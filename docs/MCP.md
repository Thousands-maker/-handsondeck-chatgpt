# Optional local MCP server

**Default: off.** Opening the editor, using the hosted site or running the build does not start this server. Nothing has been added to an MCP client's settings. The hosted site remains static and does not expose an MCP endpoint.

The server is a separate local process for MCP clients that support the **2025-11-25 protocol over stdio**. It requires Node.js 22 or later and no package installation.

## Turn it on

1. Keep a local copy of this repository.
2. Open `mcp/client.example.json` and replace its example path with the full path to your copy.
3. Add that server entry to your MCP client's settings and enable it there.

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
| `create_deck_plan` | Purpose, audience, messages, style and target count | A structured deck plan using the editor's local rules |
| `render_deck` | A deck plan | Standalone HTML returned as text |
| `review_deck` | A deck plan | Basic content advisories |

The server uses the same generator and exporter as the editor. It does not control an open browser tab, read your files, save outputs, connect to a model, or publish anything. A client may save the returned HTML when you request that action. Plans are supplied explicitly; live editor state is not connected automatically.

The server itself makes no network calls. An AI client may send the brief and tool results to its model provider, according to that client's settings. Enable it only in a client you intend to use with that content.

Embedded PNG, JPEG, GIF and WebP images are accepted by the MCP renderer; remote image URLs are rejected. The MCP transport limits each request to 12 MB.

## Compatibility references

- [MCP lifecycle, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [MCP tools, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

This is a small local integration. Actual connection testing in individual MCP clients remains outstanding.
