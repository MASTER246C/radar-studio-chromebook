# v0.9.0-preview.1

- Add guided named sessions with intended walking, standing, sitting and transition prompts, local participant aliases, keyboard annotations, undo corrections and explicit unsynchronized markers.
- Add a separate original-radar saved-capture replay and review page with range/velocity display, segment boundaries and loss, fault, malformed, rejected and truncated-data diagnostics.
- Add bounded, validated version 1 derived dataset exports with source/payload hashes, explicit review provenance and annotation audit. Resume review only against the matching original capture.
- Keep the exact 0.3.1-rc1 firmware/build/self-test gate and manual 1–5 second RF limit unchanged. No automatic ports, configuration, RF, uploads or camera access.

See SESSIONS.md for the local workflow and dataset contract. Prompts are intent, human labels require review, and exploratory peak coordinates do not establish people tracking. The optional Python training tools are separate from the browser viewer. No real-world accuracy or camera compatibility is claimed.
