# Deployment Guide — Cloudways by DigitalOcean

This guide covers deploying RepoGraph Review Desk to Cloudways by DigitalOcean.

## Prerequisites

1. Cloudways PHP/Custom application or Node.js application instance.
2. Node.js 20.18+, 22.12+, or 24 installed.
3. Pinned git repository linked to `https://github.com/D33PAKsoni/repograph-review-desk.git`.

## Environment Variables

Configure the following variables in the Cloudways environment or application settings:

```bash
PORT=3000
NODE_ENV=production
AI_MODE=live
GEMMA_MODEL=gemma-4-26b-a4b-it
GEMMA_API_KEY=your_gemini_api_key_here
ARTIFACT_BUNDLE=data/production/artifact-bundle.json
API_HANDLER_MODULE=service/api-handler.mjs
WEB_DIST=web/dist
```

## Build and Start

```bash
npm run build
npm start
```
