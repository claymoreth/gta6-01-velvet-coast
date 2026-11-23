// ocean.js — animated wave shader plane + foam band at the shoreline.
// Original code, written for this entry.
import * as THREE from 'three';
import { makeCanvasTexture } from '../engine/scene.js';

export function buildOcean(ctx) {
  const scene = ctx.scene;

  const uniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color(0x2ec4b6) },
    uDeep: { value: new THREE.Color(0x0b3d91) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: false,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        float w = sin(p.x * 0.08 + uTime) * 0.35 + sin(p.y * 0.11 + uTime * 0.7) * 0.3;
        p.z += w;
        vWave = w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vec3 col = mix(uShallow, uDeep, clamp(vUv.y * 1.4, 0.0, 1.0));
        col += vWave * 0.08;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  // Plane local x -> world x, local y -> world -z after rotation.
  const geo = new THREE.PlaneGeometry(1600, 1600, 64, 64);
  const ocean = new THREE.Mesh(geo, mat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.5, 600);
  ocean.receiveShadow = true;
  scene.add(ocean);

  // Foam band hugging the shoreline (z ~ 200..240).
  const foamTex = makeCanvasTexture(256, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 26; i++) {
      const x = (i / 26) * w + 4;
      const y = h * 0.35 + Math.sin(i * 1.7) * 8;
      c.beginPath();
      c.ellipse(x, y, 9 + (i % 3) * 3, 4, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  foamTex.wrapS = THREE.RepeatWrapping;
  foamTex.wrapT = THREE.RepeatWrapping;
  foamTex.repeat.set(6, 1);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 42),
    new THREE.MeshBasicMaterial({
      map: foamTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(-100, -0.35, 218);
  scene.add(foam);

  function update(dt) {
    uniforms.uTime.value += dt;
    foamTex.offset.x += dt * 0.05;
  }
  ctx.updatables.push(update);

  // Foam band visibility switch (Wave 11A; weather can hide it in a storm).
  function setFoamVisible(visible) {
    foam.visible = !!visible;
    return foam.visible;
  }
  ctx.ocean = { ocean, foam, setFoamVisible };
  return ctx.ocean;
}
