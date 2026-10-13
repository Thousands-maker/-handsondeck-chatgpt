# Product direction

Help people turn a briefing into a clear presentation without spending hours on formatting.

## Who it serves

- People who regularly prepare updates, proposals or decision papers and already know their argument.
- Occasional presenters who know their subject but benefit from structure and examples.

Both groups use the same brief, with structured and free-text input formats. First-time users can follow a four-step guided journey and inspect an outline before building. A one-page brief form serves people ready to write. The editor, review and save screens have persistent navigation and contextual guidance. Fictional examples and help remain available. The slide canvas is the main editing surface, with direct text editing and an element picker.

## Core requirements

- One standalone HTML editor that works offline from the outset.
- Standalone HTML presentations that recipients can open independently.
- Local generation using fixed rules, described honestly.
- Structured, layout-aware blocks and a light office workspace with restrained blue accents and clear, compact controls.
- Edits preserved when navigating slides or changing styles.
- Confirmation before regeneration replaces on-slide edits.
- Text rendered safely and local images embedded in exports.
- Replaceable embedded logo; title/front and cover slides excluded from page numbering.
- Distinct editable, presentation and project downloads, each capped at 10 MiB.
- Browser recovery with a visible failure state and a control to remove it.
- Safe import of editable HTML or JSON without executing the imported file.
- Undo for the most recent slide or element deletion.
- Standard editing needs no runtime CDNs, remote fonts, analytics, accounts or model calls.
- Optional MCP tools let a connected AI application or agent synthesise a brief, propose a deck, review it and render a presentation.
- Local browser AI is opt-in; external-agent model selection and orchestration belong to the connected host.

## AI and agent integration

MCP is the integration interface for an AI application or agent to use Hands on Deck. The connected host runs a cloud or local model and supplies the reasoning and writing. The MCP server exposes deck planning, content review and HTML rendering. An agent can author its own plan, call review, revise the plan and render again; the fixed-rule planner is an optional starting point.

The current interface is a local stdio server. It accepts explicitly supplied data and returns results. A live MCP connection to the browser’s current deck and a remote HTTP MCP endpoint are not implemented.

The **Supercharged** screen downloads and runs Qwen2.5 0.5B or 1.5B on supported devices. It checks assets and graphics support, generates an outline locally, and requires review before applying. The guided brief and direct brief both lead into this flow. Standard keeps the original wording and is clearly distinguished from AI synthesis.

## Current limits

The editor has no cloud storage, collaboration, PowerPoint export or factual verification. Browser recovery may be unavailable, full or cleared; it does not replace a downloaded backup. Checks flag basic content issues; people remain responsible for the content and final review. Exported presentation HTML is for viewing; offline-editor HTML carries an editable snapshot. The free-text organiser preserves supplied sentences and is not an AI synthesiser.

## Next improvements

1. Verify real desktop and mobile interaction, including touch editing and exported presentations.
2. Add user-defined version names for editable snapshots.
3. Refine guidance from user testing and improve content-fitting feedback.
4. Evaluate additional export formats through real usage.
5. Verify local AI inference, offline reload and writing quality across actual supported devices.
6. Add a connection for a configured AI host or agent to read and update the current editor deck, with visible connection state and a way to disconnect.

## Useful measures

Time from brief to usable presentation, the amount of rework after generation, successful exports, repeat use, and whether people still rebuild the output in another tool. The current editor does not collect telemetry.
