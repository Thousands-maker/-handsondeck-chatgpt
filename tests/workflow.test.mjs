// DOM contract tests for navigation and recovery. These do not replace browser or visual QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !m[1].includes('application/json')).map(m => m[2]);

function setup(seed, blocked = false, globals = {}) {
  const nodes = [], ids = new Map(), storage = new Map(seed ? [['hands-on-deck-recovery-v1', seed]] : []);
  class Node {
    constructor(tag, attributes = {}) { this.tagName = tag.toUpperCase(); this.attributes = attributes; this.dataset = {}; this.children = []; this.style = {}; this.listeners = {}; this.value = attributes.value || ''; this.checked = 'checked' in attributes; this.hidden = 'hidden' in attributes; this.disabled = 'disabled' in attributes; this.textContent = ''; this.className = attributes.class || ''; this.maxLength = Number(attributes.maxlength) || 524288; this.open = false; this.id = attributes.id;
      for (const [key,value] of Object.entries(attributes)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_,c) => c.toUpperCase())] = value;
      this.classList = { contains: c => this.className.split(/\s+/).includes(c), add: c => { if (!this.classList.contains(c)) this.className += ' ' + c; }, remove: c => { this.className = this.className.split(/\s+/).filter(v => v !== c).join(' '); }, toggle: (c, force) => { const on = force ?? !this.classList.contains(c); on ? this.classList.add(c) : this.classList.remove(c); return on; } };
    }
    setAttribute(k,v) { this.attributes[k] = String(v); }
    removeAttribute(k) { delete this.attributes[k]; }
    getAttribute(k) { return this.attributes[k] ?? null; }
    addEventListener(type,fn) { (this.listeners[type] ||= []).push(fn); }
    click() { if (!this.disabled) for (const fn of this.listeners.click || []) fn({ target:this, preventDefault() {}, stopPropagation() {} }); }
    focus() { document.activeElement = this; }
    append(...items) { this.children.push(...items); }
    appendChild(node) { this.append(node); return node; }
    replaceChildren(...items) { this.children = items; }
    querySelectorAll(selector) { return this.children.flatMap(node => [node,...node.querySelectorAll('*')]).filter(node => matches(node,selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() {}
  }
  function matches(node,selector) {
    if (selector === '*') return true;
    if (selector === 'dialog[open]') return node.tagName === 'DIALOG' && node.open;
    if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
    const attr = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\](:checked)?$/);
    if (attr) return attr[1] in node.attributes && (attr[2] === undefined || node.attributes[attr[1]] === attr[2]) && (!attr[3] || node.checked);
    return node.tagName.toLowerCase() === selector;
  }
  for (const tag of html.split('<script id="deck-core">')[0].matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const attributes = {};
    for (const attr of tag[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attributes[attr[1]] = attr[2] ?? '';
    const node = new Node(tag[1],attributes); nodes.push(node); if (node.id) ids.set(node.id,node);
  }
  for (const match of html.matchAll(/<script id="([^"]+)" type="application\/json">([\s\S]*?)<\/script>/g)) { const node = new Node('script', { id:match[1] }); node.textContent = match[2]; ids.set(node.id,node); }
  const saved = new Node('script', { id:'saved-project' }); saved.textContent = '{}'; ids.set(saved.id,saved);
  const document = { activeElement:null, body:nodes.find(n => n.tagName === 'BODY'), documentElement:{outerHTML:html.replace(/^<!doctype html>\s*/i,'')},
    getElementById:id => ids.get(id) || null, createElement:tag => new Node(tag),
    querySelectorAll:selector => nodes.filter(n => matches(n,selector)), querySelector:selector => nodes.find(n => matches(n,selector)) || null,
    addEventListener() {}, visibilityState:'visible' };
  const context = vm.createContext({ document, console, Blob, URL, TextEncoder, structuredClone,
    window:{ addEventListener() {}, confirm:() => true, clearTimeout() {}, setTimeout:() => 1, requestAnimationFrame:() => 1 },
    navigator:{}, location:{ protocol:'file:' }, setTimeout:() => 1, clearTimeout() {}, setInterval:() => 1, clearInterval() {}, requestAnimationFrame:() => 1, cancelAnimationFrame() {},
    localStorage:{ getItem:k => { if (blocked) throw Error('blocked'); return storage.get(k) ?? null; }, setItem:(k,v) => { if (blocked) throw Error('blocked'); storage.set(k,v); }, removeItem:k => storage.delete(k) }, ...globals });
  for (const script of scripts) vm.runInContext(script,context);
  return { get:id => ids.get(id), run:code => vm.runInContext(code,context), storage };
}

test('first visit starts with guidance, validates notes, previews an outline and builds a real editable deck', () => {
  const app = setup();
  app.get('guide-engine').value = 'standard';
  assert.equal(app.run('flow.page'),'welcome');
  assert.equal(app.run('state.slides.length'),0);
  app.get('start-guided').click(); app.get('guide-next').click();
  assert.equal(app.run('flow.step'),0); assert.equal(app.get('guide-error').hidden,false);
  app.get('guide-purpose').value = 'Approve a two-week pilot'; app.get('guide-audience').value = 'Team leads';
  app.get('guide-next').click(); assert.equal(app.run('flow.step'),1);
  app.get('guide-notes').value = 'The queue is growing. A small pilot can test a change.\n\nThe pilot needs one owner. Review the results after two weeks.';
  app.get('guide-next').click(); app.get('guide-next').click();
  assert.equal(app.run('flow.step'),3); assert.ok(app.get('guide-outline').children.length >= 3);
  app.get('guide-back').click(); assert.ok(app.get('guide-notes').value.includes('queue'));
  app.get('guide-next').click(); app.get('guide-next').click();
  assert.equal(app.run('flow.page'),'editor'); assert.ok(app.run('state.slides.length') >= 3);
  assert.equal(app.get('nav-edit').getAttribute('aria-current'),'step');
  app.run('saveRecovery()');
  const reload = setup(app.storage.get('hands-on-deck-recovery-v1'));
  assert.equal(reload.run('flow.page'),'editor');
  assert.equal(reload.run('state.slides.length'),app.run('state.slides.length'));
  assert.ok(reload.get('messages').value.includes('queue'));
});

test('optional suggestions stay beside the editor and download opens directly; presentation is read-only', () => {
  const app = setup(); app.run("loadExample('decision')");
  const before = app.run('state.slides.length');
  app.get('delete-slide').click(); assert.equal(app.run('state.slides.length'),before - 1);
  app.get('undo-delete').click(); assert.equal(app.run('state.slides.length'),before);
  app.get('open-checks').click(); assert.equal(app.run('flow.page'),'editor');
  assert.equal(app.get('drawer-dialog').open,true);
  assert.equal(app.get('checks-panel').classList.contains('hidden'),false);
  assert.equal(app.get('drawer-title').textContent,'Suggestions');
  app.get('close-drawer').click(); app.get('download').click(); assert.equal(app.run('flow.page'),'offline');
  assert.equal(app.get('review-page'),undefined);
  assert.equal(app.get('download-editor').disabled,false);
  app.get('back-to-editor').click(); app.get('present').click();
  assert.equal(app.run('flow.presenting'),true);
  assert.equal(app.get('slide-frame').querySelectorAll('*').some(n => n.contentEditable === 'plaintext-only'),false);
  app.get('exit-present').click(); assert.equal(app.run('flow.presenting'),false);
  assert.ok(app.get('slide-frame').querySelectorAll('*').some(n => n.contentEditable === 'plaintext-only'));
});

test('storage failures remain usable and the downloaded editor contains the complete workflow', async () => {
  const app = setup(undefined,true); app.run("loadExample('update')");
  assert.equal(app.run('flow.recoveryEnabled'),false);
  assert.match(app.get('save-state').textContent,/Not saved/);
  const blob = app.run('editorDownloadBlob()');
  const copy = await blob.text();
  assert.ok(copy.includes('id="interface-code"'));
  assert.ok(copy.includes('function openGuide()'));
  assert.ok(copy.includes('function parseSavedProject('));
  const saved = copy.match(/^\s*<script id="saved-project" type="application\/json">([\s\S]*?)<\/script>/m);
  assert.ok(JSON.parse(saved[1]).slides.length >= 3);
});

test('clicking the slide logo opens upload/remove controls and presentation mode has no logo button', () => {
  const app = setup(); app.run("loadExample('decision')");
  const logo = app.get('slide-frame').querySelector('.slide-logo-button');
  assert.ok(logo); logo.click();
  assert.equal(app.get('drawer-dialog').open,true);
  assert.equal(app.get('branding-panel').classList.contains('hidden'),false);
  app.get('remove-logo').click(); assert.equal(app.run('state.logo'),null);
  assert.equal(app.get('slide-frame').querySelector('.slide-logo-button'),null);
  app.get('reset-logo').click(); app.run('startPresenting()');
  assert.equal(app.get('slide-frame').querySelector('.slide-logo-button'),null);
});

test('AI drafting takes the actual brief, requires setup, and applies only a reviewed proposal', async () => {
  const app = setup(); app.run("loadExample('decision')");
  const original = app.run('JSON.stringify(state.slides)');
  app.run('openAIFromBrief(true)');
  assert.equal(app.run('flow.page'),'ai');
  assert.ok(app.get('ai-notes').value.includes('Booking a room'));
  assert.equal(app.get('ai-generate').disabled,true);
  assert.match(app.get('ai-status').textContent,/HTTPS/);
  app.run(`aiState.source = {purpose:'Agree a trial',audience:'Team',messagesText:'Original facts and caveats.',style:'executive',inputMode:'free',count:'3'};
    aiState.proposal = HandsAI.parseProposal(JSON.stringify({slides:[{title:'A clear opening',points:['Fact one']},{title:'A focused middle',points:['Keep the caveat']},{title:'Decide the next step',points:['Owner to confirm']}]})); aiRenderProposal();`);
  assert.equal(app.run('JSON.stringify(state.slides)'),original);
  app.run('aiApply()'); assert.equal(app.run('state.slides.length'),3);
  assert.equal(app.run('state.slides[1].title'),'A focused middle');
  assert.equal(app.get('messages').value,'Original facts and caveats.');
  assert.equal(app.run('flow.page'),'editor');
});

test('the primary brief builds offline and returning to it preserves edits until rebuilding is confirmed', () => {
  const app = setup();
  assert.equal(app.get('guide-engine').value, 'standard');
  app.get('start-direct').click(); assert.equal(app.run('flow.page'), 'brief');
  app.get('generate').click(); assert.equal(app.get('brief-error').hidden, false);
  app.get('purpose').value = 'Approve a two-week trial';
  app.get('messages').value = 'The queue is growing. Test a limited change.\n\nKeep the current process available. Review before expansion.';
  app.get('generate').click(); assert.equal(app.run('flow.page'), 'editor');
  assert.equal(app.get('ai-generate').disabled, true);
  app.run("state.slides[1].title = 'An edited argument'; markEdited();");
  const before = app.run('JSON.stringify(state.slides)');
  app.get('open-brief').click(); assert.equal(app.get('brief-rebuild').hidden, false);
  app.get('messages').value = 'Revised source notes.';
  app.get('brief-keep-editing').click(); assert.equal(app.run('JSON.stringify(state.slides)'), before);
  app.get('open-brief').click(); app.run('window.confirm = () => false'); app.get('generate').click();
  assert.equal(app.run('JSON.stringify(state.slides)'), before);
});

test('outline revisions, reordering and undo flow to preview and export without changing the reference brief', async () => {
  const app = setup(); app.run("loadExample('decision')");
  const originalNotes = app.get('messages').value;
  app.get('view-outline').click(); assert.equal(app.get('stage-shell').hidden, true);
  let rows = app.get('story-list').children;
  const field = rows[1].querySelector('input'); field.value = 'The revised case for change';
  field.listeners.input[0]();
  assert.equal(app.run('state.slides[1].title'), 'The revised case for change');
  assert.ok(app.run('exportHtml()').includes('The revised case for change'));
  const points = rows[1].querySelector('textarea'); points.value = 'Preserve this caveat\nConfirm the evidence'; points.listeners.input[0]();
  assert.ok(app.run('exportHtml()').includes('Preserve this caveat'));
  rows[1].querySelectorAll('button').find(n => n.getAttribute('aria-label') === 'Move down slide 2').click();
  assert.equal(app.run('state.slides[2].title'), 'The revised case for change');
  rows = app.get('story-list').children;
  rows[2].querySelectorAll('button').find(n => n.getAttribute('aria-label') === 'Remove slide 3').click();
  assert.equal(app.get('undo-delete').hidden, false); app.get('undo-delete').click();
  assert.equal(app.run('state.slides[2].title'), 'The revised case for change');
  app.get('open-source').click(); assert.equal(app.get('source-notes').textContent, originalNotes);
  app.get('close-drawer').click();
  app.get('present').click(); assert.equal(app.get('stage-shell').hidden, false);
  assert.equal(app.get('slide-frame').querySelectorAll('*').some(n => n.contentEditable === 'plaintext-only'), false);
  app.get('exit-present').click(); assert.equal(app.get('story-outline').hidden, false);
  const copy = await app.run('editorDownloadBlob()').text();
  const reopened = app.run('DeckCore.parseSavedProject(' + JSON.stringify(copy) + ')');
  assert.equal(reopened.slides[2].title, 'The revised case for change');
  assert.equal(reopened.brief.messagesText, originalNotes);
});

test('missing asks, new numbers and placeholders remain advisory and never block downloads', () => {
  const app = setup(); app.run("loadExample('decision')");
  app.run("state.slides.at(-1).blocks = [{type:'callout',label:'Proposed ask',text:'Thank you.'}]; state.slides[1].blocks.push({type:'paragraph',text:'Savings are 99%. Owner to confirm.'}); renderAll();");
  const messages = app.run('state.warnings.map(w => w.text).join(" ")');
  assert.match(messages, /closing slide no longer states an ask/);
  assert.match(messages, /99%/); assert.match(messages, /placeholder or an unresolved detail/);
  app.get('open-offline').click();
  assert.equal(app.get('download-presentation').disabled, false);
  assert.equal(app.get('download-editor').disabled, false);
  assert.match(app.get('export-check-summary').textContent, /still download/);
  assert.equal(app.get('export-suggestions').hidden, false);
  const before = app.run('JSON.stringify(state.slides)');
  app.get('export-suggestions').click();
  assert.equal(app.run('flow.page'), 'offline');
  assert.equal(app.get('drawer-dialog').open, true);
  const warning = app.get('warnings').children.find(node => node.textContent.includes('99%'));
  assert.ok(warning); warning.click();
  assert.equal(app.run('flow.page'), 'editor');
  assert.equal(app.run('flow.editView'), 'slides');
  assert.equal(app.run('state.current'), 1);
  assert.equal(app.get('drawer-dialog').open, false);
  assert.equal(app.run('JSON.stringify(state.slides)'), before);
  app.run("state.slides = [{id:'a',kind:'title',title:'A clear purpose',eyebrow:'',blocks:[]},{id:'b',kind:'content',title:'A supplied point',eyebrow:'',blocks:[{id:'p',type:'paragraph',text:'Booking a room takes too many messages.'}]},{id:'c',kind:'statement',title:'Agree the trial',eyebrow:'',blocks:[{id:'q',type:'paragraph',text:'Approve a four-week trial of online room booking.'}]}]; state.metadata = {}; showPage('offline');");
  assert.equal(app.get('export-suggestions').hidden, true);
  assert.equal(app.get('download-presentation').disabled, false);
});

test('guided notes show their ideas live, preserve typed follow-ups, and build from added facts only', () => {
  const app = setup(); app.get('start-guided').click();
  app.get('guide-purpose').value = 'Approve a revised process'; app.get('guide-next').click();
  app.get('guide-notes').value = 'the support team is joining the service team, and there are new handovers to agree. i need a RACI before starting.';
  app.run('updateGuideMode(); syncBriefFromGuide();');
  assert.equal(app.get('guide-idea-list').children.length, 3);
  const followups = app.get('guide-followups');
  const answer = followups.querySelector('textarea'); answer.value = 'Responsibility for approval is not yet agreed.';
  app.run('updateGuideMode()');
  assert.equal(followups.querySelector('textarea').value, answer.value);
  followups.querySelector('button').click();
  assert.ok(app.get('guide-notes').value.includes('Responsibility for approval is not yet agreed.'));
  app.get('guide-next').click(); app.get('guide-next').click();
  assert.equal(app.run('flow.step'), 3);
  assert.ok(app.get('guide-outline').querySelectorAll('li').some(n => n.textContent.includes('not yet agreed')));
  app.get('guide-next').click();
  const output = app.run('exportHtml()');
  assert.ok(output.includes('Responsibility for approval is not yet agreed.'));
  assert.doesNotMatch(output, /Who will do the work|What supports the case/);
  app.run('saveRecovery()');
  const reopened = setup(app.storage.get('hands-on-deck-recovery-v1'));
  assert.ok(reopened.get('messages').value.includes('not yet agreed'));
});

// Controllable workers and timers exercise recovery without requiring a GPU.
function localAIApp({ desktop = false, memory = 4, limits = { maxBufferSize: 2 ** 30, maxStorageBufferBindingSize: 2 ** 30 }, dispose = true } = {}) {
  const workers = [], downloads = [], warnings = [], timers = new Map(), stores = new Map(); let timerId = 0;
  class Worker {
    constructor() { this.messages = []; workers.push(this); }
    postMessage(message) {
      this.messages.push(message);
      if (message.type === 'dispose' && dispose) queueMicrotask(() => this.emit({ type: 'disposed' }));
    }
    emit(data) { this.onmessage?.({ data }); }
    terminate() { this.terminated = true; }
  }
  const cacheApi = { keys: async () => [...stores.keys()], delete: async name => stores.delete(name), open: async name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return { keys: async () => [...store.keys()].map(url => ({ url })), match: async url => store.get(url),
      put: async (url, response) => store.set(url, response), delete: async url => store.delete(url) };
  } };
  const app = setup(undefined, false, { Worker, Response, AbortController, caches: cacheApi,
    navigator: { userAgent: desktop ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
      userAgentData: { mobile: !desktop }, deviceMemory: memory,
      gpu: { requestAdapter: async () => ({ limits, features: new Set(['shader-f16']) }) }, serviceWorker: {} },
    location: { protocol: 'https:', href: 'https://example.test/app/' },
    console: { ...console, warn: (...args) => warnings.push(args.map(String).join(' ')) },
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => { timers.set(++timerId, { fn, ms, interval: true }); return timerId; }, clearInterval: id => timers.delete(id),
    download: async asset => { downloads.push(asset.url); return new Uint8Array([1]); }
  });
  app.run("loadExample('decision'); aiCopyBrief(); aiDeviceOptions(); aiState.model = aiSelected();");
  app.run('aiPrepareShell = async () => {}; HandsAI.downloadAsset = download;');
  return { ...app, workers, downloads, warnings, timers, stores,
    boot() { app.run('aiBoot(aiState.model)'); workers.at(-1).emit({ type: 'ready' }); },
    async settle() { await new Promise(resolve => setImmediate(resolve)); },
    fire(ms) { const entry = [...timers.entries()].find(([, timer]) => timer.ms === ms); assert.ok(entry, `Expected ${ms}ms timer`); if (!entry[1].interval) timers.delete(entry[0]); entry[1].fn(); }
  };
}

const lostGPU = { type: 'error', kind: 'gpu', detail: "Failed to execute 'mapAsync' on 'GPUBuffer': Buffer was unmapped before mapping was resolved." };
const completeOutline = { slides: Array.from({ length: 4 }, (_, index) => ({ title: `Supplied theme ${index + 1}`, points: ['Keep this supplied qualification.'] })) };

test('phone installation downloads only 0.5B even if a stale Pro selection is forced', async () => {
  const app = localAIApp();
  const smallUrls = JSON.parse(app.run('JSON.stringify(aiCatalogue().models[0].assets.map(asset => asset.url))'));
  assert.equal(app.get('ai-model').children.length, 1); assert.equal(app.get('ai-pro-name').hidden, true);
  assert.match(app.get('ai-device-note').textContent, /phone or tablet.*0.5B/);
  app.get('ai-model').value = '1';
  await app.run('aiInstall()');
  assert.deepEqual(app.downloads, smallUrls);
  assert.match(app.workers[0].messages[0].model.id, /0\.5B/);
  assert.equal(app.workers[0].messages[0].settings.context_window_size, 2048);
  assert.equal(app.get('ai-download-size').textContent, '283.1 MiB');
  assert.equal(app.workers[0].messages[0].settings.max_tokens, 256);
});

test('a checked desktop can select Pro; either insufficient buffer removes it before installation', async () => {
  const app = localAIApp({ desktop: true, memory: 8 });
  await app.run('aiRefresh()');
  assert.equal(app.get('ai-model').children.length, 2);
  app.get('ai-model').value = '1'; await app.run('aiRefresh()');
  assert.match(app.run('aiSelected().id'), /1\.5B/);
  // A later adapter check must enforce limits again, before downloading anything.
  app.run('navigator.gpu.requestAdapter = async () => ({ limits: {maxBufferSize: 1073741824, maxStorageBufferBindingSize: 134217728}, features: new Set(["shader-f16"]) })');
  await app.run('aiInstall()');
  assert.equal(app.get('ai-model').children.length, 1);
  assert.match(app.workers[0].messages[0].model.id, /0\.5B/);
});

test('outline generation immediately disables repeat submission and shows slide progress and cancellation beside it', () => {
  const app = localAIApp(); app.boot();
  app.get('ai-generate').click();
  assert.equal(app.get('ai-generate').disabled, true); assert.equal(app.get('ai-writing').hidden, false);
  assert.equal(app.get('ai-generation-cancel').hidden, false);
  assert.match(app.get('ai-writing-status').textContent, /slide 1 of 4/);
  const request = app.workers[0].messages.at(-1);
  app.get('ai-generate').click(); assert.equal(app.workers[0].messages.at(-1), request);
  app.workers[0].emit({ type: 'writing', requestId: request.requestId, slide: 2, tokens: 16 });
  assert.match(app.get('ai-writing-status').textContent, /slide 2 of 4.*drafting points/);
  assert.equal(app.get('ai-writing-progress').value, 1);
  app.get('ai-generation-cancel').click();
  assert.equal(app.get('ai-generation-cancel').hidden, true);
  assert.match(app.get('ai-writing-status').textContent, /Cancelled.*notes and deck are safe/);
  assert.equal(app.run('aiState.request'), null);
});

test('two GPU failures retry the identical source once from cache, then return a safe Standard proposal', async () => {
  const app = localAIApp(); app.boot();
  const oldDeck = app.run('JSON.stringify(state.slides)'), notes = app.get('ai-notes').value;
  app.get('ai-generate').click(); const firstRequest = app.workers[0].messages.at(-1);
  app.workers[0].emit(lostGPU);
  assert.equal(app.get('ai-generate').disabled, true);
  assert.match(app.get('ai-writing-status').textContent, /Reloading.*once/);
  await app.settle();
  assert.equal(app.workers[0].terminated, true);
  assert.equal(app.workers[0].messages.at(-1).type, 'dispose');
  assert.equal(app.workers.length, 2); assert.equal(app.downloads.length, 0);
  assert.match(app.workers[1].messages[0].model.id, /0\.5B/);
  app.workers[1].emit({ type: 'ready' });
  assert.deepEqual(app.workers[1].messages.at(-1), firstRequest);
  app.workers[1].emit({ type: 'error', kind: 'gpu', detail: 'GPU device lost: simulated reset' });
  await app.settle();
  assert.equal(app.workers.length, 2); assert.equal(app.workers[1].terminated, true);
  assert.equal(app.run('JSON.stringify(state.slides)'), oldDeck); assert.equal(app.get('ai-notes').value, notes);
  assert.equal(app.get('ai-result').hidden, false); assert.equal(app.get('ai-apply').disabled, false);
  assert.match(app.get('ai-result-title').textContent, /Standard/);
  assert.match(app.get('ai-writing-status').textContent, /standard sorting.*notes are safe/);
  assert.doesNotMatch(app.get('ai-writing-status').textContent + app.get('ai-status').textContent, /mapAsync|GPUBuffer|simulated reset/);
  assert.ok(app.warnings.some(line => line.includes('mapAsync')));
  const expectedSlides = JSON.parse(app.run('JSON.stringify(aiState.fallbackPlan.slides, (key, value) => key === "id" ? undefined : value)'));
  app.get('ai-apply').click();
  assert.equal(app.get('messages').value, notes); assert.match(app.get('editor-heading').textContent, /Standard/);
  assert.deepEqual(JSON.parse(app.run('JSON.stringify(state.slides, (key, value) => key === "id" ? undefined : value)')), expectedSlides);
});

test('the one retry can succeed and stale old-worker responses cannot replace it', async () => {
  const app = localAIApp(); app.boot(); app.get('ai-generate').click();
  app.workers[0].emit(lostGPU); await app.settle();
  app.workers[1].emit({ type: 'ready' });
  const requestId = app.workers[1].messages.at(-1).requestId;
  app.workers[0].emit({ type: 'proposal', requestId, text: '{}' });
  assert.equal(app.get('ai-result').hidden, true);
  app.workers[1].emit({ type: 'proposal', requestId, text: JSON.stringify(completeOutline) });
  assert.equal(app.get('ai-result').hidden, false); assert.equal(app.run('aiState.fallbackPlan'), null);
  assert.equal(app.get('ai-generate').disabled, false); assert.equal(app.get('ai-generation-cancel').hidden, true);
  assert.equal(app.run('aiState.proposal.length'), 4);
});

test('cancelling during teardown or reload prevents retries, fallback and late proposals', async () => {
  for (const atReload of [false, true]) {
    const app = localAIApp(); app.boot(); app.get('ai-generate').click();
    app.workers[0].emit(lostGPU);
    if (atReload) await app.settle();
    app.get('ai-generation-cancel').click(); await app.settle();
    const count = app.workers.length;
    app.workers.at(-1).emit({ type: 'ready' });
    app.workers.at(-1).emit({ type: 'proposal', text: JSON.stringify(completeOutline) });
    await app.settle();
    assert.equal(app.workers.length, count); assert.equal(count, atReload ? 2 : 1);
    assert.equal(app.run('aiState.request'), null); assert.equal(app.run('aiState.proposal'), null);
    assert.equal(app.get('ai-result').hidden, true); assert.match(app.get('ai-writing-status').textContent, /Cancelled/);
  }
});

test('a hung teardown is terminated and a failed reload falls back without downloading', async () => {
  const app = localAIApp({ dispose: false }); app.boot(); app.get('ai-generate').click();
  app.workers[0].emit(lostGPU); app.fire(1500); await app.settle();
  assert.equal(app.workers.length, 2); assert.equal(app.workers[0].terminated, true);
  app.workers[1].emit({ type: 'error', detail: 'Internal runtime boot failure' });
  assert.match(app.get('ai-writing-status').textContent, /standard sorting/);
  assert.doesNotMatch(app.get('ai-status').textContent, /Internal runtime/);
  assert.equal(app.downloads.length, 0);
});

test('GPU loss after a completed outline clears ready state without removing the reviewed proposal', () => {
  const app = localAIApp(); app.boot(); app.get('ai-generate').click();
  const requestId = app.workers[0].messages.at(-1).requestId;
  app.workers[0].emit({ type: 'proposal', requestId, text: JSON.stringify(completeOutline) });
  app.workers[0].emit({ ...lostGPU, requestId });
  assert.equal(app.run('aiState.ready'), false); assert.equal(app.get('ai-generate').disabled, true);
  assert.equal(app.get('ai-result').hidden, false); assert.equal(app.get('ai-apply').disabled, false);
  assert.doesNotMatch(app.get('ai-status').textContent, /mapAsync|GPUBuffer/);
});

test('changing deck style immediately updates every sidebar slide without changing content or selection', async () => {
  const app = setup(); app.run("loadExample('decision'); selectSlide(state.slides.length - 1)");
  const original = app.run('JSON.stringify(state.slides)'), selected = app.run('state.current');
  for (const style of ['minimal', 'operational', 'executive']) {
    const select = app.get('style-select'); select.value = style;
    select.listeners.change[0]({ target: select });
    assert.equal(app.run('state.style'), style);
    assert.equal(app.get('brief-style').value, style);
    assert.ok(app.get('slide-frame').classList.contains('style-' + style));
    const rows = app.get('slide-list').children;
    assert.equal(rows.length, app.run('state.slides.length'));
    rows.forEach((row, index) => {
      const thumbnail = row.querySelector('.thumb-slide');
      assert.ok(thumbnail.classList.contains('style-' + style));
      assert.equal(thumbnail.querySelector('.slide-title').textContent, app.run(`state.slides[${index}].title`));
      assert.equal(thumbnail.querySelector('.slide-canvas').dataset.slideId, app.run(`state.slides[${index}].id`));
      assert.equal(row.classList.contains('current'), index === selected);
    });
    assert.equal(rows[selected].getAttribute('aria-current'), 'true');
    assert.equal(app.run('JSON.stringify(state.slides)'), original);
    assert.equal(app.run('state.current'), selected);
    assert.ok(app.run('exportHtml()').includes(`class="style-${style}"`));
    app.run('saveRecovery()');
    const reloaded = setup(app.storage.get('hands-on-deck-recovery-v1'));
    assert.ok(reloaded.get('slide-list').children[0].querySelector('.thumb-slide').classList.contains('style-' + style));
    const editable = await app.run('editorDownloadBlob()').text();
    assert.equal(app.run('DeckCore.parseSavedProject(' + JSON.stringify(editable) + ').style'), style);
  }
});

test('sidebar previews use current slide content, individual page numbers and read-only images', () => {
  const app = setup(); app.run("loadExample('decision'); selectSlide(state.slides.length - 1)");
  app.run("state.slides[1].blocks = [newBlock('callout'), newBlock('image')]; state.slides[1].blocks[0].text = 'A revised point'; renderAll();");
  let rows = app.get('slide-list').children;
  assert.equal(rows[0].querySelector('.slide-number'), null);
  assert.equal(rows[1].querySelector('.slide-number').textContent, '1');
  assert.equal(rows[2].querySelector('.slide-number').textContent, '2');
  assert.equal(rows[1].querySelector('.block-callout').children[1].textContent, 'A revised point');
  for (const row of rows) {
    const frame = row.querySelector('.thumb-slide');
    assert.equal(frame.inert, true); assert.equal(frame.getAttribute('aria-hidden'), 'true');
    assert.equal(frame.querySelectorAll('button').length, 0);
    assert.equal(frame.querySelectorAll('*').some(node => node.contentEditable === 'plaintext-only'), false);
    assert.ok(frame.querySelector('.slide-logo'));
  }
  rows[1].click(); assert.equal(app.run('state.current'), 1);
  assert.equal(app.get('slide-frame').querySelector('.block-callout').children[1].textContent, 'A revised point');
  app.run('state.logo = null; renderAll();');
  rows = app.get('slide-list').children;
  assert.equal(rows.some(row => row.querySelector('.slide-logo')), false);
});
