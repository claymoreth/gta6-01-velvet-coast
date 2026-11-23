// police.js — Fase 7: PoliceOfficer. NPC polisi berseragam biru gelap yang
// keluar dari mobil patroli (wanted >= 3), mengejar player, menembak pistol
// bila jarak < 30m. Juga menangani kematian player: fade hitam, respawn di
// rumah sakit (spawnPoints[0], downtown), cash -20% (cap $500), wanted 0.
// Original code, written for this entry.
import * as THREE from 'three';
import { groundHeightAt, resolveCapsule } from '../engine/collision.js';

const OFFICER_HP = 100;
const CHASE_SPEED = 3.5; // m/s
const STOP_DIST = 8; // berhenti mengejar sedekat ini
const SHOOT_RANGE = 30; // meter
const SHOOT_INTERVAL = 0.9; // detik antar tembakan
const SHOT_DAMAGE = 8;
const MAX_OFFICERS = 4;
const RESPAWN_DELAY = 2; // detik fade hitam sebelum respawn
const CASH_LOSS_PCT = 0.2;
const CASH_LOSS_CAP = 500;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Mesh polisi dari boxes: seragam biru gelap + topi.
function buildOfficerMesh() {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.9 });
  const navyDark = new THREE.MeshStandardMaterial({ color: 0x121e36, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.75, 0.3), navy);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);
  // Lencana kecil di dada.
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xd8b13c, roughness: 0.3, metalness: 0.7 }));
  badge.position.set(-0.12, 1.28, 0.16);
  group.add(badge);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  group.add(head);
  // Topi polisi: silinder + lidah (brim).
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.12, 14), navyDark);
  cap.position.y = 1.86;
  group.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.2), black);
  brim.position.set(0, 1.81, 0.22);
  group.add(brim);

  const legGeo = new THREE.BoxGeometry(0.17, 0.68, 0.19);
  legGeo.translate(0, -0.34, 0);
  const legL = new THREE.Mesh(legGeo, navyDark);
  legL.position.set(-0.12, 0.7, 0);
  legL.castShadow = true;
  const legR = new THREE.Mesh(legGeo, navyDark);
  legR.position.set(0.12, 0.7, 0);
  legR.castShadow = true;
  group.add(legL, legR);

  const armGeo = new THREE.BoxGeometry(0.13, 0.62, 0.15);
  armGeo.translate(0, -0.31, 0);
  const armL = new THREE.Mesh(armGeo, navy);
  armL.position.set(-0.31, 1.42, 0);
  const armR = new THREE.Mesh(armGeo, navy);
  armR.position.set(0.31, 1.42, 0);
  group.add(armL, armR);
  // Pistol di tangan kanan.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.22), black);
  gun.position.set(0.31, 1.05, 0.12);
  group.add(gun);

  return { group, legL, legR, armL, armR };
}

export class PoliceOfficer {
  constructor(ctx) {
    this.ctx = ctx;
    this.officers = []; // { group, pos, hp, alive, shootTimer, walkPhase, legL, legR, enemyRef }
    this.deathInProgress = false;
    this.fadeEl = null;
    // Daftarkan death handler: Player.die() memanggil ctx.onPlayerDeath.
    ctx.onPlayerDeath = () => this.handlePlayerDeath();
  }

  spawnOfficer(pos) {
    if (this.officers.filter((o) => o.alive).length >= MAX_OFFICERS) return null;
    const built = buildOfficerMesh();
    const x = pos.x;
    const z = pos.z;
    built.group.position.set(x, groundHeightAt(x, z), z);
    this.ctx.scene.add(built.group);
    const officer = {
      group: built.group,
      pos: built.group.position, // referensi hidup
      hp: OFFICER_HP,
      alive: true,
      shootTimer: 0.5 + Math.random() * 0.5,
      walkPhase: Math.random() * Math.PI * 2,
      legL: built.legL,
      legR: built.legR,
      armL: built.armL,
      armR: built.armR,
      enemyRef: null,
    };
    // Bisa ditembak mati oleh player (CombatManager yang menjatuhkannya).
    if (this.ctx.combat && typeof this.ctx.combat.registerEnemy === 'function') {
      officer.enemyRef = this.ctx.combat.registerEnemy(built.group, OFFICER_HP, 'police');
    }
    this.officers.push(officer);
    return officer;
  }

  _removeOfficer(officer) {
    const i = this.officers.indexOf(officer);
    if (i >= 0) this.officers.splice(i, 1);
    if (officer.enemyRef && this.ctx.combat) {
      this.ctx.combat.removeEnemy(officer.enemyRef);
    }
    if (officer.group.parent) officer.group.parent.remove(officer.group);
  }

  update(dt) {
    const p = this.ctx.player;
    for (let i = this.officers.length - 1; i >= 0; i--) {
      const o = this.officers[i];
      // Mati ditembak: CombatManager sudah menjatuhkan grupnya; buang record.
      if (o.enemyRef && !o.enemyRef.alive) {
        o.alive = false;
        if (o.enemyRef.state === 'gone') {
          this.officers.splice(i, 1);
        }
        continue;
      }
      if (!o.alive || !p || p.isDead) continue;

      const dx = p.pos.x - o.pos.x;
      const dz = p.pos.z - o.pos.z;
      const dist = Math.hypot(dx, dz);
      o.group.rotation.y = Math.atan2(dx, dz);

      // Kejar player sampai 8m; jalan 3,5 m/s, hindari gedung via colliders.
      if (dist > STOP_DIST) {
        o.walkPhase += dt * 8;
        const step = CHASE_SPEED * dt;
        o.pos.x += (dx / dist) * step;
        o.pos.z += (dz / dist) * step;
        o.pos.y = groundHeightAt(o.pos.x, o.pos.z);
        resolveCapsule(o.pos, 0.35, 1.8, this.ctx.colliders);
        const sw = Math.sin(o.walkPhase) * 0.5;
        o.legL.rotation.x = sw;
        o.legR.rotation.x = -sw;
        o.armL.rotation.x = -sw * 0.6;
        o.armR.rotation.x = sw * 0.6;
      } else {
        o.legL.rotation.x = 0;
        o.legR.rotation.x = 0;
        o.armL.rotation.x = 0;
        o.armR.rotation.x = 0;
      }

      // Tembak pistol bila line-of-sight (jarak) < 30m, tiap 0,9 detik.
      // Akurasi menurun dengan jarak: 80% dekat -> 15% di 30m.
      if (dist < SHOOT_RANGE) {
        o.shootTimer -= dt;
        if (o.shootTimer <= 0) {
          o.shootTimer = SHOOT_INTERVAL;
          const hitChance = clamp(0.8 - dist / 50, 0.15, 0.8);
          const a = this.ctx.audio;
          if (a && typeof a.playGunshot === 'function') a.playGunshot();
          if (Math.random() < hitChance && typeof p.takeDamage === 'function') {
            p.takeDamage(SHOT_DAMAGE);
          }
        }
      }
    }
  }

  // --- Kematian player: fade hitam -> respawn rumah sakit (2 detik) ---
  _getFadeEl() {
    if (this.fadeEl) return this.fadeEl;
    let el = document.getElementById('fade');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fade';
      el.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;'
        + 'pointer-events:none;transition:opacity 0.6s ease;z-index:9999;';
      document.body.appendChild(el);
    }
    this.fadeEl = el;
    return el;
  }

  handlePlayerDeath() {
    if (this.deathInProgress) return;
    this.deathInProgress = true;
    const p = this.ctx.player;
    const fade = this._getFadeEl();
    fade.style.opacity = '1';
    setTimeout(() => {
      if (!p) return;
      // Respawn di rumah sakit: spawnPoints[0] (downtown, 6, 20) — aman.
      const spawn = (this.ctx.spawnPoints && this.ctx.spawnPoints[0])
        || { x: 6, z: 20 };
      if (p.driving) p.driving = null;
      p.pos.set(spawn.x, groundHeightAt(spawn.x, spawn.z), spawn.z);
      p.vel.set(0, 0, 0);
      if (p.mesh && p.mesh.group) {
        p.mesh.group.position.copy(p.pos);
        p.mesh.group.visible = true;
      }
      // Cash hilang 20%, cap $500.
      const lost = Math.min(p.cash * CASH_LOSS_PCT, CASH_LOSS_CAP);
      p.cash = Math.max(0, p.cash - lost);
      // Wanted reset 0.
      if (this.ctx.wantedSystem && typeof this.ctx.wantedSystem.setStars === 'function') {
        this.ctx.wantedSystem.setStars(0);
      } else {
        this.ctx.wanted = 0;
      }
      // Officer di lapangan dibubarkan (tidak ikut respawn).
      for (const o of [...this.officers]) this._removeOfficer(o);
      // HP penuh, hidup lagi.
      p.hp = p.maxHp;
      p.isDead = false;
      fade.style.opacity = '0';
      this.deathInProgress = false;
    }, RESPAWN_DELAY * 1000);
  }
}
