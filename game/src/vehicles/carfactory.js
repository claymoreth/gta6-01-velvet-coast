// carfactory.js — spawn the four player vehicles across Port Solana and own
// the enter/exit + driving input loop. F within 3m of the driver door enters;
// F again exits beside the car. While driving, W/S throttle/brake, A/D steer,
// Space handbrakes, Tab cycles the radio (stub until Wave D).
// Original code, written for this entry.
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { buildVehicleMesh, VEHICLE_PAINTS } from './vehicle-mesh.js';
import { groundHeightAt } from '../engine/collision.js';

export const RADIO_STATIONS = ['Sunset 88.5 FM', 'Wave 104.2', 'Vanta 90.1'];

export function createVehicle(ctx, type, x, z, heading = 0, color) {
  const built = buildVehicleMesh(type, color);
  const v = new Vehicle(ctx, type, built, x, z, heading);
  ctx.scene.add(built.group);
  ctx.vehicles.push(v);
  return v;
}

// Fase 11B — spawn satu kendaraan misi ('sports'|'sedan'|'muscle'|'van') di
// koordinat (x, z), mis. sports car valet, truk container (van), Sireno merah.
// Mengembalikan referensi Vehicle; didaftarkan ke ctx.missionVehicles.
export function spawnMissionVehicle(ctx, kind, x, z, color, heading = 0) {
  const type = ['sports', 'sedan', 'muscle', 'van'].includes(kind) ? kind : 'sedan';
  const v = createVehicle(ctx, type, x, z, heading, color);
  if (!ctx.missionVehicles) ctx.missionVehicles = [];
  ctx.missionVehicles.push(v);
  return v;
}

// One of each type, parked just OFF the driving lanes (10m+ from the road
// centre-lines, clear of buildings) so traffic never queues behind them.
export function spawnCityVehicles(ctx) {
  const paints = VEHICLE_PAINTS;
  const moro = createVehicle(ctx, 'muscle', 12, 32, Math.PI, paints.muscle[1]);
  const sedan = createVehicle(ctx, 'sedan', -70, -20, 0, paints.sedan[0]);
  const sports = createVehicle(ctx, 'sports', 14, 60, Math.PI, paints.sports[0]);
  const van = createVehicle(ctx, 'van', 44, -60, Math.PI / 2, paints.van[0]);
  return { moro, sedan, sports, van };
}

function nearestVehicleInReach(ctx, maxDist = 3) {
  const p = ctx.player.pos;
  let best = null;
  let bestD = maxDist;
  for (const v of ctx.vehicles) {
    const door = v.doorPosition(new THREE.Vector3());
    const d = Math.hypot(p.x - door.x, p.z - door.z);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

function enterVehicle(ctx, vehicle) {
  const player = ctx.player;
  player.driving = vehicle;
  player.vel.set(0, 0, 0);
  player.mesh.group.visible = false;
  if (ctx.cameraRig) ctx.cameraRig.setChase(vehicle);
  if (ctx.audio) ctx.audio.engineLoop(true);
}

function exitVehicle(ctx) {
  const player = ctx.player;
  const vehicle = player.driving;
  if (!vehicle) return;
  // Step out beside the driver door.
  const door = vehicle.doorPosition(new THREE.Vector3());
  const right = vehicle.rightVector(new THREE.Vector3());
  const x = door.x - right.x * 0.6;
  const z = door.z - right.z * 0.6;
  player.pos.set(x, groundHeightAt(x, z), z);
  player.vel.set(0, 0, 0);
  player.driving = null;
  player.mesh.group.visible = true;
  if (ctx.cameraRig) ctx.cameraRig.clearChase();
  if (ctx.audio) ctx.audio.engineLoop(false);
}

// Resolve car-vs-car overlap as circle pairs (radius ~1.4 each).
function resolveVehiclePairs(ctx) {
  const list = ctx.vehicles;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      const min = 2.8;
      if (d >= min || d < 1e-6) continue;
      const nx = dx / d;
      const nz = dz / d;
      const push = (min - d) / 2;
      a.pos.x -= nx * push;
      a.pos.z -= nz * push;
      b.pos.x += nx * push;
      b.pos.z += nz * push;
      // Kill the closing velocity along the pair axis.
      const rel = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
      if (rel < 0) {
        const imp = -rel / 2;
        a.vel.x -= nx * imp;
        a.vel.z -= nz * imp;
        b.vel.x += nx * imp;
        b.vel.z += nz * imp;
      }
    }
  }
}

// Called every frame from main.js: F enter/exit, driving input, radio stub.
export function updateVehicleInteraction(ctx, dt) {
  const input = ctx.input;
  const player = ctx.player;

  if (input.consumePressed('KeyF')) {
    if (player.driving) {
      exitVehicle(ctx);
    } else {
      const near = nearestVehicleInReach(ctx, 3);
      if (near) enterVehicle(ctx, near);
    }
  }

  if (player.driving) {
    const v = player.driving;
    const throttle =
      (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0) +
      (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? -1 : 0);
    const steer =
      (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0) +
      (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? -1 : 0);
    const handbrake = input.keys.has('Space');
    v.update(dt, { throttle, steer, handbrake });
    if (ctx.audio) ctx.audio.setEngineRpm(Math.abs(v.speed) / v.spec.topSpeed);
    // Tab cycles the radio while driving (stub until Wave D builds radio).
    if (input.consumePressed('Tab')) {
      ctx.radioStation = ((ctx.radioStation ?? 0) + 1) % RADIO_STATIONS.length;
      if (ctx.audio) ctx.audio.setRadio(RADIO_STATIONS[ctx.radioStation]);
    }
  }

  resolveVehiclePairs(ctx);
}
