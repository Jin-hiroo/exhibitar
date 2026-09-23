import type { MatApi } from './mat.handlers';
import { RpcClient } from './rpc';

/** Browser-only. Marker generation, layout and SVG/PDF rendering run off the main thread. */
export function createMatClient(): RpcClient<MatApi> {
  return new RpcClient<MatApi>(
    () => new Worker(new URL('./mat.worker.ts', import.meta.url), { type: 'module' }),
  );
}
