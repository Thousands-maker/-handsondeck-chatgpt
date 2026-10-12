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
await writeFile(new URL('index.html', root), html);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
console.log('Built the standalone offline editor.');
