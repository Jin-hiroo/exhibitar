import type { GeometryApi } from './geometry.handlers';
import { RpcClient } from './rpc';

/** Browser-only. Heavy STL work runs off the main thread. */
export function createGeometryClient(): RpcClient<GeometryApi> {
  return new RpcClient<GeometryApi>(
    () => new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' }),
  );
}
