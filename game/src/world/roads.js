// roads.js — 5x5 street grid (~400m x 400m): asphalt strips with dashed
// centre lines, crosswalks at intersections, raised sidewalk curbs.
// Original code, written for this entry.
import * as THREE from 'three';
import { makeCanvasTexture, mulberry32 } from '../engine/scene.js';
import { GRID_LINES } from '../engine/pathfinding.js';

const ROAD_W = 12;
const SPAN = 412; // road length, a little past the outer grid lines

function asphaltTexture() {
  return makeCanvasTexture(128, 512, (c, w, h) => {
    c.fillStyle = '#2b2e33';
    c.fillRect(0, 0, w, h);
    // speckle
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 300; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    // edge lines
    c.fillStyle = '#d8d8d8';
    c.fillRect(4, 0, 3, h);
    c.fillRect(w - 7, 0, 3, h);
    // dashed centre line
    c.fillStyle = '#f5c542';
    for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 2, y + 8, 4, 32);
  });
}

function crosswalkTexture() {
  return makeCanvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#2b2e33';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8e8e8';
    for (let i = 0; i < 6; i++) c.fillRect(6 + i * 21, 8, 12, h - 16);
  });
}

export function buildRoads(ctx) {
  const scene = ctx.scene;
  const roadRects = [];

  // Base land slab: x -400..200, z -400..200 (ocean takes the south + east).
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: 0x8a8f7a, roughness: 1 }),
  );
  land.rotation.x = -Math.PI / 2;
  land.position.set(-100, 0, -100);
  land.receiveShadow = true;
  scene.add(land);

  // Sandy beach slope: z 200..245, dropping from y=0 to y=-1.8.
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 46),
    new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2 + Math.atan2(1.8, 46);
  beach.position.set(-100, -0.9, 222.5);
  beach.receiveShadow = true;
  scene.add(beach);

  const asphalt = asphaltTexture();
  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 });
  // Wave 11A: weather.js finds these via userData.wettable for the wet look.
  asphaltMat.userData.wettable = true;
  const crossMat = new THREE.MeshStandardMaterial({ map: crosswalkTexture(), roughness: 0.95 });
  crossMat.userData.wettable = true;

  for (const x of GRID_LINES) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, SPAN), asphaltMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x, 0.01, 0);
    strip.receiveShadow = true;
    scene.add(strip);
    roadRects.push({ minX: x - ROAD_W / 2, maxX: x + ROAD_W / 2, minZ: -SPAN / 2, maxZ: SPAN / 2 });
  }
  for (const z of GRID_LINES) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, ROAD_W), asphaltMat);
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = Math.PI / 2; // texture runs along the road
    strip.position.set(0, 0.012, z);
    strip.receiveShadow = true;
    scene.add(strip);
    roadRects.push({ minX: -SPAN / 2, maxX: SPAN / 2, minZ: z - ROAD_W / 2, maxZ: z + ROAD_W / 2 });
  }

  // Crosswalks at every intersection.
  for (const x of GRID_LINES) {
    for (const z of GRID_LINES) {
      const cw = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_W), crossMat);
      cw.rotation.x = -Math.PI / 2;
      cw.position.set(x, 0.02, z);
      cw.receiveShadow = true;
      scene.add(cw);
    }
  }

  // Sidewalk curbs: one low slab per city block.
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 1 });
  const blockCenters = [-120, -40, 40, 120];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(70, 0.12, 70), curbMat);
      curb.position.set(bx, 0.06, bz);
      curb.receiveShadow = true;
      scene.add(curb);
    }
  }

  // Reflective puddles (Wave 11A): 6 thin glossy planes at seeded-random
  // intersections, hidden until it rains (weather.js toggles them).
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f14,
    roughness: 0.05,
    metalness: 0.6,
  });
  const puddleRng = mulberry32(1337 + 4242);
  const puddles = [];
  const usedIntersections = new Set();
  while (puddles.length < 6 && usedIntersections.size < GRID_LINES.length ** 2) {
    const x = GRID_LINES[Math.floor(puddleRng() * GRID_LINES.length)];
    const z = GRID_LINES[Math.floor(puddleRng() * GRID_LINES.length)];
    const key = `${x},${z}`;
    if (usedIntersections.has(key)) continue;
    usedIntersections.add(key);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x + (puddleRng() - 0.5) * 4, 0.03, z + (puddleRng() - 0.5) * 4);
    p.visible = false;
    scene.add(p);
    puddles.push(p);
  }
  function setPuddlesVisible(visible) {
    for (const p of puddles) p.visible = !!visible;
    return puddles.length;
  }
  ctx.puddles = { meshes: puddles, setPuddlesVisible };

  ctx.roadRects = roadRects;
  return { roadRects, puddles: ctx.puddles };
}
