# Notes

## Learner
- Owns the repo (commits as `michaeltjoee`); the extension was built quickly and they now want to understand it from the code outward.
- Asked for: how the repo works, what the entrypoint is, and the code mechanism behind each feature.

## Preferences
- Ground everything in this repo's real files with `file:line` pointers.

## Planned path (revise as learning records come in)
1. **The manifest is the entrypoint**: five entrypoints, four worlds; trace the badge. ← lesson 0001
2. **Reaching into the page**: `readPage.toString()` → `inspectedWindow.eval` (panel) vs `scripting.executeScript({ func, world: "MAIN" })` (popup); why it must be self-contained; `NextDataResult` as the contract.
3. **Keyboard shortcuts**: `commands` → background `setPopup(?tab=)` → `openPopup` → popup reads `?tab`; second listener when already open.
4. **API Fetch, part 1**: monkey-patching `fetch` / XHR at `document_start` into `window.__MS_GATEWAY__`.
5. **API Fetch, part 2**: merging with resource timing (unrecorded calls), ignored paths, stamps + 1s polling.
6. **dataLayer**: `toJson` replacer (DOM nodes, cycles, gtag `arguments`), grouping by event, Clear via non-enumerable `__clearedAt`.
7. **Version tab**: asset URL regex, `assetPrefix` → primary bundle, shared-components.
8. **Rendering**: `inspector.renderBody` dispatch, `json-tree` lazy `<details>`, filter, path copy, row reuse across re-renders.
9. **Build & types**: `tsc` → `dist/`, `copy-static`, why `global.d.ts` is ambient.
- Interleave retrieval questions from earlier lessons into later quizzes.

## Glossary
- Not created yet: add terms (world, isolated world, MAIN world, entrypoint, extension page, stamp) once the learner uses them correctly.
