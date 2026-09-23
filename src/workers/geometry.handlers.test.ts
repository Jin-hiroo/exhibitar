import { MessageChannel } from 'node:worker_threads';
import { afterEach, describe, expect, it } from 'vitest';
import { cube, toBinaryStl } from '../../tests/fixtures/shapes';
import { geometryHandlers, type GeometryApi } from './geometry.handlers';
import { RpcClient, serveRpc, type RpcPort } from './rpc';

/** Wire a client and a server over a real MessageChannel (structured clone + transfer). */
function connect(handlers = geometryHandlers) {
  const { port1, port2 } = new MessageChannel();
  serveRpc<GeometryApi>(port2 as unknown as RpcPort, handlers);
  let terminated = 0;
  const client = new RpcClient<GeometryApi>(() =>
    Object.assign(port1 as unknown as RpcPort, {
      terminate: () => {
        terminated++;
        port1.close();
        port2.close();
      },
    }),
  );
  return { client, terminatedCount: () => terminated, close: () => (port1.close(), port2.close()) };
}

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

describe('geometry worker protocol', () => {
  it('loads an STL with progress and then prepares it', async () => {
    const { client, close } = connect();
    cleanup = close;
    const stages: string[] = [];
    const stl = toBinaryStl(cube());
    const loaded = await client.call(
      'load',
      { stl, sourceScale: 1 },
      { transfer: [stl], onProgress: (s) => stages.push(s) },
    );
    expect(stl.byteLength).toBe(0); // transferred, not copied
    expect(stages).toContain('parse');
    expect(loaded.stats.triangles).toBe(12);
    expect(loaded.candidates[0]!.asPrinted).toBe(true);

    const prepared = await client.call('prepare', {
      meshMm: loaded.meshMm,
      rotation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2], // −Z → −Y
    });
    expect(prepared.triangleCount).toBe(12);
    expect(prepared.glb.byteLength).toBeGreaterThan(0);
    expect(prepared.footprint.contactAreaMm2).toBeCloseTo(3600, 0);
    expect(prepared.boundsMm.size[1]).toBeCloseTo(60, 3);
    expect(prepared.objectToMat).toHaveLength(16);
  });

  it('propagates typed errors', async () => {
    const { client, close } = connect();
    cleanup = close;
    const garbage = new TextEncoder().encode('not an stl').buffer as ArrayBuffer;
    await expect(client.call('load', { stl: garbage, sourceScale: 1 })).rejects.toMatchObject({
      name: 'StlParseError',
    });
  });

  it('cancels by terminating the worker', async () => {
    const never = new Promise<never>(() => {});
    const { client, terminatedCount, close } = connect({
      ...geometryHandlers,
      load: () => never,
    });
    cleanup = close;
    const ac = new AbortController();
    const p = client.call(
      'load',
      { stl: new ArrayBuffer(0), sourceScale: 1 },
      { signal: ac.signal },
    );
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(terminatedCount()).toBe(1);
  });
});
