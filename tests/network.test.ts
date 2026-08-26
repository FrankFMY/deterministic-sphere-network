import { describe, expect, test } from "vitest";

import { generateSphereNetwork } from "../src/index.js";

const config = {
  nodeCount: 32,
  sphereRadius: 3,
  edgeMaxDistance: 2,
  maxEdgesPerNode: 4,
  packetCount: 64,
  seed: 42,
};

describe("deterministic sphere network", () => {
  test("produces byte-identical typed buffers for the same config and seed", () => {
    const first = generateSphereNetwork(config);
    const second = generateSphereNetwork(config);

    for (const key of [
      "nodePositions",
      "nodeTiers",
      "nodePhases",
      "edgeNodeIndices",
      "edgeStarts",
      "edgeEnds",
      "edgePhases",
      "packetEdgeIndices",
      "packetSpeeds",
      "packetOffsets",
    ] as const) {
      expect([...first[key]]).toEqual([...second[key]]);
    }
    expect(first.edgeCount).toBeGreaterThan(0);
    expect(first.edgeNodeIndices).toHaveLength(first.edgeCount * 2);
    expect(first.packetEdgeIndices).toHaveLength(config.packetCount);
  });

  test("keeps positions finite, edges unique and undirected degree bounded", () => {
    const graph = generateSphereNetwork(config);
    expect([...graph.nodePositions].every(Number.isFinite)).toBe(true);
    const degrees = new Uint32Array(config.nodeCount);
    const keys = new Set<string>();
    for (let edge = 0; edge < graph.edgeCount; edge += 1) {
      const left = graph.edgeNodeIndices[edge * 2]!;
      const right = graph.edgeNodeIndices[edge * 2 + 1]!;
      expect(left).not.toBe(right);
      expect(left).toBeLessThan(config.nodeCount);
      expect(right).toBeLessThan(config.nodeCount);
      const key = left < right ? `${left}:${right}` : `${right}:${left}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
      degrees[left] = (degrees[left] ?? 0) + 1;
      degrees[right] = (degrees[right] ?? 0) + 1;
    }
    expect(Math.max(...degrees)).toBeLessThanOrEqual(config.maxEdgesPerNode);
    expect(
      [...graph.packetEdgeIndices].every((edge) => edge < graph.edgeCount),
    ).toBe(true);
  });

  test("makes the seed part of topology identity", () => {
    const first = generateSphereNetwork(config);
    const second = generateSphereNetwork({ ...config, seed: 43 });
    expect([...first.nodePositions]).not.toEqual([...second.nodePositions]);
  });

  test("handles zero and one node without NaN and rejects packets when no edge exists", () => {
    const empty = generateSphereNetwork({
      ...config,
      nodeCount: 0,
      packetCount: 0,
    });
    expect(empty.edgeCount).toBe(0);
    expect(empty.nodePositions).toHaveLength(0);

    const single = generateSphereNetwork({
      ...config,
      nodeCount: 1,
      packetCount: 0,
    });
    expect([...single.nodePositions].every(Number.isFinite)).toBe(true);
    expect(single.edgeCount).toBe(0);

    expect(() =>
      generateSphereNetwork({ ...config, nodeCount: 1, packetCount: 1 }),
    ).toThrow(/packets require/);
  });

  test("rejects unsafe or contradictory bounds", () => {
    expect(() =>
      generateSphereNetwork({ ...config, nodeCount: 4_097 }),
    ).toThrow(/nodeCount/);
    expect(() =>
      generateSphereNetwork({ ...config, sphereRadius: Number.NaN }),
    ).toThrow(/sphereRadius/);
    expect(() =>
      generateSphereNetwork({ ...config, sphereRadius: Number.MAX_VALUE }),
    ).toThrow(/sphereRadius/);
    expect(() =>
      generateSphereNetwork({ ...config, edgeMaxDistance: -1 }),
    ).toThrow(/edgeMaxDistance/);
    expect(() =>
      generateSphereNetwork({ ...config, edgeMaxDistance: Number.MAX_VALUE }),
    ).toThrow(/edgeMaxDistance/);
    expect(() =>
      generateSphereNetwork({ ...config, maxEdgesPerNode: 33 }),
    ).toThrow(/maxEdgesPerNode/);
    expect(() => generateSphereNetwork({ ...config, packetCount: -1 })).toThrow(
      /packetCount/,
    );
    expect(() => generateSphereNetwork({ ...config, seed: 1.5 })).toThrow(
      /seed/,
    );
  });

  test("snapshots accessor-backed configuration exactly once before validation", () => {
    let packetCountReads = 0;
    const accessorConfig = {
      ...config,
      nodeCount: 2,
      edgeMaxDistance: 10,
      maxEdgesPerNode: 1,
      get packetCount() {
        packetCountReads += 1;
        return packetCountReads === 1 ? 0 : 1_000_001;
      },
    };
    const graph = generateSphereNetwork(accessorConfig);
    expect(packetCountReads).toBe(1);
    expect(graph.packetEdgeIndices).toHaveLength(0);
  });

  test("never admits a subnormal-scale edge beyond the configured maximum distance", () => {
    const tinyConfig = {
      nodeCount: 12,
      sphereRadius: 1e-30,
      edgeMaxDistance: 7.876123046148686e-31,
      maxEdgesPerNode: 11,
      packetCount: 0,
      seed: 0,
    };
    const graph = generateSphereNetwork(tinyConfig);
    for (let edge = 0; edge < graph.edgeCount; edge += 1) {
      const offset = edge * 3;
      const distance = Math.hypot(
        graph.edgeStarts[offset]! - graph.edgeEnds[offset]!,
        graph.edgeStarts[offset + 1]! - graph.edgeEnds[offset + 1]!,
        graph.edgeStarts[offset + 2]! - graph.edgeEnds[offset + 2]!,
      );
      expect(distance).toBeLessThanOrEqual(tinyConfig.edgeMaxDistance);
    }
  });
});
