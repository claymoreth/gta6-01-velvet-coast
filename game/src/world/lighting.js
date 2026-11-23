// lighting.js — sun / moon / hemisphere / ambient, driven by time of day.
// Original code, written for this entry.
import * as THREE from 'three';

const DAY_SKY_TOP = new THREE.Color(0x3f7fd0);
const DAY_SKY_HORIZON = new THREE.Color(0x9fc8e8);
const NIGHT_SKY_TOP = new THREE.Color(0x060a18);
const NIGHT_SKY_HORIZON = new THREE.Color(0x1a2340);
const SUNSET_SKY_TOP = new THREE.Color(0x5a4a8a);
const SUNSET_SKY_HORIZON = new THREE.Color(0xff9a5c);

export function buildLighting(ctx) {
  const scene = ctx.scene;

  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);

  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.0);
  moon.position.set(-120, 180, -80);
  scene.add(moon);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a3f35, 0.9);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  ctx.sun = sun;
  ctx.moon = moon;
  ctx.hemi = hemi;

  // Window lights, reused by proximity (Wave 11A): at most 8 warm
  // PointLights, moved every frame onto the 8 buildings nearest the
  // player. Reuses the tower lights buildings.js already made, topping
  // the pool up to 8 with fresh ones. buildings.js must not fight over
  // their intensity once this flag is set (see its update()).
  const windowLights = [];
  if (Array.isArray(ctx.windowLights)) {
    for (const l of ctx.windowLights) windowLights.push(l);
  }
  while (windowLights.length < 8) {
    const l = new THREE.PointLight(0xffd9a0, 0, 90, 1.6);
    scene.add(l);
    windowLights.push(l);
  }
  ctx.windowLights = windowLights;
  ctx._windowLightsOwned = true;

  // Pick the 8 nearest buildings (from ctx.buildingList, exposed by
  // buildings.js) and park one pool light on each rooftop. Lights for
  // buildings beyond the pool simply stay off — the cap is 8 active.
  function updateWindowLights(playerPos) {
    const list = Array.isArray(ctx.buildingList) ? ctx.buildingList : [];
    if (!list.length || !playerPos) return;
    const px = playerPos.x;
    const pz = playerPos.z;
    const sorted = list
      .slice()
      .sort((a, b) => (a.x - px) ** 2 + (a.z - pz) ** 2 - ((b.x - px) ** 2 + (b.z - pz) ** 2));
    const on = ctx.time.isNight();
    for (let i = 0; i < windowLights.length; i++) {
      const b = sorted[i % sorted.length];
      const l = windowLights[i];
      l.position.set(b.x, b.h + 2, b.z);
      l.intensity = on ? 900 : 0;
    }
  }

  const tmpTop = new THREE.Color();
  const tmpHor = new THREE.Color();

  function update(_dt) {
    const time = ctx.time;
    const day = time.dayFactor();
    const elev = Math.sin(time.sunAngle());
    const a = time.sunAngle();
    // Sun orbits east -> west across the sky.
    sun.position.set(Math.cos(a) * 320, Math.sin(a) * 320, 140);
    sun.target.position.set(0, 0, 0);
    sun.intensity = 0.15 + day * 2.4;
    sun.color.setHSL(0.09, 0.55, 0.55 + day * 0.25);
    // Sunset tint when the sun is near the horizon.
    const sunset = Math.max(0, 1 - Math.abs(elev) * 4) * (elev > -0.2 ? 1 : 0);
    if (sunset > 0) sun.color.lerp(new THREE.Color(0xff8844), sunset * 0.6);

    moon.intensity = time.isNight() ? 0.55 : 0.0;
    hemi.intensity = 0.25 + day * 0.75;
    ambient.intensity = 0.08 + day * 0.1;

    // Sky gradient + fog follow the same palette.
    tmpTop.copy(NIGHT_SKY_TOP).lerp(DAY_SKY_TOP, day);
    tmpHor.copy(NIGHT_SKY_HORIZON).lerp(DAY_SKY_HORIZON, day);
    if (sunset > 0) {
      tmpTop.lerp(SUNSET_SKY_TOP, sunset * 0.7);
      tmpHor.lerp(SUNSET_SKY_HORIZON, sunset * 0.8);
    }
    if (ctx.sky) {
      ctx.sky.uniforms.uTopColor.value.copy(tmpTop);
      ctx.sky.uniforms.uHorizonColor.value.copy(tmpHor);
    }
    if (scene.fog) scene.fog.color.copy(tmpHor).lerp(tmpTop, 0.25);
    if (scene.background && scene.background.isColor) {
      scene.background.copy(tmpHor);
    }
    // Night fog, slightly denser (Wave 11A; scene.js owns the densities).
    if (scene.userData.setNightFog) scene.userData.setNightFog(time.isNight());
    // Window lights follow the player: nearest 8 buildings only.
    updateWindowLights(ctx.player ? ctx.player.pos : null);
  }

  ctx.updatables.push(update);
  update(0);
  return { sun, moon, hemi, ambient, updateWindowLights };
}
