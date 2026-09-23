import { Document, WebIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { mmToM } from '../units';
import { scalePositions, triangleCount, type IndexedMesh } from './mesh';
import { simplifyMesh } from './simplify';

/** Audience-side budget (CLAUDE.md core idea #6). */
export const GLB_BUDGET_BYTES = 1.5 * 1024 * 1024;
export const DEFAULT_TARGET_TRIANGLES = 40_000;
const MIN_TARGET_TRIANGLES = 5_000;

/**
 * Encode a mesh (metres, model coords) as a GLB with EXT_meshopt_compression.
 * Lossless: no quantisation and no reordering, so triangle `i` in the input is
 * triangle `i` in the file (regions store these indices).
 */
export async function encodeGlb(meshM: IndexedMesh): Promise<Uint8Array> {
  await MeshoptEncoder.ready;
  const doc = new Document();
  const buffer = doc.createBuffer();
  const vertexCount = meshM.positions.length / 3;
  const position = doc
    .createAccessor('POSITION')
    .setType('VEC3')
    .setArray(new Float32Array(meshM.positions))
    .setBuffer(buffer);
  const indices = doc
    .createAccessor('indices')
    .setType('SCALAR')
    .setArray(
      vertexCount <= 0xffff ? Uint16Array.from(meshM.indices) : new Uint32Array(meshM.indices),
    )
    .setBuffer(buffer);
  const primitive = doc.createPrimitive().setAttribute('POSITION', position).setIndices(indices);
  const mesh = doc.createMesh('model').addPrimitive(primitive);
  doc.createScene('scene').addChild(doc.createNode('model').setMesh(mesh));
  doc.getRoot().getAsset().generator = 'ExhibitAR';
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const io = new WebIO()
    .registerExtensions([EXTMeshoptCompression])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  return io.writeBinary(doc);
}

/** Decode a GLB written by {@link encodeGlb} back into positions (metres) + indices. */
export async function decodeGlb(glb: Uint8Array): Promise<IndexedMesh> {
  await MeshoptDecoder.ready;
  const io = new WebIO()
    .registerExtensions([EXTMeshoptCompression])
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(glb);
  const primitive = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
  const pos = primitive?.getAttribute('POSITION')?.getArray();
  const idx = primitive?.getIndices()?.getArray();
  if (!pos || !idx) throw new Error('GLB has no indexed mesh primitive');
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx) };
}

export interface FrozenModel {
  /** the file that gets uploaded; the single source of truth after publishing */
  glb: Uint8Array;
  /** decoded from `glb` (metres, model coords); what the editor must use */
  mesh: IndexedMesh;
  triangleCount: number;
  /** simplification deviation, mm */
  errorMm: number;
}

/**
 * Simplify (mm mesh) → encode GLB (metres) → shrink until under budget →
 * decode. Everything downstream (annotation, painting, occlusion, preview)
 * uses the decoded mesh so it matches the stored file exactly.
 */
export async function freezeModel(
  meshMm: IndexedMesh,
  {
    targetTriangles = DEFAULT_TARGET_TRIANGLES,
    budgetBytes = GLB_BUDGET_BYTES,
  }: { targetTriangles?: number; budgetBytes?: number } = {},
): Promise<FrozenModel> {
  let target = targetTriangles;
  for (;;) {
    const { mesh, error } = await simplifyMesh(meshMm, target);
    // mm → m at the GLB boundary (CLAUDE.md core idea #4)
    const glb = await encodeGlb(scalePositions(mesh, mmToM(1)));
    if (glb.byteLength <= budgetBytes || target <= MIN_TARGET_TRIANGLES) {
      if (glb.byteLength > budgetBytes) {
        throw new Error(`Model does not fit the ${budgetBytes}-byte GLB budget`);
      }
      const decoded = await decodeGlb(glb);
      return { glb, mesh: decoded, triangleCount: triangleCount(decoded), errorMm: error };
    }
    target = Math.max(MIN_TARGET_TRIANGLES, Math.floor(target * 0.7));
  }
}
