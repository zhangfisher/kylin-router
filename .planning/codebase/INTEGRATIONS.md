# External Integrations

**Analysis Date:** 2026-04-07

## APIs & External Services

**Client-side Routing:**
- History 5.3.0 - Built-in browser history API management
  - No external API calls - pure client-side routing
  - Supports hash and history modes

**Event System:**
- Mitt 3.0.1 - Lightweight event emitter
  - Internal component communication only
  - No external service integration

## Data Storage

**Databases:**
- None - Pure client-side routing library
- No external database dependencies

**File Storage:**
- Local filesystem only for component loading
- No external file storage services

**Caching:**
- Browser cache for loaded components
- No external caching services

## Authentication & Identity

**Auth Provider:**
- None - Library focuses on routing functionality only
- No authentication built-in or required

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking service integration
- Error handling through JavaScript built-in mechanisms

**Logs:**
- Console logging only
- No external logging services

## CI/CD & Deployment

**Hosting:**
- Library designed for client-side deployment
- Can be deployed to any static hosting platform (Vercel, Netlify, GitHub Pages)

**CI Pipeline:**
- Bun test for testing
- Vite build for production bundles
- No external CI service dependencies

## Environment Configuration

**Required env vars:**
- None - No external API keys or configuration required

**Secrets location:**
- No secrets needed - pure client-side functionality

## Webhooks & Callbacks

**Incoming:**
- None - No webhook endpoints or external API calls

**Outgoing:**
- None - No external API calls or service integrations

---

*Integration audit: 2026-04-07*