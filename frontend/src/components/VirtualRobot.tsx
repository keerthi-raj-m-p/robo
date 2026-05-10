'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { useRobotStore } from '@/store/useRobotStore';

// Materials defined outside to prevent recreation on every render
const baseMaterial = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.2, metalness: 0.8 });
const jointMaterial = new THREE.MeshStandardMaterial({ color: '#00ff88', roughness: 0.4, metalness: 0.5 });
const linkMaterial = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.3, metalness: 0.7 });

function RobotArm() {
  const { jointAngles } = useRobotStore();
  
  // Refs for animation
  const j1Ref = useRef<THREE.Group>(null);
  const j2Ref = useRef<THREE.Group>(null);
  const j3Ref = useRef<THREE.Group>(null);
  const j4Ref = useRef<THREE.Group>(null);
  const j5Ref = useRef<THREE.Group>(null);
  const gripperLeftRef = useRef<THREE.Mesh>(null);
  const gripperRightRef = useRef<THREE.Mesh>(null);

  // Constants
  const toRad = Math.PI / 180;

  useFrame((state, delta) => {
    // Smoothly interpolate to target angles based on telemetry
    const speed = 8;
    if (j1Ref.current) j1Ref.current.rotation.y = THREE.MathUtils.damp(j1Ref.current.rotation.y, (jointAngles[0] - 90) * toRad, speed, delta);
    // Shoulder usually pitches around X or Z. Let's assume X for our model.
    if (j2Ref.current) j2Ref.current.rotation.x = THREE.MathUtils.damp(j2Ref.current.rotation.x, (jointAngles[1] - 90) * toRad, speed, delta);
    if (j3Ref.current) j3Ref.current.rotation.x = THREE.MathUtils.damp(j3Ref.current.rotation.x, (jointAngles[2] - 90) * toRad, speed, delta);
    if (j4Ref.current) j4Ref.current.rotation.y = THREE.MathUtils.damp(j4Ref.current.rotation.y, (jointAngles[3] - 90) * toRad, speed, delta);
    if (j5Ref.current) j5Ref.current.rotation.x = THREE.MathUtils.damp(j5Ref.current.rotation.x, (jointAngles[4] - 90) * toRad, speed, delta);
    
    // Gripper (0 = close, 90 = open). Translate on X axis.
    const gripAmount = THREE.MathUtils.mapLinear(jointAngles[5], 0, 90, 0.1, 0.35);
    if (gripperLeftRef.current) gripperLeftRef.current.position.x = THREE.MathUtils.damp(gripperLeftRef.current.position.x, -gripAmount, speed, delta);
    if (gripperRightRef.current) gripperRightRef.current.position.x = THREE.MathUtils.damp(gripperRightRef.current.position.x, gripAmount, speed, delta);
  });

  return (
    <group position={[0, -2, 0]}>
      {/* Base */}
      <mesh material={baseMaterial} position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.8, 0.5, 32]} />
      </mesh>

      {/* Joint 1 (Yaw) */}
      <group ref={j1Ref} position={[0, 0.5, 0]}>
        <mesh material={jointMaterial} position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.8, 1.2, 0.8, 32]} />
        </mesh>
        
        {/* Joint 2 (Shoulder Pitch) */}
        <group ref={j2Ref} position={[0, 0.8, 0]}>
          <mesh material={jointMaterial} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 1.4, 16]} />
          </mesh>
          {/* Upper Arm Link */}
          <mesh material={linkMaterial} position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[0.6, 3, 0.6]} />
          </mesh>

          {/* Joint 3 (Elbow Pitch) */}
          <group ref={j3Ref} position={[0, 3, 0]}>
            <mesh material={jointMaterial} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.4, 0.4, 1.2, 16]} />
            </mesh>
            {/* Forearm Link */}
            <mesh material={linkMaterial} position={[0, 1.25, 0]} castShadow>
              <boxGeometry args={[0.5, 2.5, 0.5]} />
            </mesh>

            {/* Joint 4 (Wrist Roll) */}
            <group ref={j4Ref} position={[0, 2.5, 0]}>
              <mesh material={jointMaterial} position={[0, 0.25, 0]} castShadow>
                <cylinderGeometry args={[0.3, 0.3, 0.5, 16]} />
              </mesh>

              {/* Joint 5 (Wrist Pitch) */}
              <group ref={j5Ref} position={[0, 0.5, 0]}>
                <mesh material={jointMaterial} rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[0.25, 0.25, 0.8, 16]} />
                </mesh>
                
                {/* Gripper Base */}
                <mesh material={linkMaterial} position={[0, 0.3, 0]} castShadow>
                  <boxGeometry args={[0.8, 0.2, 0.4]} />
                </mesh>

                {/* Gripper Fingers (Joint 6) */}
                <group position={[0, 0.4, 0]}>
                  <mesh ref={gripperLeftRef} material={baseMaterial} position={[-0.2, 0.4, 0]} castShadow>
                    <boxGeometry args={[0.1, 0.8, 0.3]} />
                  </mesh>
                  <mesh ref={gripperRightRef} material={baseMaterial} position={[0.2, 0.4, 0]} castShadow>
                    <boxGeometry args={[0.1, 0.8, 0.3]} />
                  </mesh>
                </group>

              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function VirtualRobot() {
  return (
    <div className="w-full h-full relative bg-transparent rounded-lg overflow-hidden border border-[var(--color-robo-border)]">
      <Canvas shadows camera={{ position: [8, 6, 8], fov: 40 }}>
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 15, 10]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <pointLight position={[-10, 5, -10]} intensity={0.8} color="#00ff88" />
        
        <RobotArm />
        
        <Environment preset="city" />
        
        {/* Ground shadow and grid for that high-tech look */}
        <ContactShadows position={[0, -2, 0]} opacity={0.6} scale={15} blur={2.5} far={4} color="#000000" />
        <Grid 
          position={[0, -2.01, 0]}
          args={[20, 20]} 
          cellSize={1} 
          cellThickness={1} 
          cellColor="#333" 
          sectionSize={5} 
          sectionThickness={1.5} 
          sectionColor="#00ff88" 
          fadeDistance={30} 
        />
        
        <OrbitControls 
          enablePan={false}
          maxPolarAngle={Math.PI / 2 - 0.05} // don't allow camera below ground
          minDistance={5}
          maxDistance={20}
          autoRotate={false}
        />
      </Canvas>
      <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-[10px] text-[var(--color-robo-green)] font-semibold border border-[var(--color-robo-border)]">
        LIVE 3D PREVIEW
      </div>
    </div>
  );
}
