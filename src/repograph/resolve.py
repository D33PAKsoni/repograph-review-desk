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
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"(^|\s)//.*?$", r"\1", text, flags=re.M)
    return re.sub(r",(\s*[}\]])", r"\1", text)


class Resolver:
    def __init__(self, root: Path, files: list[tuple[str, str]]) -> None:
        self.root = root
        self.files = {rel for rel, _ in files}
        self.lang = dict(files)
        self.py_modules: dict[str, str | None] = {}
        self.ts_configs: list[dict] = []
        self.packages: dict[str, str] = {}
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
            for entry in (data.get("source"), data.get("module"), data.get("main"), "src/index.ts", "index.ts"):
                if not isinstance(entry, str):
                    continue
                cand = posixpath.normpath(posixpath.join(base, entry))
                if cand in self.files:
                    self.packages[name] = cand
                    break

    # -- Python -------------------------------------------------------------

    def _py_lookup(self, dotted: str) -> tuple[str | None, str]:
        if dotted in self.py_modules:
            target = self.py_modules[dotted]
            return (target, "confirmed") if target else (None, "unresolved")
        suffix = "." + dotted
        matches = {v for k, v in self.py_modules.items() if k.endswith(suffix) and v}
        if len(matches) == 1:
            return matches.pop(), "inferred"
        return None, "unresolved"

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
            base_target, base_conf = self._py_lookup(base) if base else (None, "unresolved")

        if base_target:
            out.append(ResolvedImport(imp.raw, imp.module, imp.line, base_target, base_conf,
                                      method, "internal", imp.names))

        # `from pkg import submodule` where `submodule` is a module file.
        for imported, local in imp.names:
            if imported in ("*", ""):
                continue
            if imp.level:
                target = file_for_parts(base_parts + imported.split("."))
                conf = "confirmed"
            else:
                dotted = ".".join([*base_parts, imported])
                target, conf = self._py_lookup(dotted)
            if target and target != base_target:
                out.append(ResolvedImport(imp.raw, f"{imp.module}.{imported}", imp.line, target,
                                          conf, method, "internal", [(imported, local)]))

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
            for ext in TS_EXTS:
                if base + ext in self.files:
                    cands.append(base + ext)
                    break
            if not cands:
                for ext in TS_EXTS:
                    idx = posixpath.join(base, "index" + ext)
                    if idx in self.files:
                        cands.append(idx)
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
                pkg = self.packages.get(spec) or self.packages.get(spec.split("/")[0])
                if pkg:
                    targets = [pkg]
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
