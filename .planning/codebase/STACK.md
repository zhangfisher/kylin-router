# Technology Stack

**Analysis Date:** 2026-04-07

## Languages

**Primary:**
- TypeScript 6.0.2 - Core language for all application code
- ES2021 - Target runtime compatibility

## Runtime

**Environment:**
- Browser runtime (ES2021 + modern browsers)
- Bun 1.3.11 - Package manager and runtime for tests
- Node.js 25.5.2 - Type definitions and compatibility

**Package Manager:**
- Bun 1.3.11 - Primary package manager
- Lockfile: No package-lock.json or bun.lockb detected

## Frameworks

**Core:**
- Lit 3.3.2 - Web Components framework for building custom elements
- History 5.3.0 - Client-side routing history management

**Testing:**
- Happy DOM 20.8.9 - DOM implementation for testing
- Bun test - Test runner

**Build/Dev:**
- Vite 8.0.1 - Build tool and development server
- TypeScript compiler - Type checking and compilation

## Key Dependencies

**Critical:**
- @lit/context 1.1.6 - Context management for Lit components
- history 5.3.0 - Client-side routing
- lit 3.3.2 - Web Components framework
- mitt 3.0.1 - Event emitter for component communication
- ts-mixer 6.0.4 - Class mixin utility for multiple inheritance

**Infrastructure:**
- TypeScript 6.0.2 - Type safety and compilation
- @types/bun 1.3.11 - Bun type definitions
- @types/node 25.5.2 - Node.js type definitions

## Configuration

**Environment:**
- TypeScript configuration in `tsconfig.json`
- Strict mode enabled with comprehensive linting rules
- Path aliases: `@/*` mapped to `./src/*`

**Build:**
- Vite configuration in `vite.config.ts`
- Development server on port 5173
- Build output to `../dist`
- Support for HMR (Hot Module Replacement)

## Platform Requirements

**Development:**
- Node.js >= 18.0.0
- Bun (recommended) or npm/yarn/pnpm
- Modern browsers supporting ES2021

**Production:**
- Modern browsers (Chrome, Firefox, Edge, Safari latest versions)
- No external runtime dependencies

---

*Stack analysis: 2026-04-07*