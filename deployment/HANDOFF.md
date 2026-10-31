# Deployment & Integration Architecture

This document outlines the delivery and deployment pipeline for the RepoGraph Review Desk application.

## Repository Setup

- **Source Code**: [D33PAKsoni/repograph-review-desk](https://github.com/D33PAKsoni/repograph-review-desk)
- **Analysis Baseline**: Pinned repository [D33PAKsoni/repograph](https://github.com/D33PAKsoni/repograph) at commit `3449061d736ef72845701e0c4bf3a6ce8c916d73`.

## Deployment Artifacts

The deployment bundle consists of:
- `web/`: Pre-compiled React/TypeScript application in `web/dist/`
- `service/`: Node.js API handler connecting to Gemma 4 via Google Gemini API
- `data/production/`: Verified artifact bundle with AST impact and Graphify architecture evidence
- `bootstrap/server.mjs`: High-performance native HTTP server serving static frontend and API endpoints

## Verification Commands

```bash
npm run build
npm test
npm run check:ready
npm run check:production
npm start
```
