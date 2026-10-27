from __future__ import annotations

import json
from pathlib import Path

from repograph.extract import extract
from repograph.resolve import Resolver


def _files(*paths: str) -> list[tuple[str, str]]:
    out = []
    for p in paths:
        lang = "python" if p.endswith(".py") else "typescript"
        out.append((p, lang))
    return out


def test_python_relative_and_src_layout_resolution(tmp_path: Path):
    files = _files("src/pkg/__init__.py", "src/pkg/a.py", "src/pkg/sub/__init__.py",
                   "src/pkg/sub/b.py", "src/pkg/models.py")
    for rel, _ in files:
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("")
    r = Resolver(tmp_path, files)

    imp = extract("src/pkg/a.py", "python", b"from .models import Thing\nfrom . import sub\n").imports
    got = r.resolve("src/pkg/a.py", imp)
    targets = {(x.target, x.confidence) for x in got}
    assert ("src/pkg/models.py", "confirmed") in targets
    assert ("src/pkg/sub/__init__.py", "confirmed") in targets

    imp = extract("src/pkg/sub/b.py", "python", b"from .. import models\n").imports
    got = r.resolve("src/pkg/sub/b.py", imp)
    assert any(x.target == "src/pkg/models.py" for x in got)

    imp = extract("src/pkg/a.py", "python", b"from pkg.models import Thing\n").imports
    got = r.resolve("src/pkg/a.py", imp)
    assert any(x.target == "src/pkg/models.py" and x.confidence == "confirmed" for x in got)


def test_python_external_and_unresolved(tmp_path: Path):
    files = _files("pkg/__init__.py", "pkg/a.py", "pkg/broken_ref.py")
    for rel, _ in files:
        (tmp_path / rel).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / rel).write_text("")
    r = Resolver(tmp_path, files)
    imp = extract("pkg/a.py", "python", b"import json\nfrom .missing import X\nfrom pkg.unknown import Y\n").imports
    got = r.resolve("pkg/a.py", imp)
    kinds = {(x.module, x.kind) for x in got}
    assert ("json", "external") in kinds
    assert any(x.kind == "unresolved" for x in got)


def test_ts_alias_workspace_and_relative(tmp_path: Path):
    (tmp_path / "web/src/api").mkdir(parents=True)
    (tmp_path / "web/src/domain").mkdir(parents=True)
    (tmp_path / "web/tsconfig.json").write_text(json.dumps({
        "compilerOptions": {"baseUrl": ".", "paths": {"@/*": ["src/*"]}}
    }))
    (tmp_path / "web/package.json").write_text(json.dumps({"name": "@shop/web", "module": "src/index.ts"}))
    for rel in ("web/src/api/client.ts", "web/src/domain/subscription.ts", "web/src/index.ts"):
        (tmp_path / rel).write_text("")
    files = [("web/src/api/client.ts", "typescript"), ("web/src/domain/subscription.ts", "typescript"),
             ("web/src/index.ts", "typescript")]
    r = Resolver(tmp_path, files)
    imp = extract("web/src/api/client.ts", "typescript",
                  b'import { S } from "@/domain/subscription";\nimport { x } from "@shop/web";\n'
                  b'import { y } from "./missing";\n').imports
    got = {(x.module, x.target, x.confidence, x.method) for x in r.resolve("web/src/api/client.ts", imp)}
    assert ("@/domain/subscription", "web/src/domain/subscription.ts", "inferred",
            "tsconfig-path-alias") in got
    assert ("@shop/web", "web/src/index.ts", "inferred", "workspace-package") in got
    assert any(x[0] == "./missing" for x in got)


def test_ts_extensionless_index_and_external(tmp_path: Path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src/index.ts").write_text("")
    (tmp_path / "src/use.ts").write_text("")
    r = Resolver(tmp_path, [("src/index.ts", "typescript"), ("src/use.ts", "typescript")])
    imp = extract("src/use.ts", "typescript", b'import "./";\nimport "react";\n').imports
    got = {(x.module, x.target, x.kind) for x in r.resolve("src/use.ts", imp)}
    assert ("./", "src/index.ts", "internal") in got
    assert ("react", None, "external") in got
