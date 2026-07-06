import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

// Ported 1:1 from the IRIS desktop app (src/renderer/src/components/Sphere.tsx).
// The desktop original reacts to a live Gemini-voice AnalyserNode. Here we accept
// an optional `analyser` prop so voice can drive it later; until then, when the
// assistant is `active` the orb gently breathes on its own so the look matches IRIS.
const CustomParticleSphere = ({ count = 3000, active = false, service = null }) => {
  const mesh = useRef(null);

  const dataArray = useMemo(() => new Uint8Array(128), []);
  const colorStart = useMemo(() => new THREE.Color('#33db12'), []);
  const colorEnd = useMemo(() => new THREE.Color('#FFFFFF'), []);
  const colorTarget = useMemo(() => new THREE.Color(), []);

  const { positions, originalPositions, spreadFactors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const orig = new Float32Array(count * 3);
    const spread = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      const z = Math.random() * 2 - 1;

      const vector = new THREE.Vector3(x, y, z);
      vector.normalize().multiplyScalar(2);

      pos[i * 3] = vector.x;
      pos[i * 3 + 1] = vector.y;
      pos[i * 3 + 2] = vector.z;

      orig[i * 3] = vector.x;
      orig[i * 3 + 1] = vector.y;
      orig[i * 3 + 2] = vector.z;

      spread[i] = Math.random();
    }
    return { positions: pos, originalPositions: orig, spreadFactors: spread };
  }, [count]);

  useFrame((state, delta) => {
    if (!mesh.current) return;

    mesh.current.rotation.y += delta * 0.05;
    mesh.current.rotation.z += delta * 0.05;

    let volume = 0;
    // Read the live voice AnalyserNode off the service each frame (it only
    // exists while a voice session is connected), so the orb pulses with speech.
    const analyser = service?.analyser || null;
    if (analyser) {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      volume = sum / dataArray.length / 128;
    } else if (active) {
      // Idle breathing when the assistant is engaged but no audio stream is wired.
      volume = (Math.sin(state.clock.elapsedTime * 1.5) * 0.5 + 0.5) * 0.22;
    }

    colorTarget.lerpColors(colorStart, colorEnd, volume);
    mesh.current.material.color.copy(colorTarget);

    const currentPos = mesh.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;
      const expansion = 1 + volume * spreadFactors[i] * 0.4;
      currentPos[ix] = originalPositions[ix] * expansion;
      currentPos[iy] = originalPositions[iy] * expansion;
      currentPos[iz] = originalPositions[iz] * expansion;
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#00F0FF"
        size={0.012}
        transparent
        opacity={0.9}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export default function IrisSphere({ active = false, service = null }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5] }}
      dpr={[1, 1.5]}
      performance={{ min: 0.5 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.6} />
      <CustomParticleSphere active={active} service={service} />
    </Canvas>
  );
}
