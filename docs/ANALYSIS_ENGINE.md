# Analysis Engine Documentation

The Analysis Engine parses codebases deterministically and outputs standard impact and architecture topology artifacts.

## Components

- `analysis/build_dataset.py`: Main executable script for running AST analysis, indexing, and generating the production bundle `data/production/artifact-bundle.json`.
- `analysis/check_dataset.py`: Comprehensive test and validation suite for evidence integrity, ID uniqueness, and source range correctness.
- `analysis/requirements.txt`: Python package requirements, including `repograph-codeintel` and `graphifyy`.

## Workflow

1. **Repository Indexing**:
   ```bash
   python3 analysis/build_dataset.py
   ```
2. **Schema & Integrity Verification**:
   ```bash
   python3 analysis/check_dataset.py
   node contracts/validate.mjs --bundle data/production/artifact-bundle.json
   ```
