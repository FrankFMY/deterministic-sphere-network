# Security Policy

The package is pure computation: it performs no I/O, network access, dynamic code loading, shell execution, DOM access, or telemetry.

Configuration values are validated and bounded before allocation or O(n²) work. Consumers must still treat generated buffers as untrusted when they cross process or network boundaries.

Report vulnerabilities through https://github.com/FrankFMY without including confidential consumer data.
