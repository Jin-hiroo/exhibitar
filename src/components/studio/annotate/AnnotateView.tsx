'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Float32BufferAttribute, Matrix4, Raycaster, type Mesh } from 'three';
import { anchorFromHit, enableFastRaycast } from '@/lib/annotations/picking';
import { ExhibitScene } from '@/lib/ar/exhibit-scene';
import type { Project, Vec3 } from '@/lib/types';
import { mmToM } from '@/lib/units';
import { FrontArrow } from '../FrontArrow';

export type Tool = 'select' | 'point' | 'paint';

interface Props {
  project: Project;
  geometry: BufferGeometry;
  tool: Tool;
  selected: string | null;
  /** triangles being painted right now (shown live) */
  paintTriangles: readonly number[];
  onPick(anchor: { position: Vec3; normal: Vec3 }): void;
  onPaint(point: Vec3, phase: 'start' | 'move' | 'end'): void;
  onSelect(id: string | null): void;
}

/** C1/C2 editing view: the stored mesh on a virtual mat with the Viewer's labels. */
export function AnnotateView(props: Props) {
  const size = props.project.model.boundsMm.size.map(mmToM) as [number, number, number];
  const r = Math.max(0.08, Math.hypot(...size));
  // render on demand: the controls and React updates invalidate; nothing animates on its own
  return (
    <Canvas
      frameloop="demand"
      camera={{ position: [r * 0.6, r * 0.9, r * 1.7], fov: 40, near: 0.002, far: 20 }}
    >
      <color attach="background" args={['#eef0f3']} />
      <hemisphereLight args={['#ffffff', '#8899aa', 1.3]} />
      <directionalLight position={[0.3, 1, 0.6]} intensity={1.3} />
      <Scene {...props} />
      <gridHelper
        args={[Math.max(0.3, r * 3), Math.round(Math.max(0.3, r * 3) * 100), '#b8bec8', '#d8dce2']}
      />
      <FrontArrow distance={Math.max(size[0], size[2]) / 2 + 0.03} />
      <OrbitControls
        makeDefault
        enabled={props.tool !== 'paint'}
        target={[0, size[1] / 2, 0]}
        maxPolarAngle={Math.PI / 2 - 0.02}
      />
    </Canvas>
  );
}

function Scene({
  project,
  geometry,
  tool,
  selected,
  paintTriangles,
  onPick,
  onPaint,
  onSelect,
}: Props) {
  const meshRef = useRef<Mesh>(null);
  const painting = useRef(false);
  const objectToMat = useMemo(
    () => new Matrix4().fromArray(project.objectToMat),
    [project.objectToMat],
  );

  // BVH for fast picking/painting
  useEffect(() => {
    const mesh = meshRef.current;
    return mesh ? enableFastRaycast(mesh) : undefined;
  }, [geometry]);

  // the Viewer's own label renderer, so the Studio shows exactly what visitors see
  const exhibit = useMemo(
    () => new ExhibitScene({ ...project, calibration: ZERO }, geometry.clone()),
    [project, geometry],
  );
  useEffect(() => () => exhibit.dispose(), [exhibit]);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    exhibit.select(selected); // redraws label textures outside React
    invalidate();
  }, [exhibit, selected, invalidate]);
  useFrame(({ camera }) => exhibit.update(camera));

  const paintGeometry = useMemo(() => {
    const pos = geometry.getAttribute('position');
    const index = geometry.getIndex();
    const out = new Float32Array(paintTriangles.length * 9);
    paintTriangles.forEach((t, i) => {
      for (let k = 0; k < 3; k++) {
        const v = index ? index.getX(t * 3 + k) : t * 3 + k;
        out.set([pos.getX(v), pos.getY(v), pos.getZ(v)], i * 9 + k * 3);
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(out, 3));
    return g;
  }, [geometry, paintTriangles]);

  const modelPoint = (e: ThreeEvent<PointerEvent>): Vec3 => {
    const p = meshRef.current!.worldToLocal(e.point.clone());
    return [p.x, p.y, p.z];
  };

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (tool === 'paint') {
      e.stopPropagation();
      painting.current = true;
      onPaint(modelPoint(e), 'start');
    }
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (tool === 'paint' && painting.current) onPaint(modelPoint(e), 'move');
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (tool === 'paint' && painting.current) {
      painting.current = false;
      onPaint(modelPoint(e), 'end');
    }
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // a drag, not a click
    if (tool === 'point' && meshRef.current) {
      const a = anchorFromHit(meshRef.current, e);
      if (a) onPick(a);
      return;
    }
    if (tool === 'select') {
      const rc = new Raycaster();
      rc.ray.copy(e.ray);
      rc.camera = e.camera;
      onSelect(exhibit.pick(rc));
    }
  };

  return (
    <>
      <primitive object={exhibit.root} />
      <group matrixAutoUpdate={false} matrix={objectToMat}>
        <mesh
          ref={meshRef}
          geometry={geometry}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onClick={onClick}
        >
          <meshStandardMaterial color="#c9d4e6" roughness={0.7} flatShading />
        </mesh>
        {paintTriangles.length > 0 && (
          <mesh geometry={paintGeometry} renderOrder={2}>
            <meshBasicMaterial
              color="#ffc400"
              transparent
              opacity={0.7}
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        )}
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.0004, 0]}>
        <planeGeometry args={[mmToM(project.mat.sizeMm[0]), mmToM(project.mat.sizeMm[1])]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </>
  );
}

const ZERO = { dxMm: 0, dyMm: 0, dzMm: 0, yawDeg: 0 };
