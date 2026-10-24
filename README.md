# Deterministic Sphere Network

Seeded Fibonacci-sphere proximity graphs with bounded degree and GPU-ready typed buffers. The package is pure TypeScript and has no runtime or rendering dependency.

## Use cases

- WebGL/Three.js network visualizations;
- deterministic procedural fixtures;
- sphere-distributed simulation nodes;
- repeatable animation and screenshot tests;
- GPU upload buffers for nodes, edges, and travelling packets.

## Installation

From the built GitHub release asset:

```bash
npm install https://github.com/FrankFMY/deterministic-sphere-network/releases/download/v0.1.0/deterministic-sphere-network-0.1.0.tgz
```

The npm release is pending maintainer approval:

```bash
npm install deterministic-sphere-network
```

## Example

```ts
import { generateSphereNetwork } from "deterministic-sphere-network";

const graph = generateSphereNetwork({
  nodeCount: 512,
  sphereRadius: 3,
  edgeMaxDistance: 1.2,
  maxEdgesPerNode: 6,
  packetCount: 2_000,
  seed: 42,
});

console.log(graph.nodePositions.length); // 1536
console.log(graph.edgeCount); // generated undirected edges
```

The same complete configuration always produces byte-identical typed-array values on the same JavaScript numeric runtime.

## Output

- `nodePositions`: `Float32Array(nodeCount * 3)`;
- `nodeTiers`: `Uint8Array(nodeCount)` containing core/relay/edge tiers `0/1/2`;
- `nodePhases`: deterministic values in `[0, 2π)`;
- `edgeNodeIndices`: endpoint node IDs as `Uint32Array(edgeCount * 2)`;
- `edgeStarts` / `edgeEnds`: flattened GPU-ready coordinates;
- `edgePhases`: deterministic flow phases;
- `packetEdgeIndices`: a valid edge ID for every packet;
- `packetSpeeds` / `packetOffsets`: deterministic animation inputs.

## Safety and complexity bounds

Generation uses an O(n²) exact neighbor search with per-node candidate sorting (O(n² log n) worst-case total time). To keep accidental UI/server inputs bounded, the public contract rejects:

- more than 4,096 nodes;
- degree caps above 32;
- more than 1,000,000 packets;
- non-finite or negative geometry values;
- sphere radii whose jittered coordinates cannot remain finite in `Float32Array` and edge distances above the Float32 range;
- non-integer seeds/counts;
- packets when no edge can be generated.

Zero-node and one-node configurations are valid when `packetCount` is zero. The one-node case remains finite, and packet indices cannot silently point to a nonexistent edge.

## Boundaries

This package generates topology and typed data only. It does not include rendering, shaders, animation loops, scene lifecycle, pointer interaction, layout controls, or Three.js/Svelte adapters.

Runtime: ESM on Node.js 20+. Reproducibility is scoped to the same numeric runtime, not guaranteed across engines. [npm package](https://www.npmjs.com/package/deterministic-sphere-network). Until approval, the existing release asset above is usable; for this candidate run `npm ci && npm run build && npm pack` in a source checkout.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm run check
npm test
npm run build
npm run pack:check
npm run package:check
```

## Author

**Artem Prianishnikov** — [FrankFMY](https://github.com/FrankFMY)

- Website: https://frankfmy.com
- Email: Pryanishnikovartem@gmail.com · frankfmy@proton.me
- Telegram: https://t.me/FrankFMY
- LinkedIn: https://www.linkedin.com/in/frankfmy/
- X: https://x.com/FrankFMY
- npm: https://www.npmjs.com/~frankfmy

## License

MIT © 2026 Artem Prianishnikov.
