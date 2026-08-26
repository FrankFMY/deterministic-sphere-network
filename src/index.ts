const TWO_PI = Math.PI * 2;
const MAX_NODE_COUNT = 4_096;
const MAX_DEGREE = 32;
const MAX_PACKET_COUNT = 1_000_000;
const MAX_FLOAT32 = 3.402_823_466_385_288_6e38;
const MAX_SPHERE_RADIUS = MAX_FLOAT32 / 2;

export interface SphereNetworkConfig {
  nodeCount: number;
  sphereRadius: number;
  edgeMaxDistance: number;
  maxEdgesPerNode: number;
  packetCount: number;
  seed: number;
}

export interface SphereNetworkData {
  nodePositions: Float32Array;
  nodeTiers: Uint8Array;
  nodePhases: Float32Array;
  edgeNodeIndices: Uint32Array;
  edgeStarts: Float32Array;
  edgeEnds: Float32Array;
  edgePhases: Float32Array;
  edgeCount: number;
  packetEdgeIndices: Uint32Array;
  packetSpeeds: Float32Array;
  packetOffsets: Float32Array;
}

function boundedInteger(value: number, name: string, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new TypeError(
      `${name} must be a safe integer between 0 and ${maximum}`,
    );
  }
}

function finiteNumber(
  value: number,
  name: string,
  minimum: number,
  inclusive: boolean,
): void {
  if (
    !Number.isFinite(value) ||
    (inclusive ? value < minimum : value <= minimum)
  ) {
    throw new TypeError(
      `${name} must be finite and ${inclusive ? "at least" : "greater than"} ${minimum}`,
    );
  }
}

function validateConfig(config: SphereNetworkConfig): void {
  boundedInteger(config.nodeCount, "nodeCount", MAX_NODE_COUNT);
  finiteNumber(config.sphereRadius, "sphereRadius", 0, false);
  finiteNumber(config.edgeMaxDistance, "edgeMaxDistance", 0, true);
  if (config.sphereRadius > MAX_SPHERE_RADIUS) {
    throw new TypeError(`sphereRadius must be at most ${MAX_SPHERE_RADIUS}`);
  }
  if (config.edgeMaxDistance > MAX_FLOAT32) {
    throw new TypeError(`edgeMaxDistance must be at most ${MAX_FLOAT32}`);
  }
  boundedInteger(config.maxEdgesPerNode, "maxEdgesPerNode", MAX_DEGREE);
  boundedInteger(config.packetCount, "packetCount", MAX_PACKET_COUNT);
  boundedInteger(config.seed, "seed", 0xffff_ffff);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function distanceBetween(
  positions: Float32Array,
  left: number,
  right: number,
): number {
  const leftOffset = left * 3;
  const rightOffset = right * 3;
  const dx = positions[leftOffset]! - positions[rightOffset]!;
  const dy = positions[leftOffset + 1]! - positions[rightOffset + 1]!;
  const dz = positions[leftOffset + 2]! - positions[rightOffset + 2]!;
  return Math.hypot(dx, dy, dz);
}

function distanceFromOrigin(positions: Float32Array, index: number): number {
  const offset = index * 3;
  return Math.hypot(
    positions[offset]!,
    positions[offset + 1]!,
    positions[offset + 2]!,
  );
}

export function generateSphereNetwork(
  config: SphereNetworkConfig,
): SphereNetworkData {
  const snapshot: SphereNetworkConfig = {
    nodeCount: config.nodeCount,
    sphereRadius: config.sphereRadius,
    edgeMaxDistance: config.edgeMaxDistance,
    maxEdgesPerNode: config.maxEdgesPerNode,
    packetCount: config.packetCount,
    seed: config.seed,
  };
  validateConfig(snapshot);
  const {
    nodeCount,
    sphereRadius,
    edgeMaxDistance,
    maxEdgesPerNode,
    packetCount,
  } = snapshot;
  const random = mulberry32(snapshot.seed);
  const nodePositions = new Float32Array(nodeCount * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < nodeCount; index += 1) {
    const y = nodeCount === 1 ? 0 : 1 - (index / (nodeCount - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * index;
    const jitter = 1 + (random() - 0.5) * 0.3;
    const offset = index * 3;
    nodePositions[offset] = Math.cos(theta) * radiusAtY * sphereRadius * jitter;
    nodePositions[offset + 1] = y * sphereRadius * jitter;
    nodePositions[offset + 2] =
      Math.sin(theta) * radiusAtY * sphereRadius * jitter;
  }

  const ranked = Array.from({ length: nodeCount }, (_, index) => ({
    index,
    distance: distanceFromOrigin(nodePositions, index),
  })).sort(
    (left, right) => left.distance - right.distance || left.index - right.index,
  );
  const nodeTiers = new Uint8Array(nodeCount);
  const coreLimit = Math.floor(nodeCount * 0.05);
  const relayLimit = Math.floor(nodeCount * 0.3);
  for (const [rank, item] of ranked.entries()) {
    nodeTiers[item.index] = rank < coreLimit ? 0 : rank < relayLimit ? 1 : 2;
  }

  const nodePhases = new Float32Array(nodeCount);
  for (let index = 0; index < nodeCount; index += 1)
    nodePhases[index] = random() * TWO_PI;

  const edgeCounts = new Uint16Array(nodeCount);
  const edgeKeys = new Set<string>();
  const edges: Array<readonly [number, number]> = [];
  for (let left = 0; left < nodeCount; left += 1) {
    if (edgeCounts[left]! >= maxEdgesPerNode) continue;
    const candidates: Array<{ index: number; distance: number }> = [];
    for (let right = 0; right < nodeCount; right += 1) {
      if (left === right) continue;
      const distance = distanceBetween(nodePositions, left, right);
      if (distance <= edgeMaxDistance)
        candidates.push({ index: right, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance || a.index - b.index);
    for (const candidate of candidates) {
      if (edgeCounts[left]! >= maxEdgesPerNode) break;
      const right = candidate.index;
      if (edgeCounts[right]! >= maxEdgesPerNode) continue;
      const minimum = Math.min(left, right);
      const maximum = Math.max(left, right);
      const key = `${minimum}:${maximum}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push([minimum, maximum]);
      edgeCounts[left] = edgeCounts[left]! + 1;
      edgeCounts[right] = edgeCounts[right]! + 1;
    }
  }

  const edgeCount = edges.length;
  if (packetCount > 0 && edgeCount === 0) {
    throw new RangeError("packets require at least one generated edge");
  }
  const edgeNodeIndices = new Uint32Array(edgeCount * 2);
  const edgeStarts = new Float32Array(edgeCount * 3);
  const edgeEnds = new Float32Array(edgeCount * 3);
  const edgePhases = new Float32Array(edgeCount);
  for (const [edgeIndex, [left, right]] of edges.entries()) {
    edgeNodeIndices[edgeIndex * 2] = left;
    edgeNodeIndices[edgeIndex * 2 + 1] = right;
    for (let axis = 0; axis < 3; axis += 1) {
      edgeStarts[edgeIndex * 3 + axis] = nodePositions[left * 3 + axis]!;
      edgeEnds[edgeIndex * 3 + axis] = nodePositions[right * 3 + axis]!;
    }
    edgePhases[edgeIndex] = random() * TWO_PI;
  }

  const packetEdgeIndices = new Uint32Array(packetCount);
  const packetSpeeds = new Float32Array(packetCount);
  const packetOffsets = new Float32Array(packetCount);
  for (let packet = 0; packet < packetCount; packet += 1) {
    packetEdgeIndices[packet] = Math.floor(random() * edgeCount);
    packetSpeeds[packet] = 0.3 + random() * 1.2;
    packetOffsets[packet] = random();
  }

  return {
    nodePositions,
    nodeTiers,
    nodePhases,
    edgeNodeIndices,
    edgeStarts,
    edgeEnds,
    edgePhases,
    edgeCount,
    packetEdgeIndices,
    packetSpeeds,
    packetOffsets,
  };
}
