'use strict';

const flow = { page: 'welcome', step: 0, highest: 0, editView: 'slides', presenting: false, fileDirty: false, recoveryTimer: 0, recoveryEnabled: true, recoveryFailed: false, recoveryBlocked: false, example: false };
const RECOVERY_KEY = 'hands-on-deck-recovery-v1';
const RECOVERY_SETTING = 'hands-on-deck-recovery-enabled';
const examples = {
  decision: { purpose: 'Approve a four-week trial of online room booking.', audience: 'Office team leads', style: 'executive', count: '4', inputMode: 'structured', messagesText: 'Booking a room takes too many messages\n- Staff currently email the office team to check availability\n- Double bookings interrupt meetings\n\nTest one shared booking calendar\n- Start with two meeting rooms for four weeks\n- Keep the current process available during the trial\n\nDecide whether to continue\n- Track booking errors and time spent arranging meetings\n- Review staff feedback before expanding' },
  update: { purpose: 'Understand progress on the website refresh and agree the next steps.', audience: 'Project team', style: 'operational', count: '4', inputMode: 'structured', messagesText: 'The first design review is complete\n- The team reviewed the homepage and contact page\n- Feedback has been added to the shared task list\n\nContent needs a final check\n- Two service descriptions still need an owner\n- The launch date depends on content approval\n\nFinish content before the next review\n- Assign owners for the remaining descriptions\n- Bring the revised pages to the next weekly meeting' },
  workshop: { purpose: 'Agree one practical improvement to the team handover.', audience: 'Team members', style: 'minimal', count: '4', inputMode: 'structured', messagesText: 'Start with the handover today\n- Where does useful information get lost?\n- Share one recent example\n\nChoose the most important problem\n- Compare the impact of each issue\n- Pick one change the team can try this week\n\nMake a small commitment\n- Name an owner for the experiment\n- Agree when to check whether it helped' }
};

function putBrief(brief) {
  byId('purpose').value = brief.purpose || '';
  byId('audience').value = brief.audience || '';
  byId('messages').value = brief.messagesText || brief.messages || '';
  byId('input-mode').value = brief.inputMode || 'free';
  byId('brief-style').value = brief.style || 'executive';
  byId('count').value = String(brief.count || 'auto');
  updateInputMode();
}

function syncGuideFromBrief() {
  const brief = getBrief();
  byId('guide-purpose').value = brief.purpose;
  byId('guide-audience').value = brief.audience;
  byId('guide-notes').value = brief.messagesText;
  byId('guide-mode').value = brief.inputMode;
  byId('guide-count').value = String(brief.count);
  document.querySelectorAll('[name="guide-style"]').forEach(node => { node.checked = node.value === brief.style; });
  updateGuideMode();
}

function syncBriefFromGuide() {
  putBrief({ purpose: byId('guide-purpose').value, audience: byId('guide-audience').value, messagesText: byId('guide-notes').value, inputMode: byId('guide-mode').value,
    style: document.querySelector('[name="guide-style"]:checked')?.value || 'executive', count: byId('guide-count').value });
}

function updateGuideMode() {
  const free = byId('guide-mode').value === 'free';
  byId('guide-notes').maxLength = free ? 20000 : 50000;
  byId('guide-notes-help').textContent = free ? 'Write naturally, including uncertainties. Standard separates clear ideas and keeps your wording as supporting content. The preview below shows what it found.' : 'Write a headline, then supporting points on separate lines starting with a hyphen. Leave a blank line before the next headline.';
  byId('guide-notes').placeholder = free ? 'What is happening? Why does it matter? What should happen next?' : 'The main point\n- A supporting fact\n- Another detail\n\nThe next point\n- Its supporting detail';
  byId('guide-char-count').textContent = `${byId('guide-notes').value.length.toLocaleString()} / ${(free ? 20000 : 50000).toLocaleString()} characters`;
  renderGuideIdeas();
}

function renderGuideIdeas() {
  const text = byId('guide-notes').value;
  const mode = byId('guide-mode').value;
  const key = mode + '\n' + text;
  if (flow.ideaPreviewKey === key) return;
  flow.ideaPreviewKey = key;
  const list = byId('guide-idea-list'); list.replaceChildren();
  byId('guide-ideas').hidden = !text.trim();
  const followups = byId('guide-followups'); followups.replaceChildren();
  if (!text.trim()) return;
  let groups;
  try { groups = mode === 'free' ? DeckCore.organiseFreeText(text) : parseMessageGroups(text); }
  catch (error) { byId('guide-ideas-count').textContent = error.message; return; }
  byId('guide-ideas-count').textContent = `${groups.length} main point${groups.length === 1 ? '' : 's'}`;
  const labels = { context: 'Context', roles: 'Responsibilities', risk: 'Risk or uncertainty', proposal: 'Proposed approach', impact: 'Impact or evidence', action: 'Next step' };
  groups.slice(0, 12).forEach((group, index) => {
    const row = make('li'), copy = make('div');
    if (group.kind) copy.appendChild(make('span', 'section-index', labels[group.kind]));
    copy.appendChild(make('strong', '', group.heading));
    const points = make('ul', 'outline-points');
    group.points.forEach(point => points.appendChild(make('li', '', point)));
    copy.appendChild(points); row.append(make('span', 'outline-number', String(index + 1).padStart(2, '0')), copy); list.appendChild(row);
  });
  if (groups.length > 12) list.appendChild(make('li', 'field-help', `${groups.length - 12} more points will be included when building. Choose the final slide count in the next step.`));
  DeckCore.briefQuestions(text).forEach((question, index) => {
    const wrap = make('div', 'form-field guide-followup');
    const id = `followup-${index}`, label = make('label', '', question.title);
    label.setAttribute('for', id);
    const prompt = make('p', 'field-help', question.prompt); prompt.id = `${id}-prompt`;
    const input = make('textarea'); input.id = id; input.rows = 2; input.maxLength = 2000; input.placeholder = question.placeholder; input.setAttribute('aria-describedby', prompt.id);
    const add = make('button', 'btn btn-quiet btn-small', 'Add this detail to my notes'); add.type = 'button';
    add.addEventListener('click', () => addGuideDetail(input.value, input));
    wrap.append(label, prompt, input, add); followups.appendChild(wrap);
  });
}

function addGuideDetail(value, input) {
  const detail = value.trim();
  if (!detail) { toast('Add a detail first, or leave this optional question unanswered.'); input?.focus(); return; }
  const notes = byId('guide-notes');
  const addition = byId('guide-mode').value === 'structured' ? '\n- ' + detail.replace(/\n+/g, '\n- ') : '\n\n' + detail;
  if (notes.value.length + addition.length > notes.maxLength) { toast('These notes have reached the character limit. Shorten them before adding more.', true); return; }
  notes.value = notes.value.trimEnd() + addition;
  updateGuideMode(); syncBriefFromGuide(); queueRecovery();
  toast('Detail added to your notes and outline.'); notes.focus();
}

function updateJourney() {
  const hasSlides = !!state.slides.length;
  const active = { brief: 'open-brief', guide: 'open-brief', editor: 'nav-edit', offline: 'open-offline' }[flow.page];
  for (const id of ['open-brief', 'nav-edit', 'open-offline']) {
    const node = byId(id);
    if (id === active) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current');
    node.disabled = id !== 'open-brief' && !hasSlides;
  }
  byId('present').hidden = !hasSlides || flow.page !== 'editor';
  byId('download').hidden = !hasSlides;
  byId('resume-card').hidden = !hasSlides;
  byId('resume-description').textContent = `${state.slides.length} slides · ${state.slides[0]?.title || 'Untitled deck'}`;
  byId('download-presentation').disabled = !hasSlides;
  byId('download-project').disabled = !hasSlides;
  byId('brief-rebuild').hidden = !hasSlides;
  byId('generate').textContent = hasSlides ? 'Rebuild from this brief' : 'Build my first deck →';
}

function showPage(page, focus = true) {
  if (flow.page === 'guide' && page !== 'guide') syncBriefFromGuide();
  if (['editor', 'offline'].includes(page) && !state.slides.length) page = 'guide';
  if (flow.presenting) stopPresenting();
  if (byId('drawer-dialog').open) byId('drawer-dialog').close();
  closeElementMenu();
  flow.page = page;
  for (const id of ['welcome', 'brief', 'guide', 'ai', 'offline']) byId(id + '-page').classList.toggle('hidden', id !== page);
  document.querySelector('.app-shell').classList.toggle('hidden', page !== 'editor');
  updateJourney();
  if (page === 'guide') { syncGuideFromBrief(); renderGuide(); }
  if (page === 'offline') refreshDownloadInfo();
  if (page === 'ai' && typeof aiRefresh === 'function') {
    aiRefresh();
    if (!byId('ai-notes').value && !aiState.busy) aiCopyBrief();
    if (aiState.request) aiShowProgress();
  }
  if (page === 'editor') { setEditView(flow.editView); scheduleFit(); }
  if (focus) {
    const heading = { welcome: 'welcome-title', brief: 'brief-title', guide: `guide-title-${flow.step}`, ai: 'ai-title', offline: 'offline-title', editor: 'editor-heading' }[page];
    byId(heading)?.focus({ preventScroll: true });
  }
}

function openGuide() { syncGuideFromBrief(); flow.step = 0; showPage('guide'); }
function openDirectBrief() {
  showPage('brief');
  byId('purpose').focus();
}

function setEditView(view) {
  flow.editView = view === 'outline' ? 'outline' : 'slides';
  const outline = flow.editView === 'outline' && !flow.presenting;
  byId('story-outline').hidden = !outline;
  byId('stage-shell').hidden = outline;
  byId('stage-footer').hidden = outline;
  document.querySelector('.editor-toolbar').hidden = outline;
  document.querySelector('.app-shell').classList.toggle('outline-mode', outline);
  byId('view-slides').setAttribute('aria-pressed', String(!outline));
  byId('view-outline').setAttribute('aria-pressed', String(outline));
  if (outline) renderStoryOutline(); else renderPreview();
}

function renderStoryOutline() {
  if (flow.editView !== 'outline') return;
  const list = byId('story-list'); list.replaceChildren();
  state.slides.forEach((slide, index) => {
    const row = make('li', 'story-card');
    const head = make('div', 'story-card-head');
    head.appendChild(make('span', 'section-index', `${String(index + 1).padStart(2, '0')} / ${slide.kind === 'title' || slide.kind === 'cover' ? 'Opening' : slide.kind === 'statement' ? 'Closing ask' : 'Key message'}`));
    const actions = make('div', 'story-actions');
    const action = (label, text, handler, disabled = false) => {
      const button = make('button', 'btn btn-quiet btn-small', text); button.type = 'button'; button.disabled = disabled;
      button.setAttribute('aria-label', `${label} slide ${index + 1}`);
      button.addEventListener('click', () => { selectSlide(index); handler(); }); actions.appendChild(button);
    };
    action('Move up', '↑', () => moveSlide(-1), index === 0);
    action('Move down', '↓', () => moveSlide(1), index === state.slides.length - 1);
    action('Remove', 'Remove', deleteSlide, state.slides.length === 1);
    action('Preview', 'View slide →', () => setEditView('slides'));
    head.appendChild(actions); row.appendChild(head);
    let fieldNumber = 0;
    const field = (label, value, change, multiline = true) => {
      const wrap = make('div', 'story-field'), id = `outline-${index}-${fieldNumber++}`;
      const name = make('label', '', label); name.setAttribute('for', id);
      const input = make(multiline ? 'textarea' : 'input'); input.id = id; input.value = value; input.maxLength = 10000;
      if (multiline) input.rows = Math.min(7, Math.max(2, value.split('\n').length));
      input.addEventListener('input', () => { change(input.value); markEdited(); scheduleSecondaryRenders(); });
      wrap.append(name, input); row.appendChild(wrap);
    };
    field('Headline', slide.title, value => { slide.title = value; }, false);
    slide.blocks.forEach(block => {
      if (block.type === 'bullets') field('Supporting points · one per line', block.items.join('\n'), value => { block.items = value.split('\n'); });
      else if (block.type === 'paragraph' || block.type === 'callout') field(block.type === 'callout' ? (block.label || 'Key point') : 'Supporting detail', block.text, value => { block.text = value; });
      else if (block.type === 'columns' || block.type === 'cards') (block.columns || block.items).forEach(item => {
        field('Message', item.title, value => { item.title = value; }, false);
        field('Supporting detail', item.text, value => { item.text = value; });
      });
      else row.appendChild(make('p', 'field-help', `${block.type[0].toUpperCase() + block.type.slice(1)} element: use View slide to edit this visual. It stays in your deck.`));
    });
    if (!slide.blocks.length) row.appendChild(make('p', 'field-help', 'No supporting content yet. Use View slide to add evidence or a clear ask.'));
    list.appendChild(row);
  });
}

function showSourceBrief() {
  const brief = getBrief();
  byId('source-purpose').textContent = brief.purpose || 'Not supplied';
  byId('source-audience').textContent = brief.audience || 'Not supplied';
  byId('source-notes').textContent = brief.messagesText || 'No source notes were supplied.';
  openDrawer('source');
}

function validGuideStep(step) {
  byId('guide-error').hidden = true;
  for (const id of ['guide-purpose', 'guide-notes']) byId(id).removeAttribute('aria-invalid');
  let id, message;
  if (step === 0 && !byId('guide-purpose').value.trim()) { id = 'guide-purpose'; message = 'Add the outcome you want, such as “Approve a four-week pilot”.'; }
  if (step === 1) {
    const notes = byId('guide-notes').value.trim();
    if (!notes) { id = 'guide-notes'; message = 'Add at least one point or a short paragraph for your slides.'; }
    else if (notes.length > byId('guide-notes').maxLength) { id = 'guide-notes'; message = 'Shorten your notes to fit the character limit before continuing.'; }
  }
  if (!message) return true;
  byId('guide-error').textContent = message;
  byId('guide-error').hidden = false;
  byId(id).setAttribute('aria-invalid', 'true'); byId(id).focus();
  return false;
}

function moveGuide(next) {
  if (next > flow.step && !validGuideStep(flow.step)) return;
  syncBriefFromGuide();
  if (next === 3 && byId('guide-engine').value === 'ai') { openAIFromBrief(true); return; }
  flow.step = Math.max(0, Math.min(3, next)); flow.highest = Math.max(flow.highest, flow.step);
  renderGuide();
  byId(`guide-title-${flow.step}`).focus({ preventScroll: true });
  byId('guide-page').scrollTop = 0;
  queueRecovery();
}

function renderGuide() {
  byId('guide-page').setAttribute('aria-labelledby', `guide-title-${flow.step}`);
  document.querySelectorAll('[data-guide-panel]').forEach(node => { node.hidden = Number(node.dataset.guidePanel) !== flow.step; });
  document.querySelectorAll('[data-guide-step]').forEach(node => {
    const step = Number(node.dataset.guideStep);
    node.disabled = step > flow.highest + 1;
    node.classList.toggle('completed', step < flow.step);
    if (step === flow.step) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current');
  });
  byId('guide-back').textContent = flow.step === 0 ? 'Back to start' : '← Back';
  byId('guide-next').textContent = ['Next: your content →', 'Next: your style →', byId('guide-engine').value === 'ai' ? 'Suggest my outline →' : 'Preview arranged wording →', 'Build my deck →'][flow.step];
  byId('guide-error').hidden = true;
  if (flow.step === 3) renderOutline();
}

function planFromBrief() {
  const brief = getBrief();
  const groups = brief.inputMode === 'free' ? DeckCore.organiseFreeText(brief.messagesText) : parseMessageGroups(brief.messagesText);
  return { ...buildSlides(brief, groups), style: brief.style };
}

function renderOutline() {
  const summary = byId('guide-summary'); summary.replaceChildren();
  const brief = getBrief();
  for (const [label, value] of [['Outcome', brief.purpose], ['Audience', brief.audience || 'Not specified'], ['Style', brief.style]]) summary.append(make('dt', '', label), make('dd', '', value));
  const list = byId('guide-outline'); list.replaceChildren();
  try {
    const plan = planFromBrief();
    for (const [i, slide] of plan.slides.entries()) {
      const row = make('li'), copy = make('div');
      copy.append(make('strong', '', slide.title), make('p', '', `${slide.kind === 'title' ? 'Opening' : slide.kind === 'statement' ? 'Closing' : 'Content'} · ${slide.blocks.length} content element${slide.blocks.length === 1 ? '' : 's'}`));
      const points = make('ul', 'outline-points');
      slide.blocks.forEach(block => {
        const values = block.type === 'bullets' ? block.items : block.type === 'columns' || block.type === 'cards' ? (block.columns || block.items).map(item => item.title + (item.text ? ' — ' + item.text : '')) : [blockPlainText(block)];
        values.filter(Boolean).forEach(value => points.appendChild(make('li', '', value)));
      });
      copy.appendChild(points);
      row.append(make('span', 'outline-number', String(i + 1).padStart(2, '0')), copy); list.appendChild(row);
    }
    byId('outline-note').textContent = `${plan.slides.length} suggested slides. ${plan.metadata.grouped ? 'Some messages are grouped to fit your chosen length. ' : ''}All wording can be edited after building.${state.slides.length ? ' Building again replaces the current slides; download a copy first to keep them.' : ''}`;
  } catch (error) { byId('outline-note').textContent = error.message; }
}

function refreshDownloadInfo() {
  const blob = editorDownloadBlob();
  const presentation = new Blob([exportHtml()], { type: 'text/html;charset=utf-8' });
  byId('presentation-download-size').textContent = formatBytes(presentation.size);
  byId('download-presentation').disabled = !state.slides.length || presentation.size > MAX_EDITOR_BYTES;
  renderChecks();
  byId('export-deck-summary').textContent = `${state.slides.length} slides · ${state.slides[0]?.title || 'Your presentation'}`;
  byId('export-check-summary').textContent = state.warnings.length ? `${state.warnings.length} optional suggestion${state.warnings.length === 1 ? '' : 's'}. You can still download now.` : 'Choose a presentation to share or an editable copy for later changes.';
  byId('export-suggestions').hidden = !state.warnings.length;
  byId('download-receipt').hidden = true;
  byId('editor-download-size').textContent = formatBytes(blob.size);
  byId('download-editor').disabled = blob.size > MAX_EDITOR_BYTES;
  byId('download-status').textContent = blob.size > MAX_EDITOR_BYTES ? 'This copy exceeds 10 MiB. Reduce or remove large images, then try again.' : 'Contains the editor, your slides, images and logo. Download only starts when you choose the button.';
  byId('download-checksum').textContent = '';
  byId('recovery-toggle').checked = flow.recoveryEnabled;
}

function queueRecovery() {
  clearTimeout(flow.recoveryTimer);
  flow.fileDirty = true;
  if (flow.recoveryBlocked) { byId('save-state').textContent = 'Another tab has a newer draft — save a file'; return; }
  if (!flow.recoveryEnabled) { byId('save-state').textContent = 'Not saved · download an editable copy'; return; }
  byId('save-state').textContent = 'Saving a browser recovery copy…';
  flow.recoveryTimer = setTimeout(saveRecovery, 500);
}

function saveRecovery() {
  if (!flow.recoveryEnabled || flow.recoveryBlocked) return;
  try {
    if (flow.page === 'guide') syncBriefFromGuide();
    const snapshot = editorSnapshot();
    if (!snapshot.slides.length && !snapshot.brief.purpose && !snapshot.brief.messagesText) return;
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(snapshot));
    flow.recoveryFailed = false;
    byId('save-state').textContent = 'Recovery saved in this browser';
    byId('recovery-note').textContent = 'Recovery is on for this browser. Download an editable file before changing devices or clearing browser data.';
  } catch {
    flow.recoveryFailed = true;
    byId('save-state').textContent = 'Recovery unavailable · download your work';
    byId('recovery-note').textContent = 'Browser recovery is unavailable or full. Download an editable copy to keep your work.';
  }
}

function applyProject(project) {
  flow.undo = null; byId('undo-delete').hidden = true;
  state.slides = project.slides; state.logo = project.logo; state.style = project.style;
  state.current = project.current; state.metadata = project.metadata; state.dirty = !!project.slides.length; state.selectedBlockId = null;
  putBrief(project.brief); byId('style-select').value = state.style;
  flow.example = false; flow.highest = 0; flow.step = 0;
  syncGuideFromBrief(); renderAll(); updateJourney();
}

function allowReplacement() {
  return !(state.slides.length || getBrief().messagesText) || window.confirm('Replace the current deck and brief? Download an editable copy first if you want to keep them.');
}

function loadExample(key) {
  if (!allowReplacement()) return;
  putBrief(examples[key]); flow.example = true; state.dirty = false;
  generateDeck(true);
  toast('Fictional example loaded. Click any text to make it yours.');
}

function afterBuild() {
  flow.fileDirty = true;
  flow.undo = null; byId('undo-delete').hidden = true;
  byId('editor-heading').textContent = flow.example ? 'A fictional example. Make it yours.' : 'Your first draft is ready.';
  byId('editor-guidance').textContent = 'Switch to Outline to refine the argument. Slides and downloads use the same content.';
  flow.editView = 'slides';
  showPage('editor'); queueRecovery();
}

function startPresenting() {
  if (!state.slides.length) return;
  showPage('editor'); flow.presenting = true; document.body.classList.add('is-presenting'); setEditView(flow.editView);
  byId('exit-present').focus();
}
function stopPresenting() { flow.presenting = false; document.body.classList.remove('is-presenting'); setEditView(flow.editView); }

function offerUndo(action, message) { flow.undo = action; byId('undo-delete').hidden = false; toast(message); }
byId('undo-delete').addEventListener('click', () => { if (!flow.undo) return; flow.undo(); flow.undo = null; byId('undo-delete').hidden = true; markEdited(); renderAll(); toast('Deletion undone.'); });

byId('home').addEventListener('click', () => showPage('welcome'));
byId('start-guided').addEventListener('click', openGuide);
byId('start-direct').addEventListener('click', openDirectBrief);
byId('guide-to-direct').addEventListener('click', openDirectBrief);
byId('direct-to-guide').addEventListener('click', () => { byId('drawer-dialog').close(); openGuide(); });
byId('brief-keep-editing').addEventListener('click', () => showPage('editor'));
byId('view-slides').addEventListener('click', () => setEditView('slides'));
byId('view-outline').addEventListener('click', () => setEditView('outline'));
byId('open-source').addEventListener('click', showSourceBrief);
byId('export-suggestions').addEventListener('click', () => openDrawer('checks'));
byId('download-return').addEventListener('click', () => showPage('editor'));
byId('nav-edit').addEventListener('click', () => showPage('editor'));
byId('resume-deck').addEventListener('click', () => showPage('editor'));
byId('open-help').addEventListener('click', () => byId('help-dialog').showModal());
byId('close-help').addEventListener('click', () => byId('help-dialog').close());
byId('open-ai').addEventListener('click', () => showPage('ai'));
byId('ai-standard').addEventListener('click', () => showPage(state.slides.length ? 'editor' : 'welcome'));
byId('exit-present').addEventListener('click', () => { stopPresenting(); byId('present').focus(); });
byId('download-presentation').addEventListener('click', downloadDeck);
byId('download-project').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(editorSnapshot(), null, 2)], { type: 'application/json' });
  if (blob.size > MAX_EDITOR_BYTES) { toast('This project exceeds 10 MiB. Reduce large images first.', true); return; }
  saveBlob(blob, 'hands-on-deck-project.json'); flow.fileDirty = false;
  toast('Project download started. Use Open a saved deck to import it later.');
});
byId('open-project').addEventListener('click', () => byId('project-input').click());
byId('project-input').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  if (file.size > MAX_EDITOR_BYTES) { toast('Choose a file no larger than 10 MiB.', true); return; }
  try {
    const project = DeckCore.parseSavedProject(await file.text());
    if (!allowReplacement()) return;
    applyProject(project); flow.fileDirty = false;
    showPage(project.slides.length ? 'editor' : 'brief'); saveRecovery();
    toast('Your editable deck is open. Nothing was uploaded.');
  } catch (error) { toast(error.message || 'This file could not be opened.', true); }
});

document.querySelectorAll('[data-example]').forEach(node => node.addEventListener('click', () => loadExample(node.dataset.example)));
document.querySelectorAll('[data-goal]').forEach(node => node.addEventListener('click', () => { const input = byId('guide-purpose'); if (!input.value.trim() || window.confirm('Replace the outcome you have written with this starter?')) input.value = node.dataset.goal; input.focus(); syncBriefFromGuide(); queueRecovery(); }));
document.querySelectorAll('[data-guide-step]').forEach(node => node.addEventListener('click', () => moveGuide(Number(node.dataset.guideStep))));
byId('guide-back').addEventListener('click', () => flow.step ? moveGuide(flow.step - 1) : showPage('welcome'));
byId('guide-next').addEventListener('click', () => {
  if (!validGuideStep(flow.step)) return;
  if (flow.step < 3) { moveGuide(flow.step + 1); return; }
  syncBriefFromGuide();
  if (!getBrief().purpose || !getBrief().messagesText) { moveGuide(!getBrief().purpose ? 0 : 1); validGuideStep(flow.step); return; }
  flow.example = false; generateDeck(false);
});
byId('guide-mode').addEventListener('change', () => { updateGuideMode(); syncBriefFromGuide(); queueRecovery(); });
byId('guide-engine').addEventListener('change', () => {
  byId('guide-engine-help').textContent = byId('guide-engine').value === 'ai' ? 'Local AI needs a one-time model download, starting at 283.1 MiB. You will choose and confirm the download before it starts. Your notes stay on this device.' : 'Standard separates clear ideas, keeps caveats and supporting details together, and suggests a structure. It uses local rules; it does not verify facts or invent missing details.';
  renderGuide();
});
byId('guide-example').addEventListener('click', () => {
  if (byId('guide-notes').value.trim() && !window.confirm('Replace these notes with a fictional example?')) return;
  byId('guide-notes').value = 'Room bookings currently rely on email. Double bookings interrupt meetings.\n\nWe propose testing a shared calendar for two rooms over four weeks. Keep the existing process available during the trial.\n\nTrack booking errors and gather staff feedback before expanding.';
  updateGuideMode(); syncBriefFromGuide(); queueRecovery();
});
byId('guide-page').addEventListener('input', () => { updateGuideMode(); syncBriefFromGuide(); queueRecovery(); });
byId('guide-count').addEventListener('change', () => { syncBriefFromGuide(); queueRecovery(); });
byId('brief-panel').addEventListener('input', queueRecovery);
byId('brief-panel').addEventListener('change', queueRecovery);
byId('recovery-toggle').addEventListener('change', event => {
  flow.recoveryEnabled = event.target.checked;
  let removed = true;
  try { localStorage.setItem(RECOVERY_SETTING, String(flow.recoveryEnabled)); if (!flow.recoveryEnabled) localStorage.removeItem(RECOVERY_KEY); }
  catch { flow.recoveryFailed = true; removed = false; }
  if (flow.recoveryEnabled) { flow.recoveryBlocked = false; saveRecovery(); }
  else { clearTimeout(flow.recoveryTimer); byId('save-state').textContent = 'Recovery off · download your work'; byId('recovery-note').textContent = removed ? 'The browser recovery copy has been removed. Your open deck is still here. Download an editable copy to keep it.' : 'Recovery is off, but its saved copy could not be removed. Clear this site’s browser data to remove it. Your open deck is still here.'; }
});
byId('copy-ai-prompt').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(byId('ai-prompt').value); toast('Prompt copied. Add your audience, outcome and notes in your AI app.'); }
  catch { byId('ai-prompt').focus(); byId('ai-prompt').select(); toast('Select and copy this prompt using your browser’s Copy command.'); }
});
window.addEventListener('storage', event => { if (event.key === RECOVERY_KEY && event.newValue) { flow.recoveryBlocked = true; clearTimeout(flow.recoveryTimer); byId('save-state').textContent = 'Another tab saved a draft · download this copy'; toast('Another tab saved a recovery copy. Download this deck before closing to keep both versions.', true); } });
window.addEventListener('beforeunload', event => { if (flow.fileDirty) saveRecovery(); if (flow.fileDirty && (!flow.recoveryEnabled || flow.recoveryFailed || flow.recoveryBlocked)) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && flow.fileDirty) saveRecovery(); });

// Capture the complete, still-unmodified page, including this inline workflow.
editorTemplate = '<!doctype html>\n' + document.documentElement.outerHTML;
putBrief({});
byId('guide-engine').value = 'standard';
try { flow.recoveryEnabled = localStorage.getItem(RECOVERY_SETTING) !== 'false'; } catch { flow.recoveryEnabled = false; flow.recoveryFailed = true; }
let restored = false;
try {
  const embedded = JSON.parse(byId('saved-project').textContent);
  if (embedded.version === 1) { applyProject(DeckCore.normaliseProject(embedded)); restored = true; }
  else if (flow.recoveryEnabled) {
    const saved = localStorage.getItem(RECOVERY_KEY);
    if (saved) { applyProject(DeckCore.parseSavedProject(saved)); restored = true; byId('save-state').textContent = 'Recovered from this browser'; }
  }
} catch { toast('The saved copy could not be restored. Open a downloaded editable file to recover your deck.', true); }
renderAll(); renderElementOptions();
showPage(restored ? (state.slides.length ? 'editor' : 'brief') : 'welcome', false);
if (restored) toast('Welcome back. Your saved work is ready.');
