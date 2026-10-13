import core from '../core/deck-core.cjs';

const styles = ['executive', 'operational', 'minimal'];
const kinds = ['title', 'cover', 'content', 'statement'];
const textSchema = { type: 'string', maxLength: 10000 };
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const listOf = (items, maxItems = 100) => ({ type: 'array', items, maxItems });
const objectOf = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const blockOf = (type, properties) => ({
  type: 'object', required: ['type', ...Object.keys(properties)], additionalProperties: false,
  properties: { id: textSchema, type: { const: type }, ...properties }
});
const detailSchema = objectOf({ title: textSchema, text: textSchema });
const imagePattern = '^data:image/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$';
const blockSchema = { oneOf: [
  blockOf('paragraph', { text: textSchema }),
  blockOf('bullets', { items: listOf(textSchema) }),
  blockOf('callout', { label: textSchema, text: textSchema }),
  blockOf('quote', { quote: textSchema, attribution: textSchema }),
  blockOf('stat', { value: textSchema, label: textSchema }),
  blockOf('columns', { columns: listOf(detailSchema) }),
  blockOf('cards', { items: listOf(detailSchema) }),
  blockOf('chart', { items: listOf(objectOf({ label: textSchema, value: { type: 'number', minimum: 0 } })) }),
  blockOf('table', { headers: { ...listOf(textSchema, 12), minItems: 1 }, rows: listOf(listOf(textSchema, 12)) }),
  blockOf('image', { src: { type: 'string', maxLength: 8 * 1024 * 1024, anyOf: [{ const: '' }, { pattern: imagePattern }] }, alt: textSchema, caption: textSchema }),
  blockOf('divider', { label: textSchema })
] };
const planSchema = {
  type: 'object', required: ['style', 'slides'],
  description: 'A complete deck supplied by the user, an AI model or an agent. You can author this directly; create_deck_plan is optional. Use source-backed content and mark gaps instead of inventing facts.',
  properties: {
    style: { enum: styles },
    logo: { description: 'Omit for the neutral placeholder, use null to remove it, or supply an embedded logo.', anyOf: [
      { type: 'null' },
      { type: 'object', required: ['src'], properties: {
        src: { type: 'string', maxLength: 1500000, anyOf: [{ pattern: imagePattern }, { const: core.DEFAULT_LOGO.src }] }, alt: textSchema
      } }
    ] },
    slides: { type: 'array', minItems: 1, maxItems: 100, items: {
      type: 'object', required: ['kind', 'title', 'eyebrow', 'blocks'],
      properties: { id: textSchema, kind: { enum: kinds, description: 'Title and cover are unnumbered; content and statement are numbered.' }, title: textSchema,
        eyebrow: { ...textSchema, description: 'Short section label; use an empty string when unnecessary.' }, blocks: listOf(blockSchema, 30) }
    } },
    metadata: { type: 'object', description: 'Optional generation metadata returned by create_deck_plan.' }
  }
};

export const tools = [
  {
    name: 'create_deck_plan', description: 'Optional rule-based starting plan from a brief. The connected AI model or agent can refine this JSON, or author a plan directly for review_deck and render_deck. This tool does not call a model or change the browser editor.',
    inputSchema: { type: 'object', required: ['purpose', 'messages'], additionalProperties: false, properties: {
      purpose: { ...textSchema, minLength: 1 }, audience: textSchema,
      messages: { type: 'string', minLength: 1, maxLength: 50000, description: 'Message headings, each followed by supporting lines beginning with a hyphen.' },
      inputMode: { enum: ['structured', 'free'], default: 'structured', description: 'Free text uses local sentence and idea separation, not an AI model. Free text is limited to 20,000 characters.' },
      style: { enum: styles, default: 'executive' }, count: { enum: ['auto', 3, 4, 5, 6], default: 'auto' }
    } }, annotations
  },
  {
    name: 'render_deck', description: 'Render a user- or AI-authored deck plan as standalone offline HTML. Accepts custom headlines, layouts and content blocks; create_deck_plan is not required. Returns HTML for the AI host or agent to save when requested. Does not update the open editor or publish.',
    inputSchema: { type: 'object', required: ['plan'], additionalProperties: false, properties: { plan: planSchema } }, annotations
  },
  {
    name: 'review_deck', description: 'Return content advisories for a supplied deck plan so the connected AI model or agent can revise it before rendering. Checks headlines, density and image descriptions; does not verify facts or modify the plan.',
    inputSchema: { type: 'object', required: ['plan'], additionalProperties: false, properties: { plan: planSchema } }, annotations
  }
];

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}
function string(value, label, max = 10000) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text of at most ${max} characters.`);
  return value;
}
function array(value, label, max = 100) {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} must be an array of at most ${max} items.`);
  return value;
}
function enumValue(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`${label} must be one of: ${allowed.join(', ')}.`);
  return value;
}

export function validatePlan(plan) {
  requireObject(plan, 'Plan');
  enumValue(plan.style, styles, 'Style');
  if (plan.logo !== undefined && plan.logo !== null) {
    requireObject(plan.logo, 'Logo');
    string(plan.logo.src, 'Logo image', 1500000);
    if (!core.isEmbeddedImage(plan.logo.src)) throw new Error('Logo must be an embedded PNG, JPEG, GIF or WebP data URL.');
    if (plan.logo.alt !== undefined) string(plan.logo.alt, 'Logo description');
  }
  if (!array(plan.slides, 'Slides').length) throw new Error('At least one slide is required.');
  for (const slide of plan.slides) {
    requireObject(slide, 'Slide');
    enumValue(slide.kind, kinds, 'Layout');
    string(slide.title, 'Headline'); string(slide.eyebrow, 'Label');
    for (const block of array(slide.blocks, 'Blocks', 30)) {
      requireObject(block, 'Block');
      const type = block.type;
      if (type === 'paragraph') string(block.text, 'Paragraph');
      else if (type === 'bullets') array(block.items, 'Points').forEach(v => string(v, 'Point'));
      else if (type === 'callout') { string(block.label, 'Label'); string(block.text, 'Callout'); }
      else if (type === 'quote') { string(block.quote, 'Quotation'); string(block.attribution, 'Attribution'); }
      else if (type === 'stat') { string(block.value, 'Value'); string(block.label, 'Label'); }
      else if (type === 'columns' || type === 'cards') {
        array(type === 'columns' ? block.columns : block.items, 'Items').forEach(v => {
          requireObject(v, 'Item'); string(v.title, 'Title'); string(v.text, 'Detail');
        });
      } else if (type === 'chart') {
        array(block.items, 'Chart items').forEach(v => {
          requireObject(v, 'Chart item'); string(v.label, 'Chart label');
          if (typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value < 0) throw new Error('Bar chart values must be finite, non-negative numbers.');
        });
      } else if (type === 'table') {
        const headers = array(block.headers, 'Headers', 12);
        if (!headers.length) throw new Error('A table must have a header.');
        headers.forEach(v => string(v, 'Header'));
        array(block.rows, 'Rows').forEach(row => {
          array(row, 'Cells', 12).forEach(v => string(v, 'Cell'));
          if (row.length !== headers.length) throw new Error('Every table row must match its header count.');
        });
      } else if (type === 'image') {
        string(block.src, 'Image', 8 * 1024 * 1024);
        if (block.src && !/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(block.src)) throw new Error('Images must be embedded PNG, JPEG, GIF or WebP data URLs.');
        string(block.alt, 'Image description'); string(block.caption, 'Caption');
      } else if (type === 'divider') string(block.label, 'Divider label');
      else throw new Error('Unsupported block type.');
    }
  }
  return plan;
}

function contentText(block) {
  if (block.type === 'paragraph') return block.text;
  if (block.type === 'bullets') return block.items.join(' ');
  if (block.type === 'callout') return `${block.label} ${block.text}`;
  if (block.type === 'quote') return `${block.quote} ${block.attribution}`;
  if (block.type === 'stat') return `${block.value} ${block.label}`;
  if (block.type === 'columns' || block.type === 'cards') return (block.columns || block.items).map(v => `${v.title} ${v.text}`).join(' ');
  if (block.type === 'chart') return block.items.map(v => `${v.label} ${v.value}`).join(' ');
  if (block.type === 'table') return `${block.headers.join(' ')} ${block.rows.flat().join(' ')}`;
  if (block.type === 'image') return `${block.alt} ${block.caption}`;
  return block.label;
}

export function callTool(name, args) {
  requireObject(args, 'Arguments');
  if (name === 'create_deck_plan') {
    const purpose = string(args.purpose, 'Purpose').trim();
    const messages = string(args.messages, 'Messages', 50000).trim();
    if (!purpose || !messages) throw new Error('Provide a purpose and at least one message.');
    const brief = { purpose, audience: string(args.audience ?? '', 'Audience'), messagesText: messages,
      style: enumValue(args.style ?? 'executive', styles, 'Style'),
      count: enumValue(args.count ?? 'auto', ['auto', 3, 4, 5, 6], 'Count') };
    const inputMode = enumValue(args.inputMode ?? 'structured', ['structured', 'free'], 'Input format');
    const result = core.buildSlides(brief, inputMode === 'free' ? core.organiseFreeText(messages) : core.parseMessageGroups(messages));
    return { style: brief.style, ...result };
  }
  if (!['render_deck', 'review_deck'].includes(name)) throw new Error('Unknown tool.');
  const plan = validatePlan(args.plan);
  if (name === 'render_deck') return { mimeType: 'text/html', html: core.renderDeckHtml(plan) };
  const warnings = [];
  const limit = { executive: 78, operational: 100, minimal: 60 }[plan.style];
  plan.slides.forEach((slide, i) => {
    const slideNumber = i + 1;
    if (!slide.title.trim()) warnings.push({ slide: slideNumber, message: 'Add a headline.' });
    if (slide.title.length > 110) warnings.push({ slide: slideNumber, message: 'Headline exceeds 110 characters.' });
    const words = slide.blocks.map(contentText).join(' ').trim().split(/\s+/).filter(Boolean).length;
    if (words > limit) warnings.push({ slide: slideNumber, message: `${words} content words; consider reducing to about ${limit}.` });
    if (slide.blocks.length > 6) warnings.push({ slide: slideNumber, message: 'More than six elements may crowd the slide.' });
    slide.blocks.forEach(block => {
      if (block.type === 'image' && block.src && !block.alt.trim()) warnings.push({ slide: slideNumber, message: 'Add an image description.' });
    });
  });
  return { warnings, note: 'Content checks only; review facts and rendered layout before sharing.' };
}
