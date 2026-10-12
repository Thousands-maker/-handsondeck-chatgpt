#!/usr/bin/env node
import { tools, callTool } from './tools.mjs';

// The editor never starts this process. A local MCP client must explicitly opt in.
if (!process.argv.includes('--enable')) {
  process.stderr.write('MCP is off. To enable it for this process, run node mcp/server.mjs --enable\n');
  process.exit(2);
}
const version = '2025-11-25';
let initialised = false;
let ready = false;
let pending = '';
const maxMessage = 12 * 1024 * 1024;
const send = message => process.stdout.write(JSON.stringify(message) + '\n');
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

function receive(line) {
  let request;
  try { request = JSON.parse(line); } catch { fail(null, -32700, 'Invalid JSON.'); return; }
  if (!request || Array.isArray(request) || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    fail(null, -32600, 'Invalid JSON-RPC request.'); return;
  }
  const id = request.id;
  if (id === undefined) {
    if (request.method === 'notifications/initialized' && initialised) ready = true;
    return;
  }
  if (!['string', 'number'].includes(typeof id) || (typeof id === 'number' && !Number.isFinite(id))) {
    fail(null, -32600, 'Invalid request ID.'); return;
  }
  const reply = result => send({ jsonrpc: '2.0', id, result });
  if (request.method === 'ping') { reply({}); return; }
  if (request.method === 'initialize') {
    if (initialised) { fail(id, -32600, 'Already initialised.'); return; }
    if (typeof request.params?.protocolVersion !== 'string' || !request.params?.clientInfo || !request.params?.capabilities) {
      fail(id, -32602, 'Provide protocolVersion, clientInfo and capabilities.'); return;
    }
    initialised = true;
    reply({ protocolVersion: version, capabilities: { tools: {} },
      serverInfo: { name: 'handsondeck', version: '0.3.0' },
      instructions: 'Hands on Deck tools for connected AI hosts and agents. Use the host model to synthesise the user brief into a plan using the advertised slide and block schemas. create_deck_plan is an optional rule-based starting point. Call review_deck, revise the plan in the host, then call render_deck to obtain standalone offline HTML. Model selection, inference and agent orchestration belong to the host. These tools do not access an open browser, save files or publish content.' });
    return;
  }
  // This server implements the 2025-11-25 handshake; the host must support it.
  if (request.method === 'server/discover') { fail(id, -32601, 'Use the MCP 2025-11-25 initialize handshake.'); return; }
  if (!ready) { fail(id, -32000, 'Initialise the connection before calling tools.'); return; }
  if (request.method === 'tools/list') { reply({ tools }); return; }
  if (request.method === 'tools/call') {
    if (!tools.some(tool => tool.name === request.params?.name)) { fail(id, -32602, 'Unknown tool.'); return; }
    try {
      const value = callTool(request.params.name, request.params.arguments ?? {});
      reply({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
    } catch (error) {
      reply({ isError: true, content: [{ type: 'text', text: error.message }] });
    }
    return;
  }
  fail(id, -32601, 'Method not supported.');
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  pending += chunk;
  let position;
  while ((position = pending.indexOf('\n')) >= 0) {
    const line = pending.slice(0, position).replace(/\r$/, '');
    pending = pending.slice(position + 1);
    if (Buffer.byteLength(line) > maxMessage) { fail(null, -32600, 'Message exceeds 12 MB.'); continue; }
    if (line.trim()) receive(line);
  }
  if (Buffer.byteLength(pending) > maxMessage) {
    process.stderr.write('Input exceeds 12 MB. Closing the process.\n');
    process.exit(1);
  }
});
process.stdin.on('end', () => { if (pending.trim()) receive(pending); });
process.stdout.on('error', error => { if (error.code === 'EPIPE') process.exit(0); else throw error; });
