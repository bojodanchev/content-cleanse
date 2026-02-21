# Decision: Carousel Multiply as Separate Job Type
**Date**: 2026-02-21
**Status**: accepted

## Context
After caption processing completes, users want to create N unique copies of the entire carousel for multi-account posting. Each copy needs imperceptible visual differences to avoid platform duplicate detection.

## Decision
Implemented as a new job type `carousel_multiply` with `parent_job_id` linking to the source caption job, rather than extending the existing `photo_captions` job type.

## Alternatives Considered
1. **Extend photo_captions**: Add a "multiply" phase to the caption job. Rejected — couples two distinct operations, complicates the state machine.
2. **Client-side augmentation**: Apply tweaks in the browser. Rejected — less control over augmentation quality, no server-side ZIP generation.
3. **Separate "multiply" page/route**: Create a standalone /multiply page. Rejected — multiply is contextual to a completed caption job, better as a flow extension.

## Consequences
- Clean separation: caption job completes → user optionally starts multiply job
- `parent_job_id` column enables future features (e.g., re-multiply, link analysis)
- 1 multiply job = 1 quota unit (same as any other job)
- Variant limit enforced: `slides × copies ≤ variantLimit` (plan-based)
- New Modal endpoint required: `start-multiply-processing`
