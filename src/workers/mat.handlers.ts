import { generateMat, type GeneratedMat, type MatInput } from '@/lib/mat/generate';
import type { RpcHandlers } from './rpc';

export type MatApi = {
  generate: { payload: MatInput; result: GeneratedMat };
};

export const matHandlers: RpcHandlers<MatApi> = {
  async generate(input, ctx) {
    ctx.progress('mat', 0);
    const result = generateMat(input);
    ctx.progress('mat', 1);
    return {
      result,
      transfer: [
        result.pdf.buffer,
        result.qrPng.buffer,
        ...result.markerPngs.map((m) => m.png.buffer),
      ],
    };
  },
};
