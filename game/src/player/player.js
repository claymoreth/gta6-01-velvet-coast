// player.js — Marco Varela: position, velocity, onGround, speed.
// Original code, written for this entry.
import * as THREE from 'three';
import { applyMovement } from './movement.js';
import { createPlayerMesh, flashHit } from './player-mesh.js';

export class Player {
  constructor(ctx) {
    this.ctx = ctx;
    const spawn = ctx.spawnPoints && ctx.spawnPoints[0] ? ctx.spawnPoints[0] : { x: 6, z: 20 };
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.vel = new THREE.Vector3();
    this.onGround = true;
    this.speed = 0;
    this.moving = false;
    this.radius = 0.4;
    this.height = 1.9;
    this.cash = 0;
    this.driving = null; // Vehicle instance while inside a car, else null
    // Fase 7 — combat stats.
    this.hp = 100;
    this.maxHp = 100;
    this.armor = 0;
    this.maxArmor = 100;
    this.weapon = 'fists';
    this.isDead = false;
    this.mesh = createPlayerMesh();
    ctx.scene.add(this.mesh.group);
    this.mesh.group.position.copy(this.pos);
  }

  // Fase 7 — combat: armor menyerap dulu, lalu HP. Mati -> die().
  takeDamage(amount) {
    if (this.isDead || amount <= 0) return;
    const absorbed = Math.min(this.armor, amount);
    this.armor -= absorbed;
    this.hp -= (amount - absorbed);
    // Flash luka: pakai ctx.screenFlash bila ada, kalau tidak tandai waktu.
    if (this.ctx && typeof this.ctx.screenFlash === 'function') {
      this.ctx.screenFlash();
    } else if (this.ctx) {
      this.ctx.playerHurtAt = performance.now();
    }
    // Kilau merah di mesh (player-mesh.js flashHit), defensif.
    if (this.mesh && typeof flashHit === 'function') flashHit(this.mesh);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    // Death handler (PoliceOfficer) bila terdaftar di ctx.onPlayerDeath.
    if (this.ctx && typeof this.ctx.onPlayerDeath === 'function') {
      this.ctx.onPlayerDeath();
    }
  }

  heal(amount) {
    if (this.isDead || amount <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  update(dt) {
    // Mati: diam sampai death handler respawn (isDead=false).
    if (this.isDead) return;
    // While driving, the car owns movement; the on-foot mesh hides and the
    // player position tracks the car (camera + spawn hooks read it).
    if (this.driving) {
      this.mesh.group.visible = false;
      this.pos.copy(this.driving.pos);
      this.pos.y = this.driving.pos.y;
      this.speed = Math.abs(this.driving.speed);
      this.moving = this.speed > 0.3;
      return;
    }
    this.mesh.group.visible = true;
    applyMovement(this, this.ctx.input, dt, this.ctx);
    this.mesh.group.position.copy(this.pos);
    // Face the movement direction; keep last heading when idle.
    if (this.speed > 0.3) {
      const targetYaw = Math.atan2(this.vel.x, this.vel.z);
      let d = targetYaw - this.mesh.group.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.mesh.group.rotation.y += d * Math.min(1, dt * 12);
    }
    // Argumen ke-4 = ctx: player-mesh membaca extra.weapons.lastShotAt
    // untuk recoil lengan (lihat player-mesh.js update).
    this.mesh.update(dt, this.speed, this.moving, this.ctx);
  }
}
