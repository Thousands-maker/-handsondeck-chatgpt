import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import core from '../core/deck-core.cjs';
import { callTool, validatePlan } from '../mcp/tools.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const html = read('index.html');
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !m[1].includes('application/json')).map(m => m[2]);
const sample = { purpose: 'Approve a small pilot', audience: 'Project team', messages: 'Clear ownership\n- One owner per task\nShort feedback cycles\n- Review weekly', count: 5 };
const samplePlan = () => callTool('create_deck_plan', sample);

test('page numbering excludes every title and cover and follows reorder and deletion', () => {
  const slides = ['title', 'content', 'cover', 'statement', 'content', 'cover'].map(kind => ({ kind, title: kind, eyebrow: '', blocks: [] }));
  const numbers = value => value.map((slide, index) => core.slidePageNumber(value, index));
  assert.deepEqual(numbers(slides), [null, 1, null, 2, 3, null]);
  const moved = [slides[5], slides[3], slides[0], slides[1], slides[4]];
  assert.deepEqual(numbers(moved), [null, 1, null, 2, 3]);
  moved.splice(1, 1);
  assert.deepEqual(numbers(moved), [null, null, 1, 2]);
  const output = core.renderDeckHtml({ style: 'executive', slides });
  const sections = [...output.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)].map(match => match[1]);
  assert.equal(sections.length, 6);
  assert.deepEqual(sections.map(section => section.match(/class="number"[^>]*>(\d+)</)?.[1] || null), [null, '1', null, '2', '3', null]);
});

test('logos are embedded, replaceable and removable in every exported slide', () => {
  const plan = samplePlan();
  const output = core.renderDeckHtml(plan);
  assert.equal([...output.matchAll(/class="slide-logo"/g)].length, plan.slides.length);
  assert.ok(output.includes(core.DEFAULT_LOGO.src));
  assert.ok(callTool('render_deck', { plan: { ...plan, logo: core.DEFAULT_LOGO } }).html.includes(core.DEFAULT_LOGO.src));
  assert.throws(() => callTool('render_deck', { plan: { ...plan, logo: { src: 'data:image/svg+xml,<svg onload="alert(1)"/>' } } }), /embedded/);
  const custom = { src: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Example <brand>' };
  const replaced = callTool('render_deck', { plan: { ...plan, logo: custom } }).html;
  assert.ok(replaced.includes('Example &lt;brand&gt;'));
  assert.ok(!replaced.includes(core.DEFAULT_LOGO.src));
  assert.doesNotMatch(core.renderDeckHtml({ ...plan, logo: null }), /class="slide-logo"/);
  assert.throws(() => callTool('render_deck', { plan: { ...plan, logo: { src: 'https://example.com/logo.png' } } }), /embedded/);
});

test('free text organisation retains sentence wording, numbers, negation and paragraph order', () => {
  const source = 'The pilot costs $1.25 million. Do not expand before review.\n\nWe need an owner. The deadline is 13 October.\n- Preserve this separate point.';
  const groups = core.organiseFreeText(source);
  assert.deepEqual(groups.flatMap(group => group.points), ['The pilot costs $1.25 million.', 'Do not expand before review.', 'We need an owner.', 'The deadline is 13 October.', 'Preserve this separate point.']);
  const result = callTool('create_deck_plan', { ...sample, inputMode: 'free', messages: source });
  const exported = core.renderDeckHtml(result);
  for (const point of groups.flatMap(group => group.points)) assert.ok(exported.toLowerCase().includes(core.escapeHtml(point.replace(/[.!?]+$/, '')).toLowerCase()));
  assert.deepEqual(core.organiseFreeText(' \n '), []);
  assert.throws(() => core.organiseFreeText('x'.repeat(20001)), /20,000/);
});

test('natural lowercase notes become distinct ideas without a browser sentence segmenter', () => {
  const notes = 'the support team is joining the service team, and there are new handovers to agree. i need a RACI before the new process can start.';
  const groups = core.organiseFreeText(notes);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map(g => g.heading), ['Team changes', 'Ways of working', 'Roles and responsibilities']);
  const plan = core.buildSlides({ purpose: 'Approve the proposed structure', audience: 'Team leads', count: 'auto' }, groups);
  assert.equal(plan.slides.length, 5);
  assert.ok(plan.slides[3].blocks[0].items[0].includes('before the new process can start'));
  assert.doesNotMatch(JSON.stringify(plan), /Notes 1/);
  const browser = vm.createContext({ Intl: undefined });
  vm.runInContext(read('core/deck-core.cjs'), browser);
  assert.equal(JSON.stringify(browser.DeckCore.organiseFreeText(notes)), JSON.stringify(groups));
});

test('idea splitting preserves numbers, abbreviations, conditions, qualifications and supplied evidence', () => {
  const source = 'Dr. Lee reviewed the pilot. it costs $1.25 million, but approval is not confirmed.\n\nIf funding is approved, we will extend the trial.\n- For example, the estimate excludes tax.\n\nComplaints fell 20%. However, fewer people could get through.';
  const groups = core.organiseFreeText(source);
  assert.equal(groups[0].points[0], 'Dr. Lee reviewed the pilot.');
  assert.equal(groups[1].points[0], 'it costs $1.25 million, but approval is not confirmed.');
  const conditional = groups.find(g => g.points[0].startsWith('If funding'));
  assert.deepEqual(conditional.points, ['If funding is approved, we will extend the trial.', 'For example, the estimate excludes tax.']);
  assert.deepEqual(groups.at(-1).points, ['Complaints fell 20%.', 'However, fewer people could get through.']);
  const plan = core.buildSlides({ purpose: 'Decide on the trial', count: '3' }, groups);
  const out = core.renderDeckHtml({ ...plan, style: 'executive' });
  for (const text of ['$1.25 million, but approval is not confirmed', 'If funding is approved, we will extend the trial', 'excludes tax', 'However, fewer people could get through']) assert.ok(out.includes(text));
});

test('guided questions ask for missing detail without adding answers to the slide plan', () => {
  const notes = 'We need a RACI and a new workflow.';
  const questions = core.briefQuestions(notes);
  assert.equal(questions.length, 3);
  assert.ok(questions.some(q => q.prompt.includes('who approves')));
  assert.ok(questions.some(q => q.prompt.includes('observation')));
  const plan = core.buildSlides({ purpose: 'Approve a trial', count: 'auto' }, core.organiseFreeText(notes));
  assert.doesNotMatch(JSON.stringify(plan), /Who will do the work|Which observation|not yet agreed/);
  const longNotes = Array.from({ length: 240 }, (_, i) => `item ${i} needs review.`).join(' ');
  const longPlan = core.buildSlides({ purpose: 'Agree priorities', count: 'auto' }, core.organiseFreeText(longNotes));
  assert.equal(core.normaliseProject({ version: 1, style: 'executive', ...longPlan, brief: { inputMode: 'free', messagesText: longNotes } }).slides.length, 6);
  assert.ok(JSON.stringify(longPlan).includes('item 239 needs review.'));
});

test('downloaded editable copies retain the full project without corrupting executable scripts', () => {
  const plan = samplePlan();
  const snapshot = { version: 1, ...plan, logo: core.DEFAULT_LOGO, current: 2, brief: { purpose: '</script><script>alert(1)</script>', messagesText: 'A & B < C', inputMode: 'free' } };
  const copy = core.embedEditorProject(html, snapshot);
  const data = copy.match(/^<script id="saved-project" type="application\/json">([\s\S]*?)<\/script>/m);
  assert.ok(data);
  assert.deepEqual(JSON.parse(data[1]), snapshot);
  assert.ok(!data[1].includes('<script>'));
  const copyScripts = [...copy.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !m[1].includes('application/json')).map(m => m[2]);
  assert.deepEqual(copyScripts, scripts);
  copyScripts.forEach(script => new vm.Script(script));
  const again = core.embedEditorProject(copy, { ...snapshot, current: 1 });
  assert.ok(again.length < copy.length + 10);
  assert.ok(new Blob([copy]).size < 10 * 1024 * 1024);
});

test('standalone builds match and all inline scripts parse', () => {
  assert.equal(html, read('dist/index.html'));
  assert.equal(scripts.length, 4);
  scripts.forEach(script => new vm.Script(script));
  assert.equal(scripts[0].trim(), read('core/deck-core.cjs').trim());
  assert.ok(html.includes("worker-src 'self' blob:"));
  assert.doesNotMatch(html, /<(?:script|img|link)[^>]+(?:src|href)=["']https?:/i);
  assert.doesNotMatch(scripts[0] + scripts[1] + scripts[3], /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
});

test('editable HTML and project JSON round-trip through safe import with all element types', () => {
  const plan = samplePlan();
  plan.slides[0].blocks = ['paragraph', 'bullets', 'quote', 'callout', 'stat', 'columns', 'cards', 'chart', 'table', 'image', 'divider'].map(type => core.newBlock(type));
  plan.slides[0].title = 'Numbers 3 → 1; <script> is just text';
  const project = { version: 1, ...plan, current: 1, logo: core.DEFAULT_LOGO, brief: { purpose: sample.purpose, messagesText: sample.messages, inputMode: 'structured' } };
  const imported = core.parseSavedProject(core.embedEditorProject(html, project));
  assert.equal(core.renderDeckHtml(imported), core.renderDeckHtml(project));
  const fromJson = core.parseSavedProject(JSON.stringify(project));
  assert.equal(fromJson.slides[0].title, project.slides[0].title);
  assert.notEqual(fromJson.slides[0].id, project.slides[0].id);
  assert.equal(fromJson.current, 1);
  assert.equal(fromJson.brief.messagesText, sample.messages);
  assert.equal(core.normaliseProject({ ...project, slides: [], current: 8 }).current, 0);
});

test('project import rejects external images, unsafe SVG, invalid tables and oversized projects', () => {
  const project = { version: 1, ...samplePlan(), brief: {} };
  const bad = patch => JSON.stringify({ ...project, ...patch });
  assert.throws(() => core.parseSavedProject(core.renderDeckHtml(project)), /presentation copy/);
  assert.throws(() => core.parseSavedProject(bad({ logo: { src: 'https://example.com/tracker.png' } })), /unsupported/);
  assert.throws(() => core.parseSavedProject(bad({ logo: { src: 'data:image/svg+xml;base64,PHN2Zy8+' } })), /unsupported/);
  const slide = { ...project.slides[0], blocks: [{ type: 'image', src: 'javascript:alert(1)', alt: '', caption: '' }] };
  assert.throws(() => core.parseSavedProject(bad({ slides: [slide] })), /unsupported/);
  slide.blocks = [{ type: 'table', headers: ['A'], rows: [['A', 'B']] }];
  assert.throws(() => core.parseSavedProject(bad({ slides: [slide] })), /unsupported/);
  assert.throws(() => core.parseSavedProject(bad({ slides: Array(101).fill(project.slides[0]) })), /unsupported/);
  assert.throws(() => core.parseSavedProject('x'.repeat(10 * 1024 * 1024 + 1)), /10 MiB/);
});

test('browser and server use the same callable core', () => {
  const browserContext = vm.createContext({});
  vm.runInContext(scripts[0], browserContext);
  assert.deepEqual(Object.keys(browserContext.DeckCore), Object.keys(core));
  const plan = samplePlan();
  assert.equal(browserContext.DeckCore.renderDeckHtml(plan), core.renderDeckHtml(plan));
});

test('short decks retain every supplied message and point', () => {
  const messages = Array.from({ length: 8 }, (_, i) => `Message ${i + 1}\n- Evidence ${i + 1}`).join('\n');
  const plan = callTool('create_deck_plan', { ...sample, messages, count: 3 });
  assert.equal(plan.slides.length, 3);
  const output = callTool('render_deck', { plan }).html;
  for (let i = 1; i <= 8; i++) {
    assert.ok(output.includes(`Message ${i}`));
    assert.ok(output.includes(`Evidence ${i}`));
  }
});

test('the planner uses content for the middle, preserves the ask and does not pad a thin brief', () => {
  const groups = core.parseMessageGroups('Context is changing\n- Evidence remains uncertain\nA bounded trial\n- Review before expanding');
  const plan = core.buildSlides({ purpose: 'Approve a two-week trial', audience: '', count: '6' }, groups);
  assert.equal(plan.slides.length, 4);
  assert.deepEqual(plan.slides.slice(1, -1).map(s => s.title), ['Context is changing', 'A bounded trial']);
  assert.equal(plan.slides.at(-1).blocks[0].text, 'Approve a two-week trial');
  assert.equal(plan.metadata.underfilled, 2);
  assert.doesNotMatch(JSON.stringify(plan.slides), /Start from the intended outcome|Define the intended audience|Add evidence/);
});

test('every editor element exports with safe text', () => {
  const types = ['paragraph', 'bullets', 'quote', 'callout', 'stat', 'columns', 'cards', 'chart', 'table', 'image', 'divider'];
  const plan = samplePlan();
  plan.slides[0].blocks = types.map(type => core.newBlock(type));
  plan.slides[0].title = '</script><img src=x onerror=alert(1)>';
  const output = callTool('render_deck', { plan }).html;
  assert.ok(output.includes('&lt;/script&gt;&lt;img'));
  assert.ok(!output.includes('<img src=x'));
  assert.equal([...output.matchAll(/<script>/g)].length, 1);
  assert.equal([...output.matchAll(/<\/script>/g)].length, 1);
  new vm.Script(output.match(/<script>([\s\S]*?)<\/script>/)[1]);
});

test('MCP rejects unsafe image sources and invalid layout metadata', () => {
  const plan = samplePlan();
  const image = core.newBlock('image');
  image.src = 'https://example.com/image.png';
  plan.slides[0].blocks = [image];
  assert.throws(() => validatePlan(plan), /embedded/);
  image.src = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(validatePlan(plan), plan);
  plan.style = 'executive" onload="alert(1)';
  assert.throws(() => validatePlan(plan), /Style/);
});

test('review reports content problems without changing the plan', () => {
  const plan = samplePlan();
  plan.slides[0].title = '';
  plan.slides[0].blocks = [{ id: 'text', type: 'paragraph', text: 'word '.repeat(100) }];
  const before = JSON.stringify(plan);
  const result = callTool('review_deck', { plan });
  assert.ok(result.warnings.some(v => v.message === 'Add a headline.'));
  assert.ok(result.warnings.some(v => v.message.includes('100 content words')));
  assert.equal(JSON.stringify(plan), before);
});

test('MCP remains off unless explicitly enabled', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('mcp/server.mjs', root))], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /MCP is off/);
});

test('MCP accepts a custom agent plan for review, revision and rendering without the rule-based planner', () => {
  const initial = { style: 'minimal', logo: null, slides: [
    { kind: 'title', eyebrow: 'Proposal', title: 'A bounded pilot', blocks: [{ type: 'paragraph', text: 'For the project team' }] },
    { kind: 'content', eyebrow: 'Decision', title: '', blocks: [{ type: 'bullets', items: ['Confirm an owner', 'Review before expansion'] }] }
  ] };
  const revised = JSON.parse(JSON.stringify(initial));
  revised.slides[1].title = 'Confirm ownership before starting';
  const requests = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'agent-workflow-test', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'review_deck', arguments: { plan: initial } } },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'review_deck', arguments: { plan: revised } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'render_deck', arguments: { plan: revised } } }
  ];
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('mcp/server.mjs', root)), '--enable'], {
    input: requests.map(value => JSON.stringify(value)).join('\n') + '\n', encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024
  });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const replies = result.stdout.trim().split('\n').map(value => JSON.parse(value));
  assert.equal(replies.length, 4);
  assert.deepEqual(replies[1].result.structuredContent.warnings, [{ slide: 2, message: 'Add a headline.' }]);
  assert.deepEqual(replies[2].result.structuredContent.warnings, []);
  const output = replies[3].result.structuredContent.html;
  for (const text of ['A bounded pilot', 'Confirm ownership before starting', 'Confirm an owner', 'Review before expansion']) assert.ok(output.includes(text));
  assert.equal([...output.matchAll(/<section class="slide /g)].length, 2);
  assert.doesNotMatch(output, /class="slide-logo"/);
  assert.match(output, /class="number" aria-label="Page 1">1</);
});

test('MCP handshake, tools, validation, and EOF shutdown work', () => {
  const requests = [
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 3, method: 'tools/list' },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'create_deck_plan', arguments: sample } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'render_deck', arguments: { plan: samplePlan() } } },
    { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'create_deck_plan', arguments: { purpose: '', messages: '' } } },
    { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'publish', arguments: {} } }
  ];
  const input = requests.map(v => JSON.stringify(v)).join('\n') + '\n';
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('mcp/server.mjs', root)), '--enable'], { input, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const replies = result.stdout.trim().split('\n').map(v => JSON.parse(v));
  assert.equal(replies.length, 7);
  assert.equal(replies[0].error.code, -32000);
  assert.equal(replies[1].result.protocolVersion, '2025-11-25');
  assert.equal(replies[2].result.tools.length, 3);
  assert.equal(replies[3].result.structuredContent.slides.length, 4);
  assert.equal(replies[3].result.structuredContent.metadata.underfilled, 1);
  assert.match(replies[4].result.structuredContent.html, /^<!doctype html>/);
  assert.equal(replies[5].result.isError, true);
  assert.equal(replies[6].error.code, -32602);
});
