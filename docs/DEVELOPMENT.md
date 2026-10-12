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

## Verification limits

Automated checks cover JavaScript syntax, matching standalone builds, generation, text escaping, and MCP request/response behaviour. They do not certify visual layout, browser-native undo, virtual keyboards, accessibility or cross-browser interaction. Those checks remain on the product backlog.
