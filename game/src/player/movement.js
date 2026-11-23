// movement.js — acceleration / friction / jump logic used by player.js.
// Original code, written for this entry.
import { groundHeightAt, resolveCapsule } from '../engine/collision.js';

export const WALK_SPEED = 2.5;
export const RUN_SPEED = 6;
export const GRAVITY = 20;
export const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * 1.4); // 1.4m apex

// `p` is the player state: { pos, vel, onGround, speed, radius, height }.
export function applyMovement(p, input, dt, ctx) {
  // Camera-relative WASD direction.
  const yaw = input.yaw;
  let fx = 0;
  let fz = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) { fx -= Math.sin(yaw); fz -= Math.cos(yaw); }
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) { fx += Math.sin(yaw); fz += Math.cos(yaw); }
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) { fx -= Math.cos(yaw); fz += Math.sin(yaw); }
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) { fx += Math.cos(yaw); fz -= Math.sin(yaw); }
  const len = Math.hypot(fx, fz);
  const moving = len > 0.01;
  if (moving) {
    fx /= len;
    fz /= len;
  }

  const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const targetSpeed = moving ? (running ? RUN_SPEED : WALK_SPEED) : 0;
  const accel = p.onGround ? 24 : 8;
  const tx = fx * targetSpeed;
  const tz = fz * targetSpeed;
  p.vel.x += (tx - p.vel.x) * Math.min(1, accel * dt / Math.max(1, targetSpeed || 1) * 2.2);
  p.vel.z += (tz - p.vel.z) * Math.min(1, accel * dt / Math.max(1, targetSpeed || 1) * 2.2);
  // Extra friction when no input so the player stops crisply.
  if (!moving && p.onGround) {
    const f = Math.max(0, 1 - 10 * dt);
    p.vel.x *= f;
    p.vel.z *= f;
  }

  // Jump: half-step compensation so the discrete (semi-implicit Euler)
  // apex lands on 1.4m for any frame dt, not 1.4 - v*dt/2.
  if (input.consumePressed('Space') && p.onGround) {
    p.vel.y = JUMP_VELOCITY + GRAVITY * dt * 0.5;
    p.onGround = false;
  }

  // Fase 7 — weapon input (blok baru; WASD/lompat di atas tidak diubah).
  // input.mouseDown dilacak oleh WeaponSystem (input.js tidak punya field ini).
  if (ctx && ctx.weapons) {
    if (input.consumePressed('Digit1')) ctx.weapons.equip('fists');
    if (input.consumePressed('Digit2')) ctx.weapons.equip('pistol');
    if (input.consumePressed('Digit3')) ctx.weapons.equip('smg');
    if (input.consumePressed('KeyR')) ctx.weapons.reload();
    if (input.mouseDown || input.keys.has('KeyF')) ctx.weapons.fire();
  }

  p.vel.y -= GRAVITY * dt;
  p.pos.x += p.vel.x * dt;
  p.pos.z += p.vel.z * dt;
  p.pos.y += p.vel.y * dt;

  resolveCapsule(p.pos, p.radius, p.height, ctx.colliders);

  const ground = groundHeightAt(p.pos.x, p.pos.z);
  if (p.pos.y <= ground) {
    p.pos.y = ground;
    p.vel.y = 0;
    p.onGround = true;
  } else if (p.pos.y > ground + 0.02) {
    p.onGround = false;
  }

  p.speed = Math.hypot(p.vel.x, p.vel.z);
  p.moving = moving;
  return p;
}
