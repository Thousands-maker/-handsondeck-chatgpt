'use strict';

const flow = { page: 'welcome', step: 0, highest: 0, presenting: false, fileDirty: false, recoveryTimer: 0, recoveryEnabled: true, recoveryFailed: false, recoveryBlocked: false, reviewDone: false, example: false };
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
  byId('guide-notes-help').textContent = free ? 'Use a new paragraph for each main idea. Your sentences are kept as written; Standard mode does not rewrite or fact-check them.' : 'Write a headline, then supporting points on separate lines starting with a hyphen. Leave a blank line before the next headline.';
  byId('guide-notes').placeholder = free ? 'What is happening? Why does it matter? What should happen next?' : 'The main point\n- A supporting fact\n- Another detail\n\nThe next point\n- Its supporting detail';
  byId('guide-char-count').textContent = `${byId('guide-notes').value.length.toLocaleString()} / ${(free ? 20000 : 50000).toLocaleString()} characters`;
}

function updateJourney() {
  const hasSlides = !!state.slides.length;
  const active = { guide: 'open-brief', editor: 'nav-edit', review: 'open-checks', offline: 'open-offline' }[flow.page];
  for (const id of ['open-brief', 'nav-edit', 'open-checks', 'open-offline']) {
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
}

function showPage(page, focus = true) {
  if (flow.page === 'guide' && page !== 'guide') syncBriefFromGuide();
  if (['editor', 'review', 'offline'].includes(page) && !state.slides.length) page = 'guide';
  if (flow.presenting) stopPresenting();
  if (byId('drawer-dialog').open) byId('drawer-dialog').close();
  closeElementMenu();
  flow.page = page;
  for (const id of ['welcome', 'guide', 'review', 'ai', 'offline']) byId(id + '-page').classList.toggle('hidden', id !== page);
  document.querySelector('.app-shell').classList.toggle('hidden', page !== 'editor');
  updateJourney();
  if (page === 'guide') { syncGuideFromBrief(); renderGuide(); }
  if (page === 'review') renderReviewPage();
  if (page === 'offline') refreshDownloadInfo();
  if (page === 'ai' && typeof aiRefresh === 'function') { aiRefresh(); if (!byId('ai-notes').value) aiCopyBrief(); }
  if (page === 'editor') scheduleFit();
  if (focus) {
    const heading = { welcome: 'welcome-title', guide: `guide-title-${flow.step}`, review: 'review-title', ai: 'ai-title', offline: 'offline-title', editor: 'editor-heading' }[page];
    byId(heading)?.focus({ preventScroll: true });
  }
}

function openGuide() { syncGuideFromBrief(); flow.step = 0; showPage('guide'); }
function openDirectBrief() {
  if (flow.page === 'guide') syncBriefFromGuide();
  if (state.slides.length) showPage('editor');
  openDrawer('brief');
  byId('purpose').focus();
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
      row.append(make('span', 'outline-number', String(i + 1).padStart(2, '0')), copy); list.appendChild(row);
    }
    byId('outline-note').textContent = `${plan.slides.length} suggested slides. ${plan.metadata.grouped ? 'Some messages are grouped to fit your chosen length. ' : ''}All wording can be edited after building.${state.slides.length ? ' Building again replaces the current slides; download a copy first to keep them.' : ''}`;
  } catch (error) { byId('outline-note').textContent = error.message; }
}

function renderReviewPage() {
  renderChecks();
  const warnings = state.warnings;
  byId('review-result').textContent = warnings.length ? `${warnings.length} suggestion${warnings.length === 1 ? '' : 's'} to look at` : 'No basic content issues found';
  const list = byId('review-warnings'); list.replaceChildren();
  if (!warnings.length) list.appendChild(make('p', '', 'Now check the facts and how each slide reads. Automated checks cannot judge your story or verify evidence.'));
  warnings.forEach(item => {
    const node = make(Number.isInteger(item.slide) ? 'button' : 'div', 'review-warning', item.text);
    if (Number.isInteger(item.slide)) { node.type = 'button'; node.appendChild(make('small', '', `Edit slide ${item.slide + 1} →`)); node.addEventListener('click', () => { selectSlide(item.slide); showPage('editor'); }); }
    list.appendChild(node);
  });
  flow.reviewDone = true;
}

function refreshDownloadInfo() {
  const blob = editorDownloadBlob();
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
  flow.example = false; flow.reviewDone = false; flow.highest = 0; flow.step = 0;
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
  flow.fileDirty = true; flow.reviewDone = false;
  flow.undo = null; byId('undo-delete').hidden = true;
  byId('editor-heading').textContent = flow.example ? 'A fictional example. Make it yours.' : 'Your first draft is ready.';
  byId('editor-guidance').textContent = 'Click text to edit it. Use Add element for visuals, then review the story before saving.';
  document.querySelectorAll('.review-check input').forEach(node => { node.checked = false; });
  showPage('editor'); queueRecovery();
}

function startPresenting() {
  if (!state.slides.length) return;
  showPage('editor'); flow.presenting = true; document.body.classList.add('is-presenting'); renderPreview();
  byId('exit-present').focus();
}
function stopPresenting() { flow.presenting = false; document.body.classList.remove('is-presenting'); renderPreview(); }

function offerUndo(action, message) { flow.undo = action; byId('undo-delete').hidden = false; toast(message); }
byId('undo-delete').addEventListener('click', () => { if (!flow.undo) return; flow.undo(); flow.undo = null; byId('undo-delete').hidden = true; markEdited(); renderAll(); toast('Deletion undone.'); });

byId('home').addEventListener('click', () => showPage('welcome'));
byId('start-guided').addEventListener('click', openGuide);
byId('start-direct').addEventListener('click', openDirectBrief);
byId('guide-to-direct').addEventListener('click', openDirectBrief);
byId('direct-to-guide').addEventListener('click', () => { byId('drawer-dialog').close(); openGuide(); });
byId('nav-edit').addEventListener('click', () => showPage('editor'));
byId('resume-deck').addEventListener('click', () => showPage('editor'));
byId('open-help').addEventListener('click', () => byId('help-dialog').showModal());
byId('close-help').addEventListener('click', () => byId('help-dialog').close());
byId('open-ai').addEventListener('click', () => showPage('ai'));
byId('ai-standard').addEventListener('click', () => showPage(state.slides.length ? 'editor' : 'welcome'));
byId('coach-review').addEventListener('click', () => showPage('review'));
byId('review-back').addEventListener('click', () => showPage('editor'));
byId('review-save').addEventListener('click', () => showPage('offline'));
byId('review-present').addEventListener('click', startPresenting);
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
    showPage(project.slides.length ? 'editor' : 'guide'); saveRecovery();
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
  byId('guide-engine-help').textContent = byId('guide-engine').value === 'ai' ? 'Local AI needs a one-time model download, starting at 283.1 MiB. You will choose and confirm the download before it starts. Your notes stay on this device.' : 'Standard splits and arranges the sentences you supplied. It does not summarise, rewrite or infer a storyline.';
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
showPage(restored ? (state.slides.length ? 'editor' : 'guide') : 'welcome', false);
if (restored) toast('Welcome back. Your saved work is ready.');
