# Architecture

**Analysis Date:** 2026-04-07

## Pattern Overview

**Overall:** Mixin-based Web Components Router with Context Propagation

**Key Characteristics:**
- LitElement-based Web Components using customElement decorators
- Mixin pattern for feature composition (Context, Hooks, ComponentLoader, KeepAlive, Transition, Preload)
- Context-based dependency injection for router instance propagation
- History API integration for client-side routing
- Light DOM approach for better style and event penetration

## Layers

**Core Router Layer:**
- Purpose: Central router orchestrator and history management
- Location: `src/router.ts`
- Contains: `KylinRouter` class, navigation methods (push, replace, back, forward), cleanup management
- Depends on: history library, Mixin pattern, TypeScript strict mode
- Used by: Host elements, outlet components

**Base Components Layer:**
- Purpose: Common base class and shared functionality
- Location: `src/components/base/index.ts`
- Contains: `KylinRouterElementBase` class, context injection mechanism, light DOM rendering
- Depends on: LitElement, custom context events
- Used by: All router-aware components (link, outlet, loading)

**Feature Layer:**
- Purpose: Cross-cutting concerns and advanced routing features
- Location: `src/features/`
- Contains: Feature classes as mixins (Context, Hooks, ComponentLoader, KeepAlive, Transition, Preload)
- Depends on: Core router, TypeScript utilities (ts-mixer)
- Used by: KylinRouter through Mixin composition

**Component Layer:**
- Purpose: UI components for routing interface
- Location: `src/components/`
- Contains: `kylin-link`, `kylin-outlet`, `kylin-loading` components
- Depends on: Base component class, LitElement decorators
- Used by: Application developers in templates

**Utility Layer:**
- Purpose: Helper functions and utilities
- Location: `src/utils/`
- Contains: Path manipulation, outlet traversal utilities
- Depends on: TypeScript type system
- Used by: Router components and features

## Data Flow

**Router Initialization Flow:**

1. `KylinRouter` constructor with host element and options
2. Attach context provider to host element
3. Initialize history instance (browser or hash)
4. Set up cleanup array for unsubscribe functions
5. Router instance stored on host element via `data-kylin-router` attribute

**Component Context Acquisition:**

1. Component extends `KylinRouterElementBase`
2. `connectedCallback()` triggers context request
3. Sync lookup: Traverse DOM for router instance
4. Async fallback: Dispatch `context-request` event
5. Router responds via callback, component gets router instance

**Navigation Flow:**

1. User clicks `kylin-link` or calls navigation method
2. History change triggers `onRouteUpdate`
3. Router features process route changes (hooks, loading, transitions)
4. `kylin-outlet` renders appropriate component
5. Context updated for all child components

**State Management:**
- Router instance propagated via context events
- Component state managed by LitElement reactive properties
- Route state managed by history API and internal router properties

## Key Abstractions

**KylinRouterElementBase:**
- Purpose: Base class providing router instance access
- Examples: `[src/components/base/index.ts]`
- Pattern: Context injection with fallback mechanisms

**KylinRouter:**
- Purpose: Main router orchestrator with mixin composition
- Examples: `[src/router.ts]`
- Pattern: Mixin pattern for feature composition

**KylinOutlet:**
- Purpose: Route rendering container with caching
- Examples: `[src/components/outlet/index.ts]`
- Pattern: Slot-based rendering with dynamic component loading

**Context Provider/Consumer:**
- Purpose: Dependency injection without prop drilling
- Examples: `[src/features/context.ts]`
- Pattern: Event-based context propagation

## Entry Points

**Main Entry Point:**
- Location: `src/index.ts`
- Triggers: Component registration and type exports
- Responsibilities: Import and re-export all components and utilities

**Router Entry Point:**
- Location: `src/router.ts`
- Triggers: Router instantiation and configuration
- Responsibilities: Router class definition, navigation methods, feature mixing

**Application Entry Point:**
- Location: `example/public/app/index.html`
- Triggers: Application initialization
- Responsibilities: Template structure with router components

## Error Handling

**Strategy:** Try-catch with error boundaries in component lifecycle

**Patterns:**
- Component lifecycle error handling in `connectedCallback`
- History listener cleanup in `disconnectCallback`
- Type-safe error handling with TypeScript strict mode

## Cross-Cutting Concerns

**Logging:** Console logging for development debugging
**Validation:** TypeScript strict type checking for all public APIs
**Authentication:** Role-based routing support in route configuration
**Performance:** Component caching and lazy loading patterns

---

*Architecture analysis: 2026-04-07*