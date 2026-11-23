// combat.js — Fase 7: CombatManager, daftar musuh (goon / polisi).
// registerEnemy menandai grup sebagai shootable; damageEnemy mengurangi hp,
// musuh mati jatuh 90 derajat lalu fade/dispose setelah 5 detik, kadang
// menjatuhkan cash kecil. Original code, written for this entry.
import * as THREE from 'three';
import { markShootable, groundHeightAt } from '../engine/collision.js';
import { addCameraShake } from '../engine/camera-rig.js';
import { spawnBlood, updateBloodParticles } from './weapons.js';

const FALL_TIME = 0.6; // detik sampai badan rebah 90 derajat
const CORPSE_TIME = 5; // detik badan tergeletak sebelum fade
const FADE_TIME = 1; // detik fade-out sebelum dispose
const DROP_CHANCE = 0.35;
const DROP_MIN = 5;
const DROP_MAX = 20;

// --- Fase 11B: ledakan -----------------------------------------------------
// Satu fireball + 24 partikel api + PointLight oranye + shake + screen flash
// + damage radius. Geometri bola dipakai bersama; material per-ledakan
// dibuat baru lalu di-dispose saat ledakan selesai.
const _explosionGeo = new THREE.SphereGeometry(1, 12, 8);
const _explosionParticleGeo = new THREE.SphereGeometry(0.12, 6, 4);

// pos: THREE.Vector3 (pusat ledakan). radius default 6m.
// Mengembalikan record ledakan aktif, atau null bila ctx.scene belum ada.
// Animasi + dispose dijalankan CombatManager.update (daftar this.explosions).
export function spawnExplosion(ctx, pos, radius = 6) {
  const scene = ctx && ctx.scene;
  if (!scene || !pos) return null;
  const group = new THREE.Group();
  group.position.copy(pos);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a18, transparent: true, opacity: 0.95 });
  const fireball = new THREE.Mesh(_explosionGeo, fireMat);
  fireball.scale.setScalar(0.5);
  group.add(fireball);
  const light = new THREE.PointLight(0xff8c2a, 120, radius * 4, 1.8);
  light.position.y = 1;
  group.add(light);
  const parts = [];
  for (let i = 0; i < 24; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() < 0.5 ? 0xffc21c : 0xff5a00,
      transparent: true,
    });
    const m = new THREE.Mesh(_explosionParticleGeo, mat);
    group.add(m);
    const a = Math.random() * Math.PI * 2;
    const sp = 4 + Math.random() * 8;
    parts.push({
      mesh: m,
      vel: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp),
      life: 0.5 + Math.random() * 0.4,
    });
  }
  scene.add(group);
  const ex = { group, fireball, fireMat, light, parts, t: 0, radius };

  // Daftarkan ke CombatManager bila ada, supaya update(dt) menganimasinya.
  const mgr = ctx.combat;
  if (mgr && Array.isArray(mgr.explosions)) mgr.explosions.push(ex);

  // Feel: shake + flash oranye.
  addCameraShake(ctx, 0.25, 0.5);
  if (typeof ctx.flashDamage === 'function') ctx.flashDamage('255,140,0', 250);
  else if (ctx.hud && typeof ctx.hud.flashScreen === 'function') ctx.hud.flashScreen('255,140,0', 250);

  // Damage radius: musuh dalam radius mati/terluka berat, player kena
  // damage yang mengecil seiring jarak.
  if (mgr && typeof mgr.damageEnemy === 'function') {
    for (const e of mgr.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d <= radius) mgr.damageEnemy(e, 100, e.pos.clone().setY(e.pos.y + 1.2));
    }
  }
  const p = ctx.player;
  if (p && typeof p.takeDamage === 'function' && !p.isDead) {
    const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
    if (d <= radius) p.takeDamage(Math.round(30 + 40 * (1 - d / radius)));
  }
  return ex;
}

// Animasikan + dispose satu ledakan. Dipakai CombatManager.update.
export function updateExplosion(ex, dt) {
  ex.t += dt;
  const k = Math.min(1, ex.t / 0.5);
  ex.fireball.scale.setScalar(0.5 + (ex.radius - 0.5) * k);
  ex.fireMat.opacity = 0.95 * (1 - k);
  ex.light.intensity = 120 * (1 - Math.min(1, ex.t / 0.6));
  for (const part of ex.parts) {
    part.life -= dt;
    part.vel.y -= 12 * dt; // gravitasi
    part.mesh.position.addScaledVector(part.vel, dt);
    part.mesh.material.opacity = Math.max(0, part.life / 0.9);
  }
  return ex.t < 0.9;
}

export function disposeExplosion(scene, ex) {
  if (scene) scene.remove(ex.group);
  ex.fireMat.dispose();
  ex.light.dispose();
  for (const part of ex.parts) part.mesh.material.dispose();
}

export class CombatManager {
  constructor(ctx, weaponSystem) {
    this.ctx = ctx;
    this.weaponSystem = weaponSystem || null;
    this.enemies = []; // { group, hp, maxHp, pos, alive, kind, state, fallT, fadeT, droppedCash }
    this.explosions = []; // record ledakan aktif (Fase 11B)
    // Daftarkan spawn ledakan ke ctx supaya misi/sistem lain bisa memakainya.
    ctx.spawnExplosion = (pos, r) => spawnExplosion(ctx, pos, r);
    ctx.spawnExplosionAt = (x, z, r) => this.spawnExplosionAt(x, z, r);
  }

  // Wrapper posisi: ledakan di (x, z), 1m di atas tanah.
  spawnExplosionAt(x, z, radius = 6) {
    const y = groundHeightAt(x, z) + 1;
    return spawnExplosion(this.ctx, new THREE.Vector3(x, y, z), radius);
  }

  // kind: 'goon' | 'police'. Mengembalikan record musuh.
  registerEnemy(group, hp = 100, kind = 'goon') {
    const enemy = {
      group,
      hp,
      maxHp: hp,
      pos: group.position, // referensi hidup ke posisi grup
      alive: true,
      kind,
      state: 'alive', // alive | falling | fading | gone
      fallT: 0,
      fadeT: 0,
      droppedCash: 0,
    };
    markShootable(group);
    group.traverse((o) => {
      o.userData.enemyRef = enemy;
    });
    this.enemies.push(enemy);
    return enemy;
  }

  // Hapus musuh dari daftar (dipakai saat officer di-dismiss, mis. respawn).
  removeEnemy(enemy) {
    if (!enemy) return false;
    const i = this.enemies.indexOf(enemy);
    if (i < 0) return false;
    this.enemies.splice(i, 1);
    if (enemy.group && enemy.group.parent) enemy.group.parent.remove(enemy.group);
    return true;
  }

  getEnemies() {
    return this.enemies.filter((e) => e.alive);
  }

  nearestEnemy(pos, maxDist = Infinity) {
    let best = null;
    let bestD = maxDist;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  damageEnemy(enemy, dmg, hitPoint) {
    if (!enemy || !enemy.alive) return false;
    enemy.hp -= dmg;
    if (hitPoint) spawnBlood(this.ctx.scene, hitPoint);
    if (enemy.hp > 0) return true;
    // Mati: mulai jatuh; cash drop kadang-kadang.
    enemy.hp = 0;
    enemy.alive = false;
    enemy.state = 'falling';
    enemy.fallT = 0;
    if (Math.random() < DROP_CHANCE) {
      const amount = DROP_MIN + Math.floor(Math.random() * (DROP_MAX - DROP_MIN + 1));
      enemy.droppedCash = amount;
      const p = this.ctx.player;
      if (p) p.cash += amount;
    }
    return true;
  }

  _disposeGroup(group) {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
  }

  update(dt) {
    for (const e of this.enemies) {
      if (e.state === 'falling') {
        e.fallT += dt;
        // Rebah 90 derajat (rotasi X) selama FALL_TIME.
        const k = Math.min(1, e.fallT / FALL_TIME);
        e.group.rotation.x = -(Math.PI / 2) * k;
        if (e.fallT >= CORPSE_TIME) {
          e.state = 'fading';
          e.fadeT = 0;
          e.group.traverse((o) => {
            if (o.material) {
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              for (const m of mats) m.transparent = true;
            }
          });
        }
      } else if (e.state === 'fading') {
        e.fadeT += dt;
        const k = Math.max(0, 1 - e.fadeT / FADE_TIME);
        e.group.traverse((o) => {
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) m.opacity = k;
          }
        });
        if (e.fadeT >= FADE_TIME) {
          e.state = 'gone';
          if (e.group.parent) e.group.parent.remove(e.group);
          this._disposeGroup(e.group);
        }
      }
    }
    // Buang record yang sudah 'gone' supaya getEnemies/nearest bersih.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].state === 'gone') this.enemies.splice(i, 1);
    }
    updateBloodParticles(this.ctx.scene, dt);
    // Fase 11B — animasikan ledakan aktif, dispose yang sudah selesai.
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      if (!updateExplosion(ex, dt)) {
        disposeExplosion(this.ctx.scene, ex);
        this.explosions.splice(i, 1);
      }
    }
  }
}
