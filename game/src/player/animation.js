// animation.js — procedural walk-animation helpers (swing phase from distance).
// Fase 11B: landing dip (badan turun 0,08m 0,15 dtk saat mendarat) + recoil
// lengan kanan saat menembak. Ayunan jalan/lari yang ada tidak diubah.
// Original code, written for this entry.

export function createWalkAnimator() {
  let phase = 0;
  let dipUntil = 0; // performance.now() ms — akhir jendela landing dip
  return {
    get phase() {
      return phase;
    },
    // Advance the swing phase by distance travelled; returns the phase.
    advance(distanceTravelled) {
      phase += distanceTravelled * 2.2;
      return phase;
    },
    // Dipanggil saat kaki menyentuh tanah setelah jatuh/lompat.
    landDip() {
      dipUntil = performance.now() + 150;
    },
    // Apply a walk cycle to body parts. `speedNorm` 0..1 scales the swing.
    // opts: { shotAt (detik, jam yang sama dengan weapons.lastShotAt),
    //         now (detik, default performance.now()/1000) } untuk recoil.
    apply(parts, speedNorm, opts = {}) {
      const s = Math.sin(phase);
      const swing = 0.6 * speedNorm;
      if (parts.legL) parts.legL.rotation.x = s * swing;
      if (parts.legR) parts.legR.rotation.x = -s * swing;
      if (parts.armL) parts.armL.rotation.x = -s * 0.45 * speedNorm;
      if (parts.armR) parts.armR.rotation.x = s * 0.45 * speedNorm;
      if (parts.body) {
        // Landing dip: badan turun 0,08m, meluruh selama 0,15 dtk.
        let dip = 0;
        const nowMs = performance.now();
        if (nowMs < dipUntil) dip = 0.08 * ((dipUntil - nowMs) / 150);
        parts.body.position.y = Math.abs(Math.cos(phase)) * 0.05 * speedNorm - dip;
        parts.body.rotation.z = s * 0.03 * speedNorm;
      }
      // Recoil: lengan kanan naik 15° (0,26 rad) selama 0,12 dtk setelah
      // tembakan terakhir (ctx.weapons.lastShotAt).
      const shotAt = opts.shotAt;
      const nowSec = typeof opts.now === 'number' ? opts.now : performance.now() / 1000;
      if (typeof shotAt === 'number' && nowSec - shotAt < 0.12 && parts.armR) {
        parts.armR.rotation.x = -0.26;
      }
    },
  };
}
