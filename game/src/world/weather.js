// weather.js — rain particle system + wet-road handling (Wave 11A).
// Original code, written for this entry.
// NOTE: main.js constructs `new Weather()` with no args, so this class
// lazily attaches to the scene: buildSky() calls attach(ctx) during
// buildCity, and update() falls back to window.__velvet (dev hook).
import * as THREE from 'three';
import { setRainExposure } from '../engine/renderer.js';

const RAIN_COUNT = 2000;
const BOX_W = 120;
const BOX_H = 60;
const BOX_D = 120;
const FALL_SPEED = 30; // m/s
const STREAK = 1.4; // visible streak length of one drop

export class Weather {
  constructor(ctx = null) {
    this.mode = 'clear';
    this.rainIntensity = 0;
    this.isRaining = false;
    this._ctx = ctx;
    this._scene = null;
    this._rain = null;
    this._positions = null;
    this._dropX = null;
    this._dropZ = null;
    this._dropY = null;
    this._wetMats = new Map(); // material -> { roughness, metalness }
    this._wetApplied = false;
    if (ctx) this.attach(ctx);
  }

  // Create the LineSegments rain field and add it to the scene.
  attach(ctx) {
    if (this._scene || !ctx || !ctx.scene) return false;
    this._ctx = ctx;
    this._scene = ctx.scene;
    const positions = new Float32Array(RAIN_COUNT * 2 * 3);
    this._dropX = new Float32Array(RAIN_COUNT);
    this._dropZ = new Float32Array(RAIN_COUNT);
    this._dropY = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      this._dropX[i] = (Math.random() - 0.5) * BOX_W;
      this._dropZ[i] = (Math.random() - 0.5) * BOX_D;
      this._dropY[i] = Math.random() * BOX_H;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xaac4de,
      transparent: true,
      opacity: 0.35,
    });
    this._rain = new THREE.LineSegments(geo, mat);
    this._rain.visible = this.isRaining;
    this._rain.frustumCulled = false; // positions are rewritten every frame
    this._scene.add(this._rain);
    this._positions = positions;
    // Re-apply any rain state that was set before attach().
    this._wetApplied = false;
    this.applyWetRoads(this.isRaining);
    if (this._ctx.renderer) setRainExposure(this._ctx.renderer, this.isRaining);
    return true;
  }

  setWeather(m) {
    if (m !== 'clear' && m !== 'rain') return this.mode;
    this.mode = m;
    this.setRain(m === 'rain' ? 1 : 0);
    return this.mode;
  }

  setRain(intensity) {
    const v = Math.max(0, Math.min(1, Number(intensity) || 0));
    this.rainIntensity = v;
    this.isRaining = v > 0.05;
    this.mode = this.isRaining ? 'rain' : 'clear';
    if (this._rain) {
      this._rain.visible = this.isRaining;
      this._rain.material.opacity = 0.12 + 0.3 * v;
    }
    this.applyWetRoads(this.isRaining);
    if (this._ctx && this._ctx.renderer) {
      setRainExposure(this._ctx.renderer, this.isRaining);
    }
    return this.rainIntensity;
  }

  // Wet look: lower roughness + slight metalness boost on every material
  // flagged userData.wettable (roads.js marks asphalt + crosswalks).
  // Original values are saved so dry restores them exactly.
  applyWetRoads(wet) {
    if (!this._scene) return;
    if (wet === this._wetApplied) return;
    this._wetApplied = wet;
    const mats = new Set();
    this._scene.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of list) {
        if (m.userData && m.userData.wettable) mats.add(m);
      }
    });
    for (const m of mats) {
      if (wet) {
        if (!this._wetMats.has(m)) {
          this._wetMats.set(m, { roughness: m.roughness, metalness: m.metalness });
        }
        m.roughness = 0.35;
        m.metalness = Math.min(1, (m.metalness || 0) + 0.15);
      } else if (this._wetMats.has(m)) {
        const orig = this._wetMats.get(m);
        m.roughness = orig.roughness;
        m.metalness = orig.metalness;
        this._wetMats.delete(m);
      }
    }
    if (
      this._ctx &&
      this._ctx.puddles &&
      typeof this._ctx.puddles.setPuddlesVisible === 'function'
    ) {
      this._ctx.puddles.setPuddlesVisible(wet);
    }
  }

  update(dt) {
    if (!this._scene && typeof window !== 'undefined' && window.__velvet) {
      this.attach(window.__velvet);
    }
    if (!this._rain || !this._rain.visible) return;
    const ctx = this._ctx;
    let ax = 0;
    let az = 0;
    if (ctx && ctx.player && ctx.player.pos) {
      ax = ctx.player.pos.x;
      az = ctx.player.pos.z;
    } else if (ctx && ctx.camera) {
      ax = ctx.camera.position.x;
      az = ctx.camera.position.z;
    }
    const pos = this._positions;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y = this._dropY[i] - FALL_SPEED * dt;
      if (y < 0) y += BOX_H;
      this._dropY[i] = y;
      const o = i * 6;
      pos[o] = ax + this._dropX[i];
      pos[o + 1] = y;
      pos[o + 2] = az + this._dropZ[i];
      pos[o + 3] = ax + this._dropX[i];
      pos[o + 4] = y + STREAK;
      pos[o + 5] = az + this._dropZ[i];
    }
    this._rain.geometry.attributes.position.needsUpdate = true;
  }
}
