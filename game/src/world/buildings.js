// buildings.js — procedural buildings from the seeded PRNG, 4 styles:
// downtown glass towers (60-180m), midrise concrete (15-40m), pastel
// residential (8-15m), corrugated warehouses (6-10m).
// Max 8 PointLights, static, on the tallest towers, lit only at night.
// Original code, written for this entry.
import * as THREE from 'three';
import { makeCanvasTexture, mulberry32 } from '../engine/scene.js';
import { addCollider } from '../engine/collision.js';

function windowsTexture({ base, glass, lit, cols, rows, litRatio }) {
  return makeCanvasTexture(128, 256, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const on = Math.random() < litRatio;
        c.fillStyle = on ? lit : glass;
        c.fillRect(col * cw + cw * 0.18, r * ch + ch * 0.22, cw * 0.64, ch * 0.56);
      }
    }
  });
}

const STYLES = {
  tower: (rng) => ({
    w: 22 + rng() * 10,
    d: 22 + rng() * 10,
    h: 60 + rng() * 120,
    tex: windowsTexture({
      base: ['#2c3e50', '#34495e', '#223140'][Math.floor(rng() * 3)],
      glass: '#1c2833',
      lit: '#ffd98a',
      cols: 8,
      rows: 18,
      litRatio: 0.35,
    }),
    color: 0xffffff,
  }),
  midrise: (rng) => ({
    w: 18 + rng() * 10,
    d: 16 + rng() * 8,
    h: 15 + rng() * 25,
    tex: windowsTexture({
      base: ['#9a8f80', '#8a7f72', '#a89a88'][Math.floor(rng() * 3)],
      glass: '#2e3a44',
      lit: '#ffe9b0',
      cols: 6,
      rows: 8,
      litRatio: 0.3,
    }),
    color: 0xffffff,
  }),
  residential: (rng) => ({
    w: 12 + rng() * 8,
    d: 10 + rng() * 6,
    h: 8 + rng() * 7,
    tex: windowsTexture({
      base: ['#f2c6a0', '#f7d9b0', '#c9d6c5', '#e8b4b8'][Math.floor(rng() * 4)],
      glass: '#33414f',
      lit: '#fff0c0',
      cols: 5,
      rows: 4,
      litRatio: 0.4,
    }),
    color: 0xffffff,
  }),
  warehouse: (rng) => ({
    w: 24 + rng() * 12,
    d: 16 + rng() * 8,
    h: 6 + rng() * 4,
    tex: makeCanvasTexture(128, 64, (c, w2, h2) => {
      c.fillStyle = ['#7d7468', '#6e7a72', '#8a7a5c'][Math.floor(rng() * 3)];
      c.fillRect(0, 0, w2, h2);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < w2; x += 8) c.fillRect(x, 0, 2, h2);
    }),
    color: 0xffffff,
  }),
};

export function buildBuildings(ctx) {
  const scene = ctx.scene;
  const rng = mulberry32(1337);
  const towers = []; // {x, z, h} for the night-light budget
  const buildingList = []; // every building {x, z, h} — lighting.js picks the nearest 8
  const windowMats = []; // facade materials whose windows glow at night (Wave 11A)
  const blockCenters = [-120, -40, 40, 120];

  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const distCenter = Math.max(Math.abs(bx), Math.abs(bz));
      let style;
      if (distCenter <= 40) style = 'tower';
      else if (distCenter <= 120) style = rng() < 0.7 ? 'midrise' : 'residential';
      else if (bz >= 120 && bx >= 40) style = rng() < 0.6 ? 'warehouse' : 'residential';
      else style = 'residential';

      const count = style === 'tower' ? 1 : style === 'midrise' ? 2 : 3;
      const plots =
        count === 1
          ? [[0, 0]]
          : count === 2
            ? [[-14, -10], [14, 12]]
            : [[-16, -14], [16, -12], [0, 16]];
      for (const [ox, oz] of plots) {
        const spec = STYLES[style](rng);
        const x = bx + ox;
        const z = bz + oz;
        const mat = new THREE.MeshStandardMaterial({
          map: spec.tex,
          color: spec.color,
          roughness: 0.85,
          metalness: style === 'tower' ? 0.25 : 0.05,
        });
        if (style !== 'warehouse') {
          // Lit windows baked into the texture glow via the emissive map;
          // intensity stays 0 by day, setNightWindows() raises it at night.
          mat.emissiveMap = spec.tex;
          mat.emissive = new THREE.Color(0xffc978);
          mat.emissiveIntensity = 0;
          windowMats.push(mat);
        }
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), mat);
        mesh.position.set(x, spec.h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        buildingList.push({ x, z, h: spec.h });
        // Flat roof cap so the texture doesn't stretch over the top.
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(spec.w + 0.4, 0.5, spec.d + 0.4),
          new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 1 }),
        );
        roof.position.set(x, spec.h + 0.25, z);
        scene.add(roof);
        addCollider(ctx, {
          minX: x - spec.w / 2,
          maxX: x + spec.w / 2,
          minZ: z - spec.d / 2,
          maxZ: z + spec.d / 2,
          minY: 0,
          maxY: spec.h,
        });
        if (style === 'tower') towers.push({ x, z, h: spec.h });
      }
    }
  }

  // Night lights: 8 static PointLights on the tallest towers, on at night.
  towers.sort((a, b) => b.h - a.h);
  const lights = [];
  for (const t of towers.slice(0, 8)) {
    const light = new THREE.PointLight(0xffd9a0, 0, 90, 1.6);
    light.position.set(t.x, t.h + 2, t.z);
    scene.add(light);
    lights.push(light);
  }
  // Exposed so lighting.js can reuse this pool by proximity (Wave 11A).
  ctx.buildingList = buildingList;
  ctx.buildingTops = towers;
  ctx.windowLights = lights;

  // Windows glow at night (hour < 6 or >= 19), dark by day.
  function setNightWindows(hour) {
    const night = hour < 6 || hour >= 19;
    const target = night ? 0.55 : 0;
    for (const m of windowMats) m.emissiveIntensity = target;
    return night;
  }

  function update(_dt) {
    setNightWindows(ctx.time.hour);
    // Once lighting.js owns the pool (ctx._windowLightsOwned), it sets
    // positions + intensity by proximity; don't fight it here.
    if (ctx._windowLightsOwned) return;
    const on = ctx.time.isNight();
    for (const l of lights) l.intensity = on ? 900 : 0;
  }
  ctx.updatables.push(update);
  update(0);
  return { towers: towers.length, lights: lights.length, buildingList, setNightWindows };
}
