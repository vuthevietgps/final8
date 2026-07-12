# Cached Export Decision

Decision: `document_current_limitation`

Prompt 31 showed that cached export can complete but direct download is denied because cached jobs do not currently persist the `redactionProfile` metadata required by download policy.

Prompt 32 did not change cached export behavior. The primary acceptance path is Director `partial_export` JSON artifact download.

