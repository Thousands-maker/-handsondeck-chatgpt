# Product direction

Hands on Deck helps people turn what they already know into a credible, decision-ready briefing, then revise it without rebuilding the presentation.

## North Star

**Weekly briefings used for a real decision or endorsement without being rebuilt in another tool.**

A qualifying briefing has been reviewed by its author, used in a real briefing or sent for review, and remains usable in the exported format. A generated outline or a download alone does not prove this outcome. “Decision-ready” means a clear purpose and audience, a coherent case using supplied facts and caveats, and an explicit closing ask. It does not mean a decision was approved; that depends on factors beyond this app.

The current app collects no telemetry. Validate this measure through consensual user research and short follow-ups about actual use. Establish a baseline before setting numerical targets. Do not collect briefing content to measure success.

Supporting measures and guardrails:

- End-to-end time from receiving a task to a usable briefing, including review and revision.
- How often authors rebuild in another tool, and why: output quality, editability or workflow fit.
- Preservation of supplied facts, numbers and uncertainty; unsupported additions found during review.
- Successful offline opening, navigation and printing on the intended devices.
- Ability to act on feedback without regenerating or losing edits.

## Primary user and job

Staff officers and programme managers who know the subject and need a senior decision or endorsement. They want their argument to be understood and acted on without spending a day formatting it. The experience should build confidence in the presentation without pretending to validate the thinking.

People who present occasionally can use the optional guided brief and fictional examples. The primary journey should work for a person who can already state their argument.

## The app journey

| Step | User outcome | Interface |
| --- | --- | --- |
| Brief | State the decision, audience and case | One-page brief with context, evidence and ask prompts; three styles; 3–6 slide target. Optional guided questions. |
| Refine | Improve the argument after review | Editable Outline and 16:9 Slides views using the same plan; reorder/remove/undo; reference brief available beside the task. |
| Download | Use the briefing outside the app | One self-contained presentation HTML file; editable HTML backup for feedback; offline opening guidance. |

Quality suggestions open in an optional drawer beside the slides. There is no separate review page or tick-box checklist. Suggestions do not block generation or export. The app flags density, missing asks, unresolved placeholders and numbers that are absent from the reference brief. These are prompts to check evidence, not factual verification.

## Core boundaries

- Standard generation and editing use fixed local rules, with no runtime CDNs, remote fonts, analytics, accounts or model calls.
- Standard preserves supplied factual wording and proposes headings using conservative local rules. It separates clear ideas instead of treating a paragraph as one slide. It does not claim to synthesise arguments with a model or verify evidence.
- The guided path previews an emerging outline and offers relevant questions about evidence, responsibilities and unknowns. Missing information is requested rather than invented; unanswered prompts stay out of the presentation.
- The opening establishes the intended outcome; middle slides use supplied messages; the close states the ask. Thin briefs stay short instead of gaining filler.
- After generation, the slide plan is the source of truth for preview and export. The raw brief remains a reference and is not kept in two-way sync.
- Rebuilding requires confirmation before replacing the current slides. Navigating back to the brief never replaces them.
- Three fixed styles keep attention on the case. Existing visual elements remain available; rich media and bespoke themes are not the main journey.
- Exports contain their styling, code and embedded images. Presentation HTML supports keyboard navigation and one slide per printed page. Editable HTML contains the app and a project snapshot.
- Editable, presentation and project downloads are capped at 10 MiB. Browser recovery is optional and is not a file backup.
- Safe import validates project data without executing imported HTML. Logos remain embedded and replaceable; title/front and cover slides have no page number.

## Optional AI and agent integration

Supercharged is an optional path for synthesising rough notes into suggested headings and points. It downloads and runs Qwen2.5 0.5B or 1.5B on supported devices, verifies the files and performs a device inference check. Setup is explicit. The user reviews every proposed outline before applying it. Original notes remain in the reference brief. The required Standard journey does not need this setup.

MCP exposes planning, review and rendering tools to a separately configured AI application or agent. The host supplies its own model and reasoning. The current local stdio integration does not control the live browser deck; a browser connection and remote endpoint remain future work.

## Validate before expanding

The key adoption risk is whether self-contained HTML fits real review and sharing practices. Observe users opening and forwarding files on target devices and approved networks. If they rebuild in PowerPoint, investigate output quality, editability and workflow fit before adding more features.

Also validate whether the generated structure earns trust, whether primary users can supply a usable brief, and how much delay slide production causes today. Compare matched tasks and observe corrections, review cycles and actual use.

The app has no cloud storage, collaboration, automatic sharing, PowerPoint export or factual verification. Visual browser, touch, cross-browser and real-device AI quality checks remain outstanding. Automated checks cover logic and data flow; they are not evidence of those user outcomes.
