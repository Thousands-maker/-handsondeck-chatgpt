import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const core = await readFile(new URL('core/deck-core.cjs', root), 'utf8');
let html = await readFile(new URL('index.html', root), 'utf8');
const marker = /<script id="deck-core">[\s\S]*?<\/script>/;
if (!marker.test(html)) throw new Error('Missing inline deck engine.');
html = html.replace(marker, () => '<script id="deck-core">\n' + core + '  </script>');
const interfaceCss = await readFile(new URL('ui/interface.css', root), 'utf8');
const interfaceHtml = await readFile(new URL('ui/interface.html', root), 'utf8');
const interfaceJs = await readFile(new URL('ui/interface.js', root), 'utf8');
for (const marker of ['<style id="interface-style">', '<!-- interface:start -->', '<!-- interface:end -->', '<script id="interface-code">']) {
  if (!html.includes(marker)) throw new Error('Missing interface build marker: ' + marker);
}
html = html.replace(/<style id="interface-style">[\s\S]*?<\/style>/, () => '<style id="interface-style">\n' + interfaceCss + '</style>');
html = html.replace(/<!-- interface:start -->[\s\S]*?<!-- interface:end -->/, () => '<!-- interface:start -->\n' + interfaceHtml + '<!-- interface:end -->');
html = html.replace(/<script id="interface-code">[\s\S]*?<\/script>/, () => '<script id="interface-code">\n' + interfaceJs + '</script>');
const aiCore = await readFile(new URL('ai/ai-core.cjs', root), 'utf8');
const aiUi = await readFile(new URL('ui/supercharged.js', root), 'utf8');
const models = await readFile(new URL('ai/models.json', root), 'utf8');
const worker = await readFile(new URL('ai/model-worker.js', root), 'utf8');
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');
html = html.replace(/<script id="ai-models" type="application\/json">[\s\S]*?<\/script>/, () => '<script id="ai-models" type="application/json">' + safeJson(JSON.parse(models)) + '</script>');
html = html.replace(/<script id="ai-worker" type="application\/json">[\s\S]*?<\/script>/, () => '<script id="ai-worker" type="application/json">' + safeJson(worker) + '</script>');
html = html.replace(/<script id="ai-code">[\s\S]*?<\/script>/, () => '<script id="ai-code">\n' + aiCore + '\n' + aiUi + '</script>');
await writeFile(new URL('index.html', root), html);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
await writeFile(new URL('dist/sw.js', root), await readFile(new URL('sw.js', root)));
console.log('Built the standalone offline editor.');
