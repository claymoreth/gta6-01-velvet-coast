// player-mesh.js — Marco Varela's procedural character mesh (boxes + sphere).
// Original code, written for this entry.
import * as THREE from 'three';
import { createWalkAnimator } from './animation.js';

export function createPlayerMesh(shirtColor) {
  const group = new THREE.Group();
  const animator = createWalkAnimator();

  // shirtColor opsional: variasi warna baju (seeded) bila mesh dipakai NPC.
  const jacket = new THREE.MeshStandardMaterial({
    color: typeof shirtColor === 'number' ? shirtColor : 0x2e6f73, roughness: 0.9,
  });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.95 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xd8b13c, roughness: 0.9 });

  const body = new THREE.Group();
  group.add(body);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.3), jacket);
  torso.position.y = 1.15;
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  body.add(head);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), capMat);
  cap.position.y = 2.05;
  body.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.2), capMat);
  brim.position.set(0, 2.0, 0.28);
  body.add(brim);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.2), pants);
  legL.geometry.translate(0, -0.375, 0);
  legL.position.set(-0.13, 0.75, 0);
  legL.castShadow = true;
  body.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.13;
  body.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.16), jacket);
  armL.geometry.translate(0, -0.35, 0);
  armL.position.set(-0.33, 1.55, 0);
  armL.castShadow = true;
  body.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.33;
  body.add(armR);

  const parts = { body, torso, legL, legR, armL, armR, head };

  // Fase 11B — deteksi mendarat: pantau delta Y grup per frame. Jatuh
  // (dy < -0,02) lalu berhenti turun = mendarat → landing dip via animator.
  let _prevY = null;
  let _falling = false;

  function update(dt, speed, moving, extra) {
    const speedNorm = Math.min(1, speed / 6);
    if (moving && speed > 0.1) {
      animator.advance(speed * dt);
    }
    // Recoil: teruskan jam tembakan terakhir ke animator bila tersedia.
    // extra bisa ctx ({ weapons: { lastShotAt } }) atau { lastShotAt }.
    const shotAt = extra && extra.weapons
      ? extra.weapons.lastShotAt
      : extra && extra.lastShotAt;
    animator.apply(parts, moving ? speedNorm : 0, {
      shotAt,
      now: performance.now() / 1000,
    });
    // Landing dip: deteksi dari posisi Y grup (di-set player.js tiap frame).
    const y = group.position.y;
    if (_prevY !== null) {
      const dy = y - _prevY;
      if (dy < -0.02) _falling = true;
      else if (_falling && dy >= -0.005) {
        _falling = false;
        animator.landDip();
      }
    }
    _prevY = y;
    // Lean forward 8 degrees while running.
    const targetLean = speed > 4 ? 0.14 : 0;
    body.rotation.x += (targetLean - body.rotation.x) * Math.min(1, dt * 8);
    // Idle breathing.
    if (!moving) torso.scale.y = 1 + Math.sin(performance.now() * 0.0016) * 0.01;
  }

  return { group, parts, update };
}

// Fase 11B — kilau damage: emissive torso (+lengan, satu material jaket)
// jadi merah terang selama `ms` (default 120ms) saat player kena damage.
// Dipanggil dari player.takeDamage — INTEGRASI: player.js BUKAN milik fase
// ini, jadi tambahkan di takeDamage: `flashHit(this.mesh)` (lihat laporan).
export function flashHit(mesh, ms = 120) {
  const mat = mesh && mesh.parts && mesh.parts.torso && mesh.parts.torso.material;
  if (!mat || !mat.emissive) return;
  if (mesh._flashTimer) clearTimeout(mesh._flashTimer);
  mat.emissive.setHex(0xff0000);
  mat.emissiveIntensity = 0.9;
  mesh._flashTimer = setTimeout(() => {
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 1;
    mesh._flashTimer = null;
  }, ms);
}
