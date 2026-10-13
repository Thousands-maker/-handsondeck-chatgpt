# Development history

The project was developed locally before its GitHub publication. Offline use was a requirement from the outset.

## Verified earlier milestone

On **3 October 2026 at 23:40:27 Singapore time**, the existing source history recorded the slide-first offline editor in commit `5a85bfdd3e64c73edbac8044f7e8720a6d92ebc9` (`Update Site source`). The hosting record was updated at **23:43:20 Singapore time** that night.

That version included direct editing, an element picker, local image embedding, standalone HTML export and responsive CSS. These records come from the earlier hosted project and its source history.

## 12 October 2026

- Prepared a general-purpose project with product and developer documentation.
- Kept the standalone offline editor and existing visible product name.
- Shared the generation and export engine with an optional local MCP component.
- Left MCP disabled by default and excluded it from the hosted runtime.
- Retained all supplied messages when grouping a longer brief into fewer slides.
- Added executable checks for engine consistency, export escaping, MCP activation and protocol behaviour.

## 13 October 2026

- Added an embedded, replaceable neutral placeholder logo.
- Excluded title/front and cover slides from numbering, with remaining pages starting at 1.
- Added basic offline free-text organisation that preserves supplied sentences.
- Added a separate Offline screen with an explicit, size-capped download of the editor and current editable deck.
- Added checks for numbering after reordering/deletion, logo replacement/removal, free-text preservation and safe saved-project restoration.
- Documented optional local AI as future work; no model is downloaded and MCP remains off by default.

## Guided editing release

- Added a start screen with guided and direct paths, three fictional examples, and saved-deck import.
- Added a four-step brief flow with validation and an outline preview before building.
- Added persistent Brief / Edit / Review / Save navigation, contextual editing help and a final review checklist.
- Added browser recovery with error reporting, opt-out/removal and protection from another tab overwriting its recovery copy.
- Separated editable HTML, presentation HTML and project JSON downloads; retained the 10 MiB cap.
- Added undo for the last deletion and read-only presentation mode with visible exit controls.
- Added illustrative Supercharged model examples and explicit unconnected status.
- Added import validation and DOM contract tests for onboarding, recovery, deletion undo and presentation state. These are not real-browser or visual tests.

## Local AI and studio release

- Replaced the explainer-only Supercharged screen with model download, hash verification, cancellation/resume, device checks, removal and a local inference worker.
- Added Qwen2.5 0.5B and 1.5B model manifests with fixed revisions, sizes and hashes; no weights or runtime are downloaded automatically.
- Added opt-in offline app caching, bounded prompts, structured outline validation and review before applying AI output.
- Connected the guided and direct brief to AI synthesis, while keeping the original notes.
- Designed a distinct ink-and-orange studio shell, vertical desktop navigation, a typographic start page and model setup/workspace.
- Made the slide logo a keyboard-accessible control for replacement or removal; presentations stay read-only.
- Added download boundary, cache isolation, proposal, workflow and logo-control checks. Device inference and visual browser QA were unavailable in the maintainer environment.

## Office workspace refinement

- Adopted a light, professional workspace with blue action controls, compact navigation and consistent sans-serif typography.
- Replaced the oversized start-page artwork with direct create/open/resume actions and a gallery of editable examples.
- Used restrained blue, green and violet accents in example previews, plus a quieter editing toolbar and slide rail.
- Simplified guidance and model-setup labels while retaining all existing drafting, editing, logo, review and save controls.
- Advanced the opt-in service-worker shell cache for the refreshed interface.

## Briefing workflow refinement

- Made the primary app journey Brief → Refine → Download, with a one-page brief and optional guided questions.
- Kept Standard as the default, so the required journey does not depend on local model setup.
- Added an editable outline, reorder/remove actions and undo alongside the slide canvas. Both views and exports use the same slide data.
- Added a reference-brief drawer and an explicit rebuild notice. Revising the source brief does not overwrite slide edits automatically.
- Removed the repeated outcome-only middle slide from generated plans; short briefs remain short rather than gaining filler.
- Added advisory checks for empty supporting content, unresolved placeholders and numbers absent from the brief. Closing-ask checks examine the content rather than accepting an “ask” label as sufficient.
- Prioritised portable presentation downloads, with an editable backup and instructions to check the file offline.
- Added automated coverage for direct creation, cancelled rebuilding, outline revisions, reorder/undo, export consistency and non-blocking suggestions.

## Verification limits

Automated checks cover JavaScript syntax, matching standalone builds, generation, text escaping, and MCP request/response behaviour. They do not certify visual layout, browser-native undo, virtual keyboards, accessibility or cross-browser interaction. Those checks remain on the product backlog.
