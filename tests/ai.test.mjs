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
  assert.match(messages.at(-1).message,/failed verification/);
  await assert.rejects(self.fetch('https://example.com/prompt'),/unapproved/);
  assert.equal(network,0); assert.equal(messages.some(message=>message.type==='ready'),false);
});

test('published service worker stays within this app navigation and the build contains all AI code', () => {
  const sw = readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.equal(sw,readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8'));
  assert.match(sw,/event.request.mode !== 'navigate'/);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.indexOf('<script id="ai-code">') < html.indexOf('<script id="interface-code">'));
  assert.equal(JSON.parse(html.match(/<script id="ai-worker" type="application\/json">([\s\S]*?)<\/script>/)[1]),readFileSync(new URL('../ai/model-worker.js',import.meta.url),'utf8'));
});
