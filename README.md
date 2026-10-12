# Hands on Deck

An offline slide editor for turning a structured brief or free-text notes into a clear presentation.

Open **index.html** in your browser. No installation, account, server or internet connection is needed. Offline use has been a core design requirement from the start.

## Use it

1. Open the Brief drawer and enter your purpose, audience and key messages. Choose **Free text** to organise paragraphs and sentences into a basic starting structure.
2. Generate a three-to-six-slide starting structure.
3. Edit text directly on the slides and use **Add element** to insert content.
4. Review the checks, then choose **Export deck** for a standalone HTML presentation.
5. Choose **Offline → Download offline editor** to save an editable copy with your current deck, images and logo. Reopen that file in a browser to keep editing without internet.

The editor includes text, bullets, quotes, callouts, statistics, columns, cards, tables, bar charts, local images and dividers. You can reorder, duplicate and remove slides and elements, and choose Executive, Operational or Minimal styling.

Generation uses fixed local rules. Free text organisation preserves sentence wording; it does not perform AI rewriting or factual verification. No AI model is connected or downloaded. Briefs and edits remain in browser memory; **download your work before closing or refreshing the page**. An exported presentation is for viewing. An offline editor copy includes a snapshot you can reopen and edit. Save a fresh copy after further edits; the file on disk does not update itself.

## Logo and page numbers

The **Logo** control replaces or removes the neutral Hands on Deck placeholder. All logos are embedded for offline use. Title/front and Cover layouts have no page number; Content and Statement slides count from 1 and renumber after reordering or deletion. Select **Cover** for an unnumbered closing slide.


## Offline downloads

The **Offline** screen shows the actual editor-copy size before downloading. Copies are limited to 10 MiB, including images, and are generated on the device only after a button click. A SHA-256 checksum is shown when the browser supports it. No external scripts, fonts, trackers or model files are fetched by the editor. Some mobile file previewers do not execute HTML; use a browser with local-HTML support.

See [offline behaviour and optional local AI design](docs/OFFLINE.md) for capabilities and limitations. A local AI model is a future option, not an implemented feature in this version.

## Optional MCP server — off by default

The separate local server in `mcp/` lets a compatible MCP client create a deck plan, render it to offline HTML or review it. It is never started by the editor or the published site. No network port is opened and no client configuration is installed automatically.

See [MCP setup](docs/MCP.md) to enable it deliberately, then stop it when finished. The editor itself still requires no Node.js installation.

## Development

Only maintainers and optional MCP users need Node.js 22 or later. There are no package dependencies.

```sh
node scripts/build.mjs
node --test tests/*.test.mjs
```

`core/deck-core.cjs` contains the shared generator and HTML exporter. The build script embeds that engine in `index.html` and copies the finished editor to `dist/index.html`. Both HTML files are self-contained.

- [Product direction](docs/PRODUCT.md)
- [Development history and verification](docs/DEVELOPMENT.md)
- [Optional MCP setup](docs/MCP.md)

Responsive layouts are implemented. Full touch-device and cross-browser verification remains outstanding.
