# Hands on Deck

An offline slide editor for turning a structured brief or free-text notes into a clear presentation.

Open **index.html** in your browser. No installation, account, server or internet connection is needed. Offline use has been a core design requirement from the start.

## Use it

1. Choose **Create a briefing** for the one-page brief. **Help me shape my brief** offers guided questions when needed.
2. Add the decision or outcome, audience and key messages. Choose a style and length, then **Build my first deck**. Standard works without an AI download and preserves your supplied wording.
3. **Refine** in Slides or Outline. Edit headlines and supporting points, reorder or remove slides, and undo the last deletion. **Source brief** keeps your reference notes available for comparison. Both views and the export use the same slide data.
4. **Check the case** for advisory suggestions about density, missing asks, placeholders and numbers absent from the reference brief. Checks do not verify facts and never block a download.
5. **Download** a presentation to use or share, and an editable copy for later feedback. Reopen the saved HTML file in a browser and try it offline.
6. Open an editable HTML file directly, or choose **Open a saved presentation** to import editable HTML or project JSON.

Three clearly labelled fictional examples demonstrate a decision, an update and a discussion. **Help** is available throughout. **Supercharged** downloads and runs a local model on compatible WebGPU devices. It turns rough notes into a reviewable outline. Apply it only after checking the facts and caveats; the original notes remain in the brief.

The editor includes text, bullets, quotes, callouts, statistics, columns, cards, tables, bar charts, local images and dividers. You can reorder, duplicate and remove slides and elements, and choose Executive, Operational or Minimal styling.

Standard generation uses fixed local rules. Free text organisation preserves sentence wording; it does not perform AI rewriting or factual verification. The optional MCP integration lets a separately configured AI application or agent supply intelligent synthesis and use the deck tools. No model is bundled with or automatically connected to the editor.

A recovery copy of the brief and deck is saved in this browser when storage is available. **Download** includes a switch to turn recovery off and remove its saved copy. Blocked or full storage is reported; a newer draft in another tab pauses recovery writes. Browser recovery is not a durable file backup. Download your work before clearing browser data or moving to another device.

An exported presentation is for viewing. An editable copy includes a snapshot you can reopen and edit. Save a fresh copy after further edits; the file on disk does not update itself.

## Logo and page numbers

Click the logo in the top-right of any editable slide to upload a replacement or remove it from all slides. The toolbar **Logo** control also works after the logo has been removed. All logos are embedded for offline use. Title/front and Cover layouts have no page number; Content and Statement slides count from 1 and renumber after reordering or deletion. Select **Cover** for an unnumbered closing slide.

## Offline downloads

The **Download** screen shows the presentation and editable-copy sizes before downloading. Copies are limited to 10 MiB, including images, and are generated on the device only after a button click. A SHA-256 checksum is shown when the browser supports it. Standard mode fetches no external scripts, fonts, trackers or model files. Supercharged fetches its declared model files only after an explicit setup action. Some mobile file previewers do not execute HTML; use a browser with local-HTML support.

## Supercharged local AI

Open **Supercharged**, select a model and choose **Download & enable**. Compatible WebGPU hardware (including shader-f16), HTTPS and available browser storage are required. The page checks the device, shows progress, supports cancellation/resume and removal, verifies every file, and performs a tiny inference check before showing ready.

| Option | Model | Complete model/runtime download |
| --- | --- | --- |
| Supercharged | Qwen2.5 0.5B Instruct | 296,863,095 bytes (283.1 MiB) |
| Supercharged Pro | Qwen2.5 1.5B Instruct | 887,915,811 bytes (846.8 MiB) |

After setup, reopen the same web address in the same browser to use the cached editor and model offline. Only one model is stored at a time. The separate editable HTML download works in Standard mode; browser model storage is not packaged into it.

AI accepts up to 2,400 combined characters of notes, outcome and audience and suggests 3–6 slides. Writing quality varies, especially with the smaller model. No factual accuracy guarantee or writing-quality benchmark is implied. Review before applying. No prompt is uploaded and there is no cloud fallback.

See [offline behaviour and local AI](docs/OFFLINE.md) for the storage, download and verification details.

## Connect an AI model or agent through MCP

The purpose of `mcp/` is to expose Hands on Deck's tools to an AI application or agent. The host runs the chosen model, turns free text into a proposed deck and can iterate through review and revision before rendering. MCP provides the tool connection; it does not itself supply the model.

A compatible host can call `create_deck_plan` for an optional basic starting structure, or author a plan directly using the published slide and block schemas. It can then call `review_deck` and `render_deck`. Model selection, provider credentials and agent orchestration are configured in that host. Cloud inference needs internet; a fully local host and preinstalled model can use the local tools offline.

The server is **off by default** and uses local stdio. It is never started by the editor or the published site. No network port is opened and no client configuration is installed automatically. The current integration returns plans and standalone presentation HTML; it does not yet read or edit the open browser deck live.

See [MCP setup](docs/MCP.md) to enable it deliberately, then stop it when finished. The editor itself still requires no Node.js installation.

## Development

Only maintainers and optional MCP users need Node.js 22 or later. There are no package dependencies.

```sh
node scripts/build.mjs
node --test tests/*.test.mjs
```

`core/deck-core.cjs` contains the shared generator and HTML exporter. The `ui/` files contain the guided interface, styles and navigation. The build script embeds these, `ai/ai-core.cjs`, the model catalogue and worker source into `index.html`, then copies the editor and opt-in service worker into `dist/`. Standard editing is self-contained. AI assets are separate, verified downloads.

- [Product direction](docs/PRODUCT.md)
- [Development history and verification](docs/DEVELOPMENT.md)
- [Optional MCP setup](docs/MCP.md)

Automated checks cover download limits and hashes, blocked inference network fallback, AI proposal validation, review-before-apply, logo controls and the existing editing workflows. Actual GPU inference, model quality and visual/touch/cross-browser verification remain outstanding in the maintainer environment. Each device must pass the runtime self-check before AI is marked ready.
