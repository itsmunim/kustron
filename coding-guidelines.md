# Coding Guidelines

Rules for all contributors and coding agents working on this project.

---

## 1. Types and Interfaces

All shared TypeScript types and interfaces live under `src/types/`. No exceptions.

- Do not define types inline in implementation files.
- Export everything from `src/types/index.ts` so consumers import from a single location:
  ```ts
  import type { DeployOptions, ClusterConfig } from '../types'
  ```

---

## 2. Reuse Before You Write

Before writing new code, search the existing codebase for something that does the same or a similar thing.

- If something similar exists and is reusable as-is, use it.
- If something similar exists but is not reusable, refactor it to be reusable — then use the refactored version. Do not duplicate.
- Only write net-new code when nothing in the codebase addresses the intent.

This applies to utilities, helpers, exec wrappers, error formatters, and anything else shared across modules.

---

## 3. Unit Tests

Tests live under `tests/`, mirroring the `src/` structure:
```
tests/
├── core/
│   ├── cluster.test.ts
│   ├── build.test.ts
│   └── manifest.test.ts
└── utils/
    └── exec.test.ts
```

**Write tests only for critical flows and non-trivial code paths.** Do not write tests for:
- Simple getters or one-liner wrappers
- Thin adapters that just call a library

Do write tests for:
- Core pipeline logic (build detection, manifest generation, registry tag formatting)
- Any function with branching logic or edge cases
- Anything that has caused or could cause a silent failure

Use the project's test runner (Vitest). Mock external processes (execa calls) — never shell out in unit tests.

---

## 4. File and Folder Naming

- All file and folder names use **kebab-case**:
  ```
  src/core/build.ts          ✓
  src/utils/exec.ts          ✓
  src/commands/cluster/up.ts ✓
  src/core/buildImage.ts     ✗
  src/Utils/Exec.ts          ✗
  ```
- **Classes** use `PascalCase`: `class ClusterManager`
- **Functions and methods** use `camelCase`: `function buildImage()`, `createCluster()`
- **Constants** use `SCREAMING_SNAKE_CASE` for true module-level constants, `camelCase` for everything else
- **Interfaces and types** use `PascalCase`: `interface DeployOptions`, `type BuildStrategy`

---

## 5. User-Facing Text

All strings shown to the user — messages, prompts, labels, error text, command descriptions — live in `src/translations/en.json`. This is the single source of truth for text.

```json
{
  "cluster": {
    "up": {
      "success": "Cluster is up. kubectl context set to {{name}}.",
      "alreadyExists": "Cluster '{{name}}' already exists. Run `kustron cluster status` to inspect it."
    }
  },
  "errors": {
    "dockerNotRunning": "Docker is not running. Start Docker and try again.",
    "clusterNotFound": "No cluster found. Run `kustron cluster up` first."
  }
}
```

- Import and use these strings via a helper (e.g. `t('cluster.up.success', { name })`) — do not hardcode user-visible strings anywhere else.
- Code-internal strings (log keys, internal identifiers, error codes used programmatically) do not belong in translations.
- For now only `en.json` exists. The structure should remain translation-friendly for future locales.
