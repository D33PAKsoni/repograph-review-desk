# Prepared analysis bundle

`analysis/build_dataset.py` serializes the fixed `CASES` and `REPO_META` constants to `data/production/artifact-bundle.json`. It does not invoke RepoGraph, Graphify, Tree-sitter, or a repository indexer. The supplied bundle declares `artifactKind: generated`; that declaration and its tool-version fields have not been independently established by captured tool output.

```sh
python analysis/build_dataset.py
python analysis/check_dataset.py
node contracts/validate.mjs --bundle data/production/artifact-bundle.json
```

The builder updates the timestamp when run. The Python checker checks basic metadata, unique evidence IDs, and reference/producer consistency. The shared Node validator checks the contract. Neither checks source contents at the cited commit or proves execution of an analysis tool. Treat source ranges and producer labels as supplied scenario metadata until independently verified.

Upstream RepoGraph source is preserved under `vendor/repograph/`, including its original installation instructions and license. A reproducible pipeline that derives these artifacts from actual RepoGraph and Graphify outputs remains separate work.
