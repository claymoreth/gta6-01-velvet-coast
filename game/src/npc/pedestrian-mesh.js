// pedestrian-mesh.js — procedural pedestrian mesh (Group of boxes + sphere
// head) with varied shirt/skin/height via PRNG and a simple walk cycle
// (legs swing, arms counter-swing, small bob), reusing the player animator.
// Original code, written for this entry.
import * as THREE from 'three';
import { createWalkAnimator } from '../player/animation.js';

const SHIRTS = [0xc25a3a, 0x3a6fc2, 0x4a9a5a, 0xd8b13c, 0x8a5ac2, 0xe8e4da, 0x2a2a2e, 0xc23a7a];
const SKINS = [0xc98d64, 0x8a5a3b, 0xe8b88a, 0x6e4530, 0xd9a075];
const PANTS = [0x22262e, 0x3a4a5a, 0x5a4a3a, 0x2e3a2e];

export function buildPedestrianMesh(rng) {
  const group = new THREE.Group();
  const animator = createWalkAnimator();
  const height = 1.6 + rng() * 0.3;

  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)], roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: SKINS[Math.floor(rng() * SKINS.length)], roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS[Math.floor(rng() * PANTS.length)], roughness: 0.95 });

  const body = new THREE.Group();
  group.add(body);
  const s = height / 1.75; // scale the 1.75m reference build

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.28), shirt);
  torso.position.y = 1.05 * s;
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10), skin);
  head.position.y = 1.68 * s;
  head.castShadow = true;
  body.add(head);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.19), pants);
  legL.geometry.translate(0, -0.34, 0);
  legL.position.set(-0.12, 0.68 * s, 0);
  legL.castShadow = true;
  body.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.12;
  body.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.15), shirt);
  armL.geometry.translate(0, -0.31, 0);
  armL.position.set(-0.3, 1.42 * s, 0);
  body.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.3;
  body.add(armR);

  const parts = { body, legL, legR, armL, armR, head };

  function update(dt, speed) {
    const speedNorm = Math.min(1, speed / 4);
    // Fase 11B — panik (mesh.userData.panicked): langkah 1,6x lebih cepat.
    const panicked = !!group.userData.panicked;
    if (speed > 0.1) animator.advance(speed * dt * (panicked ? 1.6 : 1));
    // Pedestrians swing a little less than the player: legs ±30 deg.
    const phase = animator.phase;
    const sw = Math.sin(phase);
    const swing = 0.52 * speedNorm;
    parts.legL.rotation.x = sw * swing;
    parts.legR.rotation.x = -sw * swing;
    if (panicked) {
      // Lengan terangkat: bahu -120° (tangan ke atas, pose kabur).
      parts.armL.rotation.x = -2.1;
      parts.armR.rotation.x = -2.1;
    } else {
      parts.armL.rotation.x = -sw * 0.38 * speedNorm;
      parts.armR.rotation.x = sw * 0.38 * speedNorm;
    }
    parts.body.position.y = Math.abs(Math.cos(phase)) * 0.03 * speedNorm;
  }

  return { group, parts, height, update };
}

// Fase 11B — set mode panik pada mesh pedestrian. `ped` bisa hasil
// buildPedestrianMesh ({ group, ... }) atau group-nya langsung.
export function setPanicked(ped, on) {
  const g = ped && ped.group ? ped.group : ped;
  if (g && g.userData) g.userData.panicked = !!on;
  return !!on;
}
