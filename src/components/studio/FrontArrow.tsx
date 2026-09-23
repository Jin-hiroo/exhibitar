'use client';

import { useMemo } from 'react';
import { Shape, ShapeGeometry } from 'three';

/** A flat arrow on the table pointing to mat +Z (FRONT, toward the visitor). */
export function FrontArrow({ distance }: { distance: number }) {
  const geometry = useMemo(() => {
    const s = new Shape();
    s.moveTo(-0.006, 0);
    s.lineTo(0.006, 0);
    s.lineTo(0.006, 0.012);
    s.lineTo(0.014, 0.012);
    s.lineTo(0, 0.028);
    s.lineTo(-0.014, 0.012);
    s.lineTo(-0.006, 0.012);
    s.closePath();
    // shape is in XY pointing +Y; lay it flat pointing +Z
    return new ShapeGeometry(s).rotateX(Math.PI / 2);
  }, []);
  return (
    <mesh geometry={geometry} position={[0, 0.0005, distance]}>
      <meshBasicMaterial color="#111" side={2} />
    </mesh>
  );
}
