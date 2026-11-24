---
name: cbgpu-motion
description: Add and review navigation, overlay, and task feedback motion in CBGPU 2.0.
---

Start with the state change to communicate and the element that should
remain visually continuous. Reuse the Motion provider in the preview
shell and the duration and easing tokens in preview.css. Keep stable
selection IDs scoped to their navigation group. Use opacity and transform
for immediate feedback. Keep native focus and dismissal behavior intact.
Verify each motion in reduced-motion and regular mode. Animate completion
only after the underlying action succeeds.
