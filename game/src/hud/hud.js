// hud.js — VELVET COAST HUD: health/armor, cash, clock, objective,
// wanted stars, weapon/ammo. Draws on the full-screen #hud canvas.
// Original code, written for this entry. No network, no fetch.

import { Notifications } from './notifications.js';
import { WantedDisplay } from './wanted-display.js';
import { RadioHUD } from './radio.js';

const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function fmtCash(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return '$' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtClock(hour) {
  const h = Math.floor(((hour % 24) + 24) % 24);
  const m = Math.floor((((hour % 24) + 24) % 24 - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
}

export class HUD {
  constructor(ctx) {
    this.ctx = ctx;
    this.canvas = document.getElementById('hud');
    this.g = this.canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.now = 0;
    this.objective = 'VELVET COAST — Port Solana';
    this.notifications = new Notifications(ctx);
    this.wanted = new WantedDisplay();
    // Single shared RadioHUD instance: reuse ctx.radio when main.js
    // already created one, otherwise create it here and publish it so
    // Tab (main loop, ctx.radio.cycleStation) and HUD.draw() use the
    // same visibleUntil. Two instances meant the cycled one was never drawn.
    this.radio = ctx.radio || new RadioHUD(ctx);
    ctx.radio = this.radio;
    // Fase 11B — screen flash: { css, start (performance.now ms), ms, peak }.
    this._flash = null;
    this._flashEl = document.getElementById('damage-flash');
    this._hpFracOverride = null;
    // Daftarkan hook flash ke ctx: player.takeDamage memakai ctx.screenFlash,
    // ledakan memakai ctx.flashDamage (lihat combat.js).
    ctx.flashDamage = (color, ms) => this.flashScreen(color, ms);
    ctx.screenFlash = () => this.flashDamage();
    this._resize();
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  setObjective(text) {
    if (typeof text === 'string' && text.length > 0) this.objective = text;
  }

  // --- Fase 11B: screen flash --------------------------------------------
  // Flash merah luka: opacity 0,55 lalu fade ke 0 dalam 300ms. Elemen DOM
  // #damage-flash (sudah ada di index.html) dipakai sebagai lapisan utama;
  // canvas HUD menggambar flash yang sama sebagai fallback.
  flashDamage() {
    this.flashScreen('255,0,0', 300, 0.55);
  }

  // Flash generik: color 'r,g,b' (mis. '255,140,0' untuk ledakan), ms durasi.
  flashScreen(color = '255,140,0', ms = 250, peak = 0.35) {
    this._flash = { css: String(color), start: performance.now(), ms, peak };
    if (this._flashEl) this._flashEl.style.opacity = String(peak);
  }

  // Vignette merah saat HP rendah; hpFrac 0..1 (null = baca HP live).
  showDamageVignette(hpFrac) {
    this._hpFracOverride = typeof hpFrac === 'number' ? hpFrac : null;
  }

  _drawFlash(g) {
    if (!this._flash) return;
    const el = (performance.now() - this._flash.start) / this._flash.ms;
    if (el >= 1) {
      this._flash = null;
      if (this._flashEl) this._flashEl.style.opacity = '0';
      return;
    }
    const a = this._flash.peak * (1 - el);
    if (this._flashEl) this._flashEl.style.opacity = String(a);
    // Fallback canvas (bila elemen DOM tidak ada / tertutup).
    g.fillStyle = `rgba(${this._flash.css},${a.toFixed(3)})`;
    g.fillRect(0, 0, this.w, this.h);
  }

  _drawDamageVignette(g) {
    const p = this.ctx.player || {};
    const frac = this._hpFracOverride !== null
      ? this._hpFracOverride
      : (typeof p.hp === 'number' && typeof p.hpMax === 'number' && p.hpMax > 0
        ? p.hp / p.hpMax : 1);
    if (frac >= 0.35) return;
    const a = ((0.35 - frac) / 0.35) * 0.5;
    const grad = g.createRadialGradient(
      this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35,
      this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75,
    );
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,0,0,${a.toFixed(3)})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);
  }

  update(dt) {
    this.now += dt;
    this._resize();
    this.draw();
  }

  draw() {
    const g = this.g;
    const { w, h } = this;
    if (!g || w === 0) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.textBaseline = 'alphabetic';

    this._drawBars(g);
    this._drawCashClock(g);
    this._drawObjective(g);
    this.wanted.draw(g, this._wantedStars(), this.now, w);
    this.radio.draw(g, w, h, this.now);
    this._drawWeapon(g, w, h);
    this.notifications.draw(g, w, h, this.now);
    this._drawDamageVignette(g);
    this._drawFlash(g);
  }

  _wantedStars() {
    const n = Number(this.ctx.wanted) || 0;
    return Math.max(0, Math.min(5, Math.floor(n)));
  }

  _shadow(g) {
    g.shadowColor = 'rgba(0,0,0,0.85)';
    g.shadowBlur = 4;
    g.shadowOffsetX = 1;
    g.shadowOffsetY = 1;
  }

  _noShadow(g) {
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
  }

  _bar(g, x, y, bw, bh, frac, fill, label) {
    frac = Math.max(0, Math.min(1, frac));
    this._noShadow(g);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    rr(g, x, y, bw, bh, bh / 2);
    g.fill();
    if (frac > 0) {
      g.fillStyle = fill;
      rr(g, x + 1.5, y + 1.5, Math.max(bh - 3, (bw - 3) * frac), bh - 3, (bh - 3) / 2);
      g.fill();
    }
    this._shadow(g);
    g.fillStyle = '#fff';
    g.font = `700 ${Math.round(bh * 0.85)}px ${FONT}`;
    g.textAlign = 'left';
    g.fillText(label, x + bw + 8, y + bh - 3);
  }

  _drawBars(g) {
    const p = this.ctx.player || {};
    const hp = typeof p.hp === 'number' ? p.hp : 100;
    const hpMax = typeof p.hpMax === 'number' ? p.hpMax : 100;
    const armor = typeof p.armor === 'number' ? p.armor : 0;
    const armorMax = typeof p.armorMax === 'number' ? p.armorMax : 100;
    this._bar(g, 16, 16, 220, 16, hp / hpMax, '#37d67a', String(Math.ceil(hp)));
    if (armor > 0 || typeof p.armor === 'number') {
      this._bar(g, 16, 38, 220, 10, armor / armorMax, '#3aa7ff', String(Math.ceil(armor)));
    }
  }

  _drawCashClock(g) {
    const p = this.ctx.player || {};
    this._shadow(g);
    g.fillStyle = '#fff';
    g.textAlign = 'right';
    g.font = `800 28px ${FONT}`;
    g.fillText(fmtCash(p.cash), this.w - 16, 34);
    g.font = `600 15px ${FONT}`;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    const hour = this.ctx.time ? this.ctx.time.hour : 10;
    g.fillText(fmtClock(hour), this.w - 16, 56);
    this._noShadow(g);
  }

  _drawObjective(g) {
    const text = this.ctx.missionText || this.objective;
    this._shadow(g);
    g.font = `700 17px ${FONT}`;
    g.textAlign = 'center';
    const tw = g.measureText(text).width;
    this._noShadow(g);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    rr(g, this.w / 2 - tw / 2 - 14, 12, tw + 28, 28, 14);
    g.fill();
    this._shadow(g);
    g.fillStyle = '#ffe9a8';
    g.fillText(text, this.w / 2, 31);
    this._noShadow(g);
  }

  _weapon() {
    const w = this.ctx.weapon || (this.ctx.player && this.ctx.player.weapon) || null;
    if (w) {
      return {
        name: w.name || 'Pistol',
        ammo: typeof w.ammo === 'number' ? w.ammo : 12,
        reserve: typeof w.reserve === 'number' ? w.reserve : 48,
      };
    }
    return { name: 'Pistol', ammo: 12, reserve: 48 };
  }

  _drawWeapon(g, w, h) {
    const wpn = this._weapon();
    const x = w - 16;
    const baseY = h - 24;
    this._shadow(g);
    g.fillStyle = '#fff';
    g.textAlign = 'right';
    g.font = `700 15px ${FONT}`;
    g.fillText(wpn.name.toUpperCase(), x, baseY - 26);
    g.font = `800 26px ${FONT}`;
    g.fillText(`${wpn.ammo} / ${wpn.reserve}`, x, baseY);
    // Simple pistol glyph, left of the ammo readout.
    const gw = g.measureText(`${wpn.ammo} / ${wpn.reserve}`).width;
    const gx = x - gw - 52;
    const gy = baseY - 16;
    g.fillStyle = '#fff';
    g.fillRect(gx, gy - 4, 34, 7); // barrel + slide
    g.fillRect(gx + 4, gy + 3, 7, 12); // grip
    g.fillRect(gx + 28, gy + 3, 5, 5); // trigger guard hint
    this._noShadow(g);
  }
}
