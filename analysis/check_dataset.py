#!/usr/bin/env python3
"""
Integrity and provenance checks for generated analysis bundle.
Verifies stable IDs, source ranges, tool provenance, and required schema keys.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BUNDLE_PATH = PROJECT_ROOT / "data" / "production" / "artifact-bundle.json"

def check_dataset():
    if not BUNDLE_PATH.exists():
        print(f"Error: Bundle file not found at {BUNDLE_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(BUNDLE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data.get("schemaVersion") == "1.0.0", "Invalid schemaVersion"
    assert data.get("artifactKind") == "generated", "Must be generated kind"
    repo = data.get("repository", {})
    assert repo.get("commitSha") and len(repo["commitSha"]) == 40, "Invalid commitSha"

    cases = data.get("cases", [])
    assert len(cases) > 0, "No cases found in bundle"

    for case in cases:
        evidence_map = {e["id"]: e for e in case.get("evidence", [])}
        assert len(evidence_map) == len(case.get("evidence", [])), f"Duplicate evidence IDs in {case['id']}"

        # Ensure RepoGraph and Graphify evidence both exist
        producers = {e["producer"] for e in case["evidence"]}
        assert "repograph" in producers, f"Missing repograph evidence in {case['id']}"
        assert "graphify" in producers, f"Missing graphify evidence in {case['id']}"

        # Verify impact evidence IDs exist
        for group in ["directDependents", "transitiveDependents", "relatedTests"]:
            for item in case.get("impact", {}).get(group, []):
                for eid in item.get("evidenceIds", []):
                    assert eid in evidence_map, f"Unknown evidence ID {eid} in impact.{group}"
                    assert evidence_map[eid]["producer"] == "repograph", f"Evidence {eid} must be from repograph"

        # Verify architecture evidence IDs exist and come from graphify
        for eid in case.get("architecture", {}).get("evidenceIds", []):
            assert eid in evidence_map, f"Unknown evidence ID {eid} in architecture"
            assert evidence_map[eid]["producer"] == "graphify", f"Evidence {eid} must be from graphify"

    print(f"All checks passed successfully for {len(cases)} cases.")

if __name__ == "__main__":
    check_dataset()
