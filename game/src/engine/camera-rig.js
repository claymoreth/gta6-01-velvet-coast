// camera-rig.js — third-person camera rig with far/close modes (V toggles).
// Original code, written for this entry.
import * as THREE from 'three';
import { groundHeightAt } from './collision.js';

const MODES = {
  far: new THREE.Vector3(0, 3.5, -7),
  close: new THREE.Vector3(0, 2.5, -4.5),
  chase: new THREE.Vector3(0, 4, -10),
};

export class CameraRig {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.mode = 'far';
    this.chaseVehicle = null;
    this.smoothed = new THREE.Vector3(0, 4, -10);
    this.lookTarget = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    // Fase 11B — camera shake: amp (meter) + sisa waktu (detik).
    this.shakeAmp = 0;
    this.shakeDur = 0.001;
    this.shakeTime = 0;
  }

  // Tambah guncangan; amp yang lebih besar menimpa yang kecil, durasi reset.
  addShake(amp, dur) {
    if (amp <= 0 || dur <= 0) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeDur = dur;
    this.shakeTime = dur;
  }

  // Offset acak kecil ke posisi kamera; dipanggil tiap frame setelah lerp.
  // Skala mengecil seiring sisa waktu: offset *= amp * (time/dur).
  applyShake(camera, dt) {
    if (this.shakeTime <= 0) return;
    this.shakeTime -= dt;
    if (this.shakeTime <= 0) {
      this.shakeAmp = 0;
      return;
    }
    const k = this.shakeAmp * (this.shakeTime / this.shakeDur);
    camera.position.x += (Math.random() * 2 - 1) * k;
    camera.position.y += (Math.random() * 2 - 1) * k * 0.7;
    camera.position.z += (Math.random() * 2 - 1) * k;
  }

  toggleMode() {
    this.mode = this.mode === 'far' ? 'close' : 'far';
  }

  setChase(vehicle) {
    this.chaseVehicle = vehicle;
  }

  clearChase() {
    this.chaseVehicle = null;
  }

  update(dt, target) {
    // Chase cam follows the driven car (heading-based), not the mouse yaw.
    if (this.chaseVehicle) {
      const v = this.chaseVehicle;
      const pullback = Math.abs(v.speed) * 0.08; // speed-based pullback
      const base = MODES.chase;
      const cosH = Math.cos(v.heading);
      const sinH = Math.sin(v.heading);
      const oz = base.z - pullback;
      const ox = base.x * cosH - oz * sinH;
      const oz2 = base.x * sinH + oz * cosH;
      this._offset.set(ox, base.y, oz2);
      this._desired.copy(v.pos).add(this._offset);
      const ground = groundHeightAt(this._desired.x, this._desired.z);
      if (this._desired.y < ground + 0.5) this._desired.y = ground + 0.5;
      // Lerp factor 0.15 per frame at 60fps; smooth 0.3s hand-off from on-foot.
      const k = 1 - Math.exp(-9 * dt);
      this.smoothed.lerp(this._desired, k);
      this.camera.position.copy(this.smoothed);
      this.lookTarget.copy(v.pos).add(new THREE.Vector3(0, 1.6, 0));
      this.camera.lookAt(this.lookTarget);
      this.applyShake(this.camera, dt);
      return;
    }
    if (this.input.consumePressed('KeyV')) this.toggleMode();
    const yaw = this.input.yaw;
    const pitch = this.input.pitch;
    const base = MODES[this.mode];
    // Offset rotated by yaw around Y, then pitched.
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const ox = base.x * cosY - base.z * sinY;
    const oz = base.x * sinY + base.z * cosY;
    const oy = base.y + Math.sin(pitch) * Math.abs(base.z) * 0.6;
    this._offset.set(ox, oy, oz);
    this._desired.copy(target).add(this._offset);
    // Never let the camera sink under the ground.
    const ground = groundHeightAt(this._desired.x, this._desired.z);
    if (this._desired.y < ground + 0.5) this._desired.y = ground + 0.5;
    const k = 1 - Math.exp(-8 * dt);
    this.smoothed.lerp(this._desired, k);
    this.camera.position.copy(this.smoothed);
    this.lookTarget.copy(target).add(new THREE.Vector3(0, 1.6, 0));
    this.camera.lookAt(this.lookTarget);
    this.applyShake(this.camera, dt);
  }
}

// --- Fase 11B helpers (module-level, aman dipanggil dari mana saja) ---
export function addCameraShake(ctx, amp, dur) {
  const rig = ctx && ctx.cameraRig;
  if (rig && typeof rig.addShake === 'function') rig.addShake(amp, dur);
}

// Kick kecil saat menembak.
export function shakeOnShoot(ctx) {
  addCameraShake(ctx, 0.06, 0.12);
}

// Guncangan besar saat ledakan.
export function shakeOnExplosion(ctx) {
  addCameraShake(ctx, 0.25, 0.5);
}
