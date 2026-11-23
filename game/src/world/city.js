// city.js — assembles the whole world: roads, buildings, props, ocean,
// sky, lighting, plus the causeway bridge and the marina dock.
// Also owns groundHeight(x, z) and the spawn points.
// Original code, written for this entry.
import * as THREE from 'three';
import { buildRoadGraph } from '../engine/pathfinding.js';
import { registerGroundHeight } from '../engine/collision.js';
import { buildRoads } from './roads.js';
import { buildBuildings } from './buildings.js';
import { buildProps } from './props.js';
import { buildOcean } from './ocean.js';
import { buildSky } from './sky.js';
import { buildLighting } from './lighting.js';

// Ground height map for Port Solana.
// Land y=0; beach slopes down south of z=200; ocean floor -2 east of x=200;
// the causeway deck runs at y=5 from the shore to a small island;
// the marina dock sits at y=0.3.
export function groundHeight(x, z) {
  // Causeway: approach ramp, deck, exit ramp, island.
  if (Math.abs(z) <= 8) {
    if (x >= 185 && x < 200) return ((x - 185) / 15) * 5;
    if (x >= 200 && x <= 340) return 5;
    if (x > 340 && x <= 355) return 5 - ((x - 340) / 15) * 5;
  }
  if (x > 355 && x <= 400 && Math.abs(z) <= 25) return 0; // island
  // Marina dock planks.
  if (x >= 90 && x <= 190 && z >= 222 && z <= 262) return 0.3;
  // Beach slope into the sea.
  if (z > 200) return -1.8 * Math.min(1, (z - 200) / 40);
  // Open water east of the city.
  if (x > 200) return -2;
  return 0;
}

function buildCauseway(ctx) {
  const scene = ctx.scene;
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.95 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(155, 0.6, 16), deckMat);
  deck.position.set(270, 4.7, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  scene.add(deck);
  // Railings.
  const railMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 });
  for (const rz of [-7.6, 7.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(155, 0.9, 0.25), railMat);
    rail.position.set(270, 5.6, rz);
    scene.add(rail);
  }
  // Pillars down to the water.
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 1 });
  for (let x = 210; x <= 330; x += 20) {
    for (const pz of [-5, 5]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 7, 10), pillarMat);
      p.position.set(x, 1.2, pz);
      scene.add(p);
    }
  }
  // Approach + exit ramps (visual; groundHeight already ramps).
  const rampMat = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.95 });
  const rampIn = new THREE.Mesh(new THREE.BoxGeometry(17, 0.5, 16), rampMat);
  rampIn.position.set(192.5, 2.4, 0);
  rampIn.rotation.z = Math.atan2(5, 15);
  rampIn.castShadow = true;
  scene.add(rampIn);
  const rampOut = new THREE.Mesh(new THREE.BoxGeometry(17, 0.5, 16), rampMat);
  rampOut.position.set(347.5, 2.4, 0);
  rampOut.rotation.z = -Math.atan2(5, 15);
  rampOut.castShadow = true;
  scene.add(rampOut);
  // Island at the far end: sand disc + one palm + billboard pole.
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 30, 1.2, 20),
    new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 1 }),
  );
  island.position.set(378, -0.4, 0);
  island.receiveShadow = true;
  scene.add(island);
}

function buildMarina(ctx) {
  const scene = ctx.scene;
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 });
  const dock = new THREE.Mesh(new THREE.BoxGeometry(100, 0.3, 40), dockMat);
  dock.position.set(140, 0.15, 242);
  dock.castShadow = true;
  dock.receiveShadow = true;
  scene.add(dock);
  // Mooring posts.
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 });
  for (let x = 95; x <= 185; x += 15) {
    for (const pz of [224, 260]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.6, 8), postMat);
      p.position.set(x, 0.8, pz);
      scene.add(p);
    }
  }
  // Three simple moored boats: hull + cabin.
  const hullColors = [0xe8e4da, 0x2c5f7c, 0x7c2c2c];
  hullColors.forEach((col, i) => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.2, 9),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 }),
    );
    hull.position.y = 0.1;
    hull.castShadow = true;
    boat.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.1, 3.5),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
    );
    cabin.position.set(0, 1.2, -0.5);
    boat.add(cabin);
    boat.position.set(105 + i * 35, -0.3, 272 + (i % 2) * 6);
    boat.rotation.y = (i - 1) * 0.06;
    scene.add(boat);
  });
}

// Mission anchor points, chosen against the built layout:
// grid lines -160/-80/0/80/160; warehouses at blocks (40,120) & (120,120);
// beach slopes south of z=200; marina dock x 90–190, z 222–262;
// causeway deck y=5, x 200–340, z≈0; island x 355–400, z ±25.
// Spots sit on road lines / intersections or open ground, clear of
// building plots (blocks centred -120/-40/40/120, plots ±16).
export const MISSION_SPOTS = {
  valetLot: { x: 80, z: -40 }, // downtown, off the tower plot at (40,-40)
  garage: { x: -80, z: 40 }, // midtown intersection, Dex's garage
  warehouse: { x: 160, z: 120 }, // east edge of the warehouse blocks
  containerYard: { x: 120, z: 160 }, // south of the warehouses, by the beach road
  saltRefinery: { x: 160, z: 180 }, // coastal strip, east end of the beach road
  beachHotel: { x: 120, z: 190 }, // beachfront, just before the sand slope
  safehouse: { x: -120, z: -80 }, // residential west, road intersection
  mansion: { x: 378, z: 0 }, // island at the far end of the causeway
  causewayMid: { x: 270, z: 0 }, // middle of the causeway deck (y=5)
  hospital: { x: -40, z: 80 }, // midtown, on the z=80 road between blocks
  marina: { x: 140, z: 242 }, // centre of the marina dock
};

export function buildCity(ctx) {
  registerGroundHeight(groundHeight);
  ctx.groundHeight = groundHeight;
  ctx.roadGraph = buildRoadGraph();
  ctx.spawnPoints = [
    { x: 6, z: 20, name: 'downtown' },
    { x: -40, z: 40, name: 'midtown' },
    { x: 120, z: 180, name: 'beach' },
    { x: 140, z: 240, name: 'marina' },
  ];

  buildRoads(ctx);
  buildSky(ctx);
  buildOcean(ctx);
  buildBuildings(ctx);
  buildProps(ctx);
  buildCauseway(ctx);
  buildMarina(ctx);
  buildLighting(ctx);
  return ctx;
}
