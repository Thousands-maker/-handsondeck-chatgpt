import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ai from '../ai/ai-core.cjs';

const catalogue = JSON.parse(readFileSync(new URL('../ai/models.json', import.meta.url)));
const bytes = new TextEncoder().encode('verified model fixture');
const digest = Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes)).toString('hex');
const asset = { url:'https://huggingface.co/example/resolve/pinned/test.bin', bytes:bytes.length, sha256:digest };

test('both model manifests have exact, bounded totals and pinned weights, configuration and libraries', () => {
  assert.equal(ai.validateManifest(catalogue), catalogue);
  for (const model of catalogue.models) {
    assert.match(model.model, /\/resolve\/[a-f0-9]{40}\/$/);
    assert.match(model.model_lib, /\/mlc-ai\/binary-mlc-llm-libs\/[a-f0-9]{40}\//);
    for (const name of ['tokenizer.json','tensor-cache.json','mlc-chat-config.json']) assert.ok(model.assets.some(a => a.name === name));
    assert.ok(model.assets.some(a => a.name.endsWith('.bin')));
    assert.ok(model.totalBytes < 1024 ** 3);
  }
  const unsafe = structuredClone(catalogue); unsafe.models[0].assets[0].url = 'https://example.com/runtime.js';
  assert.throws(() => ai.validateManifest(unsafe), /Unapproved/);
});

test('downloads omit credentials, enforce exact bytes and verify the hash before returning', async () => {
  let options, progress = [];
  const result = await ai.downloadAsset(asset, { fetcher:async (url, opts) => { assert.equal(url,asset.url); options = opts; return new Response(bytes); }, onProgress:n => progress.push(n) });
  assert.deepEqual(result,bytes); assert.equal(options.credentials,'omit'); assert.equal(options.referrerPolicy,'no-referrer');
  assert.equal(progress.at(-1),bytes.length);
  await assert.rejects(ai.downloadAsset({ ...asset, sha256:'0'.repeat(64) }, { fetcher:async () => new Response(bytes) }), /security check/);
  await assert.rejects(ai.downloadAsset(asset, { fetcher:async () => new Response(bytes.slice(0,2)) }), /incomplete/);
});

test('an oversized stream is cancelled and user cancellation stops a download', async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(asset.bytes + 1)); }, cancel() { cancelled = true; } });
  await assert.rejects(ai.downloadAsset(asset, { fetcher:async () => new Response(body) }), /exceeded/);
  assert.equal(cancelled,true);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(ai.downloadAsset(asset, { signal:controller.signal, fetcher:async () => new Response(bytes) }), { name:'AbortError' });
});

test('AI output is bounded data and malformed, incomplete or excessive plans are rejected', () => {
  const slides = Array.from({length:3},(_,i) => ({title:`Point ${i+1}`,points:['Keep the qualification.']}));
  assert.deepEqual(ai.parseProposal(JSON.stringify({slides})),slides);
  assert.throws(() => ai.parseProposal('{"slides":['), /usable outline/);
  assert.throws(() => ai.parseProposal(JSON.stringify({slides:slides.slice(0,1)})), /3–6/);
  assert.throws(() => ai.parseProposal(JSON.stringify({slides:[{title:'X',points:[]},...slides]})), /incomplete/);
  assert.throws(() => ai.parseProposal('x'.repeat(16001)), /too much/);
});

test('worker blocks every network fallback and rejects a damaged cached runtime', async () => {
  const messages = [], opened = []; let network = 0;
  const self = { postMessage:message => messages.push(message), caches:{ open:async name => { opened.push(name); return { match:async () => new Response('damaged') }; } } };
  const context = vm.createContext({self,crypto:webcrypto,Response,Request,URL,Blob,console,fetch:async () => { network++; throw Error('network'); }});
  vm.runInContext(readFileSync(new URL('../ai/model-worker.js', import.meta.url),'utf8'),context);
  await self.onmessage({data:{type:'boot',model:{assets:[{...asset,role:'runtime'}]},cacheName:'isolated-test'}});
  assert.deepEqual(opened,['isolated-test']); assert.equal(network,0);
  assert.match(messages.at(-1).detail,/failed verification/);
  await assert.rejects(self.fetch('https://example.com/prompt'),/unapproved/);
  assert.equal(network,0); assert.equal(messages.some(message=>message.type==='ready'),false);
});

test('mobile, tablet and low-memory policies never offer Pro even with generous GPU limits', () => {
  const large = { maxBufferSize: 2 ** 31, maxStorageBufferBindingSize: 2 ** 31 };
  for (const device of [
    { userAgentData: { mobile: true }, userAgent: 'Windows NT', deviceMemory: 16 },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', deviceMemory: 8 },
    { userAgent: 'Mozilla/5.0 (Linux; Android 14; Tablet)', deviceMemory: 16 },
    { userAgent: 'Mozilla/5.0 (iPad; CPU OS 18)', deviceMemory: 16 },
    { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 },
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0)', deviceMemory: 4 }
  ]) {
    const policy = ai.devicePolicy(device, large);
    assert.equal(policy.allowPro, false); assert.equal(policy.compact, true);
  }
  assert.equal(ai.devicePolicy({}, large).allowPro, false);
});

test('Pro requires a desktop and both buffer limits, while phone generation is bounded', () => {
  const desktop = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', deviceMemory: 8 };
  const large = { maxBufferSize: 2 ** 30, maxStorageBufferBindingSize: 2 ** 30 };
  assert.equal(ai.devicePolicy(desktop, large).allowPro, true);
  for (const limits of [undefined, {}, { ...large, maxBufferSize: 2 ** 28 }, { ...large, maxStorageBufferBindingSize: 2 ** 27 }]) {
    assert.equal(ai.devicePolicy(desktop, limits).allowPro, false);
  }
  assert.ok(ai.generationSettings(true).max_tokens <= 256);
  assert.ok(ai.generationSettings(true).context_window_size < ai.generationSettings(false).context_window_size);
});

function workerFixture(mockEngine, extra = {}) {
  const messages = [];
  const self = { postMessage: message => messages.push(message), addEventListener() {} };
  const context = vm.createContext({ self, console, mockEngine, ...extra });
  vm.runInContext(readFileSync(new URL('../ai/model-worker.js', import.meta.url), 'utf8'), context);
  vm.runInContext('engine = mockEngine', context);
  return { self, messages, run: code => vm.runInContext(code, context) };
}

test('phone inference streams one short slide per call, resets history and reports actual progress', async () => {
  const calls = []; let resets = 0;
  const fixture = workerFixture({ resetChat: async () => { resets++; }, chat: { completions: { create: async request => {
    calls.push(request);
    return (async function* () {
      const text = JSON.stringify({ title: `Slide ${calls.length}`, points: ['A supplied fact with its caveat.'] });
      for (const char of text) yield { choices: [{ delta: { content: char } }] };
      yield { choices: [{ finish_reason: 'stop' }] };
    })();
  } } } });
  const brief = { purpose: 'Agree a pilot', audience: 'Team', messagesText: 'The trial is small. Results may not apply elsewhere.' };
  await fixture.self.onmessage({ data: { type: 'suggest', requestId: 9, brief, count: 4 } });
  assert.equal(calls.length, 4); assert.equal(resets, 4);
  for (let index = 0; index < calls.length; index++) {
    const request = calls[index];
    assert.equal(request.stream, true); assert.ok(request.max_tokens <= 256);
    assert.equal(request.messages.length, 2); assert.ok(request.messages[0].content.length < 350);
    const source = JSON.parse(request.messages[1].content);
    assert.equal(source.notes, brief.messagesText); assert.equal(source.earlierTitles.length, index);
    assert.equal(source.slide, `${index + 1}/4`);
  }
  assert.deepEqual([...new Set(fixture.messages.filter(m => m.type === 'writing').map(m => m.slide))], [1, 2, 3, 4]);
  assert.ok(fixture.messages.some(m => m.type === 'writing' && m.tokens > 0));
  assert.equal(ai.parseProposal(fixture.messages.at(-1).text).length, 4);
});

test('a mapAsync failure is classified for recovery and never returns a partial outline', async () => {
  const fixture = workerFixture({ resetChat: async () => {}, chat: { completions: { create: async () => {
    throw new Error("Failed to execute 'mapAsync' on 'GPUBuffer': Buffer was unmapped before mapping was resolved.");
  } } } });
  await fixture.self.onmessage({ data: { type: 'suggest', requestId: 3, brief: { purpose: '', audience: '', messagesText: 'Notes.' }, count: 3 } });
  assert.equal(fixture.messages.at(-1).type, 'error'); assert.equal(fixture.messages.at(-1).kind, 'gpu');
  assert.equal(fixture.messages.at(-1).requestId, 3);
  assert.equal(fixture.messages.some(m => m.type === 'proposal'), false);
});

test('loss of the actual runtime device reports once, and disposal interrupts and unloads', async () => {
  let lose, destroyed = 0, interrupted = 0, unloaded = 0;
  const device = { lost: new Promise(resolve => { lose = resolve; }), destroy() { destroyed++; }, addEventListener() {} };
  class GPUAdapter { async requestDevice() { return device; } }
  const fixture = workerFixture({ interruptGenerate: async () => { interrupted++; }, unload: async () => { unloaded++; } }, { GPUAdapter });
  fixture.run('watchDevices()'); await new GPUAdapter().requestDevice();
  lose({ reason: 'unknown', message: 'Simulated GPU reset' }); await Promise.resolve();
  fixture.run('fail(new Error("mapAsync failed"))');
  assert.equal(fixture.messages.filter(m => m.type === 'error').length, 1);
  assert.equal(fixture.messages[0].kind, 'gpu');
  await fixture.self.onmessage({ data: { type: 'dispose' } });
  assert.equal(interrupted, 1); assert.equal(unloaded, 1); assert.equal(destroyed, 1);
  assert.equal(fixture.messages.at(-1).type, 'disposed');
});

test('incomplete bounded output fails rather than offering truncated slides', async () => {
  const fixture = workerFixture({ resetChat: async () => {}, chat: { completions: { create: async () => (async function* () {
    yield { choices: [{ delta: { content: '{"title":"Incomplete' }, finish_reason: 'length' }] };
  })() } } });
  await fixture.self.onmessage({ data: { type: 'suggest', brief: { purpose: '', audience: '', messagesText: 'Notes.' }, count: 3 } });
  assert.equal(fixture.messages.at(-1).type, 'error');
  assert.equal(fixture.messages.some(m => m.type === 'proposal'), false);
});

test('published service worker stays within this app navigation and the build contains all AI code', () => {
  const sw = readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.equal(sw,readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8'));
  assert.match(sw,/event.request.mode !== 'navigate'/);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.indexOf('<script id="ai-code">') < html.indexOf('<script id="interface-code">'));
  assert.equal(JSON.parse(html.match(/<script id="ai-worker" type="application\/json">([\s\S]*?)<\/script>/)[1]),readFileSync(new URL('../ai/model-worker.js',import.meta.url),'utf8'));
});
