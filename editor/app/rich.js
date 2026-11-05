// Rich text boxes for the editor: a toolbar (headings, bold, italic, links, lists, quotes)
// over an editable area. What you type is saved in the same simple format as before
// (## heading, **bold**, _italic_, [link](/page/), - bullets), so the website, the online
// admin and older text all keep working. Pasting from Word or a web page keeps headings,
// bold, italic, links and lists, and drops everything else (fonts, colours, sizes).
window.RichText = (function () {
  'use strict';

  // ---------- simple format -> HTML (matches src/lib.mjs on the website) ----------
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function inlineHtml(s) {
    var out = esc(s);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, text, href) { return '<a href="' + href + '">' + text + '</a>'; });
    out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/(^|[^\w\/])_([^_\n<>"]+)_(?!\w)/g, '$1<em>$2</em>');
    return out;
  }
  function toHtml(src, mode) {
    src = String(src || '').replace(/\r/g, '');
    if (mode !== 'block') return src.trim() ? '<p>' + inlineHtml(src.replace(/\s*\n\s*/g, ' ')) + '</p>' : '<p><br></p>';
    var out = [], para = [], list = null;
    function flushPara() { if (para.length) out.push('<p>' + inlineHtml(para.join(' ')) + '</p>'); para = []; }
    function flushList() { if (list) out.push('<' + list.type + '>' + list.items.map(function (i) { return '<li>' + inlineHtml(i) + '</li>'; }).join('') + '</' + list.type + '>'); list = null; }
    src.split('\n').forEach(function (raw) {
      var line = raw.replace(/\s+$/, ''), m;
      if (!line.trim()) { flushPara(); flushList(); return; }
      if (/^\\[#>*\-\d]/.test(line.trim())) { flushList(); para.push(line.trim().slice(1)); return; }
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushPara(); flushList(); var tag = m[1].length <= 2 ? 'h2' : 'h3'; out.push('<' + tag + '>' + inlineHtml(m[2]) + '</' + tag + '>'); return; }
      if (/^---+$/.test(line.trim())) { flushPara(); flushList(); out.push('<hr>'); return; }
      if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { flushPara(); if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; } list.items.push(m[1]); return; }
      if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) { flushPara(); if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; } list.items.push(m[1]); return; }
      if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); out.push('<blockquote><p>' + inlineHtml(m[1]) + '</p></blockquote>'); return; }
      flushList(); para.push(line.trim());
    });
    flushPara(); flushList();
    return out.join('') || '<p><br></p>';
  }

  // ---------- HTML -> simple format ----------
  var SKIP = /^(STYLE|SCRIPT|META|TITLE|LINK|XML|TEMPLATE|NOSCRIPT|IMG|SVG|BUTTON|INPUT|SELECT|TEXTAREA|IFRAME|OBJECT)$/;
  var BLOCK = /^(P|DIV|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|NAV|FIGURE|FIGCAPTION|H1|H2|H3|H4|H5|H6|UL|OL|LI|BLOCKQUOTE|HR|PRE|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|DL|DT|DD|ADDRESS|CENTER|FORM|FIELDSET)$/;
  function okHref(href) {
    href = String(href || '').trim();
    return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href) ? href.replace(/[\s()]/g, encodeURIComponent) : '';
  }
  function styleOf(el) { return (el.getAttribute && el.getAttribute('style') || '').toLowerCase(); }
  function isBold(el) {
    var st = styleOf(el), m = st.match(/font-weight\s*:\s*([a-z0-9]+)/);
    if (m) return m[1] === 'bold' || m[1] === 'bolder' || Number(m[1]) >= 600;
    return /^(B|STRONG)$/.test(el.tagName);
  }
  function isItalic(el) {
    var st = styleOf(el), m = st.match(/font-style\s*:\s*([a-z]+)/);
    if (m) return m[1] === 'italic' || m[1] === 'oblique';
    return /^(I|EM|CITE)$/.test(el.tagName);
  }
  // Collect runs of text with their formatting.
  function runs(nodes, fmt, out, links) {
    Array.prototype.forEach.call(nodes, function (n) {
      if (n.nodeType === 3) { out.push({ t: n.nodeValue.replace(/[\s ]+/g, ' '), b: fmt.b, i: fmt.i, a: fmt.a }); return; }
      if (n.nodeType !== 1 || SKIP.test(n.tagName)) return;
      if (n.tagName === 'BR') { out.push({ t: ' ', b: false, i: false, a: fmt.a }); return; }
      var f = { b: fmt.b, i: fmt.i, a: fmt.a };
      if (n.tagName !== 'A') { var st = styleOf(n); if (/font-weight/.test(st) || /^(B|STRONG)$/.test(n.tagName)) f.b = isBold(n); if (/font-style/.test(st) || /^(I|EM|CITE)$/.test(n.tagName)) f.i = isItalic(n); }
      else if (links) f.a = okHref(n.getAttribute('href')) || fmt.a;
      runs(n.childNodes, f, out, links);
    });
    return out;
  }
  function wrap(text, b, i) {
    var lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0], core = text.trim();
    if (!core) return text;
    if (i) core = '_' + core + '_';
    if (b) core = '**' + core + '**';
    return lead + core + trail;
  }
  function inlineMd(nodes, links) {
    var rs = runs(nodes, { b: false, i: false, a: '' }, [], links);
    // Merge neighbours with the same formatting.
    var merged = [];
    rs.forEach(function (r) { var last = merged[merged.length - 1]; if (last && last.b === r.b && last.i === r.i && last.a === r.a) last.t += r.t; else merged.push({ t: r.t, b: r.b, i: r.i, a: r.a }); });
    var out = '', k = 0;
    while (k < merged.length) {
      var r = merged[k];
      if (r.a) {
        var text = '', href = r.a;
        while (k < merged.length && merged[k].a === href) { text += wrap(merged[k].t, merged[k].b, merged[k].i); k++; }
        var lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
        out += text.trim() ? lead + '[' + text.trim().replace(/\]/g, ')') + '](' + href + ')' + trail : text;
      } else { out += wrap(r.t, r.b, r.i); k++; }
    }
    return out.replace(/\s+/g, ' ').trim();
  }
  // Keep a line from being read as a heading, list or quote when it's meant as ordinary text.
  function guard(t) { return /^(#{1,4}\s|[-*]\s|\d+\.\s|>|---+$)/.test(t) ? '\\' + t : t; }
  function toBlocks(node, out, links) {
    var buf = [];
    function flush() { var t = inlineMd(buf, links); if (t) out.push({ type: 'p', text: t }); buf = []; }
    Array.prototype.forEach.call(node.childNodes, function (n) {
      if (n.nodeType === 3 || (n.nodeType === 1 && !BLOCK.test(n.tagName) && n.tagName !== 'BR' && !SKIP.test(n.tagName))) {
        // An inline wrapper (e.g. Google Docs' <b>) can hold whole paragraphs: look inside.
        if (n.nodeType === 1 && n.querySelector && n.querySelector('p,div,h1,h2,h3,h4,ul,ol,blockquote,li,table')) { flush(); toBlocks(n, out, links); return; }
        buf.push(n); return;
      }
      if (n.nodeType !== 1 || SKIP.test(n.tagName)) return;
      var tag = n.tagName;
      if (tag === 'BR') { flush(); return; }
      flush();
      if (/^H[1-6]$/.test(tag)) { var ht = inlineMd(n.childNodes, links).replace(/^\*\*(.*)\*\*$/, '$1'); if (ht) out.push({ type: Number(tag[1]) <= 2 ? 'h2' : 'h3', text: ht }); return; }
      if (tag === 'UL' || tag === 'OL') {
        Array.prototype.forEach.call(n.querySelectorAll('li'), function (li) {
          var own = Array.prototype.filter.call(li.childNodes, function (c) { return !(c.nodeType === 1 && /^(UL|OL)$/.test(c.tagName)); });
          var t = inlineMd(own, links); if (t) out.push({ type: tag === 'UL' ? 'ul' : 'ol', text: t });
        });
        return;
      }
      if (tag === 'LI') { var lt = inlineMd(n.childNodes, links); if (lt) out.push({ type: 'ul', text: lt }); return; }
      if (tag === 'BLOCKQUOTE') { var inner = []; toBlocks(n, inner, links); inner.forEach(function (b) { out.push({ type: 'quote', text: b.text }); }); return; }
      if (tag === 'HR') { out.push({ type: 'hr' }); return; }
      toBlocks(n, out, links);
    });
    flush();
    return out;
  }
  function toMd(container, mode, links) {
    if (mode !== 'block') return inlineMd(container.childNodes, links);
    var blocks = toBlocks(container, [], links);
    // Lists pasted from Word arrive as paragraphs starting with a bullet character or a number.
    blocks.forEach(function (b) {
      var m;
      if (b.type !== 'p') return;
      if ((m = b.text.match(/^[·•▪◦o§–-]\s+(.*)$/))) { b.type = 'ul'; b.text = m[1]; }
      else if ((m = b.text.match(/^(\d+)[.)]\s+(.*)$/)) && blocks.some(function (o) { return o !== b && /^\d+[.)]\s/.test(o.text || ''); })) { b.type = 'ol'; b.text = m[2]; }
    });
    var out = '', prev = null;
    blocks.forEach(function (b) {
      var line = b.type === 'h2' ? '## ' + b.text : b.type === 'h3' ? '### ' + b.text : b.type === 'ul' ? '- ' + b.text : b.type === 'ol' ? '1. ' + b.text : b.type === 'quote' ? '> ' + b.text : b.type === 'hr' ? '---' : guard(b.text);
      var sameList = prev && (b.type === 'ul' || b.type === 'ol') && prev.type === b.type;
      out += (out ? (sameList ? '\n' : '\n\n') : '') + line;
      prev = b;
    });
    return out;
  }

  // ---------- the box ----------
  var TOOLS = {
    heading: { label: 'Heading', title: 'Heading', block: 'h2' },
    sub: { label: 'Sub-heading', title: 'Smaller heading', block: 'h3' },
    normal: { label: 'Normal', title: 'Normal paragraph text', block: 'p' },
    bold: { label: 'B', title: 'Bold (Ctrl+B)', cmd: 'bold', cls: 'rte__btn--b' },
    italic: { label: 'I', title: 'Italic (Ctrl+I)', cmd: 'italic', cls: 'rte__btn--i' },
    link: { label: 'Link', title: 'Add a link to the selected words (Ctrl+K)' },
    unlink: { label: 'Remove link', title: 'Remove the link' },
    ul: { label: '• List', title: 'Bulleted list', cmd: 'insertUnorderedList' },
    ol: { label: '1. List', title: 'Numbered list', cmd: 'insertOrderedList' },
    quote: { label: '“ Quote', title: 'Quotation', block: 'blockquote' },
    clear: { label: 'Clear', title: 'Remove bold, italic and links from the selected words' },
  };
  function create(opts) {
    var mode = opts.mode || 'block';
    var links = opts.links !== false;
    var names = mode === 'block'
      ? [opts.headings === false ? null : 'heading', opts.headings === false ? null : 'sub', 'normal', '|', 'bold', 'italic', links ? 'link' : null, links ? 'unlink' : null, '|', 'ul', 'ol', 'quote', '|', 'clear']
      : ['bold', 'italic', links ? 'link' : null, links ? 'unlink' : null, '|', 'clear'];
    names = names.filter(Boolean);

    var root = document.createElement('div'); root.className = 'rte rte--' + mode;
    var bar = document.createElement('div'); bar.className = 'rte__bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', (opts.label || 'Text') + ' formatting');
    var area = document.createElement('div');
    area.className = 'rte__area' + (mode === 'block' ? ' rte__area--block' : '');
    area.id = opts.id; area.contentEditable = 'true'; area.setAttribute('role', 'textbox'); area.spellcheck = true;
    if (mode === 'block') area.setAttribute('aria-multiline', 'true');
    if (opts.labelledby) area.setAttribute('aria-labelledby', opts.labelledby);
    if (opts.describedby) area.setAttribute('aria-describedby', opts.describedby);
    area.style.minHeight = Math.max(2, opts.rows || 3) * 1.65 + 1.4 + 'em';
    area.innerHTML = toHtml(opts.value, mode);

    var btns = {};
    names.forEach(function (n) {
      if (n === '|') { var sep = document.createElement('span'); sep.className = 'rte__sep'; bar.append(sep); return; }
      var t = TOOLS[n], b = document.createElement('button');
      b.type = 'button'; b.className = 'rte__btn' + (t.cls ? ' ' + t.cls : ''); b.textContent = t.label; b.title = t.title; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep the selection in the text
      b.addEventListener('click', function () { run(n); });
      btns[n] = b; bar.append(b);
    });
    root.append(bar, area);

    function exec(cmd, val) { try { document.execCommand(cmd, false, val); } catch (e) { /* ignore */ } }
    function currentBlock() {
      var sel = window.getSelection(); if (!sel.rangeCount) return null;
      var n = sel.anchorNode; if (!area.contains(n)) return null;
      while (n && n !== area) { if (n.nodeType === 1 && /^(P|H2|H3|BLOCKQUOTE|LI|DIV)$/.test(n.tagName)) return n; n = n.parentNode; }
      return null;
    }
    function inQuote() { var n = currentBlock(); while (n && n !== area) { if (n.tagName === 'BLOCKQUOTE') return n; n = n.parentNode; } return null; }
    function run(n) {
      area.focus();
      var t = TOOLS[n];
      if (t.block) {
        var cur = currentBlock();
        var target = t.block;
        if (target === 'blockquote' && inQuote()) target = 'p';
        else if (cur && cur.tagName.toLowerCase() === target && target !== 'p') target = 'p';
        exec('formatBlock', '<' + target + '>');
      } else if (t.cmd) exec(t.cmd);
      else if (n === 'link') addLink();
      else if (n === 'unlink') exec('unlink');
      else if (n === 'clear') { exec('removeFormat'); exec('unlink'); }
      changed();
    }
    function addLink() {
      var sel = window.getSelection();
      var text = sel.toString();
      var url = window.prompt('Link address, for example https://www.amazon.co.uk/dp/… or /contact/ for a page on this site', 'https://');
      if (!url || url === 'https://') return;
      url = url.trim();
      if (/^www\./i.test(url)) url = 'https://' + url;
      if (!okHref(url)) { window.alert('That doesn\'t look like a web address. Start it with https:// (another website) or / (a page on this site).'); return; }
      if (text) exec('createLink', url);
      else exec('insertHTML', '<a href="' + esc(url) + '">' + esc(url) + '</a>');
    }
    function syncState() {
      Object.keys(btns).forEach(function (n) {
        var t = TOOLS[n], on = false;
        if (t.cmd) { try { on = document.queryCommandState(t.cmd); } catch (e) { on = false; } }
        else if (t.block && t.block !== 'p') { var c = currentBlock(); on = t.block === 'blockquote' ? !!inQuote() : !!(c && c.tagName.toLowerCase() === t.block); }
        btns[n].setAttribute('aria-pressed', String(!!on));
      });
      root.classList.toggle('is-empty', !area.textContent.trim());
    }
    var last = String(opts.value || '');
    function changed() {
      var v = toMd(area, mode, links);
      if (v !== last) { last = v; if (opts.onChange) opts.onChange(v); }
      syncState();
    }
    area.addEventListener('input', changed);
    area.addEventListener('keyup', syncState);
    area.addEventListener('mouseup', syncState);
    area.addEventListener('focus', function () { exec('defaultParagraphSeparator', 'p'); syncState(); });
    area.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && mode !== 'block') { e.preventDefault(); return; }
      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); exec('insertParagraph'); return; }
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        var k = e.key.toLowerCase();
        if (k === 'k' && links) { e.preventDefault(); addLink(); changed(); }
        if (k === 'u') e.preventDefault(); // underlines look like links on websites, so they're not offered
      }
    });
    // Paste: keep headings, bold, italic, links and lists; drop fonts, colours and sizes.
    area.addEventListener('paste', function (e) {
      var cd = e.clipboardData; if (!cd) return;
      e.preventDefault();
      var html = cd.getData('text/html'), plain = cd.getData('text/plain'), md;
      if (html) { var doc = new DOMParser().parseFromString(html, 'text/html'); md = toMd(doc.body, mode, links); }
      else md = mode === 'block' ? plain.replace(/\r/g, '').split(/\n{2,}/).map(function (p) { return guard(p.replace(/\s*\n\s*/g, ' ').trim()); }).filter(Boolean).join('\n\n') : plain.replace(/\s+/g, ' ');
      if (!md) return;
      var frag = toHtml(md, mode);
      if (mode !== 'block') frag = frag.replace(/^<p>|<\/p>$/g, '');
      else if (/^<p>[^]*<\/p>$/.test(frag) && frag.indexOf('<p>', 1) < 0) frag = frag.slice(3, -4); // one paragraph: insert into the current line
      exec('insertHTML', frag);
      changed();
    });
    // Links shouldn't open while you're editing; Ctrl+click opens them in a new tab.
    area.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a'); if (!a) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) window.open(a.href, '_blank', 'noopener');
    });
    syncState();
    return { el: root, area: area };
  }

  return { create: create, toMd: toMd, toHtml: toHtml };
})();
