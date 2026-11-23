// props.js — palms, lampposts, benches, bins, billboards with original
// in-world brands (Sireno Motors, Escabi, Sunset 88.5, Vanta, Moro).
// Original code, written for this entry.
import * as THREE from 'three';
import { makeCanvasTexture, mulberry32 } from '../engine/scene.js';
import { addCollider } from '../engine/collision.js';

const BRANDS = [
  { text: 'SIRENO', sub: 'MOTORS', bg: '#123a5c', fg: '#ffd76a' },
  { text: 'ESCABI', sub: 'ESCAPE IN STYLE', bg: '#5c1a2e', fg: '#ffffff' },
  { text: 'SUNSET 88.5', sub: 'PORT SOLANA RADIO', bg: '#e8632c', fg: '#fff3d6' },
  { text: 'VANTA', sub: '90.1 — AFTER DARK', bg: '#14141c', fg: '#b78cff' },
  { text: 'MORO', sub: 'DRIVE THE COAST', bg: '#0f5c46', fg: '#eafff3' },
];

function billboardTexture(brand) {
  return makeCanvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = brand.bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = brand.fg;
    c.font = 'bold 44px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText(brand.text, w / 2, h / 2 + 4);
    c.font = '20px system-ui, sans-serif';
    c.fillText(brand.sub, w / 2, h / 2 + 34);
  });
}

function makePalm(rng) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 6, 7), trunkMat);
  trunk.position.y = 3;
  trunk.rotation.z = (rng() - 0.5) * 0.12;
  trunk.castShadow = true;
  g.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7d46, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.28, 3.4, 4), frondMat);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.4, 6.4, Math.sin(a) * 1.4);
    frond.rotation.z = Math.cos(a) * 1.1;
    frond.rotation.x = -Math.sin(a) * 1.1;
    frond.castShadow = true;
    g.add(frond);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 }),
  );
  nuts.position.y = 6.1;
  g.add(nuts);
  return g;
}

function makeLamppost() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 8), mat);
  pole.position.y = 2.6;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), mat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.7, 5.1, 0);
  g.add(arm);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0xfff2c0,
      emissive: 0xffdf8a,
      emissiveIntensity: 0.9,
    }),
  );
  head.position.set(1.4, 5.0, 0);
  g.add(head);
  // Keep the head material so setLampLights() can brighten it at night.
  g.userData.headMat = head.material;
  return g;
}

export function buildProps(ctx) {
  const scene = ctx.scene;
  const rng = mulberry32(1337 + 999);
  let palms = 0;
  let lamps = 0;

  // Palms: beach row + scattered along sidewalks.
  for (let x = -180; x <= 180; x += 30) {
    const palm = makePalm(rng);
    palm.position.set(x + (rng() - 0.5) * 6, 0, 192 + rng() * 4);
    scene.add(palm);
    palms++;
  }
  for (let i = 0; i < 14; i++) {
    const palm = makePalm(rng);
    const bx = [-120, -40, 40, 120][Math.floor(rng() * 4)];
    const bz = [-120, -40, 40, 120][Math.floor(rng() * 4)];
    palm.position.set(bx + (rng() < 0.5 ? -33 : 33), 0, bz + (rng() - 0.5) * 50);
    scene.add(palm);
    palms++;
  }

  // Lampposts along the north-south roads, alternating sides.
  // Wave 11A: record each lamp-head world position for the light pool.
  const lampHeads = []; // {x, y, z} of the glowing head
  const headMats = [];
  for (const x of [-160, -80, 0, 80, 160]) {
    for (let z = -180; z <= 180; z += 40) {
      const lamp = makeLamppost();
      lamp.position.set(x + 7, 0, z);
      lamp.rotation.y = z % 80 === 0 ? 0 : Math.PI;
      scene.add(lamp);
      lamps++;
      // Head sits at local (+1.4, 5, 0); rotation.y = PI flips it to -1.4.
      const hx = x + 7 + (lamp.rotation.y === 0 ? 1.4 : -1.4);
      lampHeads.push({ x: hx, y: 5.0, z });
      headMats.push(lamp.userData.headMat);
    }
  }

  // Small reusable pool (Wave 11A): 6 warm PointLights parked on the
  // 6 lampposts nearest the player at night, off by day.
  const lampLights = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(0xffc978, 0, 40, 1.8);
    scene.add(l);
    lampLights.push(l);
  }

  // Night = hour < 6 or >= 19 (same cut as buildings.setNightWindows).
  function setLampLights(hour) {
    const night = hour < 6 || hour >= 19;
    for (const m of headMats) m.emissiveIntensity = night ? 2.2 : 0.9;
    let px = 0;
    let pz = 0;
    if (ctx.player && ctx.player.pos) {
      px = ctx.player.pos.x;
      pz = ctx.player.pos.z;
    } else if (ctx.camera) {
      px = ctx.camera.position.x;
      pz = ctx.camera.position.z;
    }
    const sorted = lampHeads
      .slice()
      .sort((a, b) => (a.x - px) ** 2 + (a.z - pz) ** 2 - ((b.x - px) ** 2 + (b.z - pz) ** 2));
    for (let i = 0; i < lampLights.length; i++) {
      const h = sorted[i % sorted.length];
      const l = lampLights[i];
      l.position.set(h.x, h.y, h.z);
      l.intensity = night ? 700 : 0;
    }
    return night;
  }

  function update(_dt) {
    setLampLights(ctx.time.hour);
  }
  ctx.updatables.push(update);
  update(0);
  ctx.lampLights = { lights: lampLights, setLampLights };

  // Benches + bins near the beach promenade.
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
  const binMat = new THREE.MeshStandardMaterial({ color: 0x2f6b4f, roughness: 0.8 });
  for (let x = -150; x <= 150; x += 50) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), benchMat);
    seat.position.y = 0.5;
    seat.castShadow = true;
    bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.1), benchMat);
    back.position.set(0, 0.9, -0.28);
    bench.add(back);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.55), binMat);
      leg.position.set(sx, 0.25, 0);
      bench.add(leg);
    }
    bench.position.set(x, 0, 186);
    scene.add(bench);
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.9, 10), binMat);
    bin.position.set(x + 2.5, 0.45, 186);
    bin.castShadow = true;
    scene.add(bin);
  }

  // Billboards on rooftops / poles around the city.
  const spots = [
    { x: -40, z: -40, y: 42, ry: 0.4 },
    { x: 40, z: 40, y: 26, ry: -0.6 },
    { x: -120, z: 80, y: 14, ry: 1.2 },
    { x: 120, z: -120, y: 12, ry: -1.8 },
    { x: 0, z: 160, y: 10, ry: 3.1 },
  ];
  spots.forEach((s, i) => {
    const brand = BRANDS[i % BRANDS.length];
    const g = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(12, 6, 0.5),
      new THREE.MeshStandardMaterial({ map: billboardTexture(brand), roughness: 0.8 }),
    );
    board.position.y = 3;
    board.castShadow = true;
    g.add(board);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 3, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }),
    );
    post.position.y = 0;
    g.add(post);
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = s.ry;
    scene.add(g);
    addCollider(ctx, {
      minX: s.x - 0.5, maxX: s.x + 0.5,
      minZ: s.z - 0.5, maxZ: s.z + 0.5,
      minY: 0, maxY: s.y,
    });
  });

  return { palms, lamps, billboards: spots.length, setLampLights };
}
