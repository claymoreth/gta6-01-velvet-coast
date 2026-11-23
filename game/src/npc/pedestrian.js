// pedestrian.js — PedestrianManager: 12 pedestrians strolling the sidewalks
// (8.5m off the road centre-lines), pausing at crosswalks, turning at
// intersections, and fleeing when the player is armed within 15m or a
// gunshot rings out within 25m (ctx.lastGunshot {x, z, time}).
// Original code, written for this entry.
import * as THREE from 'three';
import { mulberry32 } from '../engine/scene.js';
import { GRID_LINES } from '../engine/pathfinding.js';
import { groundHeightAt, resolveCapsule } from '../engine/collision.js';
import { buildPedestrianMesh } from './pedestrian-mesh.js';
import { CHARACTERS } from '../story/characters.js';

const PED_COUNT = 12;
const SIDEWALK_OFF = 8.5;
const WALK_SPEED = 1.4;
const FLEE_SPEED = 4;

function nearestLine(v, lines = GRID_LINES) {
  let best = lines[0];
  let bestD = Infinity;
  for (const l of lines) {
    const d = Math.abs(v - l);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

export class PedestrianManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.rng = mulberry32(777);
    this.peds = [];
    this.spawnPeds();
  }

  spawnPeds() {
    const rng = this.rng;
    const spawn = this.ctx.spawnPoints?.[0] || { x: 6, z: 20 };
    let placed = 0;
    let guard = 0;
    while (placed < PED_COUNT && guard++ < 200) {
      const line = GRID_LINES[Math.floor(rng() * GRID_LINES.length)];
      const side = rng() < 0.5 ? -1 : 1;
      const along = -160 + rng() * 320;
      const axis = rng() < 0.5 ? 'x' : 'z';
      const x = axis === 'x' ? along : line + SIDEWALK_OFF * side;
      const z = axis === 'x' ? line + SIDEWALK_OFF * side : along;
      if (Math.hypot(x - spawn.x, z - spawn.z) < 8) continue;
      if (this.peds.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < 5)) continue;
      const mesh = buildPedestrianMesh(rng);
      mesh.group.position.set(x, groundHeightAt(x, z), z);
      this.ctx.scene.add(mesh.group);
      this.peds.push({
        mesh,
        pos: new THREE.Vector3(x, groundHeightAt(x, z), z),
        axis,
        line,
        side,
        dir: rng() < 0.5 ? -1 : 1,
        speed: 1.1 + rng() * 0.7,
        state: 'walk', // walk | pause | flee
        stateTime: 0,
        pauseTime: 0,
        lastCrossKey: '',
        fleeFrom: null,
      });
      placed++;
    }
  }

  // Spawn one named mission NPC that stands still until told otherwise.
  // Shirt colour comes from the character's accent colour.
  spawnMissionNPC(key, x, z) {
    const ch = CHARACTERS[key] || CHARACTERS.marco;
    const mesh = buildPedestrianMesh(this.rng);
    // Recolour the torso (the 0.46-wide box) to the character accent.
    mesh.group.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.parameters
        && o.geometry.parameters.width === 0.46) {
        o.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(ch.accent),
          roughness: 0.95,
        });
      }
    });
    mesh.group.position.set(x, groundHeightAt(x, z), z);
    this.ctx.scene.add(mesh.group);
    const ped = {
      mesh,
      pos: new THREE.Vector3(x, groundHeightAt(x, z), z),
      axis: 'x',
      line: x,
      side: 1,
      dir: 1,
      speed: 0,
      state: 'idle', // idle | walk | pause | flee
      stateTime: 0,
      pauseTime: 0,
      lastCrossKey: '',
      fleeFrom: null,
      isMissionNPC: true,
      key,
      name: ch.name,
    };
    this.peds.push(ped);
    return ped;
  }

  // Force every ped (or those within `radius` of the player) to flee.
  setFleeAll(radius = Infinity) {
    const player = this.ctx.player;
    const cx = player ? player.pos.x : 0;
    const cz = player ? player.pos.z : 0;
    for (const p of this.peds) {
      const d = Math.hypot(p.pos.x - cx, p.pos.z - cz);
      if (d > radius) continue;
      p.state = 'flee';
      p.stateTime = 0;
      p.fleeFrom = { x: cx, z: cz };
    }
  }

  // Snap a ped back onto the nearest sidewalk lane after fleeing.
  snapToSidewalk(p) {
    // Choose the axis whose road line is closer to the ped.
    const distX = Math.abs(p.pos.x - nearestLine(p.pos.x));
    const distZ = Math.abs(p.pos.z - nearestLine(p.pos.z));
    if (distX <= distZ) {
      p.axis = 'z';
      p.line = nearestLine(p.pos.x);
      p.side = p.pos.x >= p.line ? 1 : -1;
      p.pos.x = p.line + SIDEWALK_OFF * p.side;
      p.dir = this.rng() < 0.5 ? -1 : 1;
    } else {
      p.axis = 'x';
      p.line = nearestLine(p.pos.z);
      p.side = p.pos.z >= p.line ? 1 : -1;
      p.pos.z = p.line + SIDEWALK_OFF * p.side;
      p.dir = this.rng() < 0.5 ? -1 : 1;
    }
  }

  threatNear(p) {
    const player = this.ctx.player;
    if (player && player.armed) {
      const d = Math.hypot(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
      if (d < 15) return { x: player.pos.x, z: player.pos.z };
    }
    const shot = this.ctx.lastGunshot;
    if (shot) {
      const age = (performance.now() - shot.time) / 1000;
      if (age < 3) {
        const d = Math.hypot(shot.x - p.pos.x, shot.z - p.pos.z);
        if (d < 25) return { x: shot.x, z: shot.z };
      }
    }
    return null;
  }

  update(dt) {
    for (const p of this.peds) {
      p.stateTime += dt;
      // Named mission NPCs stand still until their state changes.
      if (p.isMissionNPC && p.state === 'idle') {
        p.mesh.update(dt, 0);
        p.mesh.group.position.copy(p.pos);
        continue;
      }
      const threat = this.threatNear(p);
      if (threat && p.state !== 'flee') {
        p.state = 'flee';
        p.stateTime = 0;
        p.fleeFrom = threat;
      }

      if (p.state === 'flee') {
        let dx = p.pos.x - p.fleeFrom.x;
        let dz = p.pos.z - p.fleeFrom.z;
        let d = Math.hypot(dx, dz);
        if (d < 0.5) {
          // Threat exactly on top of the ped: pick a random escape direction.
          const a = this.rng() * Math.PI * 2;
          dx = Math.sin(a);
          dz = Math.cos(a);
          d = 1;
        }
        p.pos.x += (dx / d) * FLEE_SPEED * dt;
        p.pos.z += (dz / d) * FLEE_SPEED * dt;
        p.mesh.group.rotation.y = Math.atan2(dx, dz);
        p.mesh.update(dt, FLEE_SPEED);
        // End the flee after 3s or once 20m clear of the threat.
        if (p.stateTime > 3 || d > 20) {
          p.state = 'walk';
          p.stateTime = 0;
          this.snapToSidewalk(p);
        }
      } else if (p.state === 'pause') {
        p.mesh.update(dt, 0);
        if (p.stateTime >= p.pauseTime) {
          p.state = 'walk';
          p.stateTime = 0;
        }
      } else {
        // Walk along the sidewalk lane.
        const step = p.speed * dt * p.dir;
        if (p.axis === 'x') {
          p.pos.x += step;
          if (Math.abs(p.pos.x) > 175) p.dir *= -1;
        } else {
          p.pos.z += step;
          if (Math.abs(p.pos.z) > 175) p.dir *= -1;
        }
        p.mesh.group.rotation.y = p.axis === 'x'
          ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (p.dir > 0 ? 0 : Math.PI);
        p.mesh.update(dt, p.speed);

        // Crosswalk behaviour at intersections: pause or turn, once per crossing.
        const along = p.axis === 'x' ? p.pos.x : p.pos.z;
        const cross = nearestLine(along);
        const key = `${p.axis}:${cross}`;
        if (Math.abs(along - cross) < 2.5 && p.lastCrossKey !== key) {
          p.lastCrossKey = key;
          const roll = this.rng();
          if (roll < 0.25) {
            p.state = 'pause';
            p.stateTime = 0;
            p.pauseTime = 2 + this.rng() * 2;
          } else if (roll < 0.45) {
            // Turn onto the crossing road's sidewalk.
            const otherAxis = p.axis === 'x' ? 'z' : 'x';
            p.axis = otherAxis;
            p.line = cross;
            p.side = this.rng() < 0.5 ? -1 : 1;
            if (otherAxis === 'z') p.pos.x = p.line + SIDEWALK_OFF * p.side;
            else p.pos.z = p.line + SIDEWALK_OFF * p.side;
            p.dir = this.rng() < 0.5 ? -1 : 1;
          }
        } else if (Math.abs(along - cross) > 6) {
          p.lastCrossKey = '';
        }
      }

      // Keep peds on the ground and out of buildings.
      p.pos.y = groundHeightAt(p.pos.x, p.pos.z);
      resolveCapsule(p.pos, 0.35, 1.8, this.ctx.colliders);
      p.mesh.group.position.copy(p.pos);
    }
  }
}
