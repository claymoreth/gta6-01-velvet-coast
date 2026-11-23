// carchase.js — pursuit steering helper for AI drivers (police in Wave C,
// mission 6 chase). Real, simple implementation: steer toward the target,
// throttle when far, reverse out when the target is far behind.
// Original code, written for this entry.
// Fase 11B: driveRam — mode menabrak (ram) untuk pengejar.
import { addCameraShake } from '../engine/camera-rig.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Drive `vehicle` toward (targetX, targetZ) for one frame. Returns the
// controls used, plus the remaining distance.
// opts.rolling: don't brake/stop at the target — drive through waypoints
// (traffic). opts.cruise: cap the cruising speed (traffic speed limit).
export function driveToward(vehicle, targetX, targetZ, dt, opts = {}) {
  const dx = targetX - vehicle.pos.x;
  const dz = targetZ - vehicle.pos.z;
  const dist = Math.hypot(dx, dz);
  const diff = wrapAngle(Math.atan2(dx, dz) - vehicle.heading);

  let throttle = 0;
  let steer = 0;
  // Braking distance at the current speed (brake decel ~18 m/s^2) + margin:
  // start braking early enough to stop AT the target instead of past it.
  const stopDist = (vehicle.speed * vehicle.speed) / 36 + 2;
  if (!opts.rolling && dist <= 1.5 && Math.abs(vehicle.speed) < 1) {
    // Arrived: hold still.
    throttle = 0;
    steer = 0;
  } else if (!opts.rolling && dist < stopDist && vehicle.speed > 4) {
    throttle = -1; // brake while closing in
    steer = clamp(diff * 1.6, -1, 1);
  } else if (Math.abs(diff) > 2.4 && dist < 15) {
    // Target close behind: reverse out, steering flipped. For a FAR target
    // behind us, reversing would drive backwards for tens of metres — do a
    // slow forward U-turn instead (the else branch below).
    throttle = -0.6;
    steer = clamp(-diff * 1.2, -1, 1);
  } else {
    throttle = dist > 12 ? 1 : 0.55;
    steer = clamp(diff * 1.6, -1, 1);
  }
  // Cruise cap: coast once at the limit instead of pushing to top speed.
  if (opts.cruise && vehicle.speed >= opts.cruise && throttle > 0) throttle = 0;
  // Slow for sharp turns: a slower car turns tighter (steerMax grows as
  // speed falls) and doesn't swing wide off the road on U-turns.
  if (Math.abs(diff) > 0.7 && throttle > 0) throttle = Math.min(throttle, 0.45);
  const controls = { throttle, steer, handbrake: false };
  vehicle.update(dt, controls);
  return { ...controls, dist };
}

// True when the vehicle is roughly facing the target (within `spread` rad).
export function isFacing(vehicle, targetX, targetZ, spread = 0.35) {
  const dx = targetX - vehicle.pos.x;
  const dz = targetZ - vehicle.pos.z;
  return Math.abs(wrapAngle(Math.atan2(dx, dz) - vehicle.heading)) < spread;
}

// --- Fase 11B: mode ram ----------------------------------------------------
// Kejar seperti driveToward saat jauh; begitu jarak < 5m, komit menabrak:
// gas penuh tanpa rem, setir keras ke target. Saat kontak (< 2.8m): damage
// kecil ke player on-foot + shake + suara benturan (bila ada), max 1x/detik.
// opts: { ctx, ramDamage (default 8), onRamHit(vehicle, dist) }.
// Mengembalikan controls + dist + rammed (bool kontak frame ini).
export function driveRam(vehicle, targetX, targetZ, dt, opts = {}) {
  const dx = targetX - vehicle.pos.x;
  const dz = targetZ - vehicle.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 5) return { ...driveToward(vehicle, targetX, targetZ, dt, opts), rammed: false };
  const diff = wrapAngle(Math.atan2(dx, dz) - vehicle.heading);
  const controls = { throttle: 1, steer: clamp(diff * 2.0, -1, 1), handbrake: false };
  vehicle.update(dt, controls);
  let rammed = false;
  if (dist < 2.8) {
    rammed = true;
    const now = performance.now();
    if (now - (vehicle._lastRamAt || 0) > 1000) {
      vehicle._lastRamAt = now;
      const ctx = opts.ctx;
      if (ctx) {
        const p = ctx.player;
        if (p && typeof p.takeDamage === 'function' && !p.driving) {
          p.takeDamage(opts.ramDamage ?? 8);
        }
        addCameraShake(ctx, 0.2, 0.4);
        const a = ctx.audio;
        if (a && typeof a.playCrash === 'function') a.playCrash();
      }
      if (typeof opts.onRamHit === 'function') opts.onRamHit(vehicle, dist);
    }
  }
  return { ...controls, dist, rammed };
}
