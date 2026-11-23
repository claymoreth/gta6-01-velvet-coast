// radio.js — radio station HUD: shows the active station for 3s after
// switching (Tab), then fades. Draws on the #hud canvas, bottom-right
// above the weapon readout.
// Original code, written for this entry. No network, no fetch.

const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const FALLBACK_STATIONS = [
  { name: 'Sunset 88.5 FM', genre: 'Synthwave' },
  { name: 'Wave 104.2', genre: 'Chill' },
  { name: 'Vanta 90.1', genre: 'Trap' },
];

const SHOW_SECONDS = 3;

function normalizeStations(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return FALLBACK_STATIONS;
  return raw.map((s) => {
    if (typeof s === 'string') return { name: s, genre: '' };
    return { name: s.name || 'Unknown', genre: s.genre || s.style || '' };
  });
}

export class RadioHUD {
  constructor(ctx) {
    this.ctx = ctx;
    this.visibleUntil = 0; // seconds, HUD clock
    this._lastNow = 0;
  }

  stations() {
    return normalizeStations(this.ctx.radioStations);
  }

  currentStation() {
    const list = this.stations();
    const idx = ((Number(this.ctx.radioStation) || 0) % list.length + list.length) % list.length;
    return list[idx];
  }

  currentStationName() {
    const s = this.currentStation();
    return s.genre ? `${s.name} — ${s.genre}` : s.name;
  }

  cycleStation() {
    const list = this.stations();
    const next = (((Number(this.ctx.radioStation) || 0) + 1) % list.length);
    this.ctx.radioStation = next;
    this.visibleUntil = this._lastNow + SHOW_SECONDS;
    // Start the procedural radio audio for the new station (Fase 10).
    const a = this.ctx.audio;
    if (a && typeof a.startRadio === 'function') a.startRadio(next);
    return this.currentStation();
  }

  // g: 2d context of the #hud canvas. now: HUD seconds.
  draw(g, w, h, now) {
    this._lastNow = now;
    // Radio only plays while driving: on foot the audio stops, but the
    // station label keeps showing (Fase 10).
    const driving = !!(this.ctx.player && this.ctx.player.driving);
    const a = this.ctx.audio;
    if (!driving && a && typeof a.stopRadio === 'function'
      && a.radioStation !== null && a.radioStation !== undefined) {
      a.stopRadio();
    }
    if (now > this.visibleUntil) return;
    const remain = this.visibleUntil - now;
    const alpha = Math.min(1, remain / 0.6);
    const label = this.currentStationName();

    g.save();
    g.globalAlpha = alpha;
    g.textAlign = 'right';
    g.shadowColor = 'rgba(0,0,0,0.85)';
    g.shadowBlur = 4;
    g.shadowOffsetX = 1;
    g.shadowOffsetY = 1;
    // "♪" note glyph + station name, bottom-right above the ammo readout.
    g.font = `700 15px ${FONT}`;
    g.fillStyle = '#ffd21f';
    g.fillText('\u266A  ' + label, w - 16, h - 108);
    g.font = `600 12px ${FONT}`;
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText('RADIO — TAB untuk ganti stasiun', w - 16, h - 90);
    g.restore();
  }
}
