import { generateSphereNetwork } from "deterministic-sphere-network";
import type {
  SphereNetworkConfig,
  SphereNetworkData,
} from "deterministic-sphere-network";
const config: SphereNetworkConfig = {
  nodeCount: 8,
  sphereRadius: 3,
  edgeMaxDistance: 10,
  maxEdgesPerNode: 2,
  packetCount: 4,
  seed: 42,
};
const graph: SphereNetworkData = generateSphereNetwork(config);
const positions: Float32Array = graph.nodePositions;
// @ts-expect-error all configuration fields are required
generateSphereNetwork({ nodeCount: 8 });
// @ts-expect-error seed is numeric, not an arbitrary label
generateSphereNetwork({ ...config, seed: "seed" });
// @ts-expect-error typed buffers are not number arrays
const invalid: number[] = graph.nodePositions;
void [positions, invalid];
