'use strict';
const aiState = { manifest: null, model: null, busy: false, ready: false, worker: null, abort: null, proposal: null, source: null, timeout: 0, workerUrl: null, shellReady: false };
const AI_CACHE_PREFIX = 'hands-on-deck-chatgpt-model-';
function aiCatalogue() {
  return aiState.manifest ||= HandsAI.validateManifest(JSON.parse(byId('ai-models').textContent));
}
function aiSelected() { return aiCatalogue().models[Number(byId('ai-model').value) || 0]; }
function aiCacheName(model) { return AI_CACHE_PREFIX + aiCatalogue().version + '-' + model.id; }
function aiStatus(text, error = false) {
  byId('ai-status').textContent = text;
  byId('ai-status').classList.toggle('is-error', error);
}
function aiControls() {
  byId('ai-install').disabled = aiState.busy || aiState.ready;
  byId('ai-model').disabled = aiState.busy || aiState.ready;
  byId('ai-generate').disabled = aiState.busy || !aiState.ready;
  byId('ai-cancel').hidden = !aiState.busy;
  byId('ai-remove').disabled = aiState.busy;
  byId('ai-apply').disabled = aiState.busy || !aiState.proposal;
  byId('ai-use-brief').disabled = aiState.busy;
  byId('ai-example').disabled = aiState.busy;
  byId('ai-notes').disabled = aiState.busy;
  byId('ai-purpose').disabled = aiState.busy;
  byId('ai-audience').disabled = aiState.busy;
  byId('ai-count').disabled = aiState.busy;
  byId('ai-runtime-status').textContent = aiState.ready ? 'Local AI ready' : aiState.busy ? 'Setting up / working' : 'Standard · on this device';
}
function aiStop() {
  aiState.abort?.abort(); aiState.abort = null;
  aiState.worker?.terminate(); aiState.worker = null;
  if (aiState.workerUrl) URL.revokeObjectURL(aiState.workerUrl);
  aiState.workerUrl = null; clearTimeout(aiState.timeout);
  aiState.ready = false; aiState.busy = false; aiControls();
}
function aiInputCount() {
  const length = ['ai-notes', 'ai-purpose', 'ai-audience'].reduce((sum, id) => sum + byId(id).value.length, 0);
  byId('ai-input-count').textContent = `${length.toLocaleString()} / ${HandsAI.MAX_INPUT.toLocaleString()} characters across these fields`;
}
function aiCopyBrief() {
  const brief = getBrief();
  byId('ai-notes').value = brief.messagesText;
  byId('ai-purpose').value = brief.purpose;
  byId('ai-audience').value = brief.audience;
  byId('ai-count').value = brief.count === 'auto' ? '4' : String(brief.count);
  aiInputCount();
}
function openAIFromBrief(generateWhenReady = false) {
  if (flow.page === 'guide') syncBriefFromGuide();
  aiCopyBrief(); showPage('ai');
  if (generateWhenReady && aiState.ready) aiSuggest();
  else byId(aiState.ready ? 'ai-generate' : 'ai-install').focus();
}
async function aiRefresh() {
  const model = aiSelected();
  byId('ai-download-size').textContent = `${(model.totalBytes / 1048576).toFixed(1)} MiB`;
  byId('ai-memory').textContent = `Allow about ${model.memoryMB / 1000} GB of graphics memory, plus browser overhead. A compatible WebGPU device is required.`;
  byId('ai-install').textContent = 'Download & enable ' + model.label;
  if (!aiState.busy && !aiState.ready) {
    if (globalThis.location?.protocol !== 'https:') aiStatus('Open the published HTTPS app to set up local AI. Downloaded HTML files still support all Standard editing tools.', true);
    else if (!navigator.gpu || !globalThis.caches || !navigator.serviceWorker) aiStatus('Local AI needs WebGPU, browser storage and service workers. Try a current desktop browser with graphics acceleration enabled. Standard editing is available here.', true);
    else {
      aiStatus('No model is running. Check the download size, then choose Download & enable.');
      try {
        const keys = await caches.keys();
        if (keys.includes(aiCacheName(model))) {
          const cache = await caches.open(aiCacheName(model));
          const requests = new Set((await cache.keys()).map(request => request.url));
          const complete = model.assets.every(asset => requests.has(asset.url));
          byId('ai-install').textContent = complete ? 'Load downloaded model' : 'Resume download & enable';
          aiStatus(complete ? 'The model is downloaded. Load it to check your graphics device and start writing.' : 'A partial download is saved. Resume to reuse files that passed verification.');
        }
      } catch { aiStatus('Browser model storage is unavailable. Allow site storage or use Standard mode.', true); }
    }
  }
  aiControls();
}
async function aiPrepareShell() {
  const existing = await navigator.serviceWorker.getRegistration(new URL('./', location.href));
  const registration = existing?.active && existing.scope === new URL('./', location.href).href ? existing : await navigator.serviceWorker.register(new URL('sw.js', location.href), { scope: './' });
  await Promise.race([
    (async () => {
      const candidate = registration.installing || registration.waiting || registration.active;
      if (!candidate) throw new Error('The offline editor could not be installed.');
      if (candidate.state !== 'activated') await new Promise((resolve, reject) => {
        candidate.addEventListener('statechange', () => {
          if (candidate.state === 'activated') resolve();
          if (candidate.state === 'redundant') reject(new Error('Offline setup failed. Reconnect and retry.'));
        });
      });
      const ready = await new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => { channel.port1.close(); resolve(event.data.ready); };
        candidate.postMessage({ type: 'STATUS' }, [channel.port2]);
      });
      if (!ready) throw new Error('The editor was not cached. Reconnect and retry.');
    })(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Offline setup timed out. Check your connection and retry.')), 25000))
  ]);
  aiState.shellReady = true;
  byId('ai-offline-status').textContent = 'Editor saved for offline use at this address. Keep this browser’s site data.';
}
async function aiInstall() {
  if (aiState.busy) return;
  aiStop(); aiState.busy = true; aiControls();
  const controller = new AbortController(); aiState.abort = controller;
  const model = aiSelected(); aiState.model = model;
  try {
    if (location.protocol !== 'https:' || !navigator.gpu || !globalThis.caches || !navigator.serviceWorker) throw new Error('Local AI requires the HTTPS app, WebGPU and browser storage. Use a compatible desktop browser or continue in Standard.');
    aiStatus('Checking this device before any model download…');
    const adapter = await navigator.gpu.requestAdapter();
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (!adapter || !adapter.features.has('shader-f16')) throw new Error('This graphics device does not support the model’s WebGPU features. Try another device; Standard editing still works.');
    const estimate = await navigator.storage?.estimate?.();
    const cached = await caches.open(aiCacheName(model));
    const present = new Set((await cached.keys()).map(request => request.url));
    const needed = model.assets.filter(asset => !present.has(asset.url)).reduce((sum, asset) => sum + asset.bytes, 0);
    if (estimate?.quota && estimate.quota - estimate.usage < needed * 1.25) throw new Error('There is not enough browser storage. Free some space or remove the previous model, then retry.');
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    await aiPrepareShell();
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    // Keep at most one model. Changing models releases the previous download.
    for (const name of await caches.keys()) if (name.startsWith(AI_CACHE_PREFIX) && name !== aiCacheName(model)) await caches.delete(name);
    const cache = await caches.open(aiCacheName(model)); let completed = 0;
    byId('ai-progress').hidden = false; byId('ai-progress').max = model.totalBytes;
    for (const asset of model.assets) {
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const report = bytes => {
        byId('ai-progress').value = completed + bytes;
        aiStatus(`Preparing ${asset.name} · ${((completed + bytes) / 1048576).toFixed(1)} / ${(model.totalBytes / 1048576).toFixed(1)} MiB`);
      };
      let bytes;
      const saved = await cache.match(asset.url);
      if (saved) {
        try { bytes = await HandsAI.verify(await saved.arrayBuffer(), asset); }
        catch { await cache.delete(asset.url); }
      }
      if (!bytes) {
        bytes = await HandsAI.downloadAsset(asset, { signal: controller.signal, onProgress: report });
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        await cache.put(asset.url, new Response(bytes, { headers: { 'Content-Type': asset.role === 'runtime' ? 'text/javascript' : 'application/octet-stream' } }));
      }
      completed += asset.bytes; report(0);
    }
    aiState.abort = null;
    aiStatus('Download verified. Loading on your graphics device and running a short self-check…');
    aiBoot(model);
  } catch (error) {
    if (aiState.abort !== controller && controller.signal.aborted) return;
    aiStop();
    aiStatus(error.name === 'AbortError' ? 'Cancelled. Verified files are kept so you can resume, or choose Remove download.' : error.message || 'Model setup failed. Please retry.', error.name !== 'AbortError');
  }
}
function aiBoot(model) {
  const source = JSON.parse(byId('ai-worker').textContent);
  aiState.workerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(aiState.workerUrl, { type: 'module' }); aiState.worker = worker;
  aiState.timeout = setTimeout(() => { aiStop(); aiStatus('The device took too long to load the model. Try the smaller option or another graphics device.', true); }, 180000);
  worker.onerror = () => { aiStop(); aiStatus('The local AI worker could not start. Check browser graphics support and allow site storage, then retry.', true); };
  worker.onmessage = event => {
    const data = event.data;
    if (data.type === 'progress') aiStatus('Loading local AI · ' + data.text);
    else if (data.type === 'ready') {
      clearTimeout(aiState.timeout); aiState.ready = true; aiState.busy = false;
      aiStatus(`${model.label} is ready on this device. Add notes below and ask for an outline.`);
      byId('ai-install').textContent = 'Model ready'; aiControls();
    } else if (data.type === 'proposal') {
      clearTimeout(aiState.timeout); aiState.busy = false;
      try { aiState.proposal = HandsAI.parseProposal(data.text); aiRenderProposal(); aiStatus('Your suggested outline is ready to review. Your current deck is unchanged.'); }
      catch (error) { aiStatus(error.message, true); }
      aiControls();
    } else if (data.type === 'error') {
      aiStop(); aiStatus('Local AI stopped: ' + data.message + ' Your notes and deck are still here.', true);
    }
  };
  worker.postMessage({ type: 'boot', model, cacheName: aiCacheName(model) });
}
function aiSuggest() {
  if (!aiState.ready || aiState.busy) return;
  const source = { purpose: byId('ai-purpose').value.trim(), audience: byId('ai-audience').value.trim(), messagesText: byId('ai-notes').value.trim(), inputMode: 'free', style: getBrief().style || 'executive', count: byId('ai-count').value };
  if (!source.messagesText) { aiStatus('Add notes before asking for an outline.', true); byId('ai-notes').focus(); return; }
  if (source.messagesText.length + source.purpose.length + source.audience.length > HandsAI.MAX_INPUT) { aiStatus(`Keep notes, outcome and audience within ${HandsAI.MAX_INPUT.toLocaleString()} characters. Nothing has been shortened automatically.`, true); return; }
  aiState.source = source; aiState.proposal = null; aiState.busy = true;
  byId('ai-result').hidden = true; aiControls();
  aiStatus('Writing a local draft. This may take a few minutes; you can cancel.');
  aiState.timeout = setTimeout(() => { aiStop(); aiStatus('Generation timed out. Your notes are safe. Load the model again and try a shorter brief.', true); }, 240000);
  aiState.worker.postMessage({ type: 'suggest', brief: source, count: Number(source.count) });
}
function aiRenderProposal() {
  const list = byId('ai-outline'); list.replaceChildren();
  aiState.proposal.forEach((slide, index) => {
    const item = make('li'), copy = make('div'), points = make('p', '', slide.points.join(' • '));
    copy.append(make('strong', '', slide.title), points);
    item.append(make('span', 'outline-number', String(index + 1).padStart(2, '0')), copy); list.appendChild(item);
  });
  byId('ai-source-copy').textContent = aiState.source.messagesText;
  byId('ai-result').hidden = false;
}
function aiApply() {
  if (!aiState.proposal || aiState.busy || !allowReplacement()) return;
  const slides = aiState.proposal.map((slide, index, all) => ({ kind: index === 0 ? 'title' : index === all.length - 1 ? 'statement' : 'content', title: slide.title, eyebrow: '', blocks: [{ type: 'bullets', items: slide.points }] }));
  const project = DeckCore.normaliseProject({ version: 1, style: aiState.source.style, logo: state.logo, slides, brief: aiState.source });
  applyProject(project); afterBuild();
  byId('editor-heading').textContent = 'AI draft · ready for your judgement';
  byId('editor-guidance').textContent = 'Check every fact, number and caveat against your original notes. Click any text to refine it.';
  toast('Suggested outline applied. Your original notes are kept in the brief.');
}
async function aiRemove() {
  aiStop();
  try {
    for (const name of await caches.keys()) if (name.startsWith(AI_CACHE_PREFIX)) await caches.delete(name);
    aiStatus('Model files removed from this browser. Your deck and the offline editor are kept.');
    byId('ai-install').textContent = 'Download & enable ' + aiSelected().label;
    byId('ai-progress').hidden = true;
  } catch { aiStatus('The files could not be removed. Clear this site’s browser storage to remove the model.', true); }
}
byId('ai-install').addEventListener('click', aiInstall);
byId('direct-ai').addEventListener('click', () => openAIFromBrief(true));
byId('ai-model').addEventListener('change', aiRefresh);
byId('ai-cancel').addEventListener('click', () => { aiStop(); aiStatus('Cancelled. Your notes and deck are safe. Load the model to try again, or remove its files.'); });
byId('ai-remove').addEventListener('click', aiRemove);
byId('ai-generate').addEventListener('click', aiSuggest);
byId('ai-use-brief').addEventListener('click', aiCopyBrief);
byId('ai-apply').addEventListener('click', aiApply);
byId('ai-discard').addEventListener('click', () => { aiState.proposal = null; byId('ai-result').hidden = true; aiControls(); aiStatus('Suggestion discarded. Your original deck is unchanged.'); });
for (const id of ['ai-notes', 'ai-purpose', 'ai-audience']) byId(id).addEventListener('input', aiInputCount);
byId('ai-example').addEventListener('click', () => {
  if (byId('ai-notes').value && !window.confirm('Replace these AI notes with a fictional example?')) return;
  byId('ai-purpose').value = 'Decide whether to expand the pilot.';
  byId('ai-audience').value = 'Team leads';
  byId('ai-notes').value = 'Our two-room booking pilot ran for four weeks. Booking conflicts fell from eight in the previous month to two during the pilot. Staff liked seeing availability in one place. The trial was small, so the results may not apply to every team. Training for the reception team is still unfinished. We recommend completing training, then testing two more rooms before a wider rollout.';
  aiInputCount();
});
