# Product direction

Help people turn a briefing into a clear presentation without spending hours on formatting.

## Who it serves

- People who regularly prepare updates, proposals or decision papers and already know their argument.
- Occasional presenters who know their subject but benefit from structure and examples.

Both groups use the same brief, with structured and free-text input formats. The slide canvas is the main editing surface, with direct text editing and an element picker. Brief inputs, logo settings and quality checks live in temporary drawers. Offline downloads have a separate screen.

## Core requirements

- One standalone HTML editor that works offline from the outset.
- Standalone HTML presentations that recipients can open independently.
- Local generation using fixed rules, described honestly.
- Structured, layout-aware blocks and a professional light interface.
- Edits preserved when navigating slides or changing styles.
- Confirmation before regeneration replaces on-slide edits.
- Text rendered safely and local images embedded in exports.
- Replaceable embedded logo; title/front and cover slides excluded from page numbering.
- Explicit offline-editor download with the current editable deck and a 10 MiB size cap.
- No runtime CDNs, remote fonts, analytics, accounts or model calls.
- Optional automation kept separate from the everyday editing workflow.

## Current limits

The editor has no autosave, cloud storage, collaboration, PowerPoint export or factual verification. Checks flag basic content issues; people remain responsible for the content and final review. Exported presentation HTML is for viewing; offline-editor HTML carries an editable snapshot. The free-text organiser preserves supplied sentences and is not an AI synthesiser.

## Next improvements

1. Verify real desktop and mobile interaction, including touch editing and exported presentations.
2. Add local recovery and version naming for editable snapshots.
3. Improve prompts, empty states and content-fitting feedback.
4. Evaluate additional export formats through real usage.
5. Evaluate an optional browser-local AI download with explicit consent, a verified complete asset manifest, size limits and device testing before describing it as ready offline.

## Useful measures

Time from brief to usable presentation, the amount of rework after generation, successful exports, repeat use, and whether people still rebuild the output in another tool. The current editor does not collect telemetry.
