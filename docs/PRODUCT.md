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
- The standalone editor needs no runtime CDNs, remote fonts, analytics, accounts or model calls.
- Optional MCP tools let a connected AI application or agent synthesise a brief, propose a deck, review it and render a presentation.
- Model selection and agent orchestration belong to the connected host; the manual offline editor remains usable independently.

## AI and agent integration

MCP is the integration interface for an AI application or agent to use Hands on Deck. The connected host runs a cloud or local model and supplies the reasoning and writing. The MCP server exposes deck planning, content review and HTML rendering. An agent can author its own plan, call review, revise the plan and render again; the fixed-rule planner is an optional starting point.

The current interface is a local stdio server. It accepts explicitly supplied data and returns results. A live connection to the browser's current deck, an in-editor model selector and a remote HTTP MCP endpoint are not implemented.

## Current limits

The editor has no autosave, cloud storage, collaboration, PowerPoint export or factual verification. Checks flag basic content issues; people remain responsible for the content and final review. Exported presentation HTML is for viewing; offline-editor HTML carries an editable snapshot. The free-text organiser preserves supplied sentences and is not an AI synthesiser.

## Next improvements

1. Verify real desktop and mobile interaction, including touch editing and exported presentations.
2. Add local recovery and version naming for editable snapshots.
3. Improve prompts, empty states and content-fitting feedback.
4. Evaluate additional export formats through real usage.
5. Evaluate an optional browser-local AI download with explicit consent, a verified complete asset manifest, size limits and device testing before describing it as ready offline.
6. Add a connection for a configured AI host or agent to read and update the current editor deck, with visible connection state and a way to disconnect.

## Useful measures

Time from brief to usable presentation, the amount of rework after generation, successful exports, repeat use, and whether people still rebuild the output in another tool. The current editor does not collect telemetry.
