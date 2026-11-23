// notifications.js — toast stack on the #hud canvas: slide-in 0.3s,
// hold 3s, fade out. Max 3 toasts queued.
// Original code, written for this entry. No network, no fetch.

const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const KINDS = {
  info: { bg: 'rgba(20,32,52,0.88)', fg: '#bcd8ff', bar: '#3aa7ff' },
  success: { bg: 'rgba(16,46,28,0.88)', fg: '#b8f5cd', bar: '#37d67a' },
  warning: { bg: 'rgba(52,38,10,0.88)', fg: '#ffe1a1', bar: '#ffb020' },
  error: { bg: 'rgba(52,14,14,0.88)', fg: '#ffc4c4', bar: '#ff5252' },
};

const SLIDE = 0.3;
const HOLD = 3.0;
const FADE = 0.5;

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export class Notifications {
  constructor(ctx) {
    this.ctx = ctx;
    this.queue = []; // { text, kind, born } — born in HUD seconds
    this.now = 0;
  }

  toast(text, kind = 'info') {
    if (typeof text !== 'string' || text.length === 0) return;
    if (!KINDS[kind]) kind = 'info';
    this.queue.push({ text, kind, born: this.now });
    while (this.queue.length > 3) this.queue.shift();
  }

  // g: 2d context of the #hud canvas. now: HUD seconds.
  draw(g, w, _h, now) {
    this.now = now;
    // Drop expired toasts.
    const life = SLIDE + HOLD + FADE;
    while (this.queue.length > 0 && now - this.queue[0].born > life) {
      this.queue.shift();
    }
    if (this.queue.length === 0) return;

    g.save();
    g.font = `600 15px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const topY = 96;
    const rowH = 38;
    const gap = 8;

    this.queue.forEach((t, i) => {
      const age = now - t.born;
      const k = KINDS[t.kind];
      let alpha = 1;
      let slide = 0; // 0 = fully in, 1 = fully above
      if (age < SLIDE) {
        const p = age / SLIDE;
        slide = 1 - p;
        alpha = p;
      } else if (age > SLIDE + HOLD) {
        alpha = Math.max(0, 1 - (age - SLIDE - HOLD) / FADE);
      }
      if (alpha <= 0) return;
      const tw = Math.min(w - 32, g.measureText(t.text).width + 34);
      const x = (w - tw) / 2;
      const y = topY + i * (rowH + gap) - slide * (rowH + 12);
      g.globalAlpha = alpha;
      g.fillStyle = k.bg;
      rr(g, x, y, tw, rowH, 8);
      g.fill();
      g.fillStyle = k.bar;
      g.fillRect(x, y, 4, rowH);
      g.fillStyle = k.fg;
      g.fillText(t.text, x + 14, y + rowH / 2 + 0.5);
    });
    g.restore();
  }
}
