# Changelog

## 0.1.0 — 2026-08-26

- Added seeded Fibonacci-sphere nodes with deterministic jitter and tier assignment.
- Added exact degree-capped proximity graph generation and explicit endpoint IDs.
- Added deterministic packet buffers suitable for GPU animation.
- Added finite-input, complexity, degree, packet, zero-node, and one-node guards.
- Snapshot accessor-backed configuration once and reject finite geometry that would overflow GPU-facing Float32 buffers.
