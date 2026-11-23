// weapons.js — Fase 7: WeaponSystem (fists / pistol / SMG) + blood particles.
// Original code, written for this entry. No network, no fetch.
// Raycast dari tengah kamera; kena musuh -> damage via CombatManager,
// kena pedestrian -> wanted naik. Muzzle flash + reload dip di view-model.
import * as THREE from 'three';
import { raycastWorld } from '../engine/collision.js';

// rate = tembakan per detik. fists 0.5/dtk, pistol 2.5/dtk, SMG 9/dtk.
export const WEAPON_DEFS = {
  fists: { damage: 15, range: 1.8, rate: 0.5, magSize: Infinity, reloadTime: 0, reserveStart: Infinity },
  pistol: { damage: 34, range: 60, rate: 2.5, magSize: 12, reloadTime: 1.8, reserveStart: 48 },
  smg: { damage: 18, range: 45, rate: 9, magSize: 30, reloadTime: 1.8, reserveStart: 120 },
};

const BLOOD_COLOR = 0xa01818;
const MAX_BLOOD_PARTICLES = 300;

// ---------------------------------------------------------------------------
// BloodParticles: 8-12 sphere merah kecil dengan velocity + gravitasi.
// Satu sistem per scene (WeakMap); updateBloodParticles(dt) dipanggil dari
// WeaponSystem.update / CombatManager.update.
// ---------------------------------------------------------------------------
const _bloodGeo = new THREE.SphereGeometry(0.035, 6, 4);
const _bloodMat = new THREE.MeshBasicMaterial({ color: BLOOD_COLOR });
const _bloodSystems = new WeakMap();

export class BloodParticles {
  constructor(scene) {
    this.scene = scene;
    this.particles = []; // { mesh, vel, life }
    _bloodSystems.set(scene, this);
  }

  spawn(pos, count = 10) {
    const n = count || 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_BLOOD_PARTICLES) {
        const old = this.particles.shift();
        this.scene.remove(old.mesh);
      }
      const mesh = new THREE.Mesh(_bloodGeo, _bloodMat);
      mesh.position.copy(pos);
      mesh.position.x += (Math.random() - 0.5) * 0.15;
      mesh.position.y += (Math.random() - 0.5) * 0.15;
      mesh.position.z += (Math.random() - 0.5) * 0.15;
      this.scene.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const up = 1 + Math.random() * 2.5;
      const out = 0.5 + Math.random() * 2;
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.sin(a) * out, up, Math.cos(a) * out),
        life: 0.6 + Math.random() * 0.5,
      });
    }
    return this;
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 12 * dt; // gravitasi
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.life <= 0 || p.mesh.position.y < 0.02) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }
}

// Fungsi praktis sesuai spek: spawnBlood(scene, pos) memakai sistem scene itu.
export function spawnBlood(scene, pos, count) {
  let sys = _bloodSystems.get(scene);
  if (!sys) sys = new BloodParticles(scene);
  sys.spawn(pos, count);
  return sys;
}

export function updateBloodParticles(scene, dt) {
  const sys = _bloodSystems.get(scene);
  if (sys) sys.update(dt);
}

// ---------------------------------------------------------------------------
// WeaponSystem
// ---------------------------------------------------------------------------
export class WeaponSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.currentWeapon = 'fists';
    this._ammo = { fists: Infinity, pistol: WEAPON_DEFS.pistol.magSize, smg: WEAPON_DEFS.smg.magSize };
    this._reserve = { fists: Infinity, pistol: WEAPON_DEFS.pistol.reserveStart, smg: WEAPON_DEFS.smg.reserveStart };
    this.reloadT = 0; // detik tersisa; 0 = tidak reload
    this.lastShotAt = -10;
    this.flashT = 0;
    this.raycaster = new THREE.Raycaster();
    this.blood = new BloodParticles(ctx.scene);
    this.mouseDown = false;

    // mouseDown tidak ada di input.js — lacak sendiri di canvas game.
    // movement.js membaca input.mouseDown; sinkronkan ke sana juga.
    const input = ctx.input;
    if (input) input.mouseDown = false;
    const canvas = (ctx.renderer && ctx.renderer.domElement) || document.getElementById('game');
    if (canvas) {
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          this.mouseDown = true;
          if (input) input.mouseDown = true;
        }
      });
    }
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
        if (input) input.mouseDown = false;
      }
    });

    // View-model senjata sederhana di kamera (kotak gelap + laras).
    this.gunGroup = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.5, metalness: 0.6 });
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), gunMat);
    grip.position.set(0, -0.06, 0);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.34), gunMat);
    barrel.position.set(0, 0.02, -0.18);
    this.barrel = barrel;
    this.gunGroup.add(grip, barrel);
    // Muzzle flash: PointLight oranye kecil di ujung laras, denyut ~80ms.
    this.flash = new THREE.PointLight(0xffa040, 0, 7, 1.5);
    this.flash.position.set(0, 0.02, -0.38);
    this.gunGroup.add(this.flash);
    this.gunGroup.position.set(0.34, -0.28, -0.55);
    this.gunGroup.visible = false; // fists: tangan kosong
    if (ctx.camera) ctx.camera.add(this.gunGroup);
  }

  // Ammo mag senjata aktif; reserve ammo-nya. fists = Infinity.
  get ammo() {
    return this._ammo[this.currentWeapon];
  }
  get reserveAmmo() {
    return this._reserve[this.currentWeapon];
  }

  equip(name) {
    if (!WEAPON_DEFS[name] || name === this.currentWeapon) return false;
    this.currentWeapon = name;
    this.reloadT = 0;
    const p = this.ctx.player;
    if (p) {
      p.weapon = name;
      p.armed = name !== 'fists';
    }
    this.gunGroup.visible = name !== 'fists';
    // SMG larasnya lebih panjang dari pistol.
    this.barrel.scale.z = name === 'smg' ? 1.5 : 1;
    return true;
  }

  reload() {
    const def = WEAPON_DEFS[this.currentWeapon];
    if (this.reloadT > 0 || !isFinite(def.magSize)) return false;
    if (this._ammo[this.currentWeapon] >= def.magSize) return false;
    if (this._reserve[this.currentWeapon] <= 0) return false;
    this.reloadT = def.reloadTime;
    return true;
  }

  _finishReload() {
    const def = WEAPON_DEFS[this.currentWeapon];
    const need = def.magSize - this._ammo[this.currentWeapon];
    const take = Math.min(need, this._reserve[this.currentWeapon]);
    this._ammo[this.currentWeapon] += take;
    this._reserve[this.currentWeapon] -= take;
  }

  _playShot() {
    const a = this.ctx.audio;
    if (a && typeof a.playGunshot === 'function') a.playGunshot();
  }

  _muzzleFlash() {
    this.flash.intensity = 26;
    this.flashT = 0.08; // denyut 80ms
  }

  _registerShot() {
    const p = this.ctx.player;
    if (p) {
      this.ctx.lastGunshot = { x: p.pos.x, z: p.pos.z, time: performance.now() };
    }
  }

  // Cari pedestrian terdekat dari sebuah titik (untuk melee + raycast ped).
  _nearestPed(pos, maxDist) {
    const mgr = this.ctx.pedestrians;
    if (!mgr || !mgr.peds) return null;
    let best = null;
    let bestD = maxDist;
    for (const ped of mgr.peds) {
      const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best ? { ped: best, dist: bestD } : null;
  }

  _crime(points) {
    const w = this.ctx.wantedSystem;
    if (w && typeof w.addCrime === 'function') {
      const p = this.ctx.player;
      w.addCrime(points, p ? p.pos : null);
    }
  }

  fire() {
    const p = this.ctx.player;
    if (!p || p.isDead || p.driving) return false;
    if (this.reloadT > 0) return false;
    const def = WEAPON_DEFS[this.currentWeapon];
    const now = performance.now() / 1000;
    if (now - this.lastShotAt < 1 / def.rate) return false; // rate limit
    if (isFinite(def.magSize)) {
      if (this._ammo[this.currentWeapon] <= 0) {
        this.reload(); // mag kosong: reload otomatis
        return false;
      }
      this._ammo[this.currentWeapon] -= 1;
    }
    this.lastShotAt = now;
    this._playShot();
    this._registerShot();

    // --- Fists: melee jarak dekat, tanpa raycast ---
    if (this.currentWeapon === 'fists') {
      const combat = this.ctx.combat;
      const enemy = combat ? combat.nearestEnemy(p.pos, def.range) : null;
      if (enemy) {
        const hit = enemy.pos.clone();
        hit.y += 1.2;
        combat.damageEnemy(enemy, def.damage, hit);
        return true;
      }
      const near = this._nearestPed(p.pos, def.range);
      if (near) {
        const hit = near.ped.pos.clone();
        hit.y += 1.2;
        spawnBlood(this.ctx.scene, hit);
        this._crime(50);
      }
      return true;
    }

    // --- Senjata api: raycast dari tengah kamera ---
    this._muzzleFlash();
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.ctx.camera);
    this.raycaster.far = def.range;
    const hit = raycastWorld(this.ctx, this.raycaster.ray.origin, this.raycaster.ray.direction, def.range);
    let enemyHit = null;
    let enemyDist = Infinity;
    if (hit && hit.object.userData.enemyRef) {
      enemyHit = hit;
      enemyDist = hit.distance;
    }

    // Pedestrian biasa: raycast terpisah ke grup ped (tidak shootable).
    let pedHit = null;
    let pedDist = Infinity;
    const mgr = this.ctx.pedestrians;
    if (mgr && mgr.peds && mgr.peds.length) {
      const groups = mgr.peds.map((pd) => pd.mesh.group);
      const groupOf = new Map(groups.map((g, i) => [g, mgr.peds[i]]));
      const hits = this.raycaster.intersectObjects(groups, true);
      if (hits.length) {
        let o = hits[0].object;
        while (o && !groupOf.has(o)) o = o.parent;
        if (o) {
          pedHit = { ped: groupOf.get(o), point: hits[0].point };
          pedDist = hits[0].distance;
        }
      }
    }

    // Yang paling dekat yang kena.
    if (enemyHit && enemyDist <= pedDist) {
      const enemy = hit.object.userData.enemyRef;
      if (this.ctx.combat) {
        this.ctx.combat.damageEnemy(enemy, def.damage, hit.point);
      } else {
        spawnBlood(this.ctx.scene, hit.point);
      }
      if (enemy.kind === 'police') this._crime(40); // menembak polisi
    } else if (pedHit) {
      spawnBlood(this.ctx.scene, pedHit.point);
      this._crime(100); // menembak warga sipil
    }
    return true;
  }

  update(dt) {
    // Reload: senjata menunduk selama reloadTime, lalu mag terisi.
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      const def = WEAPON_DEFS[this.currentWeapon];
      const phase = 1 - Math.max(0, this.reloadT) / def.reloadTime;
      this.gunGroup.rotation.x = -0.6 * Math.sin(phase * Math.PI);
      if (this.reloadT <= 0) {
        this.reloadT = 0;
        this.gunGroup.rotation.x = 0;
        this._finishReload();
      }
    }
    // Muzzle flash padam dalam ~80ms.
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.intensity = 0;
    }
    updateBloodParticles(this.ctx.scene, dt);
  }
}
