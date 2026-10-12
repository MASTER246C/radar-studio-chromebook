# Radar Studio 0.9.0-preview.5

This focused cleanup follows preview.4 continuous monitoring and optional browser-camera recording/review.

- Stop playback now clears the synthetic/replay scene and counters before reporting offline.
- Camera review export and manual-interval validation appear beside their actions.
- The browser trainer clearly identifies its compatible TI-format inputs and points Original radar camera users to review, timing alignment and the separate Python trainer.
- Setup, upgrade and session guidance distinguishes timed firmware 0.3.1 from timed/continuous 0.3.2-rc1; camera support is browser-generic, with C920e the project test device.

Google MediaPipe Pose Landmarker Lite supplies body landmarks. Project activity rules remain unvalidated proposals requiring human review. The separate radar baseline is session-balanced-centroid-v1; no trained radar model or accuracy is supplied.

Validation: focused synthetic camera/continuous/recording and hosted integration tests; browser Stop and missing-input feedback checks. Public artifact hashes are checked after publication. Physical firmware endurance, C920e behavior and real activity accuracy remain pending.

Firmware and Python algorithms are unchanged by this cleanup. Existing published preview.4 viewer, trainer and firmware archives retain their earlier contents. Keep the previous firmware BIN for rollback. Stop, save and confirm idle before updating an active viewer tab.
