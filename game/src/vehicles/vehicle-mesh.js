// vehicle-mesh.js — procedural 3D vehicle meshes (Group of boxes + cylinder
// wheels). Four original brands: Sireno sedan/sports, Moro muscle, Escabi van.
// Original code, written for this entry. No external assets.
import * as THREE from 'three';

const glassMat = new THREE.MeshStandardMaterial({
  color: 0x0a141c, transparent: true, opacity: 0.78, metalness: 0.9, roughness: 0.12,
});
const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xb9bec4, metalness: 0.9, roughness: 0.3 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dce0, metalness: 1, roughness: 0.22 });
const lightMat = new THREE.MeshStandardMaterial({
  color: 0xfff6cf, emissive: 0xffedb5, emissiveIntensity: 0.4, roughness: 0.3,
});
const tailMat = new THREE.MeshStandardMaterial({
  color: 0x7a0d0d, emissive: 0x550000, emissiveIntensity: 0.5, roughness: 0.4,
});

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// One wheel: steer pivot (yaw) > spin pivot (axle roll) > tire + hub.
function makeWheel() {
  const steer = new THREE.Group();
  const spin = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.26, 14), tireMat);
  tire.rotation.z = Math.PI / 2; // cylinder axis Y -> axle along X
  tire.castShadow = true;
  spin.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 10), hubMat);
  hub.rotation.z = Math.PI / 2;
  spin.add(hub);
  steer.add(spin);
  return { steer, spin };
}

function addWheels(group, halfTrack, frontZ, rearZ) {
  const wheels = [];
  for (const [x, z, front] of [
    [-halfTrack, frontZ, true],
    [halfTrack, frontZ, true],
    [-halfTrack, rearZ, false],
    [halfTrack, rearZ, false],
  ]) {
    const w = makeWheel();
    w.steer.position.set(x, 0.35, z);
    w.front = front;
    group.add(w.steer);
    wheels.push(w);
  }
  return wheels;
}

function addHeadlights(group, paint, y, zFront, halfSpread) {
  const lights = [];
  for (const sx of [-1, 1]) {
    const lamp = box(0.34, 0.16, 0.1, lightMat, sx * halfSpread, y, zFront);
    group.add(lamp);
    const spot = new THREE.SpotLight(0xfff2c0, 0, 45, 0.5, 0.45, 1.6);
    spot.position.set(sx * halfSpread, y, zFront);
    const target = new THREE.Object3D();
    target.position.set(sx * halfSpread * 1.4, 0.1, zFront + 14);
    group.add(target);
    spot.target = target;
    group.add(spot);
    lights.push(spot);
  }
  return lights;
}

function addTaillights(group, y, zRear, halfSpread) {
  // Material di-clone per lampu supaya setBrakeLights bisa menyalakan satu
  // mobil tanpa ikut menyalakan semua mobil (tailMat modul-level dipakai bersama).
  const lamps = [];
  for (const sx of [-1, 1]) {
    const mat = tailMat.clone();
    const lamp = box(0.34, 0.14, 0.08, mat, sx * halfSpread, y, zRear);
    group.add(lamp);
    lamps.push(lamp);
  }
  return lamps;
}

// Beam lampu depan: cone transparan kuning pucat, apex di lampu, alas 12m
// ke depan (+Z). Disembunyikan secara default; dinyalakan saat malam.
function addHeadlightBeams(group, y, zFront, halfSpread) {
  const beams = [];
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c0, transparent: true, opacity: 0.07,
    side: THREE.DoubleSide, depthWrite: false,
  });
  for (const sx of [-1, 1]) {
    const geo = new THREE.ConeGeometry(1.1, 12, 12, 1, true);
    geo.translate(0, -6, 0); // apex ke origin
    geo.rotateX(-Math.PI / 2); // alas mengarah +Z (ke depan mobil)
    const beam = new THREE.Mesh(geo, beamMat);
    beam.position.set(sx * halfSpread, y, zFront);
    beam.visible = false;
    group.add(beam);
    beams.push(beam);
  }
  return beams;
}

// Tapered nose: a box whose front (+z) vertices are pinched inward.
function taperedBox(w, h, len, pinch) {
  const geo = new THREE.BoxGeometry(w, h, len);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getZ(i) > 0) pos.setX(i, pos.getX(i) * pinch);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildSedan(paint) {
  const g = new THREE.Group();
  g.add(box(1.8, 0.85, 4.2, paint, 0, 0.78, 0)); // body
  g.add(box(1.6, 0.55, 2.1, glassMat, 0, 1.42, -0.25)); // cabin glass
  g.add(box(1.62, 0.08, 2.0, paint, 0, 1.72, -0.25)); // roof
  g.add(box(1.82, 0.22, 0.3, paint, 0, 0.42, 2.05)); // front bumper
  g.add(box(1.82, 0.22, 0.3, paint, 0, 0.42, -2.05)); // rear bumper
  const wheels = addWheels(g, 0.85, 1.35, -1.35);
  const headlights = addHeadlights(g, paint, 0.82, 2.12, 0.58);
  const taillights = addTaillights(g, 0.82, -2.12, 0.58);
  const beams = addHeadlightBeams(g, 0.82, 2.12, 0.58);
  return { group: g, wheels, headlights, taillights, beams, length: 4.2, width: 1.8 };
}

function buildSports(paint) {
  const g = new THREE.Group();
  const nose = new THREE.Mesh(taperedBox(1.95, 0.55, 2.4, 0.55), paint);
  nose.position.set(0, 0.6, 1.15);
  nose.castShadow = true;
  g.add(nose);
  g.add(box(1.95, 0.7, 2.4, paint, 0, 0.68, -1.0)); // rear body
  g.add(box(1.7, 0.45, 1.5, glassMat, 0, 1.2, -0.9)); // low cabin
  g.add(box(1.72, 0.06, 1.4, paint, 0, 1.45, -0.9)); // roof
  // Rear spoiler.
  g.add(box(1.8, 0.06, 0.35, chromeMat, 0, 1.12, -2.15));
  g.add(box(0.08, 0.22, 0.3, chromeMat, -0.7, 1.0, -2.15));
  g.add(box(0.08, 0.22, 0.3, chromeMat, 0.7, 1.0, -2.15));
  const wheels = addWheels(g, 0.92, 1.4, -1.4);
  const headlights = addHeadlights(g, paint, 0.62, 2.32, 0.62);
  const taillights = addTaillights(g, 0.72, -2.22, 0.62);
  const beams = addHeadlightBeams(g, 0.62, 2.32, 0.62);
  return { group: g, wheels, headlights, taillights, beams, length: 4.6, width: 1.95 };
}

function buildMuscle(paint) {
  const g = new THREE.Group();
  g.add(box(1.9, 0.8, 4.6, paint, 0, 0.75, 0)); // body
  g.add(box(1.7, 0.22, 1.9, paint, 0, 1.22, 1.05)); // long hood scoop base
  g.add(box(0.5, 0.18, 1.1, chromeMat, 0, 1.38, 1.05)); // hood scoop
  g.add(box(1.65, 0.5, 1.9, glassMat, 0, 1.38, -0.55)); // cabin
  g.add(box(1.67, 0.08, 1.8, paint, 0, 1.66, -0.55)); // roof
  // Chrome bumpers + wide rear.
  g.add(box(1.95, 0.2, 0.25, chromeMat, 0, 0.42, 2.32));
  g.add(box(2.0, 0.2, 0.25, chromeMat, 0, 0.42, -2.32));
  const wheels = addWheels(g, 0.88, 1.45, -1.45);
  const headlights = addHeadlights(g, paint, 0.8, 2.32, 0.6);
  const taillights = addTaillights(g, 0.8, -2.32, 0.6);
  const beams = addHeadlightBeams(g, 0.8, 2.32, 0.6);
  return { group: g, wheels, headlights, taillights, beams, length: 4.6, width: 1.9 };
}

function buildVan(paint) {
  const g = new THREE.Group();
  g.add(box(2.0, 1.5, 4.8, paint, 0, 1.1, 0)); // tall box body
  g.add(box(1.9, 0.7, 0.9, glassMat, 0, 1.55, 1.95)); // windshield
  g.add(box(1.9, 0.6, 1.6, glassMat, 0, 1.5, 0.4)); // side glass band
  // Sliding-door seam: two thin dark strips on the flanks.
  for (const sx of [-1, 1]) {
    g.add(box(0.02, 1.1, 0.9, tireMat, sx * 1.01, 1.0, 0.5));
  }
  g.add(box(2.02, 0.25, 0.3, chromeMat, 0, 0.42, 2.42)); // front bumper
  g.add(box(2.02, 0.25, 0.3, chromeMat, 0, 0.42, -2.42)); // rear bumper
  const wheels = addWheels(g, 0.92, 1.55, -1.55);
  const headlights = addHeadlights(g, paint, 0.95, 2.42, 0.65);
  const taillights = addTaillights(g, 0.95, -2.42, 0.65);
  const beams = addHeadlightBeams(g, 0.95, 2.42, 0.65);
  return { group: g, wheels, headlights, taillights, beams, length: 4.8, width: 2.0 };
}

const BUILDERS = { sedan: buildSedan, sports: buildSports, muscle: buildMuscle, van: buildVan };

export const VEHICLE_PAINTS = {
  sedan: [0x2e6f73, 0x8a1f2d, 0xd8d8d8],
  sports: [0xc22525, 0x1f3a8a, 0xe8a020],
  muscle: [0x22262e, 0x5a2a7a, 0x0f5a2a],
  van: [0xe8e4da, 0x2c5f7c, 0x7c6a2c],
};

// Build a vehicle mesh. `color` is a hex number; defaults to the type's first paint.
export function buildVehicleMesh(type, color) {
  const build = BUILDERS[type] || BUILDERS.sedan;
  const paint = new THREE.MeshStandardMaterial({
    color: color ?? VEHICLE_PAINTS[type]?.[0] ?? 0x888888,
    metalness: 0.55,
    roughness: 0.35,
  });
  const built = build(paint);
  built.group.userData.type = type;
  built.group.userData.taillights = built.taillights || [];
  built.group.userData.beams = built.beams || [];
  return built;
}

// --- Fase 11B: lampu rem + beam lampu depan -------------------------------
// target: hasil buildVehicleMesh ({ group, taillights, beams }) atau group-nya.
// Lampu rem: emissive merah terang saat on, redup saat off.
export function setBrakeLights(target, on) {
  const lamps = target.taillights || (target.userData && target.userData.taillights) || [];
  for (const lamp of lamps) {
    const mat = lamp.material;
    if (!mat || !mat.emissive) continue;
    mat.emissive.setHex(on ? 0xff1a1a : 0x550000);
    mat.emissiveIntensity = on ? 2.2 : 0.5;
  }
}

// Beam lampu depan: visible saat malam (on=true).
export function setHeadlightBeams(target, on) {
  const beams = target.beams || (target.userData && target.userData.beams) || [];
  for (const beam of beams) beam.visible = !!on;
}
