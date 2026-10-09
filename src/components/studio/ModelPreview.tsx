'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import type { IndexedMesh } from '@/lib/geometry/mesh';
import { applyOrientation, type QuatTuple } from '@/lib/geometry/orient';
import { mmToM } from '@/lib/units';
import { FrontArrow } from './FrontArrow';

/**
 * Orientation preview: the (decimated) model as it will stand on the mat —
 * rotated, dropped to the table and centred on its contact footprint.
 */
export function ModelPreview({ mesh, rotation }: { mesh: IndexedMesh; rotation: QuatTuple }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
    g.setIndex(new BufferAttribute(new Uint32Array(mesh.indices), 1));
    g.scale(mmToM(1), mmToM(1), mmToM(1)); // mm → m at the three.js boundary
    g.computeVertexNormals();
    return g;
  }, [mesh]);

  const { matrix, size } = useMemo(() => {
    const o = applyOrientation(mesh, rotation);
    const b = { max: [-Infinity, -Infinity, -Infinity], min: [Infinity, Infinity, Infinity] };
    const p = o.oriented.positions;
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        b.min[k] = Math.min(b.min[k]!, p[i + k]!);
        b.max[k] = Math.max(b.max[k]!, p[i + k]!);
      }
    }
    return {
      matrix: new Matrix4().fromArray(o.objectToMat),
      size: b.max.map((v, k) => mmToM(v - b.min[k]!)) as [number, number, number],
    };
  }, [mesh, rotation]);

  const r = Math.max(0.08, Math.hypot(...size));
  return (
    <Canvas
      frameloop="demand"
      camera={{ position: [r * 0.7, r * 0.9, r * 1.6], fov: 40, near: 0.002, far: 20 }}
    >
      <color attach="background" args={['#eef0f3']} />
      <hemisphereLight args={['#ffffff', '#8899aa', 1.4]} />
      <directionalLight position={[0.3, 1, 0.6]} intensity={1.4} />
      <group matrixAutoUpdate={false} matrix={matrix}>
        <mesh geometry={geometry}>
          <meshStandardMaterial color="#6aa8ff" roughness={0.6} flatShading />
        </mesh>
      </group>
      <gridHelper
        args={[Math.max(0.3, r * 3), Math.round(Math.max(0.3, r * 3) * 100), '#b8bec8', '#d8dce2']}
      />
      <FrontArrow distance={Math.max(size[0], size[2]) / 2 + 0.03} />
      <OrbitControls makeDefault target={[0, size[1] / 2, 0]} maxPolarAngle={Math.PI / 2 - 0.02} />
    </Canvas>
  );
}
