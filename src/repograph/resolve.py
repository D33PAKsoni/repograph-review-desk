"""Static import resolution for Python, TypeScript and JavaScript.

Resolution is file-level and evidence-producing: each result records how the
target was found and how certain we are. Dynamic imports, reflection and
runtime wiring are *not* resolved; they are surfaced as blind spots instead.
"""

from __future__ import annotations

import json
import posixpath
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from .extract import Import


@dataclass
class ResolvedImport:
    raw: str
    module: str
    line: int
    target: str | None  # repo-relative path of resolved file
    confidence: str  # confirmed | inferred | unresolved
    method: str
    kind: str = "internal"  # internal | external | unresolved
    names: list[tuple[str, str]] = field(default_factory=list)
    note: str = ""


PY_EXT = ".py"
TS_EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts")
PY_STDLIB = set(sys.stdlib_module_names) | {"__future__"}


def _strip_json_comments(text: str) -> str:
    """Remove // and /* */ comments without touching string contents.

    A regex over the raw text corrupts glob patterns: ``"@vue/*"`` contains
    ``/*`` and was truncated up to the ``*/`` inside ``./packages/*/src``,
    silently discarding tsconfig path aliases.
    """
    out: list[str] = []
    i, n = 0, len(text)
    in_string = escaped = False
    while i < n:
        ch = text[i]
        if in_string:
            out.append(ch)
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "/":
            end = text.find("\n", i)
            i = n if end < 0 else end
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "*":
            end = text.find("*/", i + 2)
            i = n if end < 0 else end + 2
            continue
        out.append(ch)
        i += 1
    return re.sub(r",(\s*[}\]])", r"\1", "".join(out))


class Resolver:
    def __init__(self, root: Path, files: list[tuple[str, str]]) -> None:
        self.root = root
        self.files = {rel for rel, _ in files}
        self.lang = dict(files)
        self.py_modules: dict[str, str | None] = {}
        self.ts_configs: list[dict] = []
        self.packages: dict[str, str] = {}
        self.package_dirs: dict[str, str] = {}
        self._dirs = {str(PurePosixPath(p).parent) for p in self.files}
        self._build_python_modules()
        self._build_ts_configs()
        self._build_packages()

    # -- index construction -------------------------------------------------

    def _build_python_modules(self) -> None:
        for rel, lang in self.lang.items():
            if lang != "python":
                continue
            parts = rel.split("/")
            stem = parts[-1].rsplit(".", 1)[0]
            for alias in self._python_aliases(parts, stem):
                self.py_modules[alias] = None if alias in self.py_modules else rel
            if stem == "__init__":
                pkg = ".".join(parts[:-1])
                if pkg:
                    self.py_modules.setdefault(pkg, rel)
                # `import pkg` must bind the package, not `pkg.__init__`.
                if parts[0] in ("src", "lib", "python") and len(parts) > 2:
                    self.py_modules.setdefault(".".join(parts[1:-1]), rel)

    @staticmethod
    def _python_aliases(parts: list[str], stem: str) -> list[str]:
        aliases = []
        # Module name relative to the repository root.
        rel_mod = ".".join(parts[:-1] + [stem])
        aliases.append(rel_mod)
        # Module name relative to an `src`/`lib`/`python` source root.
        if parts and parts[0] in ("src", "lib", "python") and len(parts) > 1:
            aliases.append(".".join(parts[1:-1] + [stem]))
        # Module name relative to the top-most regular package.
        dirs = parts[:-1]
        start = None
        for i in range(len(dirs), 0, -1):
            if (Path(*dirs[:i]) / "__init__.py").is_file():
                start = i - 1
                break
        if start is not None:
            aliases.append(".".join(parts[start:-1] + [stem]))
        return list(dict.fromkeys(aliases))

    def _build_ts_configs(self) -> None:
        import os

        for dirpath, dirnames, filenames in os.walk(self.root):
            dirnames[:] = [d for d in dirnames if d not in
                           ("node_modules", ".git", ".venv", "dist", "build", "coverage")]
            rel_dir = Path(dirpath).relative_to(self.root).as_posix()
            depth = 0 if rel_dir == "." else rel_dir.count("/") + 1
            if depth > 3:
                dirnames[:] = []
                continue
            if "tsconfig.json" not in filenames:
                continue
            cfg = Path(dirpath, "tsconfig.json")
            try:
                data = json.loads(_strip_json_comments(cfg.read_text(encoding="utf-8", errors="replace")))
            except (OSError, ValueError):
                continue
            opts = data.get("compilerOptions", {})
            if not isinstance(opts, dict):
                continue
            paths = opts.get("paths", {})
            entries = []
            if isinstance(paths, dict):
                for pattern, targets in paths.items():
                    if isinstance(targets, list):
                        entries.append((pattern, [str(t) for t in targets]))
            self.ts_configs.append({
                "dir": "" if rel_dir == "." else rel_dir,
                "baseurl": str(opts.get("baseUrl", ".")),
                "paths": entries,
            })
        # Most specific config (deepest directory) wins.
        self.ts_configs.sort(key=lambda c: len(c["dir"]), reverse=True)

    def _build_packages(self) -> None:
        import os

        for dirpath, dirnames, filenames in os.walk(self.root):
            dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".git", ".venv", "dist", "build")]
            rel_dir = Path(dirpath).relative_to(self.root).as_posix()
            depth = 0 if rel_dir == "." else rel_dir.count("/") + 1
            if depth > 4:
                dirnames[:] = []
                continue
            if "package.json" not in filenames:
                continue
            pkg_json = Path(dirpath, "package.json")
            rel = pkg_json.relative_to(self.root).as_posix()
            try:
                data = json.loads(_strip_json_comments(pkg_json.read_text(encoding="utf-8", errors="replace")))
            except (OSError, ValueError):
                continue
            name = data.get("name")
            if not isinstance(name, str) or not name:
                continue
            base = posixpath.dirname(rel)
            resolved = None
            for entry in (data.get("source"), data.get("module"), data.get("main"),
                          "src/index.ts", "src/index.tsx", "index.ts", "index.js"):
                if not isinstance(entry, str):
                    continue
                cand = posixpath.normpath(posixpath.join(base, entry))
                if cand in self.files:
                    resolved = cand
                    break
            # Published entries often point at build output (``dist/...``) that
            # may not exist in a source checkout. For change impact the file
            # developers edit is ``src/index.ts``, so prefer it in that case.
            # ponytail: fixed src/index.ts candidates; add other source layouts
            # when a measured corpus needs them.
            src_entry = None
            for entry in ("src/index.ts", "src/index.tsx", "src/index.js"):
                cand = posixpath.normpath(posixpath.join(base, entry))
                if cand in self.files:
                    src_entry = cand
                    break
            published = f"{data.get('module') or ''} {data.get('main') or ''}"
            if src_entry and (resolved is None or "dist/" in published):
                resolved = src_entry
            if resolved:
                self.packages[name] = resolved
                self.package_dirs[name] = base

    # -- Python -------------------------------------------------------------

    def _py_lookup(self, dotted: str) -> tuple[str | None, str]:
        # Only exact module paths. A suffix match such as ``types`` ->
        # ``fastapi.types`` is not how Python absolute imports bind, and it
        # produced false edges to same-named repository files (stdlib
        # collisions). Source-root aliases are already registered exactly.
        target = self.py_modules.get(dotted)
        return (target, "confirmed") if target else (None, "unresolved")

    def _package_of(self, rel: str) -> list[str]:
        parts = rel.split("/")[:-1]
        return parts

    def _resolve_python(self, rel: str, imp: Import) -> list[ResolvedImport]:
        out: list[ResolvedImport] = []
        method = "python-relative-import" if imp.level else "python-absolute-import"

        def file_for_parts(parts: list[str]) -> str | None:
            base = "/".join(parts)
            if not base:
                return None
            for cand in (base + ".py", base + "/__init__.py", base + ".pyi"):
                if cand in self.files:
                    return cand
            return None

        if imp.level:
            pkg = self._package_of(rel)
            drop = imp.level - 1
            if drop > len(pkg):
                return [ResolvedImport(imp.raw, imp.module, imp.line, None, "unresolved",
                                       method, "unresolved", imp.names,
                                       "relative import escapes the repository")]
            base_parts = (pkg[:-drop] if drop else pkg) + (imp.module.split(".") if imp.module else [])
            base_target = file_for_parts(base_parts)
            base_conf = "confirmed"
        else:
            base_parts = imp.module.split(".") if imp.module else []
            base = ".".join(base_parts)
            top = base_parts[0] if base_parts else ""
            # An absolute import of a stdlib name is external unless this
            # repository defines that exact top-level module (shadowing).
            if top in PY_STDLIB and top not in self.py_modules:
                return [ResolvedImport(imp.raw, imp.module, imp.line, None, "external",
                                       method, "external", imp.names,
                                       "standard library (absolute import)")]
            base_target, base_conf = self._py_lookup(base) if base else (None, "unresolved")

        # `from pkg import submodule` where `submodule` is a module file.
        name_edges: list[ResolvedImport] = []
        resolved_names: set[str] = set()
        for imported, local in imp.names:
            if imported in ("*", ""):
                continue
            if imp.level:
                target = file_for_parts(base_parts + imported.split("."))
                conf = "confirmed"
            else:
                dotted = ".".join([*base_parts, imported])
                target, conf = self._py_lookup(dotted)
            if target:
                resolved_names.add(imported)
                if target != base_target:
                    name_edges.append(ResolvedImport(
                        imp.raw, f"{imp.module}.{imported}", imp.line, target,
                        conf, method, "internal", [(imported, local)]))

        # Emit the package `__init__` edge only when the import names the
        # package itself, or when a name is a package attribute rather than a
        # submodule (`from . import VERSION`). Otherwise `from . import mod`
        # produced a duplicate edge that labeling scored as a wrong target.
        meaningful = [n for n, _ in imp.names if n not in ("*", "")]
        if base_target and (imp.module or not meaningful
                            or any(n not in resolved_names for n in meaningful)):
            out.append(ResolvedImport(imp.raw, imp.module, imp.line, base_target, base_conf,
                                      method, "internal", imp.names))
        out.extend(name_edges)

        if out:
            return out
        top = base_parts[0] if base_parts else ""
        if not imp.level and (top in PY_STDLIB or top and not self._looks_internal(top)):
            return [ResolvedImport(imp.raw, imp.module, imp.line, None, "external", method,
                                   "external", imp.names, "third-party or standard library")]
        if not imp.level and top:
            return [ResolvedImport(imp.raw, imp.module, imp.line, None, "unresolved", method,
                                   "unresolved", imp.names,
                                   "top-level name matches repository content but module was not resolved")]
        return [ResolvedImport(imp.raw, imp.module, imp.line, None, "unresolved", method,
                               "unresolved", imp.names)]

    def _looks_internal(self, top: str) -> bool:
        if top in self._dirs or f"{top}.py" in self.files:
            return True
        return any(top in p.split("/") for p in self.files)

    # -- TypeScript / JavaScript -------------------------------------------

    def _ts_candidates(self, base: str) -> list[str]:
        base = posixpath.normpath(base)
        if base.startswith("../") or base == "..":
            return []
        cands = [base] if base in self.files else []
        if not cands:
            for ext in (*TS_EXTS, ".d.ts"):
                if base + ext in self.files:
                    cands.append(base + ext)
                    break
            if not cands:
                for ext in (*TS_EXTS, ".d.ts"):
                    idx = posixpath.normpath(posixpath.join(base, "index" + ext))
                    if idx in self.files:
                        cands.append(idx)
                        break
            if not cands and base.endswith((".js", ".jsx", ".mjs", ".cjs")):
                # ESM style: `./x.js` refers to `./x.ts` in TypeScript source.
                stem = base.rsplit(".", 1)[0]
                for ext in (".ts", ".tsx", ".mts", ".cts", ".d.ts"):
                    if stem + ext in self.files:
                        cands.append(stem + ext)
                        break
        return cands

    def _resolve_ts(self, rel: str, imp: Import) -> list[ResolvedImport]:
        spec = imp.module
        method = "typescript-relative-import"
        targets: list[str] = []

        if spec.startswith(".") or spec.startswith("/"):
            base = posixpath.join(posixpath.dirname(rel), spec) if spec.startswith(".") else spec.lstrip("/")
            targets = self._ts_candidates(base)
            if not targets:
                return [ResolvedImport(imp.raw, spec, imp.line, None, "unresolved",
                                       "typescript-relative-import", "unresolved", imp.names,
                                       "relative path not found (generated, missing, or out of index)")]
        else:
            cfg = next(
                (c for c in self.ts_configs
                 if c["dir"] == "" or rel == c["dir"] or rel.startswith(c["dir"] + "/")),
                {"dir": "", "baseurl": ".", "paths": []},
            )
            baseurl_dir = posixpath.normpath(posixpath.join(cfg["dir"], cfg["baseurl"]))
            for pattern, subs in cfg["paths"]:
                if "*" in pattern:
                    prefix, suffix = pattern.split("*", 1)
                    if spec.startswith(prefix) and spec.endswith(suffix):
                        middle = spec[len(prefix): len(spec) - len(suffix) if suffix else None]
                        for sub in subs:
                            cand = sub.replace("*", middle)
                            base = posixpath.normpath(posixpath.join(baseurl_dir, cand))
                            found = self._ts_candidates(base)
                            if found:
                                targets = found
                                method = "tsconfig-path-alias"
                                break
                elif spec == pattern:
                    for sub in subs:
                        base = posixpath.normpath(posixpath.join(baseurl_dir, sub))
                        found = self._ts_candidates(base)
                        if found:
                            targets = found
                            method = "tsconfig-path-alias"
                            break
                if targets:
                    break
            if not targets:
                if spec.startswith("@"):
                    parts = spec.split("/")
                    pkg_name = "/".join(parts[:2])
                    subpath = "/".join(parts[2:])
                else:
                    parts = spec.split("/")
                    pkg_name = parts[0]
                    subpath = "/".join(parts[1:])
                pkg_dir = self.package_dirs.get(pkg_name)
                if pkg_dir and subpath:
                    for probe in (posixpath.join(pkg_dir, subpath),
                                  posixpath.join(pkg_dir, "src", subpath)):
                        found = self._ts_candidates(posixpath.normpath(probe))
                        if found:
                            targets = found
                            method = "workspace-package"
                            break
                elif self.packages.get(pkg_name):
                    targets = [self.packages[pkg_name]]
                    method = "workspace-package"
            if not targets:
                return [ResolvedImport(imp.raw, spec, imp.line, None, "external",
                                       "bare-specifier", "external", imp.names,
                                       "third-party package or Node builtin")]

        conf = "confirmed" if method == "typescript-relative-import" else "inferred"
        return [ResolvedImport(imp.raw, spec, imp.line, targets[0], conf, method,
                               "internal", imp.names)]

    # -- public -------------------------------------------------------------

    def resolve(self, rel: str, imports: list[Import]) -> list[ResolvedImport]:
        lang = self.lang.get(rel, "")
        out: list[ResolvedImport] = []
        for imp in imports:
            if imp.kind == "dynamic":
                if not imp.module:
                    out.append(ResolvedImport(imp.raw, "", imp.line, None, "unresolved",
                                              "dynamic-import", "dynamic", imp.names,
                                              "dynamic import target is not a string literal"))
                    continue
                if lang == "python":
                    sub = self._resolve_python(rel, imp)
                elif lang in ("typescript", "tsx", "javascript", "jsx"):
                    sub = self._resolve_ts(rel, imp)
                else:
                    sub = []
                for r in sub:
                    r.kind = "dynamic"
                    r.method = "dynamic-import"
                    r.note = "dynamic import; target may change at runtime"
                    r.confidence = "inferred" if r.target else "unresolved"
                out.extend(sub)
                continue
            if lang == "python":
                out.extend(self._resolve_python(rel, imp))
            elif lang in ("typescript", "tsx", "javascript", "jsx"):
                out.extend(self._resolve_ts(rel, imp))
        # Deduplicate by (target, line, module); keep the strongest confidence.
        rank = {"confirmed": 0, "inferred": 1, "external": 2, "unresolved": 3}
        best: dict[tuple, ResolvedImport] = {}
        for r in out:
            key = (r.target, r.line, r.module)
            if key not in best or rank[r.confidence] < rank[best[key].confidence]:
                best[key] = r
        return list(best.values())
