# Risks And Open Questions

- The smoke export harness still uses compiled `backend/dist` with a minimal Nest context because source `ts-node` full module loading has known Mongoose schema metadata limitations.
- Cached export direct download remains documented as a current limitation instead of being fixed in Prompt 32.
- Operational risk findings are surfaced in `16_operation_capacity`; a future schema version could introduce a dedicated operational risk findings section if needed.

