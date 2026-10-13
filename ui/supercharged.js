'use strict';
const aiState = { manifest: null, model: null, busy: false, ready: false, worker: null, abort: null, proposal: null, source: null, timeout: 0, workerUrl: null, shellReady: false,
  policy: HandsAI.devicePolicy(navigator), limits: null, adapterChecked: false, request: null, sequence: 0, phase: 'idle', ticker: 0, release: null, fallbackPlan: null, refresh: 0 };
const AI_CACHE_PREFIX = 'hands-on-deck-chatgpt-model-';
function aiCatalogue() {
  return aiState.manifest ||= HandsAI.validateManifest(JSON.parse(byId('ai-models').textContent));
}
function aiSelected() { return aiCatalogue().models[aiState.policy.allowPro && byId('ai-model').value === '1' ? 1 : 0]; }
function aiDeviceOptions(limits) {
  aiState.policy = HandsAI.devicePolicy(navigator, limits);
  const previous = byId('ai-model').value;
  const options = aiCatalogue().models.slice(0, aiState.policy.allowPro ? 2 : 1).map((model, index) => {
    const option = make('option', '', `${model.label} · Qwen2.5 ${index ? '1.5B' : '0.5B'}`); option.value = String(index); return option;
  });
  byId('ai-model').replaceChildren(...options);
  byId('ai-model').value = aiState.policy.allowPro && previous === '1' ? '1' : '0';
  const reasons = {
    phone: 'This phone or tablet gets Qwen2.5 0.5B, our smaller model, to use less graphics memory. The larger model is available only on suitable computers.',
    memory: 'This device reports less than 8 GB of memory. You’ll get Qwen2.5 0.5B to reduce memory use.',
    unknown: 'We cannot confirm this is a laptop or desktop. You’ll get the smaller Qwen2.5 0.5B model.',
    graphics: 'You’ll get Qwen2.5 0.5B. The larger model stays unavailable unless this computer passes both graphics buffer checks.',
    desktop: 'Qwen2.5 0.5B is selected by default to use less memory. This computer passes both graphics buffer checks, so you can also choose 1.5B. Available graphics memory can still vary.'
  };
  byId('ai-device-note').textContent = aiState.policy.allowPro && byId('ai-model').value === '1'
    ? 'You’ve chosen Qwen2.5 1.5B. This laptop or desktop passes both graphics buffer checks. It uses more memory; the smaller 0.5B option is still available.'
    : reasons[aiState.policy.reason];
  byId('ai-pro-name').hidden = byId('ai-pro-description').hidden = !aiState.policy.allowPro;
}
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
  byId('ai-generation-cancel').hidden = !aiState.request;
  byId('ai-generate').textContent = aiState.request ? (aiState.phase === 'recovering' ? 'Restoring local AI…' : 'Writing your outline…') : 'Suggest my outline ↗';
  byId('ai-generate').setAttribute('aria-busy', String(!!aiState.request));
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
function aiClearTimers() { clearTimeout(aiState.timeout); clearInterval(aiState.ticker); aiState.timeout = aiState.ticker = 0; }
function aiReleaseWorker() {
  const worker = aiState.worker, url = aiState.workerUrl;
  aiState.worker = null; aiState.workerUrl = null;
  if (!worker) return aiState.release || Promise.resolve();
  const released = new Promise(resolve => {
    let finished = false, deadline;
    const finish = () => {
      if (finished) return; finished = true; clearTimeout(deadline);
      worker.terminate(); if (url) URL.revokeObjectURL(url); resolve();
    };
    worker.onmessage = event => { if (event.data.type === 'disposed') finish(); };
    worker.onerror = finish;
    deadline = setTimeout(finish, 1500);
    try { worker.postMessage({ type: 'dispose' }); } catch { finish(); }
  });
  aiState.release = released;
  released.then(() => { if (aiState.release === released) aiState.release = null; });
  return released;
}
function aiStop() {
  aiState.abort?.abort(); aiState.abort = null; aiState.request = null;
  aiClearTimers(); aiState.phase = 'idle';
  aiState.ready = false; aiState.busy = false; aiControls();
  return aiReleaseWorker();
}
function aiWriting(text, complete = false) {
  byId('ai-writing').hidden = false;
  byId('ai-writing-status').textContent = text;
  byId('ai-writing-progress').hidden = complete;
  aiStatus(text);
}
function aiShowProgress() {
  const request = aiState.request; if (!request) return;
  const elapsed = Math.floor((Date.now() - request.started) / 1000);
  const text = aiState.phase === 'recovering'
    ? 'Local AI stopped. Reloading the downloaded model once and trying your outline again…'
    : `Writing your outline… slide ${request.slide} of ${request.count}${request.tokens ? ' · drafting points' : ' · reading your notes'}`;
  aiWriting(`${text}${elapsed >= 5 ? ` · ${elapsed}s elapsed` : ''}`);
  byId('ai-writing-progress').max = request.count;
  byId('ai-writing-progress').value = aiState.phase === 'recovering' ? 0 : request.slide - 1;
}
function aiCancel() {
  aiStop(); aiWriting('Cancelled. Your notes and deck are safe. Load the model to try again, or continue in Standard.', true);
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
  if (aiState.request) {
    showPage('ai'); byId('ai-writing-status').focus({ preventScroll: true });
    byId('ai-writing').scrollIntoView?.({ block: 'nearest' }); return;
  }
  if (flow.page === 'guide') syncBriefFromGuide();
  aiCopyBrief(); showPage('ai');
  if (generateWhenReady && aiState.ready) aiSuggest();
  else byId(aiState.ready ? 'ai-generate' : 'ai-install').focus();
}
async function aiRefresh() {
  const refresh = ++aiState.refresh;
  if (!aiState.busy && !aiState.ready) {
    // The larger option is absent until the adapter has passed both checks.
    aiDeviceOptions(aiState.limits);
    if (!aiState.adapterChecked && aiState.policy.reason === 'graphics' && navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (refresh !== aiState.refresh || aiState.busy || aiState.ready) return;
        aiState.adapterChecked = true; aiState.limits = adapter?.limits;
        aiDeviceOptions(aiState.limits);
      } catch (error) { console.warn('Local AI adapter check:', error); }
    }
  }
  const model = aiSelected();
  byId('ai-download-size').textContent = `${(model.totalBytes / 1048576).toFixed(1)} MiB`;
  byId('ai-memory').textContent = `Allow about ${model.memoryMB / 1000} GB of graphics memory, plus browser overhead. A compatible WebGPU device is required.`;
  byId('ai-install').textContent = aiState.ready ? 'Model ready' : 'Download & enable ' + model.label;
  if (!aiState.busy && !aiState.ready) {
    if (globalThis.location?.protocol !== 'https:') aiStatus('Open the published HTTPS app to set up local AI. Downloaded HTML files still support all Standard editing tools.', true);
    else if (!navigator.gpu || !globalThis.caches || !navigator.serviceWorker) aiStatus('Local AI needs WebGPU, browser storage and service workers. Try a current desktop browser with graphics acceleration enabled. Standard editing is available here.', true);
    else {
      aiStatus('No model is running. Check the download size, then choose Download & enable.');
      try {
        const keys = await caches.keys();
        if (refresh !== aiState.refresh || aiState.busy || aiState.ready) return;
        if (keys.includes(aiCacheName(model))) {
          const cache = await caches.open(aiCacheName(model));
          const requests = new Set((await cache.keys()).map(request => request.url));
          if (refresh !== aiState.refresh || aiState.busy || aiState.ready) return;
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
  const released = aiStop(); aiState.busy = true; aiState.phase = 'loading'; aiControls();
  const controller = new AbortController(); aiState.abort = controller;
  const setupIssue = message => Object.assign(new Error(message), { publicMessage: message });
  try {
    await released;
    if (controller.signal.aborted) return;
    if (location.protocol !== 'https:' || !navigator.gpu || !globalThis.caches || !navigator.serviceWorker) throw setupIssue('Local AI requires the HTTPS app, WebGPU and browser storage. Use a compatible browser or continue in Standard.');
    aiStatus('Checking this device before any model download…');
    const adapter = await navigator.gpu.requestAdapter();
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (!adapter || !adapter.features.has('shader-f16')) throw setupIssue('This graphics device cannot run the local model. Standard editing still works.');
    aiState.limits = adapter.limits; aiState.adapterChecked = true;
    aiDeviceOptions(adapter.limits);
    const model = aiSelected(); aiState.model = model;
    byId('ai-download-size').textContent = `${(model.totalBytes / 1048576).toFixed(1)} MiB`;
    const estimate = await navigator.storage?.estimate?.();
    const cached = await caches.open(aiCacheName(model));
    const present = new Set((await cached.keys()).map(request => request.url));
    const needed = model.assets.filter(asset => !present.has(asset.url)).reduce((sum, asset) => sum + asset.bytes, 0);
    if (estimate?.quota && estimate.quota - estimate.usage < needed * 1.25) throw setupIssue('There is not enough browser storage. Free some space or remove the previous model, then retry.');
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
    console.warn('Local AI setup:', error);
    aiStatus(error.name === 'AbortError' ? 'Cancelled. Verified files are kept so you can resume, or choose Remove download.' : error.publicMessage || 'Model setup could not finish. Check your connection and available browser storage, then retry. Your notes are safe and Standard editing is available.', error.name !== 'AbortError');
  }
}
function aiBoot(model) {
  aiState.busy = true; aiState.ready = false; aiControls();
  const source = JSON.parse(byId('ai-worker').textContent);
  aiState.workerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(aiState.workerUrl, { type: 'module' }); aiState.worker = worker;
  aiState.timeout = setTimeout(() => { if (aiState.worker === worker) aiFailure('Model loading timed out.', 'runtime'); }, 180000);
  worker.onerror = event => { if (aiState.worker === worker) { event.preventDefault?.(); aiFailure(event.message || 'Worker failed.', 'runtime'); } };
  worker.onmessage = event => {
    if (aiState.worker !== worker) return;
    const data = event.data;
    if (data.type !== 'error' && data.requestId != null && data.requestId !== aiState.request?.id) return;
    if (data.type === 'progress') {
      if (aiState.request) aiShowProgress();
      else aiStatus(`Loading local AI · ${Math.round(Math.max(0, Math.min(1, Number(data.progress) || 0)) * 100)}%. Running a short device check before it is ready…`);
    }
    else if (data.type === 'ready') {
      clearTimeout(aiState.timeout); aiState.ready = true;
      if (aiState.request) { aiSendRequest(); return; }
      aiState.busy = false; aiState.phase = 'idle';
      aiStatus(`${model.label} is ready on this device. Add notes below and ask for an outline.`);
      byId('ai-install').textContent = 'Model ready'; aiControls();
    } else if (data.type === 'writing' && aiState.request) {
      aiState.request.slide = Math.min(aiState.request.count, Math.max(1, Number(data.slide) || 1));
      aiState.request.tokens = Number(data.tokens) || 0; aiShowProgress();
    } else if (data.type === 'proposal' && aiState.request) {
      try {
        const proposal = HandsAI.parseProposal(data.text);
        if (proposal.length !== aiState.request.count) throw new Error('Unexpected outline length.');
        aiState.proposal = proposal; aiState.request = null; aiState.busy = false; aiState.phase = 'idle';
        aiClearTimers(); aiRenderProposal(); aiWriting('Your suggested outline is ready to review. Your current deck is unchanged.', true); aiControls();
      } catch (error) { aiFailure(error, 'runtime'); }
    } else if (data.type === 'error') {
      aiFailure(data.detail || data.message, data.kind);
    }
  };
  worker.postMessage({ type: 'boot', model, cacheName: aiCacheName(model), settings: HandsAI.generationSettings(aiState.policy.compact) });
}
async function aiFailure(detail, kind) {
  console.warn('Local AI failure:', detail);
  const request = aiState.request;
  if (!request) {
    aiStop(); aiStatus('Local AI could not run on this device. Reload the downloaded model to try again, or use Standard. Your notes and deck are safe.', true); return;
  }
  // Detach the old worker immediately so error/loss races cannot start two retries.
  aiState.ready = false; aiClearTimers();
  const released = aiReleaseWorker();
  request.gpuFailure ||= kind === 'gpu' || /mapAsync|GPUBuffer|device.{0,12}lost|out.of.memory/i.test(String(detail?.message || detail));
  if (request.attempt >= 1) { aiFallback(request); return; }
  request.attempt++; aiState.phase = 'recovering'; aiState.busy = true;
  aiShowProgress(); aiState.ticker = setInterval(aiShowProgress, 1000); aiControls();
  await released;
  if (aiState.request !== request) return;
  try { aiBoot(aiState.model); }
  catch (error) { aiFailure(error, 'runtime'); }
}
function aiFallback(request) {
  if (aiState.request !== request) return;
  aiClearTimers(); aiState.request = null; aiState.busy = false; aiState.ready = false; aiState.phase = 'idle';
  // Use the same frozen source as the failed request, preserving all original wording.
  aiState.fallbackPlan = DeckCore.buildSlides(request.source, DeckCore.organiseFreeText(request.source.messagesText));
  aiState.proposal = aiState.fallbackPlan.slides.map(slide => ({ title: slide.title, points: slide.blocks.map(blockPlainText).filter(Boolean) }));
  aiRenderProposal(); aiControls();
  aiWriting(request.gpuFailure
    ? 'Your device ran out of graphics memory or reset its graphics connection, so I used the standard sorting instead. Your notes are safe. Review the outline below.'
    : 'Local AI could not finish after one retry, so I used the standard sorting instead. Your notes are safe. Review the outline below.', true);
}
function aiSendRequest() {
  const request = aiState.request; if (!request) return;
  aiState.phase = 'writing'; aiState.busy = true; request.slide = 1; request.tokens = 0;
  aiClearTimers(); aiShowProgress(); aiControls();
  aiState.ticker = setInterval(aiShowProgress, 1000);
  aiState.timeout = setTimeout(() => { if (aiState.request === request) aiFailure('Generation timed out.', 'runtime'); }, 240000);
  try { aiState.worker.postMessage({ type: 'suggest', requestId: request.id, brief: request.source, count: request.count }); }
  catch (error) { aiFailure(error, 'runtime'); }
}
function aiSuggest() {
  if (!aiState.ready || aiState.busy) return;
  const source = { purpose: byId('ai-purpose').value.trim(), audience: byId('ai-audience').value.trim(), messagesText: byId('ai-notes').value.trim(), inputMode: 'free', style: getBrief().style || 'executive', count: byId('ai-count').value };
  if (!source.messagesText) { aiWriting('Add notes before asking for an outline.', true); byId('ai-notes').focus(); return; }
  if (source.messagesText.length + source.purpose.length + source.audience.length > HandsAI.MAX_INPUT) { aiWriting(`Keep notes, outcome and audience within ${HandsAI.MAX_INPUT.toLocaleString()} characters. Nothing has been shortened automatically.`, true); return; }
  const count = Number(source.count);
  if (!Number.isInteger(count) || count < 3 || count > 6) return;
  aiState.source = Object.freeze(source); aiState.proposal = null; aiState.fallbackPlan = null; aiState.busy = true;
  aiState.request = { id: ++aiState.sequence, source: aiState.source, count, attempt: 0, slide: 1, tokens: 0, started: Date.now(), gpuFailure: false };
  byId('ai-result').hidden = true; aiControls();
  aiSendRequest();
  byId('ai-writing-status').focus({ preventScroll: true });
  byId('ai-writing').scrollIntoView?.({ block: 'nearest' });
}
function aiRenderProposal() {
  const list = byId('ai-outline'); list.replaceChildren();
  aiState.proposal.forEach((slide, index) => {
    const item = make('li'), copy = make('div'), points = make('p', '', slide.points.join(' • '));
    copy.append(make('strong', '', slide.title), points);
    item.append(make('span', 'outline-number', String(index + 1).padStart(2, '0')), copy); list.appendChild(item);
  });
  byId('ai-source-copy').textContent = aiState.source.messagesText;
  byId('ai-result-title').textContent = aiState.fallbackPlan ? 'Review your Standard outline.' : 'Review the suggested outline.';
  byId('ai-result').hidden = false;
}
function aiApply() {
  if (!aiState.proposal || aiState.busy || !allowReplacement()) return;
  const slides = aiState.fallbackPlan?.slides || aiState.proposal.map((slide, index, all) => ({ kind: index === 0 ? 'title' : index === all.length - 1 ? 'statement' : 'content', title: slide.title, eyebrow: '', blocks: [{ type: 'bullets', items: slide.points }] }));
  const project = DeckCore.normaliseProject({ version: 1, style: aiState.source.style, logo: state.logo, slides, brief: aiState.source });
  applyProject(project); afterBuild();
  byId('editor-heading').textContent = aiState.fallbackPlan ? 'Standard outline · ready to refine' : 'AI draft · ready for your judgement';
  byId('editor-guidance').textContent = 'Check every fact, number and caveat against your original notes. Click any text to refine it.';
  toast('Suggested outline applied. Your original notes are kept in the brief.');
}
async function aiRemove() {
  await aiStop();
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
byId('ai-cancel').addEventListener('click', aiCancel);
byId('ai-generation-cancel').addEventListener('click', aiCancel);
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
