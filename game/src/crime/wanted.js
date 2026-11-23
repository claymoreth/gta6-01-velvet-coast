// wanted.js — Fase 7: WantedSystem. Crime points 0-1000, bintang 1-5,
// decay 1 poin/detik bila tidak ada polisi yang melihat selama 5 detik.
// Polisi mengejar lastKnownPos; 5 bintang = 5 mobil + helikopter.
// Original code, written for this entry.
import * as THREE from 'three';
import { Vehicle } from '../vehicles/vehicle.js';
import { groundHeightAt } from '../engine/collision.js';
import { driveToward } from '../vehicles/carchase.js';

export const STAR_THRESHOLDS = [100, 250, 450, 700, 950]; // bintang 1..5
const MAX_CRIME = 1000;
const DECAY_PER_SEC = 1;
const NO_SIGHT_DECAY_DELAY = 5; // detik tanpa terlihat sebelum decay
const SIGHT_RANGE = 70; // meter: polisi "melihat" player dalam jarak ini
const RAM_RANGE = 5; // meter: mobil menabrak player
const RAM_DAMAGE = 12;
const RAM_COOLDOWN = 1; // detik antar tabrakan per mobil
const HELI_HEIGHT = 30;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Jumlah mobil patroli per level bintang.
function carsForStars(stars) {
  if (stars <= 0) return 0;
  if (stars <= 2) return 1;
  if (stars <= 4) return 3;
  return 5;
}

// Mesh mobil polisi dari boxes: body putih-hitam + light bar merah-biru.
function buildPoliceCarMesh() {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.4), white);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  // Pita hitam di sisi body (two-tone putih-hitam).
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.2, 4.42), black);
  band.position.y = 0.62;
  group.add(band);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.1), glass);
  cabin.position.set(0, 1.12, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // Light bar: alas + lampu merah (kiri) + biru (kanan), emissive berkedip.
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.32), black);
  barBase.position.set(0, 1.42, -0.2);
  group.add(barBase);
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xaa0000, emissive: 0xff0000, emissiveIntensity: 0.2, roughness: 0.4,
  });
  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x0000aa, emissive: 0x2244ff, emissiveIntensity: 0.2, roughness: 0.4,
  });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.34), redMat);
  red.position.set(-0.32, 1.5, -0.2);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.34), blueMat);
  blue.position.set(0.32, 1.5, -0.2);
  group.add(red, blue);

  // Roda (visual saja; Vehicle diisi wheels: []).
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.35, wz);
    group.add(w);
  }
  return { group, redMat, blueMat };
}

// Helikopter: sphere body + rotor + spotlight ke bawah.
function buildHelicopter() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2a44, roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), bodyMat);
  body.scale.set(1, 0.85, 1.5);
  body.castShadow = true;
  group.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), bodyMat);
  tail.position.set(0, 0.2, -3.2);
  group.add(tail);
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.15, metalness: 0.5 }),
  );
  glass.scale.set(1, 0.7, 0.9);
  glass.position.set(0, -0.2, 1.1);
  group.add(glass);
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.4), rotorMat);
  rotor.position.y = 1.6;
  group.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.3), rotorMat);
  tailRotor.position.set(0.35, 0.3, -5.1);
  group.add(tailRotor);
  // Spotlight ke bawah (target diupdate tiap frame ke posisi player).
  const spot = new THREE.SpotLight(0xfff2cc, 400, 90, 0.42, 0.4, 1.2);
  spot.position.set(0, -1, 0);
  group.add(spot);
  group.add(spot.target);
  spot.target.position.set(0, -HELI_HEIGHT, 0);
  return { group, rotor, tailRotor, spot };
}

export class WantedSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.crimePoints = 0;
    this.lastKnownPos = null; // THREE.Vector3 atau null
    this.noSightTime = 0;
    this.policeCars = []; // { car: Vehicle, redMat, blueMat, ramAt }
    this.blinkT = 0;
    this.sirenOn = false;
    this.heli = null; // { group, rotor, tailRotor, spot }
    this.heliAngle = 0;
    this.officerTimer = 0;
  }

  get stars() {
    let s = 0;
    for (const t of STAR_THRESHOLDS) if (this.crimePoints >= t) s++;
    return s;
  }

  setStars(n) {
    const stars = clamp(Math.round(n) || 0, 0, 5);
    this.crimePoints = stars === 0 ? 0 : STAR_THRESHOLDS[stars - 1];
    const p = this.ctx.player;
    if (stars > 0 && p) {
      this.lastKnownPos = p.pos.clone();
    } else if (stars === 0) {
      this.lastKnownPos = null;
    }
    this.ctx.wanted = stars;
    this._syncForces();
    return stars;
  }

  addCrime(points, pos) {
    this.crimePoints = clamp(this.crimePoints + points, 0, MAX_CRIME);
    if (pos) {
      this.lastKnownPos = new THREE.Vector3(pos.x, pos.y || 0, pos.z);
    }
    this.ctx.wanted = this.stars;
    this._syncForces();
    return this.crimePoints;
  }

  // Ada polisi (mobil / officer) yang melihat player? Sederhana: jarak.
  _copSeesPlayer() {
    const p = this.ctx.player;
    if (!p || p.isDead) return false;
    for (const e of this.policeCars) {
      if (Math.hypot(e.car.pos.x - p.pos.x, e.car.pos.z - p.pos.z) < SIGHT_RANGE) return true;
    }
    const police = this.ctx.police;
    if (police && police.officers) {
      for (const o of police.officers) {
        if (!o.alive) continue;
        if (Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) < SIGHT_RANGE) return true;
      }
    }
    return false;
  }

  // Cari titik spawn di luar gedung (tidak di dalam AABB collider).
  _findSpawnPoint(aroundX, aroundZ, dist) {
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2;
      const x = aroundX + Math.sin(a) * dist;
      const z = aroundZ + Math.cos(a) * dist;
      if (Math.abs(x) > 185 || Math.abs(z) > 185) continue;
      let inside = false;
      for (const b of this.ctx.colliders) {
        if (x > b.minX - 2 && x < b.maxX + 2 && z > b.minZ - 2 && z < b.maxZ + 2) {
          inside = true;
          break;
        }
      }
      if (!inside) return { x, z };
    }
    return { x: aroundX + dist, z: aroundZ };
  }

  _spawnPoliceCar() {
    const p = this.ctx.player;
    const px = p ? p.pos.x : 0;
    const pz = p ? p.pos.z : 0;
    const { x, z } = this._findSpawnPoint(px, pz, 30 + Math.random() * 15);
    const built = buildPoliceCarMesh();
    const heading = Math.atan2(px - x, pz - z);
    // Vehicle butuh built { group, wheels, headlights, length, width }.
    const car = new Vehicle(this.ctx, 'sedan', {
      group: built.group, wheels: [], headlights: [], length: 4.4, width: 1.9,
    }, x, z, heading);
    car.ai = 'police';
    this.ctx.scene.add(built.group);
    this.policeCars.push({ car, redMat: built.redMat, blueMat: built.blueMat, ramAt: -10 });
    const a = this.ctx.audio;
    if (a && typeof a.playSiren === 'function' && !this.sirenOn) {
      a.playSiren();
      this.sirenOn = true;
    }
    return car;
  }

  _removePoliceCar(entry) {
    const i = this.policeCars.indexOf(entry);
    if (i >= 0) this.policeCars.splice(i, 1);
    if (entry.car.group.parent) entry.car.group.parent.remove(entry.car.group);
    entry.car.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material !== entry.redMat && o.material !== entry.blueMat) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    entry.redMat.dispose();
    entry.blueMat.dispose();
  }

  _spawnHeli() {
    if (this.heli) return;
    const p = this.ctx.player;
    const heli = buildHelicopter();
    heli.group.position.set(p ? p.pos.x : 0, HELI_HEIGHT, p ? p.pos.z - 10 : -10);
    this.ctx.scene.add(heli.group);
    this.heli = heli;
  }

  _removeHeli() {
    if (!this.heli) return;
    if (this.heli.group.parent) this.heli.group.parent.remove(this.heli.group);
    this.heli.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    this.heli = null;
  }

  // Samakan jumlah mobil + helikopter dengan level bintang saat ini.
  _syncForces() {
    const want = carsForStars(this.stars);
    while (this.policeCars.length < want) this._spawnPoliceCar();
    while (this.policeCars.length > want) this._removePoliceCar(this.policeCars[this.policeCars.length - 1]);
    if (this.stars >= 5) this._spawnHeli();
    else this._removeHeli();
    if (want === 0) {
      // Bintang 0: matikan sirene yang sedang jalan. Sebelumnya flag
      // direset tanpa stop audio, jadi sirene berbunyi selamanya.
      if (this.sirenOn) {
        const a = this.ctx.audio;
        if (a && typeof a.playSirenStop === 'function') a.playSirenStop();
        this.sirenOn = false;
      }
    }
  }

  update(dt) {
    const p = this.ctx.player;
    const stars = this.stars;
    this.ctx.wanted = stars;

    // Decay: 1 poin/detik bila tidak terlihat selama 5 detik.
    if (this._copSeesPlayer()) {
      this.noSightTime = 0;
    } else {
      this.noSightTime += dt;
      if (this.noSightTime > NO_SIGHT_DECAY_DELAY && this.crimePoints > 0) {
        this.crimePoints = Math.max(0, this.crimePoints - DECAY_PER_SEC * dt);
      }
    }
    this._syncForces();

    // Light bar merah-biru berkedip (bergantian tiap 0.25 detik).
    this.blinkT += dt;
    const phase = Math.floor(this.blinkT * 4) % 2 === 0;
    for (const e of this.policeCars) {
      e.redMat.emissiveIntensity = phase ? 2.4 : 0.15;
      e.blueMat.emissiveIntensity = phase ? 0.15 : 2.4;
    }

    // Mobil mengejar lastKnownPos (langsung ke player bila sudah dekat).
    const target = this.lastKnownPos || (p ? p.pos : null);
    for (const e of this.policeCars) {
      const car = e.car;
      let tx = target ? target.x : car.pos.x;
      let tz = target ? target.z : car.pos.z;
      if (p && Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z) < 25) {
        tx = p.pos.x;
        tz = p.pos.z;
      }
      const cruise = 14 + stars * 1.2; // 14-20 m/s
      driveToward(car, tx, tz, dt, { cruise });
      // Ram: tabrak player jalan kaki bila < 5m.
      if (p && !p.driving && !p.isDead) {
        const d = Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
        if (d < RAM_RANGE && this.blinkT - e.ramAt > RAM_COOLDOWN) {
          e.ramAt = this.blinkT;
          const dx = p.pos.x - car.pos.x;
          const dz = p.pos.z - car.pos.z;
          const len = Math.hypot(dx, dz) || 1;
          p.vel.x += (dx / len) * 6;
          p.vel.z += (dz / len) * 6;
          if (typeof p.takeDamage === 'function') p.takeDamage(RAM_DAMAGE);
        }
      }
    }

    // Officer keluar dari mobil patroli saat wanted >= 3 (maks 2 di lapangan).
    const police = this.ctx.police;
    if (stars >= 3 && police && typeof police.spawnOfficer === 'function') {
      this.officerTimer -= dt;
      const aliveOfficers = police.officers ? police.officers.filter((o) => o.alive).length : 0;
      if (this.officerTimer <= 0 && aliveOfficers < 2 && this.policeCars.length > 0) {
        this.officerTimer = 3;
        const car = this.policeCars[Math.floor(Math.random() * this.policeCars.length)].car;
        police.spawnOfficer(new THREE.Vector3(car.pos.x + 2, car.pos.y, car.pos.z + 2));
      }
    }

    // Helikopter: mengikuti player dari atas (ketinggian 30m), rotor berputar.
    if (this.heli && p) {
      this.heliAngle += dt * 0.25;
      const hx = p.pos.x + Math.sin(this.heliAngle) * 8;
      const hz = p.pos.z + Math.cos(this.heliAngle) * 8;
      const g = this.heli.group.position;
      g.x += (hx - g.x) * Math.min(1, dt * 1.5);
      g.z += (hz - g.z) * Math.min(1, dt * 1.5);
      g.y += (HELI_HEIGHT - g.y) * Math.min(1, dt * 1.5);
      this.heli.rotor.rotation.y += dt * 22;
      this.heli.tailRotor.rotation.x += dt * 22;
      this.heli.spot.target.position.set(p.pos.x, groundHeightAt(p.pos.x, p.pos.z), p.pos.z);
      this.heli.group.lookAt(p.pos.x, g.y, p.pos.z);
    }
  }
}
