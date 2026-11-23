// sky.js — gradient sky dome, night stars, glowing moon.
// Original code, written for this entry.
import * as THREE from 'three';
import { mulberry32 } from '../engine/scene.js';

export function buildSky(ctx) {
  const scene = ctx.scene;
  const rng = mulberry32(1337 + 77);

  const uniforms = {
    uTopColor: { value: new THREE.Color(0x3f7fd0) },
    uHorizonColor: { value: new THREE.Color(0x9fc8e8) },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        float t = pow(max(h, 0.0), 0.55);
        vec3 col = mix(uHorizonColor, uTopColor, t);
        if (h < 0.0) col = uHorizonColor * 0.85;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(880, 24, 16), skyMat);
  scene.add(sky);

  // Stars on the upper dome, fading in at night.
  const starCount = 900;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rng() * Math.PI * 2;
    const y = 0.08 + rng() * 0.92;
    const r = Math.sqrt(1 - y * y);
    const R = 840;
    positions[i * 3] = Math.cos(theta) * r * R;
    positions[i * 3 + 1] = y * R;
    positions[i * 3 + 2] = Math.sin(theta) * r * R;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Moon, opposite the sun.
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(22, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xe8eefc, fog: false }),
  );
  moon.visible = false;
  scene.add(moon);

  ctx.sky = { uniforms, skyMat, stars, moon, updateSkyExtras };

  // Weather has no scene of its own (main.js builds it bare), so the sky
  // — built while the scene exists — attaches it here (Wave 11A).
  if (ctx.weather && typeof ctx.weather.attach === 'function') {
    ctx.weather.attach(ctx);
  }

  // Stars fade in at night; the moon sits opposite the sun.
  // sunDir is a THREE.Vector3 pointing at the sun, or a sun angle number.
  function updateSkyExtras(hour, sunDir) {
    const angle = typeof sunDir === 'number' ? sunDir : Math.atan2(sunDir.y, sunDir.x);
    const night = hour < 6 || hour >= 18 ? 1 : Math.max(0, -Math.sin(angle) * 2);
    starMat.opacity = Math.min(1, night) * 0.9;
    moon.visible = night > 0.05;
    if (moon.visible) {
      if (typeof sunDir === 'number' || !sunDir) {
        const a = angle + Math.PI;
        moon.position.set(Math.cos(a) * 700, Math.max(120, Math.sin(a) * 700), -300);
      } else {
        // Opposite the sun direction, lifted so it never dips below the horizon.
        moon.position.set(
          -sunDir.x * 700,
          Math.max(120, -sunDir.y * 700),
          -sunDir.z * 700,
        );
      }
    }
    return night;
  }

  function update(_dt) {
    const time = ctx.time;
    const a = time.sunAngle();
    // Sun direction as built by lighting.js (east -> west, z tilted +140).
    const sunDir = new THREE.Vector3(Math.cos(a), Math.sin(a), 140 / 320).normalize();
    updateSkyExtras(time.hour, sunDir);
    // Sky dome follows the camera so the horizon never runs out.
    sky.position.copy(ctx.camera.position);
    stars.position.copy(ctx.camera.position);
  }

  ctx.updatables.push(update);
  update(0);
  return ctx.sky;
}
