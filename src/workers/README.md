# src/workers — WS-A / WS-B

Web Worker entrypoints that wrap pure functions from `src/lib/geometry` and
`src/lib/mat`. Workers only translate messages; all logic lives in `src/lib/**`
so it is unit-testable in Node.

- `rpc.ts` — typed request / progress / result protocol; cancel = terminate + respawn
- `geometry.worker.ts`, `mat.worker.ts`

The STL `ArrayBuffer` is transferred into the worker and never leaves the browser.
