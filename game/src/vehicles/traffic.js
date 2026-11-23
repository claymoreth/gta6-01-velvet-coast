// traffic.js — TrafficManager: 7 AI cars driving the 5x5 road graph at
// 8-11 m/s in the right-hand lane, braking for cars/the player ahead and
// honking after 2s stuck. Built on Vehicle + driveToward (rolling mode).
// Original code, written for this entry.
import * as THREE from 'three';
import { mulberry32 } from '../engine/scene.js';
import { GRID_LINES, nearestNode, nextWaypointOnRoad } from '../engine/pathfinding.js';
import { createVehicle } from './carfactory.js';
import { VEHICLE_PAINTS } from './vehicle-mesh.js';
import { driveToward } from './carchase.js';

const TRAFFIC_COUNT = 7;
const TYPES = ['sedan', 'sedan', 'sports', 'muscle', 'van'];

function randomNode(rng) {
  return {
    x: GRID_LINES[Math.floor(rng() * GRID_LINES.length)],
    z: GRID_LINES[Math.floor(rng() * GRID_LINES.length)],
  };
}

// True right-hand vector for a heading: facing south, right is west.
function rightOfHeading(heading) {
  return { x: -Math.cos(heading), z: Math.sin(heading) };
}

export class TrafficManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.rng = mulberry32(4242);
    this.cars = [];
    this.spawnCars();
  }

  spawnCars() {
    const rng = this.rng;
    const spawn = this.ctx.spawnPoints?.[0] || { x: 6, z: 20 };
    let placed = 0;
    let guard = 0;
    while (placed < TRAFFIC_COUNT && guard++ < 200) {
      const line = GRID_LINES[Math.floor(rng() * GRID_LINES.length)];
      const along = -160 + rng() * 320;
      const northSouth = rng() < 0.5;
      // Centre-line point on the road, before the lane offset.
      const cx = northSouth ? line : along;
      const cz = northSouth ? along : line;
      if (Math.hypot(cx - spawn.x, cz - spawn.z) < 15) continue;
      if (this.cars.some((c) => Math.hypot(c.car.pos.x - cx, c.car.pos.z - cz) < 12)) continue;
      const dest = randomNode(rng);
      // First waypoint: the nearest intersection itself when far from it —
      // nextWaypointOnRoad assumes the car is already AT that node, so aiming
      // at its result directly would cut diagonally across a city block.
      const nn = nearestNode(cx, cz);
      const waypoint = Math.hypot(nn.x - cx, nn.z - cz) > 8
        ? { x: nn.x, z: nn.z }
        : nextWaypointOnRoad({ x: cx, z: cz }, dest) || dest;
      // Face the waypoint along the road axis, then shift into the right lane.
      const dx = waypoint.x - cx;
      const dz = waypoint.z - cz;
      const heading = Math.abs(dx) > Math.abs(dz)
        ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (dz > 0 ? 0 : Math.PI);
      const right = rightOfHeading(heading);
      const x = cx + right.x * 2.5;
      const z = cz + right.z * 2.5;
      const type = TYPES[Math.floor(rng() * TYPES.length)];
      const paints = VEHICLE_PAINTS[type];
      const color = paints[Math.floor(rng() * paints.length)];
      const car = createVehicle(this.ctx, type, x, z, heading, color);
      car.ai = 'traffic';
      const entry = {
        car,
        cruise: 8 + rng() * 3, // 8-11 m/s
        dest,
        waypoint,
        blockedTime: 0,
        lastHonk: -10,
        lastNearMissHonk: -10, // Fase 11B — throttle klakson near-miss
        time: 0,
      };
      this.cars.push(entry);
      placed++;
    }
  }

  // Is there a car or the on-foot player within 8m ahead in a narrow cone?
  isBlocked(entry) {
    const car = entry.car;
    const fwd = car.forwardVector(new THREE.Vector3());
    const right = car.rightVector(new THREE.Vector3());
    const check = (px, pz) => {
      const dx = px - car.pos.x;
      const dz = pz - car.pos.z;
      const ahead = dx * fwd.x + dz * fwd.z;
      const side = Math.abs(dx * right.x + dz * right.z);
      return ahead > 0.5 && ahead < 8 && side < 2.6;
    };
    for (const other of this.ctx.vehicles) {
      if (other === car) continue;
      if (check(other.pos.x, other.pos.z)) return true;
    }
    const p = this.ctx.player;
    if (p && !p.driving && check(p.pos.x, p.pos.z)) return true;
    return false;
  }

  update(dt) {
    for (const entry of this.cars) {
      const car = entry.car;
      entry.time += dt;
      if (this.isBlocked(entry)) {
        entry.blockedTime += dt;
        if (car.speed > 0.5) {
          car.update(dt, { throttle: -1, steer: 0, handbrake: false });
        } else {
          car.update(dt, { throttle: 0, steer: 0, handbrake: false });
        }
        // Honk after 2s stuck, at most once per 3s (audio stub is safe).
        if (entry.blockedTime > 2 && entry.time - entry.lastHonk > 3) {
          entry.lastHonk = entry.time;
          if (this.ctx.audio && typeof this.ctx.audio.playHonk === 'function') {
            this.ctx.audio.playHonk();
          }
        }
        continue;
      }
      entry.blockedTime = 0;

      // Fase 11B — near-miss: player melaju >15 m/s dan lewat <3m di samping
      // mobil ini → klakson sekali (throttle 1x/3 dtk per mobil).
      const p = this.ctx.player;
      if (p && p.driving && Math.abs(p.driving.speed) > 15) {
        const fwd = car.forwardVector(new THREE.Vector3());
        const right = car.rightVector(new THREE.Vector3());
        const dx = p.pos.x - car.pos.x;
        const dz = p.pos.z - car.pos.z;
        const ahead = dx * fwd.x + dz * fwd.z;
        const side = Math.abs(dx * right.x + dz * right.z);
        if (Math.abs(ahead) < 6 && side < 3 && entry.time - entry.lastNearMissHonk > 3) {
          entry.lastNearMissHonk = entry.time;
          if (this.ctx.audio && typeof this.ctx.audio.playHonk === 'function') {
            this.ctx.audio.playHonk();
          }
        }
      }

      // Advance the waypoint when close; pick a new destination at the node.
      const wp = entry.waypoint;
      if (!wp || Math.hypot(wp.x - car.pos.x, wp.z - car.pos.z) < 6) {
        if (wp && Math.hypot(entry.dest.x - car.pos.x, entry.dest.z - car.pos.z) < 8) {
          entry.dest = randomNode(this.rng);
        }
        // Same nearest-node-first rule as at spawn: never aim past the
        // intersection the car has not reached yet.
        const nn = nearestNode(car.pos.x, car.pos.z);
        if (Math.hypot(nn.x - car.pos.x, nn.z - car.pos.z) > 8) {
          entry.waypoint = { x: nn.x, z: nn.z };
        } else {
          entry.waypoint = nextWaypointOnRoad(car.pos, entry.dest) || entry.dest;
        }
      }
      // Aim at the waypoint, shifted into the right-hand lane. The lane side
      // comes from the TRAVEL direction (car -> waypoint, axis-aligned), not
      // the car's current heading: during a U-turn the heading swings around
      // and a heading-based offset would drag the target across lanes,
      // leaving the car facing oncoming traffic in the wrong lane.
      const tdx = entry.waypoint.x - car.pos.x;
      const tdz = entry.waypoint.z - car.pos.z;
      const travelHeading = Math.abs(tdx) > Math.abs(tdz)
        ? (tdx > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (tdz > 0 ? 0 : Math.PI);
      const right = rightOfHeading(travelHeading);
      const tx = entry.waypoint.x + right.x * 2.5;
      const tz = entry.waypoint.z + right.z * 2.5;
      driveToward(car, tx, tz, dt, { rolling: true, cruise: entry.cruise });
    }
  }
}
