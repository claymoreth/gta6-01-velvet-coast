// scene.js — THREE.Scene setup, seeded PRNG, CanvasTexture helper.
// Original code, written for this entry. No external assets.
import * as THREE from 'three';

// Deterministic PRNG (mulberry32). Fixed seed 1337 for the whole world.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.FogExp2(0x9db8cc, 0.0016);

  // Night fog (Wave 11A): denser at night so the city closes in.
  // lighting.js calls this every frame from its update loop.
  scene.userData.setNightFog = (night) => {
    scene.fog.density = night ? 0.0028 : 0.0016;
  };
  scene.userData.updateSceneFog = (hour) => {
    scene.userData.setNightFog(hour < 6 || hour >= 18);
  };
  return scene;
}

// Standalone form of the userData hook above (Wave 11A).
export function updateSceneFog(scene, hour) {
  if (!scene || !scene.fog) return;
  if (scene.userData.setNightFog) scene.userData.setNightFog(hour < 6 || hour >= 18);
  else scene.fog.density = hour < 6 || hour >= 18 ? 0.0028 : 0.0016;
}

// Draw into a canvas and return a texture ready for meshes.
export function makeCanvasTexture(w, h, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
