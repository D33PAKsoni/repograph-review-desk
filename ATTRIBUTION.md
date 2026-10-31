# Attribution

RepoGraph Review Desk is a companion application. The unrelated `feature/gemma` history includes RepoGraph core; branch integration preserves that source unchanged under `vendor/repograph/`, with its original README and Apache-2.0 license. The root application and MIT license apply to the companion code. See [branch integration](docs/BRANCH_INTEGRATION.md).

- Existing project: [INDEX0-RESEARCH-LABS/repograph](https://github.com/INDEX0-RESEARCH-LABS/repograph).
- Declared analysis baseline: `3449061d736ef72845701e0c4bf3a6ce8c916d73`.
- RepoGraph's baseline uses [Apache License 2.0](vendor/repograph/LICENSE). Its original code, name and licensing remain with their respective owners; the companion MIT license does not relicense upstream code. The vendored tree retains its original files and notices.
- Graphify is an architecture-context producer in the contract. Fixtures contain synthetic Graphify-style evidence. The analysis builder currently serializes hardcoded evidence and tool labels; merging and schema checks do not establish actual tool execution. See [analysis limitations](docs/ANALYSIS_ENGINE.md).
- Starter ownership: the supplied contracts, fixtures, validator, mock API and launcher predate Member 3's implementation. They remain unchanged. Fixture excerpts are synthetic development material.
- New Member 3 work: `web/` React/TypeScript/Vite dashboard, API integration, browser checks, root build wiring and `deployment/` operations/demo materials.
- React/React DOM, Vite, TypeScript, Playwright and axe-core retain their upstream licenses. axe-core is MPL-2.0 and used only for development accessibility verification. Dependency versions are pinned by `web/package-lock.json`; inspect package license files when redistributing dependencies. No remote fonts, imagery or executable model content are required by the UI.

The zero SHA and `example` repository in the fixture are placeholders, not a real reference-repository result. Neither synthetic evidence nor canned briefing output establishes sponsor usage or a live model demonstration.
