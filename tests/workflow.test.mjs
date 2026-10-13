// DOM contract tests for navigation and recovery. These do not replace browser or visual QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !m[1].includes('application/json')).map(m => m[2]);

function setup(seed, blocked = false) {
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
    if (selector === '.review-check input') return node.tagName === 'INPUT' && node.attributes.type === 'checkbox' && !node.id;
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
    navigator:{}, location:{ protocol:'file:' }, setTimeout:() => 1, clearTimeout() {}, requestAnimationFrame:() => 1, cancelAnimationFrame() {},
    localStorage:{ getItem:k => { if (blocked) throw Error('blocked'); return storage.get(k) ?? null; }, setItem:(k,v) => { if (blocked) throw Error('blocked'); storage.set(k,v); }, removeItem:k => storage.delete(k) } });
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

test('edit, undo deletion, review and save remain connected; presentation is read-only', () => {
  const app = setup(); app.run("loadExample('decision')");
  const before = app.run('state.slides.length');
  app.get('delete-slide').click(); assert.equal(app.run('state.slides.length'),before - 1);
  app.get('undo-delete').click(); assert.equal(app.run('state.slides.length'),before);
  app.get('open-checks').click(); assert.equal(app.run('flow.page'),'review');
  app.get('review-save').click(); assert.equal(app.run('flow.page'),'offline');
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
