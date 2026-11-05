// Small helpers used by the build. No external dependencies.

export const esc = (s = '') =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const slugify = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Wrap anything written as [like this] (that isn't a link) in a visible marker,
// so unfinished placeholders are easy to spot on the site.
export const markTodos = (html) =>
  html.replace(/\[([^\]\n<>]{2,200})\](?!\()/g, '<mark class="todo" title="Placeholder: replace this in the admin">[$1]</mark>');

// Plain text field -> escaped HTML with placeholders marked.
export const t = (s) => markTodos(esc(s));

function inline(s) {
  let out = esc(s);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
    const ext = /^https?:\/\//.test(href);
    return `<a href="${href}"${ext ? ' rel="noopener"' : ''}>${text}</a>`;
  });
  out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // _italic_ (what the editor's toolbar writes), but not inside words or web addresses like my_file.
  out = out.replace(/(^|[^\w\/])_([^_\n<>"]+)_(?!\w)/g, '$1<em>$2</em>');
  return markTodos(out);
}

// Short text field -> escaped HTML with **bold**, *italic* and [links](/url) (from the editor's toolbar).
export const ti = (s) => inline(String(s || '').replace(/\s*\n\s*/g, ' '));

// Minimal Markdown: headings, paragraphs, lists, blockquotes, rules, bold, italic, links.
export function md(src = '', { headingOffset = 0 } = {}) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  let list = null; // { type, items }
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushPara(); flushList(); continue; }
    // A backslash at the start keeps the line as ordinary text, e.g. \1984. A good year (not a numbered list).
    if (/^\\[#>*\-\d]/.test(line.trim())) { flushList(); para.push(line.trim().slice(1)); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flushPara(); flushList();
      const level = Math.min(6, m[1].length + headingOffset);
      const id = slugify(m[2]);
      out.push(`<h${level} id="${id}">${inline(m[2])}</h${level}>`);
      continue;
    }
    if (/^---+$/.test(line.trim())) { flushPara(); flushList(); out.push('<hr>'); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      flushPara();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(m[1]);
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); flushList();
      out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara(); flushList();
  return out.join('\n');
}

export const stripMd = (s = '') =>
  String(s || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*#>_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const money = (n) =>
  n === null || n === undefined || n === '' || isNaN(Number(n))
    ? null
    : '£' + Number(n).toFixed(2);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const niceDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00Z' : ''));
  if (isNaN(d)) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// Simple stable hash, used to pick a placeholder cover colour.
export const hash = (s) => {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
