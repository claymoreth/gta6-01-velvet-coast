// pathfinding.js — road graph over the 5x5 street grid (Manhattan routing).
// Original code, written for this entry. Wave 6 will use it for NPC driving.

export const GRID_LINES = [-160, -80, 0, 80, 160];

let graph = null;

export function buildRoadGraph() {
  const nodes = [];
  const byKey = new Map();
  for (const x of GRID_LINES) {
    for (const z of GRID_LINES) {
      const node = { x, z, id: `${x},${z}` };
      nodes.push(node);
      byKey.set(node.id, node);
    }
  }
  const adj = new Map();
  for (const n of nodes) {
    const list = [];
    for (const [dx, dz] of [[80, 0], [-80, 0], [0, 80], [0, -80]]) {
      const nb = byKey.get(`${n.x + dx},${n.z + dz}`);
      if (nb) list.push(nb);
    }
    adj.set(n.id, list);
  }
  graph = { nodes, adj };
  return graph;
}

export function nearestNode(x, z) {
  if (!graph) buildRoadGraph();
  let best = null;
  let bestD = Infinity;
  for (const n of graph.nodes) {
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

// Bearing + distance from `from` to `to` (angle = atan2(dx, dz),
// matching the mesh yaw convention used by player / pedestrians).
export function directionTo(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return { angle: Math.atan2(dx, dz), distance: Math.hypot(dx, dz) };
}

// Nearest drivable point to (x, z): the closest road-graph node when the
// graph has the known {nodes:[{x,z}]} shape, else the input point itself.
export function nearestRoadPoint(roadGraph, x, z) {
  const nodes = roadGraph && Array.isArray(roadGraph.nodes) ? roadGraph.nodes : null;
  if (!nodes || !nodes.length) return { x, z };
  let best = nodes[0];
  let bestD = Infinity;
  for (const n of nodes) {
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return { x: best.x, z: best.z };
}

// Next waypoint on a Manhattan route from `from` toward `to`.
// Moves along X first, then Z, one intersection at a time.
export function nextWaypointOnRoad(from, to) {
  if (!graph) buildRoadGraph();
  const a = nearestNode(from.x, from.z);
  const b = nearestNode(to.x, to.z);
  if (!a || !b) return null;
  if (a.id === b.id) return { x: to.x, z: to.z };
  // Step in X toward target column, else step in Z.
  if (a.x !== b.x) {
    const step = b.x > a.x ? 80 : -80;
    return { x: a.x + step, z: a.z };
  }
  const step = b.z > a.z ? 80 : -80;
  return { x: a.x, z: a.z + step };
}
