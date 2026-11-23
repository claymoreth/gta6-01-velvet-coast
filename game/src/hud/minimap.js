// minimap.js — circular minimap on #minimap (180px, bottom-left).
// Player triangle always points up; the world rotates underneath.
// Roads from ctx.roadGraph (fallback: 5x5 grid), mission diamond,
// police dots, NPC dots, cardinal compass on the rim.
// Original code, written for this entry. No network, no fetch.

import { GRID_LINES } from '../engine/pathfinding.js';

const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// World window shown on the map (covers the 5x5 grid + marina + island).
const MIN_X = -200;
const MAX_X = 420;
const MIN_Z = -200;
const MAX_Z = 300;

function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v.values === 'function') return Array.from(v.values());
  return [];
}

function posOf(o) {
  if (!o) return null;
  if (o.pos && typeof o.pos.x === 'number') return { x: o.pos.x, z: o.pos.z };
  if (typeof o.x === 'number' && typeof o.z === 'number') return { x: o.x, z: o.z };
  return null;
}

export class Minimap {
  constructor(ctx) {
    this.ctx = ctx;
    this.canvas = document.getElementById('minimap');
    this.g = this.canvas.getContext('2d');
    this.size = 180;
    this.heading = 0; // radians, 0 = facing north (-z)
    this._lastX = null;
    this._lastZ = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.size * dpr);
    this.canvas.height = Math.round(this.size * dpr);
    this._dpr = dpr;
  }

  _trackHeading() {
    const p = this.ctx.player;
    if (!p || !p.pos) return;
    const x = p.pos.x;
    const z = p.pos.z;
    if (this._lastX !== null) {
      const dx = x - this._lastX;
      const dz = z - this._lastZ;
      if (dx * dx + dz * dz > 0.0004) {
        // Heading measured clockwise from north (-z).
        this.heading = Math.atan2(dx, -dz);
      }
    }
    this._lastX = x;
    this._lastZ = z;
  }

  update(dt) {
    void dt;
    this._trackHeading();
    this._draw();
  }

  _draw() {
    const g = this.g;
    const s = this.size;
    const c = s / 2;
    const R = c - 2;
    if (!g) return;
    g.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    g.clearRect(0, 0, s, s);

    // Circular clip + backdrop.
    g.save();
    g.beginPath();
    g.arc(c, c, R, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = 'rgba(10,18,32,0.82)';
    g.fillRect(0, 0, s, s);

    const scale = s / Math.max(MAX_X - MIN_X, MAX_Z - MIN_Z);
    const p = this.ctx.player;
    const px = p && p.pos ? p.pos.x : 0;
    const pz = p && p.pos ? p.pos.z : 0;

    // Rotating world frame: origin at player, rotated so heading is up.
    g.translate(c, c);
    g.rotate(-this.heading);
    g.translate(-px * scale, -pz * scale);

    this._drawRoads(g, scale);
    this._drawMarkers(g, scale);
    g.restore();

    // Rim ring.
    g.beginPath();
    g.arc(c, c, R, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 2;
    g.stroke();

    this._drawPlayer(g, c);
    this._drawCompass(g, c, R);
  }

  _drawRoads(g, scale) {
    g.strokeStyle = 'rgba(150,170,200,0.75)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    const graph = this.ctx.roadGraph;
    if (graph && Array.isArray(graph.nodes) && graph.adj) {
      const seen = new Set();
      for (const n of graph.nodes) {
        const nbs = graph.adj.get ? graph.adj.get(n.id) : null;
        if (!nbs) continue;
        for (const nb of nbs) {
          const key = [n.id, nb.id].sort().join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          g.beginPath();
          g.moveTo(n.x * scale, n.z * scale);
          g.lineTo(nb.x * scale, nb.z * scale);
          g.stroke();
        }
      }
    } else {
      // Fallback: plain 5x5 grid.
      for (const v of GRID_LINES) {
        g.beginPath();
        g.moveTo(MIN_X * scale, v * scale);
        g.lineTo(MAX_X * scale, v * scale);
        g.stroke();
        g.beginPath();
        g.moveTo(v * scale, MIN_Z * scale);
        g.lineTo(v * scale, MAX_Z * scale);
        g.stroke();
      }
    }
    // Ocean hint east of x=200, beach south of z=200.
    g.fillStyle = 'rgba(40,110,180,0.35)';
    g.fillRect(200 * scale, MIN_Z * scale, (MAX_X - 200) * scale, (MAX_Z - MIN_Z) * scale);
  }

  _drawMarkers(g, scale) {
    // Mission markers: yellow diamonds.
    for (const m of toArray(this.ctx.missionMarkers)) {
      const pos = posOf(m);
      if (!pos) continue;
      const x = pos.x * scale;
      const y = pos.z * scale;
      g.fillStyle = '#ffd21f';
      g.beginPath();
      g.moveTo(x, y - 7);
      g.lineTo(x + 6, y);
      g.lineTo(x, y + 7);
      g.lineTo(x - 6, y);
      g.closePath();
      g.fill();
    }
    // Police cars: red dots.
    const police = this.ctx.wantedSystem ? this.ctx.wantedSystem.policeCars : null;
    for (const car of toArray(police)) {
      const pos = posOf(car);
      if (!pos) continue;
      g.fillStyle = '#ff4040';
      g.beginPath();
      g.arc(pos.x * scale, pos.z * scale, 4, 0, Math.PI * 2);
      g.fill();
    }
    // NPCs: dim gray dots (pedestrians + traffic).
    const npcs = [];
    if (this.ctx.pedestrians) {
      npcs.push(...toArray(this.ctx.pedestrians.pedestrians));
      npcs.push(...toArray(this.ctx.pedestrians.list));
    }
    if (this.ctx.traffic) {
      npcs.push(...toArray(this.ctx.traffic.cars));
      npcs.push(...toArray(this.ctx.traffic.vehicles));
    }
    g.fillStyle = 'rgba(190,200,215,0.55)';
    for (const n of npcs) {
      const pos = posOf(n);
      if (!pos) continue;
      g.beginPath();
      g.arc(pos.x * scale, pos.z * scale, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  _drawPlayer(g, c) {
    g.fillStyle = '#fff';
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(c, c - 10);
    g.lineTo(c + 7, c + 8);
    g.lineTo(c, c + 4);
    g.lineTo(c - 7, c + 8);
    g.closePath();
    g.fill();
    g.stroke();
  }

  _drawCompass(g, c, R) {
    const h = this.heading;
    const items = [
      { ch: 'N', dx: 0, dz: -1 },
      { ch: 'E', dx: 1, dz: 0 },
      { ch: 'S', dx: 0, dz: 1 },
      { ch: 'W', dx: -1, dz: 0 },
    ];
    g.font = `700 11px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const r = R - 11;
    for (const it of items) {
      // World dir (dx, dz) -> map plane (dx, dz) with +z down, then
      // rotate by -h (canvas rotate): (x, y) -> (x cos h + y sin h,
      // -x sin h + y cos h).
      const mx = it.dx * Math.cos(h) + it.dz * Math.sin(h);
      const my = -it.dx * Math.sin(h) + it.dz * Math.cos(h);
      const x = c + mx * r;
      const y = c + my * r;
      g.fillStyle = it.ch === 'N' ? '#ff7070' : 'rgba(255,255,255,0.9)';
      g.shadowColor = 'rgba(0,0,0,0.9)';
      g.shadowBlur = 3;
      g.fillText(it.ch, x, y);
      g.shadowBlur = 0;
    }
  }
}
