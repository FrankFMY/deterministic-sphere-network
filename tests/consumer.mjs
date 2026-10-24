import assert from "node:assert/strict";
import { generateSphereNetwork } from "deterministic-sphere-network";
const config = {
  nodeCount: 32,
  sphereRadius: 3,
  edgeMaxDistance: 2,
  maxEdgesPerNode: 4,
  packetCount: 64,
  seed: 42,
};
const first = generateSphereNetwork(config),
  second = generateSphereNetwork(config);
assert.ok(first.edgeCount > 0);
for (const [key, value] of Object.entries(first)) {
  if (ArrayBuffer.isView(value))
    assert.deepEqual(
      Buffer.from(value.buffer, value.byteOffset, value.byteLength),
      Buffer.from(
        second[key].buffer,
        second[key].byteOffset,
        second[key].byteLength,
      ),
    );
}
assert.notDeepEqual(
  first.nodePositions,
  generateSphereNetwork({ ...config, seed: 43 }).nodePositions,
);
const degrees = new Uint32Array(config.nodeCount),
  edges = new Set();
for (let edge = 0; edge < first.edgeCount; edge++) {
  const left = first.edgeNodeIndices[edge * 2],
    right = first.edgeNodeIndices[edge * 2 + 1];
  assert.ok(left < right && right < config.nodeCount);
  assert.ok(!edges.has(`${left}:${right}`));
  edges.add(`${left}:${right}`);
  degrees[left]++;
  degrees[right]++;
  const start = first.edgeStarts.slice(edge * 3, edge * 3 + 3),
    end = first.edgeEnds.slice(edge * 3, edge * 3 + 3);
  assert.deepEqual(start, first.nodePositions.slice(left * 3, left * 3 + 3));
  assert.deepEqual(end, first.nodePositions.slice(right * 3, right * 3 + 3));
  assert.ok(
    Math.hypot(...start.map((value, axis) => value - end[axis])) <=
      config.edgeMaxDistance + 1e-6,
  );
}
assert.ok([...degrees].every((value) => value <= config.maxEdgesPerNode));
assert.ok(
  [...first.packetEdgeIndices].every((value) => value < first.edgeCount),
);
assert.ok([...first.packetOffsets].every((value) => value >= 0 && value <= 1));
assert.equal(
  generateSphereNetwork({ ...config, nodeCount: 0, packetCount: 0 }).edgeCount,
  0,
);
assert.throws(
  () => generateSphereNetwork({ ...config, nodeCount: 1, packetCount: 1 }),
  /packets require/,
);
assert.throws(() => generateSphereNetwork({ ...config, seed: -1 }), /seed/);
console.log(
  "installed deterministic topology/buffer/degree/packet consumer: PASS",
);
