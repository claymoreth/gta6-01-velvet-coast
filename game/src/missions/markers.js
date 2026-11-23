// markers.js — floating 3D mission marker (diamond + light column).
// Original code, written for this entry. No external assets.
import * as THREE from 'three';

export class MissionMarkers {
  constructor(ctx) {
    this.ctx = ctx;
    this.target = null; // {x, z, label}
    this.group = new THREE.Group();
    this.group.visible = false;

    const diamondMat = new THREE.MeshStandardMaterial({
      color: 0xffd23c,
      emissive: 0xaa8800,
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.4,
    });
    this.diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), diamondMat);
    this.diamond.castShadow = true;
    this.group.add(this.diamond);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd23c,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 30, 12, 1, true), beamMat);
    this.beam.position.y = 15;
    this.group.add(this.beam);

    ctx.scene.add(this.group);
    this.time = 0;
    this.baseY = 0;
  }

  groundY(x, z) {
    if (typeof this.ctx.groundHeight === 'function') return this.ctx.groundHeight(x, z);
    return 0;
  }

  setTarget(x, z, label) {
    this.target = { x: Number(x) || 0, z: Number(z) || 0, label: label || '' };
    this.baseY = this.groundY(this.target.x, this.target.z);
    this.group.position.set(this.target.x, this.baseY + 3.2, this.target.z);
    this.group.visible = true;
    // Minimap-readable registry (array of {x, z, label}).
    this.ctx.missionMarkers = [{ x: this.target.x, z: this.target.z, label: this.target.label }];
  }

  clear() {
    this.target = null;
    this.group.visible = false;
    this.ctx.missionMarkers = [];
  }

  update(dt) {
    if (!this.group.visible || !this.target) return;
    this.time += dt;
    this.diamond.rotation.y += dt * 2.2;
    // Bobbing: diamond floats 2.6–3.8m above the ground.
    this.group.position.y = this.baseY + 3.2 + Math.sin(this.time * 1.8) * 0.6;
    this.beam.material.opacity = 0.12 + Math.sin(this.time * 1.8) * 0.05;
  }
}
