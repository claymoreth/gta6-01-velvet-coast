// player/camera.js — thin integration: drive the shared CameraRig with the
// player's position as the follow target.
// Fase 11B: camera kick saat menembak + shake saat tabrakan (via ctx).
// Original code, written for this entry.
import { CameraRig, addCameraShake } from '../engine/camera-rig.js';

// Penanda tembakan/tab rakan terakhir yang sudah diproses, supaya satu
// kejadian hanya memicu satu kick (bukan tiap frame selama jendela aktif).
let _lastShotAt = -10;
let _lastCollidedAt = 0;

export function createPlayerCamera(ctx) {
  const rig = new CameraRig(ctx.camera, ctx.input);
  ctx.cameraRig = rig;
  return rig;
}

export function updatePlayerCamera(ctx, dt) {
  if (!ctx.cameraRig) createPlayerCamera(ctx);
  ctx.cameraRig.update(dt, ctx.player.pos);
  // Rig sudah menerapkan applyShake tiap frame setelah lerp; di sini hanya
  // pemicu event: kick menembak + shake tabrakan.
  const w = ctx.weapons;
  if (w && typeof w.lastShotAt === 'number' && w.lastShotAt !== _lastShotAt) {
    _lastShotAt = w.lastShotAt;
    addCameraShake(ctx, 0.06, 0.12);
  }
  const p = ctx.player;
  if (p && typeof p.collidedAt === 'number' && p.collidedAt !== _lastCollidedAt) {
    _lastCollidedAt = p.collidedAt;
    addCameraShake(ctx, 0.18, 0.35);
  }
}
