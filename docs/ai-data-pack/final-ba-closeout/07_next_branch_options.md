# Next Branch Options

The current BA branch should stop after closeout. Any next branch requires an explicit business decision.

| Option | Description | Safety posture |
|---|---|---|
| Option A | Stop current BA branch and use manually. | Recommended default after closeout. |
| Option B | XLSX rendering support. | No OpenAI, no action import. |
| Option C | Attach human ChatGPT Web output evidence. | Evidence-only, no import/execution. |
| Option D | Action draft schema spec. | Spec only, no import/execution. |
| Option E | ERP action import spec. | Spec only, no execution. |
| Option F | Dry-run spec. | Spec before implementation; no live execution. |
| Option G | Approval workflow spec. | Spec before implementation. |
| Option H | Live execution/provider mutation much later. | Requires separate approvals, validation, policy, tests, and production gates. |

Warning:

```text
Do not jump from current BA closeout directly to live execution.
```

Suggested next prompt only after explicit approval:

```text
PR-2.4A - Action Draft Schema Spec, No Import, No Execution
```

or:

```text
PR-2.3B-5F - XLSX Rendering Support, No OpenAI, No Action Import
```

or:

```text
PR-2.3B-5E-HUMAN-EVIDENCE - Attach Real ChatGPT Web Output Transcript, No OpenAI, No Action Import
```

