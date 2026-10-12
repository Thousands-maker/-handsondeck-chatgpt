# Connect an AI application or agent

The MCP server exists so an AI application or agent can use Hands on Deck's deck tools. A connected model can synthesise free text into an argument and slide structure; an agent can then review, revise and render that plan through tool calls.

The AI host selects and runs the model and contains the MCP client. Hands on Deck provides the MCP server and deck tools. MCP is the connection protocol, not the model or the agent's reasoning engine. You do not need to put a provider key into the HTML editor or this server.

## What works now

- A compatible AI host or agent can supply its own complete deck plan, including headlines, layouts and all supported content blocks.
- It can request content checks, revise the plan itself and render a self-contained HTML presentation.
- It can optionally call the fixed-rule planner for a starting structure. AI-authored plans do not have to use that planner.
- Tool discovery includes the slide and content-block schemas so the host can construct valid arguments.

This MCP server does not read or edit an open browser deck, perform inference itself, or expose a remote HTTP endpoint. The editor’s separate Supercharged feature runs an opt-in local browser model. No model connection has been configured automatically.

## Enable the connection

**Default: off.** Opening the editor, using the hosted site or running the build does not start this server. Nothing has been added to an MCP client's settings. The hosted site remains static and does not expose an MCP endpoint.

The server is a separate local process for MCP clients that support the **2025-11-25 protocol over stdio**. It requires Node.js 22 or later and no package installation. A host that only accepts remote HTTP servers or only supports newer protocol handshakes cannot connect directly to this version.

1. Keep a local copy of this repository.
2. Choose a compatible AI application or agent runtime and configure its cloud or local model there.
3. Open `mcp/client.example.json` and replace its example path with the full path to your copy.
4. Add that server entry to the host's MCP settings and enable it there. Some hosts use a different configuration shape; use the same command and arguments in their supported format.
5. Check that the host discovers `create_deck_plan`, `review_deck` and `render_deck` before asking it to build a deck.

The client runs:

```sh
node /absolute/path/to/hands-on-deck/mcp/server.mjs --enable
```

The `--enable` flag is required. Without it the process exits immediately. The example configuration is documentation only; its filename is deliberately not an automatically loaded configuration file.

## Turn it off

Disable or remove the server entry in your MCP client and stop its process. A process started manually can be stopped with Ctrl+C. There is no background service, network listener or autostart registration.

## Tools

| Tool | Input | Result |
| --- | --- | --- |
| `create_deck_plan` | Purpose, audience, messages, style and target count | An optional starting plan using fixed local rules |
| `review_deck` | A user- or AI-authored deck plan | Content advisories for the host or agent to act on |
| `render_deck` | A user- or AI-authored deck plan | Standalone HTML returned for the host to save |

The server uses the same generator and exporter as the editor. The connected host supplies the model calls and agent loop; the server supplies the deck operations. It does not control an open browser tab, read your files, save outputs or publish anything. The host can save the returned HTML using its own file facilities when requested. Plans are supplied explicitly; live editor state is not connected automatically.

## Typical agent workflow

1. The user gives the AI host a brief and audience.
2. The model synthesises the brief into a deck plan, preserving supplied facts and marking information gaps.
3. The agent calls `review_deck` with that plan.
4. The model revises the plan using the returned advisories and any user feedback.
5. The agent calls `render_deck` and returns or saves the HTML through its host.

For example, this is a valid minimal custom plan to pass under the `plan` argument to `review_deck` or `render_deck`:

```json
{
  "style": "executive",
  "slides": [
    {
      "kind": "title",
      "eyebrow": "Proposal",
      "title": "Test a small pilot before expansion",
      "blocks": [{ "type": "paragraph", "text": "Prepared for the project team" }]
    },
    {
      "kind": "content",
      "eyebrow": "Decision",
      "title": "Set an owner and review point",
      "blocks": [{ "type": "bullets", "items": ["Confirm the pilot owner", "Agree the review date before starting"] }]
    }
  ]
}
```

Use the discovered schemas for other blocks: paragraphs, bullets, callouts, quotations, statistics, columns, cards, charts, tables, images and dividers. The renderer validates supplied data and escapes text; the host remains responsible for synthesis and content judgement.

## Cloud and offline models

The MCP server itself makes no network calls. A host using a cloud model sends prompts and selected tool results to its provider according to that host's settings, and needs internet during inference. A fully local host with a preinstalled model can use these local tools offline if it has no other network dependencies. Presentations returned by the renderer remain viewable offline in either case.

Embedded PNG, JPEG, GIF and WebP images are accepted by the MCP renderer; remote image URLs are rejected. The MCP transport limits each request to 12 MB.

## Compatibility references

- [MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP lifecycle, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [MCP tools, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP transports, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

Automated checks exercise the protocol and a supplied custom-plan review/revise/render workflow. A live model session in a named third-party host has not yet been tested; do not treat the presence of the MCP code as proof that a model is already connected.
