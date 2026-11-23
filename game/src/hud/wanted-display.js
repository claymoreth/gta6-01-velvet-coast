// wanted-display.js — 5-star wanted level, top-right under the cash
// readout. New stars blink for 1s when the level rises.
// Original code, written for this entry. No network, no fetch.

const GOLD = '#ffd21f';
const DIM = 'rgba(200,200,200,0.55)';

function starPath(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

export class WantedDisplay {
  constructor() {
    this._lastStars = 0;
    this._blinkUntil = 0;
  }

  // g: 2d context of the #hud canvas. stars: 0..5. now: seconds.
  // w: canvas CSS width (stars right-align at w - 16).
  draw(g, stars, now, w) {
    stars = Math.max(0, Math.min(5, Math.floor(Number(stars) || 0)));
    if (stars > this._lastStars) this._blinkUntil = now + 1;
    this._lastStars = stars;

    const size = 11; // star outer radius
    const gap = 26;
    const y = 66 + size; // row sits just under the cash readout
    const right = (w || 800) - 16;
    const startX = right - (5 - 1) * gap;

    g.save();
    for (let i = 0; i < 5; i++) {
      const cx = startX + i * gap;
      const active = i < stars;
      let alpha = 1;
      if (active && i === stars - 1 && now < this._blinkUntil) {
        alpha = 0.35 + 0.65 * Math.abs(Math.sin(now * 9));
      }
      g.globalAlpha = alpha;
      starPath(g, cx, y, size);
      if (active) {
        g.fillStyle = GOLD;
        g.shadowColor = 'rgba(255,210,31,0.9)';
        g.shadowBlur = 10;
        g.fill();
        g.shadowBlur = 0;
      } else {
        g.strokeStyle = DIM;
        g.lineWidth = 1.6;
        g.stroke();
      }
    }
    g.restore();
  }
}
