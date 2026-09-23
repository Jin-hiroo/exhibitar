import type { IndexedMesh } from '@/lib/geometry/mesh';
import type { QuatTuple } from '@/lib/geometry/orient';
import {
  loadModel,
  prepareModel,
  type LoadedModel,
  type PreparedModel,
} from '@/lib/geometry/pipeline';
import type { RpcHandlers } from './rpc';

export type GeometryApi = {
  /** The STL buffer is transferred in and never leaves the browser. */
  load: { payload: { stl: ArrayBuffer; sourceScale: number }; result: LoadedModel };
  prepare: {
    payload: { meshMm: IndexedMesh; rotation: QuatTuple; targetTriangles?: number };
    result: PreparedModel;
  };
};

/** Pure message handlers (unit-tested in Node); the worker file only wires them up. */
export const geometryHandlers: RpcHandlers<GeometryApi> = {
  async load({ stl, sourceScale }, ctx) {
    const result = await loadModel(stl, sourceScale, ctx.progress);
    return { result, transfer: [result.meshMm.positions.buffer, result.meshMm.indices.buffer] };
  },
  async prepare({ meshMm, rotation, targetTriangles }, ctx) {
    const result = await prepareModel(meshMm, rotation, { targetTriangles }, ctx.progress);
    return {
      result,
      transfer: [
        result.glb.buffer,
        result.frozenMesh.positions.buffer,
        result.frozenMesh.indices.buffer,
      ],
    };
  },
};
