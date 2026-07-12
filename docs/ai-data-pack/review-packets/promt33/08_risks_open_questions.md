# Risks And Open Questions

- Prompt 33 has reached `complete_transcript_validated`.
- Five expected findings are supported by alert labels or weak evidence rather than full underlying detail tables.
- The transcript prose summary has a minor arithmetic mismatch: it says `6/6`, while the actual table rows parse as `7 detected_with_evidence` and `5 detected_but_weak_evidence`.
- The packet relies on the Prompt 32 artifact stored under `tmp`; preserve or move it if workspace cleanup may remove temporary files.
- The human operator note confirms upload succeeded, but it does not name the visible ChatGPT model label.
