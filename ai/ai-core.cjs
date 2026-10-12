/* Download and proposal boundaries shared by the browser and contract tests. */
(function (root) {
  'use strict';
  const MAX_INPUT = 2400;
  const MAX_DOWNLOAD = 1024 * 1024 * 1024;
  const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  async function verify(bytes, asset) {
    if (bytes.byteLength !== asset.bytes) throw new Error('The download is incomplete. Retry to resume verified files.');
    if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== asset.sha256) throw new Error('A file failed its security check. It was not installed. Refresh the online app, then retry.');
    return bytes;
  }
  function validateManifest(manifest) {
    if (!manifest || !Array.isArray(manifest.models) || manifest.models.length !== 2) throw new Error('The model catalogue is invalid.');
    for (const model of manifest.models) {
      const seen = new Set(); let sum = 0;
      if (!Array.isArray(model.assets) || !model.assets.length) throw new Error('Missing model files.');
      for (const asset of model.assets) {
        const url = new URL(asset.url);
        if (url.protocol !== 'https:' || !['cdn.jsdelivr.net', 'huggingface.co', 'raw.githubusercontent.com'].includes(url.hostname) || url.username || url.password || seen.has(asset.url)) throw new Error('Unapproved model source.');
        if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > 128 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('Invalid file limit or checksum.');
        seen.add(asset.url); sum += asset.bytes;
      }
      if (sum !== model.totalBytes || sum !== model.downloadLimit || sum > MAX_DOWNLOAD) throw new Error('The model exceeds its download limit.');
      if (model.assets.filter(a => a.role === 'runtime').length !== 1 || !seen.has(model.model_lib)) throw new Error('Missing runtime.');
    }
    return manifest;
  }
  async function downloadAsset(asset, { signal, onProgress = () => {}, fetcher = fetch } = {}) {
    const response = await fetcher(asset.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', mode: 'cors' });
    if (!response.ok || !response.body) throw new Error('Download unavailable. Check your internet connection and try again.');
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      while (true) {
        if (signal?.aborted) throw new DOMException('Download cancelled.', 'AbortError');
        const next = await reader.read(); if (next.done) break;
        size += next.value.byteLength;
        if (size > asset.bytes) throw new Error('A file exceeded the download limit. The download was stopped.');
        chunks.push(next.value); onProgress(size);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    await verify(bytes, asset); return bytes;
  }
  function parseProposal(raw) {
    if (typeof raw !== 'string' || raw.length > 16000) throw new Error('The model returned too much text. Try shorter notes.');
    let value;
    try { value = JSON.parse(raw.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '')); }
    catch { throw new Error('The model did not finish a usable outline. Shorten the notes and try again.'); }
    const clean = (text, max) => {
      if (typeof text !== 'string' || !text.trim() || text.length > max) throw new Error('The suggested outline has an invalid heading or point. Try again.');
      return text.trim();
    };
    if (!Array.isArray(value.slides) || value.slides.length < 3 || value.slides.length > 6) throw new Error('The model did not return 3–6 slides. Please try again.');
    return value.slides.map(slide => {
      if (!slide || !Array.isArray(slide.points) || slide.points.length < 1 || slide.points.length > 3) throw new Error('The model returned an incomplete slide. Please try again.');
      return { title: clean(slide.title, 180), points: slide.points.map(point => clean(point, 700)) };
    });
  }
  const api = { MAX_INPUT, MAX_DOWNLOAD, verify, validateManifest, downloadAsset, parseProposal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HandsAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
