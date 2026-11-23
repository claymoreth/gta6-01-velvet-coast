// vehicle.js — arcade car physics: kinematic body with throttle/brake/steer,
// a velocity vector that can diverge from heading (handbrake drift), simple
// circle-vs-AABB collision against the world colliders, spinning wheels.
// Original code, written for this entry.
import * as THREE from 'three';
import { groundHeightAt } from '../engine/collision.js';
import { addCameraShake } from '../engine/camera-rig.js';
import { setBrakeLights, setHeadlightBeams } from './vehicle-mesh.js';

export const VEHICLE_SPECS = {
  sedan: { topSpeed: 32, accel: 9, reverseAccel: 6, wheelBase: 2.7, grip: 22 },
  sports: { topSpeed: 42, accel: 14, reverseAccel: 7, wheelBase: 2.8, grip: 26 },
  muscle: { topSpeed: 36, accel: 12, reverseAccel: 6, wheelBase: 2.9, grip: 20 },
  van: { topSpeed: 24, accel: 7, reverseAccel: 5, wheelBase: 3.1, grip: 24 },
};

const BRAKE_DECEL = 18;
const ROLL_DECEL = 3;
const HANDBRAKE_DECEL = 12;
const WHEEL_RADIUS = 0.35;
const COLLISION_RADIUS = 1.3;
// Fase 11B — bekas ban: quad 0,3x1,2, fade 10 dtk, cap 60, interval 0,15 dtk.
const MARK_INTERVAL = 0.15;
const MARK_LIFE = 10;
const MARK_MAX = 60;
const MARK_OPACITY = 0.55;
const HARD_HIT_SPEED = 8; // m/s komponen kecepatan ke dinding = tabrakan keras
const _markGeo = new THREE.PlaneGeometry(0.3, 1.2);

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Vehicle {
  constructor(ctx, type, built, x, z, heading) {
    this.ctx = ctx;
    this.type = type;
    this.spec = VEHICLE_SPECS[type] || VEHICLE_SPECS.sedan;
    this.group = built.group;
    this.wheels = built.wheels;
    this.headlights = built.headlights;
    this.length = built.length;
    this.width = built.width;
    this.pos = new THREE.Vector3(x, groundHeightAt(x, z), z);
    this.vel = new THREE.Vector3();
    this.heading = heading || 0;
    this.speed = 0; // signed forward speed (m/s)
    this.steer = 0;
    this.spin = 0;
    this.ai = null; // set by TrafficManager / police for AI-driven cars
    // Fase 11B — bekas ban.
    this.tireMarks = []; // { mesh, age }
    this._markTimer = 0;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  forwardVector(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  rightVector(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
  }

  // Driver-door world position (left flank, mid-body).
  doorPosition(out = new THREE.Vector3()) {
    const right = this.rightVector(new THREE.Vector3());
    return out.copy(this.pos).addScaledVector(right, -this.width / 2 - 0.35);
  }

  // controls: { throttle: -1..1 (W=+1, S=-1), steer: -1..1 (A=+1 left),
  //             handbrake: bool }
  update(dt, controls = {}) {
    const spec = this.spec;
    const throttle = controls.throttle || 0;
    const steerInput = controls.steer || 0;
    const handbrake = !!controls.handbrake;

    const fwd = this.forwardVector(new THREE.Vector3());
    const right = this.rightVector(new THREE.Vector3());
    let fwdSpeed = this.vel.dot(fwd);
    let latSpeed = this.vel.dot(right);

    // Throttle / brake / reverse / rolling drag on the forward component.
    if (throttle > 0) {
      fwdSpeed += spec.accel * throttle * dt;
      if (fwdSpeed > spec.topSpeed) fwdSpeed = spec.topSpeed;
    } else if (throttle < 0) {
      if (fwdSpeed > 0.5) {
        fwdSpeed -= BRAKE_DECEL * dt; // brake while moving forward
        if (fwdSpeed < 0) fwdSpeed = 0;
      } else {
        fwdSpeed += spec.reverseAccel * throttle * dt; // reverse
        if (fwdSpeed < -8) fwdSpeed = -8;
      }
    } else {
      const d = ROLL_DECEL * dt;
      if (Math.abs(fwdSpeed) <= d) fwdSpeed = 0;
      else fwdSpeed -= Math.sign(fwdSpeed) * d;
    }
    if (handbrake) {
      const d = HANDBRAKE_DECEL * dt;
      if (Math.abs(fwdSpeed) <= d) fwdSpeed = 0;
      else fwdSpeed -= Math.sign(fwdSpeed) * d;
    }
    // Rebuild the velocity from the adjusted components on the OLD heading.
    this.vel.copy(fwd).multiplyScalar(fwdSpeed).addScaledVector(right, latSpeed);

    // Steering scales inversely with speed; heading follows the front axle.
    const steerMax = 0.55 / (1 + Math.abs(fwdSpeed) * 0.09);
    const targetSteer = steerInput * steerMax;
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 10);
    this.heading += (fwdSpeed / spec.wheelBase) * Math.tan(this.steer) * dt;

    // Re-split the (unchanged) velocity on the NEW heading. The turn itself
    // creates a lateral component; grip damps it. High grip = velocity tracks
    // the heading (normal driving); low grip under handbrake = the velocity
    // vector diverges from the heading: a drift.
    const fwd2 = this.forwardVector(new THREE.Vector3());
    const right2 = this.rightVector(new THREE.Vector3());
    fwdSpeed = this.vel.dot(fwd2);
    latSpeed = this.vel.dot(right2);
    const grip = handbrake ? 4.0 : spec.grip;
    latSpeed *= Math.exp(-grip * dt);
    this.vel.copy(fwd2).multiplyScalar(fwdSpeed).addScaledVector(right2, latSpeed);
    this.speed = fwdSpeed;

    this.pos.addScaledVector(this.vel, dt);
    this.pos.y = groundHeightAt(this.pos.x, this.pos.z);
    this.resolveCollisions();

    // Wheels: spin proportional to forward speed, fronts yaw with steering.
    this.spin += (fwdSpeed / WHEEL_RADIUS) * dt;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.spin;
      if (w.front) w.steer.rotation.y = this.steer;
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    this.updateHeadlights();
    // Fase 11B — lampu rem menyala saat mengerem (S) atau handbrake.
    const braking = (throttle < 0 && fwdSpeed > 0.5) || handbrake;
    setBrakeLights(this.group, braking);
    this._updateTireMarks(dt, handbrake);
    return this;
  }

  // --- Fase 11B: bekas ban -----------------------------------------------
  // Handbrake + kecepatan >8 m/s: quad datar di posisi roda belakang tiap
  // 0,15 dtk, fade 10 dtk lalu dispose, cap 60.
  _dropTireMark() {
    if (!this.ctx.scene) return;
    if (this.tireMarks.length >= MARK_MAX) {
      const old = this.tireMarks.shift();
      this.ctx.scene.remove(old.mesh);
      old.mesh.material.dispose();
    }
    const fwd = this.forwardVector(new THREE.Vector3());
    const right = this.rightVector(new THREE.Vector3());
    const rearZ = -this.length / 2 + 0.7;
    for (const side of [-1, 1]) {
      const x = this.pos.x + right.x * (side * (this.width / 2 - 0.1)) + fwd.x * rearZ;
      const z = this.pos.z + right.z * (side * (this.width / 2 - 0.1)) + fwd.z * rearZ;
      const mat = new THREE.MeshBasicMaterial({
        color: 0x0a0a0a, transparent: true, opacity: MARK_OPACITY, depthWrite: false,
      });
      const mesh = new THREE.Mesh(_markGeo, mat);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.y = this.heading;
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, groundHeightAt(x, z) + 0.02, z);
      this.ctx.scene.add(mesh);
      this.tireMarks.push({ mesh, age: 0 });
    }
  }

  _updateTireMarks(dt, handbrake) {
    for (let i = this.tireMarks.length - 1; i >= 0; i--) {
      const m = this.tireMarks[i];
      m.age += dt;
      const k = 1 - m.age / MARK_LIFE;
      if (k <= 0) {
        this.ctx.scene.remove(m.mesh);
        m.mesh.material.dispose();
        this.tireMarks.splice(i, 1);
      } else {
        m.mesh.material.opacity = MARK_OPACITY * k;
      }
    }
    if (handbrake && Math.abs(this.speed) > 8) {
      this._markTimer -= dt;
      if (this._markTimer <= 0) {
        this._markTimer = MARK_INTERVAL;
        this._dropTireMark();
      }
    } else {
      this._markTimer = 0;
    }
  }

  // Circle-vs-AABB push-out against world colliders; kills velocity into walls.
  resolveCollisions() {
    const r = COLLISION_RADIUS;
    const top = this.pos.y + 1.8;
    for (const b of this.ctx.colliders) {
      if (top <= b.minY || this.pos.y >= b.maxY) continue;
      const cx = Math.max(b.minX, Math.min(this.pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(this.pos.z, b.maxZ));
      const dx = this.pos.x - cx;
      const dz = this.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let nx, nz;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        nx = dx / d;
        nz = dz / d;
        this.pos.x = cx + nx * r;
        this.pos.z = cz + nz * r;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const penL = this.pos.x + r - b.minX;
        const penR = b.maxX - (this.pos.x - r);
        const penN = this.pos.z + r - b.minZ;
        const penS = b.maxZ - (this.pos.z - r);
        const m = Math.min(penL, penR, penN, penS);
        if (m === penL) { this.pos.x = b.minX - r; nx = -1; nz = 0; }
        else if (m === penR) { this.pos.x = b.maxX + r; nx = 1; nz = 0; }
        else if (m === penN) { this.pos.z = b.minZ - r; nx = 0; nz = -1; }
        else { this.pos.z = b.maxZ + r; nx = 0; nz = 1; }
      }
      const vn = this.vel.x * nx + this.vel.z * nz;
      if (vn < 0) {
        const impact = -vn; // komponen kecepatan ke dinding = kerasnya tabrakan
        this.vel.x -= nx * vn;
        this.vel.z -= nz * vn;
        this.vel.multiplyScalar(0.6); // scrub speed on a hard hit
        // Fase 11B — tabrakan keras pada mobil yang dikemudikan player:
        // tandai waktu tabrakan (camera.js membaca ini untuk shake) + shake
        // + suara benturan bila audio menyediakannya.
        if (impact > HARD_HIT_SPEED && this.ctx.player && this.ctx.player.driving === this) {
          this.ctx.player.collidedAt = performance.now();
          addCameraShake(this.ctx, 0.18, 0.35);
          const a = this.ctx.audio;
          if (a && typeof a.playCrash === 'function') a.playCrash();
        }
      }
    }
  }

  // Headlights only at night (hour < 6 or >= 19), per spec.
  updateHeadlights() {
    const h = this.ctx.time ? this.ctx.time.hour : 12;
    const night = h < 6 || h >= 19;
    for (const s of this.headlights) s.intensity = night ? 80 : 0;
    // Fase 11B — beam cone lampu depan ikut menyala saat malam.
    setHeadlightBeams(this.group, night);
  }

  // Signed distance from this car to a point, along its forward axis.
  forwardDistanceTo(x, z) {
    const fwd = this.forwardVector(new THREE.Vector3());
    return (x - this.pos.x) * fwd.x + (z - this.pos.z) * fwd.z;
  }

  headingTo(x, z) {
    return wrapAngle(Math.atan2(x - this.pos.x, z - this.pos.z) - this.heading);
  }
}
