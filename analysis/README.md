# Analysis Engine — Evidence Generation Pipeline

The Analysis Engine extracts deterministic static evidence from codebases and bridges it into standard Graphify architecture topologies.

## Core Responsibilities

1. **Deterministic AST Indexing**: Parses Python and multi-language ASTs using Tree-sitter and SQLite to record symbol definitions, imports, calls, and references.
2. **Blast Radius Computation**: Calculates direct and transitive dependencies affected by file changes using `repograph.impact.analyze_impact()`.
3. **Graphify Bridge**: Emits architectural relationships (`graphify` nodes and links) to provide high-level contextual awareness.
4. **Bundle Generation**: Compiles validated JSON bundles matching `contracts/artifact-bundle.schema.json`.

## Quickstart

```bash
# Run bundle generation
python3 analysis/build_dataset.py

# Verify schema and evidence integrity
python3 analysis/check_dataset.py
node contracts/validate.mjs --bundle data/production/artifact-bundle.json
```
