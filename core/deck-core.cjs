/* Shared local deck engine. Generated into index.html by scripts/build.mjs. */
(function (root) {
  'use strict';
    const DEFAULT_LOGO = { src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNDQiIGhlaWdodD0iMTQ0IiB2aWV3Qm94PSIwIDAgMTQ0IDE0NCI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjE0MCIgaGVpZ2h0PSIxNDAiIHJ4PSIyNCIgZmlsbD0iI2VmZjhmNiIgc3Ryb2tlPSIjMTY3NTZjIiBzdHJva2Utd2lkdGg9IjMiLz48cmVjdCB4PSIzNSIgeT0iMzUiIHdpZHRoPSI2MyIgaGVpZ2h0PSI1MSIgcng9IjciIGZpbGw9IiNjNWU4ZTEiLz48cmVjdCB4PSI0NiIgeT0iNDYiIHdpZHRoPSI2MyIgaGVpZ2h0PSI1MSIgcng9IjciIGZpbGw9IiMxNjc1NmMiLz48cGF0aCBkPSJNNTkgNjBoMzdNNTkgNzFoMjhNNTkgODJoMzIiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48dGV4dCB4PSI3MiIgeT0iMTIyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwsc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzE1NTM0ZCI+SEQ8L3RleHQ+PC9zdmc+', alt: 'Hands on Deck placeholder logo' };
    const isEmbeddedImage = value => typeof value === 'string' && (value === DEFAULT_LOGO.src || /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value));
    function deckLogo(deck) {
      if (deck.logo === null) return null;
      const logo = deck.logo === undefined ? DEFAULT_LOGO : deck.logo;
      return logo && isEmbeddedImage(logo.src) ? { src: logo.src, alt: String(logo.alt || 'Presentation logo') } : null;
    }
    function slidePageNumber(slides, index) {
      if (!slides[index] || ['title', 'cover'].includes(slides[index].kind)) return null;
      return slides.slice(0, index + 1).filter(slide => !['title', 'cover'].includes(slide.kind)).length;
    }
    function embedEditorProject(template, project) {
      const marker = /^[ \t]*<script id="saved-project" type="application\/json">[\s\S]*?<\/script>/m;
      if (!marker.test(template)) throw new Error('The offline editor template is missing.');
      const json = JSON.stringify(project).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
      return template.replace(marker, () => '<script id="saved-project" type="application/json">' + json + '<\/script>');
    }
    function organiseFreeText(text) {
      const source = String(text).replace(/\r\n?/g, '\n').trim();
      if (source.length > 20000) throw new Error('Keep free text to 20,000 characters or fewer.');
      if (!source) return [];
      const groups = [];
      const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'sentence' }) : null;
      source.split(/\n\s*\n/).forEach(paragraph => {
        const sentences = paragraph.split('\n').flatMap(line => {
          const clean = line.replace(/^\s*[-*•]\s+/, '').trim();
          if (!clean) return [];
          return segmenter ? [...segmenter.segment(clean)].map(part => part.segment.trim()).filter(Boolean) : [clean];
        });
        for (let start = 0; start < sentences.length; start += 4) {
          const points = sentences.slice(start, start + 4);
          const heading = points[0].length <= 110 ? points[0].replace(/[.!?]+$/, '') : `Notes ${groups.length + 1}`;
          groups.push({ heading, points });
        }
      });
      return groups;
    }
    const uid = () => 'id-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
    const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
    function parseMessageGroups(text) {
      const groups = [];
      let current = null;
      text.split(/\r?\n/).forEach(raw => {
        const line = raw.trim();
        if (!line) return;
        const bullet = line.match(/^[-*•]\s+(.+)$/);
        if (bullet) {
          if (!current) { current = { heading: 'Supporting points', points: [] }; groups.push(current); }
          current.points.push(bullet[1].trim());
        } else {
          current = { heading: line, points: [] };
          groups.push(current);
        }
      });
      return groups;
    }

    function distribute(items, bucketCount) {
      const count = Math.max(1, Math.min(bucketCount, Math.max(1, items.length)));
      const buckets = Array.from({ length: count }, () => []);
      items.forEach((item, index) => buckets[Math.min(count - 1, Math.floor(index * count / items.length))].push(item));
      return buckets;
    }

    function newBlock(type) {
      const id = uid();
      const templates = {
        paragraph: { id, type, text: 'Add a short explanation.' },
        bullets: { id, type, items: ['First supporting point', 'Second supporting point'] },
        quote: { id, type, quote: 'Add a concise quotation.', attribution: 'Source or speaker' },
        callout: { id, type, label: 'Key point', text: 'Add the message that deserves emphasis.' },
        stat: { id, type, value: '42%', label: 'Explain what this value means and why it matters.' },
        columns: { id, type, columns: [{ title: 'First idea', text: 'Add supporting detail.' }, { title: 'Second idea', text: 'Add supporting detail.' }] },
        cards: { id, type, items: [{ title: 'One', text: 'Add detail.' }, { title: 'Two', text: 'Add detail.' }, { title: 'Three', text: 'Add detail.' }] },
        chart: { id, type, items: [{ label: 'Option A', value: 72 }, { label: 'Option B', value: 54 }, { label: 'Option C', value: 38 }] },
        table: { id, type, headers: ['Option', 'Benefit', 'Constraint'], rows: [['A', 'Add benefit', 'Add constraint'], ['B', 'Add benefit', 'Add constraint']] },
        image: { id, type, src: '', alt: '', caption: 'Add a caption or source note.' },
        divider: { id, type, label: 'New section' }
      };
      return clone(templates[type] || templates.paragraph);
    }

    function buildSlides(brief, groups) {
      const autoCount = Math.min(6, Math.max(3, groups.length + 2));
      const requested = brief.count === 'auto' ? autoCount : Number(brief.count);
      const contentSlots = Math.max(1, requested - 2);
      const buckets = distribute(groups, contentSlots);
      const slides = [];

      slides.push({
        id: uid(), kind: 'title', eyebrow: 'Decision brief',
        title: brief.purpose || 'Untitled presentation',
        blocks: brief.audience ? [{ id: uid(), type: 'paragraph', text: `Prepared for ${brief.audience}` }] : []
      });

      buckets.forEach((bucket, bucketIndex) => {
        if (!bucket.length) return;
        if (bucket.length === 1) {
          const group = bucket[0];
          const blocks = group.points.length
            ? [{ id: uid(), type: 'bullets', items: group.points.slice() }]
            : [];
          slides.push({ id: uid(), kind: 'content', eyebrow: `Message ${bucketIndex + 1}`, title: group.heading, blocks });
        } else {
          slides.push({
            id: uid(), kind: 'content', eyebrow: `Messages ${bucketIndex + 1}`, title: 'Key messages',
            blocks: [{ id: uid(), type: bucket.length === 2 ? 'columns' : 'cards',
              ...(bucket.length === 2
                ? { columns: bucket.map(group => ({ title: group.heading, text: group.points.join(' · ') })) }
                : { items: bucket.map(group => ({ title: group.heading, text: group.points.join(' · ') })) })
            }]
          });
        }
      });

      const decisionBrief = /\b(approve|approval|decision|recommend|endorse|authorise|authorize|fund)\b/i.test(brief.purpose);
      slides.push({
        id: uid(), kind: 'statement', eyebrow: decisionBrief ? 'Decision required' : 'Next step',
        title: decisionBrief ? 'The decision we need' : 'Agree what happens next',
        blocks: [{ id: uid(), type: 'callout', label: decisionBrief ? 'Proposed ask' : 'Action', text: brief.purpose || 'Confirm the owner, timing and next action.' }]
      });

      return {
        slides: slides.slice(0, requested),
        metadata: { requested, grouped: Math.max(0, groups.length - contentSlots), underfilled: Math.max(0, requested - slides.length) }
      };
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    }
    function blockToHtml(block) {
      if (block.type === 'paragraph') return `<div class="block paragraph"><p>${escapeHtml(block.text)}</p></div>`;
      if (block.type === 'bullets') return `<div class="block bullets"><ul>${block.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;
      if (block.type === 'callout') return `<div class="block callout"><div class="label">${escapeHtml(block.label)}</div><div>${escapeHtml(block.text)}</div></div>`;
      if (block.type === 'quote') return `<blockquote class="block quote"><div>${escapeHtml(block.quote)}</div><footer>${escapeHtml(block.attribution)}</footer></blockquote>`;
      if (block.type === 'stat') return `<div class="block stat"><div class="stat-value">${escapeHtml(block.value)}</div><div class="stat-label">${escapeHtml(block.label)}</div></div>`;
      if (block.type === 'columns') return `<div class="block columns">${block.columns.map(item => `<div class="column"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></div>`).join('')}</div>`;
      if (block.type === 'cards') return `<div class="block cards">${block.items.map(item => `<div class="card"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></div>`).join('')}</div>`;
      if (block.type === 'chart') {
        const max = Math.max(1, ...block.items.map(item => Number(item.value) || 0));
        return `<div class="block chart">${block.items.map(item => `<div class="chart-row"><span>${escapeHtml(item.label)}</span><i><b style="width:${Math.max(3, Math.min(100, (Number(item.value) || 0) / max * 100))}%"></b></i><strong>${escapeHtml(item.value)}</strong></div>`).join('')}</div>`;
      }
      if (block.type === 'table') return `<table class="block table"><thead><tr>${block.headers.map(item => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map(item => `<td>${escapeHtml(item)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      if (block.type === 'image') return `<div class="block image">${block.src ? `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}">` : '<div class="image-empty">Image not supplied</div>'}<div><p>${escapeHtml(block.caption)}</p><small>${escapeHtml(block.alt)}</small></div></div>`;
      return `<div class="block divider"><span>${escapeHtml(block.label)}</span></div>`;
    }

    function renderDeckHtml(deck) {
      const title = deck.slides[0]?.title || 'Generated deck';
      const logo = deckLogo(deck);
      const slides = deck.slides.map((slide, index) => {
        const pageNumber = slidePageNumber(deck.slides, index);
        return `<section class="slide kind-${slide.kind}${index === 0 ? ' active' : ''}" aria-label="Slide ${index + 1} of ${deck.slides.length}">${logo ? `<img class="slide-logo" src="${escapeHtml(logo.src)}" alt="${escapeHtml(logo.alt)}">` : ''}<div class="eyebrow">${escapeHtml(slide.eyebrow)}</div><div class="content"><h1>${escapeHtml(slide.title)}</h1><div class="blocks">${slide.blocks.map(blockToHtml).join('')}</div></div>${pageNumber === null ? '' : `<div class="number" aria-label="Page ${pageNumber}">${pageNumber}</div>`}</section>`;
      }).join('');
      return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';script-src 'unsafe-inline';img-src data:;font-src 'none';connect-src 'none';object-src 'none';base-uri 'none';form-action 'none'"><title>${escapeHtml(title)}</title><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#e7e9ee;font-family:Arial,Helvetica,sans-serif}.deck{width:100%;height:100%}.slide{--x:7.2%;position:absolute;inset:0;display:none;overflow:hidden;color:#17243a;background:#fff}.slide.active{display:block}.slide:after{content:"";position:absolute;right:0;bottom:0;width:14%;height:.6vh;background:#13aab0}.eyebrow{position:absolute;top:6%;left:var(--x);color:#007880;font-size:min(1.02vw,1.82vh);font-weight:900;letter-spacing:.14em;text-transform:uppercase}.content{position:absolute;top:13%;right:var(--x);bottom:8.5%;left:var(--x);display:flex;flex-direction:column;justify-content:center;gap:2.4vh;transform-origin:center left}.content h1{max-width:91%;margin:0;font-size:min(4.5vw,8vh);line-height:1.03;letter-spacing:-.037em;overflow-wrap:anywhere;text-wrap:balance}.blocks{display:grid;gap:1.6vh;max-width:94%;font-size:min(1.72vw,3.06vh);line-height:1.34}.block{min-width:0;color:#394b62}.block p{margin:0}.bullets ul{margin:0;padding-left:1.15em}.bullets li{margin:.28em 0}.callout{padding:.72em .9em;border-left:.28em solid #13aab0;background:#ecf8f7}.label{margin-bottom:.22em;color:#007880;font-size:.66em;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.quote{max-width:86%;margin:0;padding:.15em 0 .15em 1em;border-left:.18em solid #b9a7d7;color:#4a2a77;font-size:1.14em;font-weight:700}.quote footer{margin-top:.4em;color:#737687;font-size:.65em}.stat{display:flex;align-items:baseline;gap:.75em}.stat-value{color:#32165c;font-size:2.3em;font-weight:900;line-height:.95;letter-spacing:-.05em}.stat-label{max-width:22em;font-size:.82em}.columns,.cards{display:grid;gap:.72em}.columns{grid-template-columns:repeat(2,minmax(0,1fr))}.cards{grid-template-columns:repeat(3,minmax(0,1fr))}.column,.card{padding:.72em .78em;background:#f5f7fa}.column{border-top:.18em solid #13aab0}.card{border:1px solid #d9dee7;border-radius:.45em;background:#fff}.column strong,.card strong{display:block;margin-bottom:.32em;color:#17243a;font-size:.86em}.column span,.card span{display:block;color:#536378;font-size:.72em}.chart{display:grid;gap:.42em}.chart-row{display:grid;grid-template-columns:minmax(4.8em,.8fr) minmax(8em,3fr) 3.2em;gap:.55em;align-items:center;font-size:.72em}.chart-row i{height:.74em;overflow:hidden;border-radius:999px;background:#e8ebf0}.chart-row b{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#008f96,#4e71d7)}.chart-row strong{text-align:right;color:#4a2a77}.table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.68em}.table th,.table td{border:1px solid #cfd5df;padding:.45em .52em}.table th{background:#edf4f5;text-align:left}.image{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(7em,.55fr);gap:.75em;align-items:center}.image img{width:100%;max-height:10.5em;object-fit:contain;border-radius:.45em;background:#f0f1f4}.image p{font-size:.67em}.image small{font-size:.55em;color:#7b8190}.image-empty{min-height:7em;display:grid;place-items:center;border:1px dashed #adb4c0;border-radius:.45em}.divider{display:flex;align-items:center;gap:.65em;color:#707687;font-size:.68em;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.divider:before,.divider:after{content:"";flex:1;height:1px;background:#cfd5df}.slide-logo{position:absolute;right:4%;top:3%;width:8%;height:12%;object-fit:contain;object-position:right top}.eyebrow{max-width:70%}.number{position:absolute;right:4%;bottom:4%;color:#718199;font-size:min(1.15vw,2.04vh);font-weight:800}.kind-title,.kind-cover{color:#24113f;background:linear-gradient(114deg,transparent 0 70%,rgba(19,170,176,.13) 70% 71%,transparent 71%),linear-gradient(135deg,#fff 0 64%,#f0ecf8 64% 82%,#e1f6f4 82%)}.kind-title:after,.kind-cover:after{width:24%;height:.8vh}.kind-title h1,.kind-cover h1{max-width:82%}.kind-statement{border-left:min(1.1vw,1.96vh) solid #008f96}.kind-statement h1{max-width:78%}.style-operational .slide{--x:6.2%;border-top:1.2vh solid #00a699;background:#f8fbfd}.style-operational .slide:before{content:"OPERATIONAL BRIEF";position:absolute;top:4%;right:14%;color:#65768a;font-size:min(.86vw,1.53vh);font-weight:900;letter-spacing:.12em}.style-operational .content{top:14%;justify-content:flex-start}.style-operational .eyebrow{top:7%}.style-operational .kind-title,.style-operational .kind-cover{background:#f0fbfa}.style-minimal .slide{--x:8.4%;color:#111;background:#fff}.style-minimal .slide:after{left:0;right:auto;width:100%;height:2px;background:#111}.style-minimal .eyebrow{color:#111}.style-minimal .kind-title,.style-minimal .kind-cover{color:#111;background:#fff}.style-minimal .kind-statement{border-left-color:#111}.controls{position:fixed;left:50%;bottom:2.2vh;z-index:20;display:flex;align-items:center;gap:10px;transform:translateX(-50%);padding:8px 10px;border:1px solid rgba(255,255,255,.2);border-radius:999px;color:#fff;background:rgba(24,16,38,.9);box-shadow:0 10px 30px rgba(0,0,0,.25)}button{min-width:42px;min-height:34px;border:1px solid #6b6079;border-radius:999px;color:#fff;background:#32165c;font:700 15px Arial;cursor:pointer}button:disabled{opacity:.4}.count{min-width:70px;text-align:center;font-size:13px;font-weight:700}@media print{@page{size:13.333in 7.5in;margin:0}html,body{width:auto;height:auto;overflow:visible;background:#fff}.deck{height:auto}.slide,.slide.active{position:relative;display:block;width:13.333in;height:7.5in;page-break-after:always}.controls{display:none}}@media(max-aspect-ratio:16/9){.deck{position:absolute;top:50%;height:56.25vw;transform:translateY(-50%)}}@media(min-aspect-ratio:16/9){.deck{position:absolute;left:50%;width:177.7778vh;transform:translateX(-50%)}}
</style></head><body class="style-${deck.style}"><main class="deck">${slides}</main><nav class="controls" aria-label="Slide navigation"><button id="prev" type="button" aria-label="Previous slide">←</button><span class="count" id="count">1 / ${deck.slides.length}</span><button id="next" type="button" aria-label="Next slide">→</button></nav><script>'use strict';const slides=[...document.querySelectorAll('.slide')];let current=0;const prev=document.getElementById('prev'),next=document.getElementById('next'),count=document.getElementById('count');function fit(slide){const content=slide.querySelector('.content');if(!content)return;content.style.transform='';content.style.width='';let low=.42,high=1,best=1;const fits=()=>content.scrollHeight<=content.clientHeight+1&&content.scrollWidth<=content.clientWidth+1;if(!fits()){for(let i=0;i<12;i++){const value=(low+high)/2;content.style.transform='scale('+value+')';content.style.width=(100/value)+'%';if(fits()){best=value;low=value}else high=value}content.style.transform='scale('+best+')';content.style.width=(100/best)+'%'}}function show(index){current=Math.max(0,Math.min(index,slides.length-1));slides.forEach((slide,i)=>slide.classList.toggle('active',i===current));count.textContent=(current+1)+' / '+slides.length;prev.disabled=current===0;next.disabled=current===slides.length-1;requestAnimationFrame(()=>fit(slides[current]))}prev.onclick=()=>show(current-1);next.onclick=()=>show(current+1);document.addEventListener('keydown',event=>{if(['ArrowRight','PageDown',' '].includes(event.key)){event.preventDefault();show(current+1)}if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();show(current-1)}if(event.key==='Home')show(0);if(event.key==='End')show(slides.length-1)});window.addEventListener('resize',()=>slides.forEach(fit));show(0);<\/script></body></html>`;
    }


    function parseSavedProject(source) {
      if (typeof source !== 'string' || source.length > 10 * 1024 * 1024) throw new Error('Choose a project no larger than 10 MiB.');
      let json = source.trim();
      if (json.startsWith('<')) {
        const match = source.match(/^\s*<script id="saved-project" type="application\/json">([\s\S]*?)<\/script>/m);
        if (!match) throw new Error('This is a presentation copy. Open an editable copy downloaded from Save & share.');
        json = match[1];
      }
      let value;
      try { value = JSON.parse(json); } catch { throw new Error('This file does not contain a readable Hands on Deck project.'); }
      return normaliseProject(value);
    }

    function normaliseProject(value) {
      const fail = () => { throw new Error('This project contains unsupported or damaged slide data.'); };
      const obj = v => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(); return v; };
      const str = (v, max = 10000) => { if (typeof v !== 'string' || v.length > max) fail(); return v; };
      const list = (v, max = 100) => { if (!Array.isArray(v) || v.length > max) fail(); return v; };
      const styles = ['executive', 'operational', 'minimal'];
      const kinds = ['title', 'cover', 'content', 'statement'];
      obj(value);
      if (value.version !== 1 || !styles.includes(value.style)) fail();
      const detail = v => ({ title: str(obj(v).title), text: str(v.text) });
      const blocks = v => list(v, 30).map(raw => {
        obj(raw);
        const b = { id: uid(), type: raw.type };
        if (b.type === 'paragraph') b.text = str(raw.text);
        else if (b.type === 'bullets') b.items = list(raw.items).map(v => str(v));
        else if (b.type === 'callout') { b.label = str(raw.label); b.text = str(raw.text); }
        else if (b.type === 'quote') { b.quote = str(raw.quote); b.attribution = str(raw.attribution); }
        else if (b.type === 'stat') { b.value = str(raw.value); b.label = str(raw.label); }
        else if (b.type === 'columns') b.columns = list(raw.columns).map(detail);
        else if (b.type === 'cards') b.items = list(raw.items).map(detail);
        else if (b.type === 'chart') b.items = list(raw.items).map(v => {
          obj(v); if (typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value < 0) fail();
          return { label: str(v.label), value: v.value };
        });
        else if (b.type === 'table') {
          b.headers = list(raw.headers, 12).map(v => str(v));
          if (!b.headers.length) fail();
          b.rows = list(raw.rows).map(row => { const cells = list(row, 12).map(v => str(v)); if (cells.length !== b.headers.length) fail(); return cells; });
        } else if (b.type === 'image') {
          b.src = str(raw.src, 8 * 1024 * 1024); b.alt = str(raw.alt); b.caption = str(raw.caption);
          if (b.src && !/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(b.src)) fail();
        } else if (b.type === 'divider') b.label = str(raw.label);
        else fail();
        return b;
      });
      const slides = list(value.slides).map(raw => {
        obj(raw); if (!kinds.includes(raw.kind)) fail();
        return { id: uid(), kind: raw.kind, title: str(raw.title), eyebrow: str(raw.eyebrow), blocks: blocks(raw.blocks) };
      });
      let logo = clone(DEFAULT_LOGO);
      if (value.logo === null) logo = null;
      else if (value.logo !== undefined) { obj(value.logo); const src = str(value.logo.src, 1500000); if (!isEmbeddedImage(src)) fail(); logo = { src, alt: str(value.logo.alt ?? '') }; }
      const brief = obj(value.brief || {});
      const inputMode = brief.inputMode === 'free' ? 'free' : 'structured';
      const metadata = {};
      for (const key of ['requested', 'grouped', 'underfilled']) metadata[key] = Number.isFinite(value.metadata?.[key]) ? Math.max(0, value.metadata[key]) : 0;
      return { version: 1, slides, logo, style: value.style, current: Math.max(0, Math.min(Number.isInteger(value.current) ? value.current : 0, slides.length - 1)), metadata,
        brief: { purpose: str(brief.purpose ?? ''), audience: str(brief.audience ?? ''), messagesText: str(brief.messagesText ?? '', inputMode === 'free' ? 20000 : 50000), inputMode,
          style: styles.includes(brief.style) ? brief.style : value.style, count: ['auto', '3', '4', '5', '6'].includes(String(brief.count)) ? String(brief.count) : 'auto' } };
    }

  const api = { uid, clone, parseMessageGroups, organiseFreeText, embedEditorProject, distribute, newBlock, buildSlides, escapeHtml, blockToHtml, renderDeckHtml, DEFAULT_LOGO, isEmbeddedImage, deckLogo, slidePageNumber, parseSavedProject, normaliseProject };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DeckCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
