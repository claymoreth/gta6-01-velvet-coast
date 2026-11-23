// collision.js — AABB colliders, capsule resolution, ground height.
// Original code, written for this entry. No external assets.
import * as THREE from 'three';

// A collider is { minX, maxX, minZ, maxZ, minY, maxY }.
export function addCollider(ctx, box) {
  ctx.colliders.push(box);
  return box;
}

let groundFn = () => 0;

export function registerGroundHeight(fn) {
  groundFn = fn;
}

export function groundHeightAt(x, z) {
  return groundFn(x, z);
}

export function raycastDownGround(x, z) {
  return groundFn(x, z);
}

function overlapsBox(px, pz, radius, box) {
  return (
    px + radius > box.minX &&
    px - radius < box.maxX &&
    pz + radius > box.minZ &&
    pz - radius < box.maxZ
  );
}

// Axis-separated capsule-vs-AABB resolution. `pos` is the feet position
// ({x, y, z}, mutated in place). Y is handled by gravity + groundHeight.
// Each overlap is pushed out along the SMALLEST penetration axis, so a
// head-on approach stops dead at the face instead of sliding sideways.
export function resolveCapsule(pos, radius, height, colliders) {
  const top = pos.y + height;
  for (const box of colliders) {
    if (top <= box.minY || pos.y >= box.maxY) continue;
    if (!overlapsBox(pos.x, pos.z, radius, box)) continue;
    const penLeft = pos.x + radius - box.minX;
    const penRight = box.maxX - (pos.x - radius);
    const penX = Math.min(penLeft, penRight);
    const penNorth = pos.z + radius - box.minZ;
    const penSouth = box.maxZ - (pos.z - radius);
    const penZ = Math.min(penNorth, penSouth);
    if (penX < penZ) {
      pos.x = penLeft < penRight ? box.minX - radius : box.maxX + radius;
    } else {
      pos.z = penNorth < penSouth ? box.minZ - radius : box.maxZ + radius;
    }
  }
  return pos;
}

// --- Fase 7: raycast tembakan ---
const _raycaster = new THREE.Raycaster();

// Raycast ke scene; hanya objek dengan userData.shootable yang dihitung
// (musuh yang didaftarkan CombatManager). Kembalikan { point, object,
// distance } terdekat dalam maxDist, atau null bila tidak ada yang kena.
export function raycastWorld(ctx, origin, dir, maxDist = 100) {
  _raycaster.set(origin, dir);
  _raycaster.far = maxDist;
  const hits = _raycaster.intersectObjects(ctx.scene.children, true);
  for (const h of hits) {
    if (h.object.userData.shootable) {
      return { point: h.point, object: h.object, distance: h.distance };
    }
  }
  return null;
}

// Tandai grup (rekursif) sebagai target tembakan.
export function markShootable(group) {
  group.traverse((o) => {
    o.userData.shootable = true;
  });
  return group;
}
