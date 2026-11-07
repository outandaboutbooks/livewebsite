// Out and About Books website editor (runs on your own computer).
(function () {
  'use strict';
  var S = window.SCHEMA;
  var main = document.getElementById('main');
  var toastEl = document.getElementById('toast');
  var state = { dirty: false };
  var uid = 0;

  // ---------- helpers ----------
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
    return el;
  }
  function api(method, url, body, raw) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) {
      if (raw) { opts.body = body; } else { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    }
    return fetch('/api/' + url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || j.output || ('Something went wrong (' + r.status + ').'));
        return j;
      });
    });
  }
  var toastTimer;
  function toast(msg, bad) {
    toastEl.textContent = msg;
    toastEl.className = 'toast is-on' + (bad ? ' is-bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, bad ? 8000 : 3500);
  }
  function markDirty() { state.dirty = true; var s = document.querySelector('[data-save-state]'); if (s) s.textContent = 'Unsaved changes'; }
  function clean() { state.dirty = false; var s = document.querySelector('[data-save-state]'); if (s) s.textContent = 'All changes saved'; }
  window.addEventListener('beforeunload', function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- preview ----------
  var previewWin = null;
  function preview() {
    var btns = document.querySelectorAll('#preview-btn, [data-preview]');
    btns.forEach(function (b) { b.disabled = true; });
    toast('Building the preview…');
    // Open the tab straight away (browsers block pop-ups opened later).
    if (!previewWin || previewWin.closed) previewWin = window.open('about:blank', 'oab-preview');
    return api('POST', 'build').then(function (r) {
      toast('Preview updated.');
      var target = state.previewPath ? r.preview.replace(/\/$/, '') + state.previewPath : r.preview;
      if (previewWin && !previewWin.closed) { previewWin.location.href = target; previewWin.focus(); }
      else window.open(target, 'oab-preview');
    }).catch(function (e) {
      if (previewWin && !previewWin.closed) previewWin.close();
      toast('The preview could not be built: ' + e.message, true);
    }).finally(function () { btns.forEach(function (b) { b.disabled = false; }); });
  }
  document.getElementById('preview-btn').addEventListener('click', function () {
    if (state.dirty && !confirm('You have unsaved changes. Preview without them?')) return;
    preview();
  });

  // ---------- images ----------
  function prepareImage(file, kind) {
    // Shrinks large photos and saves them as JPG. SVGs are uploaded as they are.
    return new Promise(function (resolve, reject) {
      if (file.type === 'image/svg+xml') return resolve({ blob: file, name: file.name, w: 0, h: 0 });
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Choose a JPG, PNG or WebP image.'));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, hgt = img.naturalHeight;
        var maxW = kind === 'square' ? 1200 : 1600;
        var scale = Math.min(1, maxW / w);
        var cw = Math.round(w * scale), ch = Math.round(hgt * scale);
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error('That image could not be read.'));
          var base = file.name.replace(/\.[^.]+$/, '');
          resolve({ blob: blob, name: base + '.jpg', w: w, h: hgt });
        }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That image could not be read.')); };
      img.src = url;
    });
  }
  function shapeNote(kind, w, hgt) {
    if (!w || !hgt) return '';
    var ratio = hgt / w;
    if (kind === 'cover' && Math.abs(ratio - 1.6) > 0.012) {
      return 'This image is ' + w + ' × ' + hgt + ' pixels, which isn\'t the 5:8 shape of a 5 × 8 inch book, so its edges will be trimmed to fit. If it includes the bleed, cut that off first.';
    }
    if (kind === 'square' && Math.abs(ratio - 1) > 0.02) return 'This photo isn\'t square, so its edges will be trimmed to fit.';
    return '';
  }

  // ---------- fields ----------
  function fieldId() { return 'f' + (++uid); }

  function renderField(f, obj) {
    var id = fieldId();
    var val = obj[f.name];
    var help = f.help ? h('p', { class: 'help', id: id + '-help', text: f.help }) : null;
    var describedby = f.help ? id + '-help' : null;
    var set = function (v) { obj[f.name] = v; markDirty(); };
    var wrap = h('div', { class: 'field field--' + f.type + (f.small ? ' field--small' : '') + (f.publish ? ' field--publish' : '') });

    if (f.type === 'bool') {
      var cb = h('input', { type: 'checkbox', id: id, 'aria-describedby': describedby, onchange: function () { set(cb.checked); } });
      cb.checked = val === undefined ? !!f.default : !!val;
      if (val === undefined && f.default !== undefined) obj[f.name] = !!f.default;
      wrap.append(h('div', { class: 'check' }, [cb, h('label', { for: id, text: f.label })]), help || '');
      return wrap;
    }

    if (f.type === 'colour') return colourField(f, obj, id, help, wrap, set);
    if (f.type === 'font') return fontField(f, obj, id, help, wrap, set);
    if (f.type === 'bookpick') {
      var bsel = h('select', { id: id, 'aria-describedby': describedby, onchange: function () { set(bsel.value); } }, [h('option', { value: '', text: 'No book' })]);
      api('GET', 'list/books').then(function (books) {
        books.forEach(function (b) { var v = b.file.replace(/\.json$/, ''); bsel.append(h('option', { value: v, text: b.title + (b.unpublished ? ' (unpublished)' : '') })); });
        bsel.value = val || '';
        if (val && bsel.value !== val) bsel.append(h('option', { value: val, text: val + ' (not found)' })), bsel.value = val;
      });
      wrap.append(h('label', { for: id, text: f.label }), bsel, help || '');
      return wrap;
    }
    if (f.type === 'text' && f.rich && window.RichText) {
      var lab = h('span', { class: 'label', id: id + '-label', text: f.label, onclick: function () { box.area.focus(); } });
      var box = window.RichText.create({ id: id, mode: f.rich, links: f.links !== false, headings: f.headings !== false, rows: f.rows, value: val || '', label: f.label,
        labelledby: id + '-label', describedby: describedby, onChange: function (v) { set(v); } });
      wrap.append(lab, box.el, help || '');
      return wrap;
    }

    var label = h('label', { for: id, text: (f.label || '') + (f.required ? ' (required)' : '') });
    var input;
    if (f.type === 'text') {
      input = h('textarea', { id: id, rows: f.rows || 4, class: f.mono ? 'mono' : null, 'aria-describedby': describedby, oninput: function () { set(input.value); } });
      input.value = val || '';
    } else if (f.type === 'number') {
      input = h('input', { id: id, type: 'number', inputmode: 'decimal', step: f.step || '1', min: '0', 'aria-describedby': describedby,
        oninput: function () { set(input.value === '' ? null : Number(input.value)); } });
      input.value = val === null || val === undefined ? '' : val;
    } else if (f.type === 'select') {
      input = h('select', { id: id, 'aria-describedby': describedby, onchange: function () { set(input.value); if (f.onchange) f.onchange(); if (f.rerender && state.rerender) state.rerender(id); } },
        f.options.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      if (val && !f.options.some(function (o) { return o[0] === val; })) input.prepend(h('option', { value: val, text: val }));
      input.value = val || f.default || f.options[0][0];
      if (!val) obj[f.name] = input.value;
    } else if (f.type === 'date') {
      input = h('input', { id: id, type: 'date', 'aria-describedby': describedby, oninput: function () { set(input.value); } });
      input.value = val || '';
    } else if (f.type === 'list') {
      input = h('textarea', { id: id, rows: Math.max(3, (val || []).length + 1), 'aria-describedby': describedby,
        oninput: function () { set(input.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)); } });
      input.value = (val || []).join('\n');
    } else if (f.type === 'pageparent') {
      var me = (state.currentFile || '').replace(/\.json$/, '');
      input = h('select', { id: id, 'aria-describedby': describedby, onchange: function () { set(input.value); } }, [h('option', { value: '', text: 'None (a top-level page)' })]);
      input.value = '';
      api('GET', 'list/pages').then(function (items) {
        var hasKids = items.some(function (it) { return it.parent === me; });
        parentChoices(items, me).forEach(function (o) { input.append(h('option', { value: o[0], text: o[1] })); });
        input.value = val || '';
        if (hasKids) { input.disabled = true; input.title = 'This page has pages under it, so it stays at the top level.'; if (help) help.textContent = 'This page has pages under it, so it stays at the top level.'; }
      });
      wrap.append(label, input, help || '');
      return wrap;
    } else if (f.type === 'audio') {
      return renderAudio(f, obj, id, help);
    } else if (f.type === 'image') {
      return renderImage(f, obj, id, label, help);
    } else if (f.type === 'objlist') {
      return renderObjList(f, obj, label, help);
    } else if (f.type === 'object') {
      if (!obj[f.name] || typeof obj[f.name] !== 'object') obj[f.name] = {};
      var inner = obj[f.name];
      var g = h('div', { class: 'grid' }, f.fields.map(function (sub) { return renderField(sub, inner); }));
      wrap.append(g);
      return wrap;
    } else {
      input = h('input', { id: id, type: f.type === 'url' ? 'url' : 'text', readonly: f.readonly || null, 'aria-describedby': describedby,
        autocomplete: 'off', spellcheck: f.type === 'url' ? 'false' : null, maxlength: f.maxlength || null, oninput: function () { set(input.value); } });
      input.value = val === null || val === undefined ? '' : val;
    }
    if (f.required) input.setAttribute('required', '');
    wrap.append(label, input, help || '');
    return wrap;
  }

  function renderImage(f, obj, id, label, help) {
    var wrap = h('div', { class: 'field field--image' });
    var box = h('div', { class: 'imgbox imgbox--' + (f.kind || 'cover') });
    var note = h('p', { class: 'warn', hidden: true });
    var name = h('p', { class: 'imgname' });
    var fileInput = h('input', { type: 'file', id: id, accept: 'image/jpeg,image/png,image/webp,image/svg+xml', class: 'visually-hidden' });
    function show() {
      box.innerHTML = '';
      if (obj[f.name]) {
        var im = h('img', { src: obj[f.name] + '?v=' + Date.now(), alt: '' });
        im.onload = function () { var t = shapeNote(f.kind, im.naturalWidth, im.naturalHeight); note.hidden = !t; note.textContent = t; };
        box.append(im);
        name.textContent = obj[f.name].replace(/^\/media\//, '');
      } else {
        box.append(h('span', { class: 'imgbox__empty', text: 'No image yet' }));
        name.textContent = ''; note.hidden = true;
      }
      removeBtn.hidden = !obj[f.name];
    }
    var chooseBtn = h('label', { for: id, class: 'btn btn--secondary', text: 'Choose image…' });
    var removeBtn = h('button', { type: 'button', class: 'btn btn--quiet', text: 'Remove', onclick: function () { obj[f.name] = ''; markDirty(); show(); } });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0]; if (!file) return;
      chooseBtn.textContent = 'Adding…';
      prepareImage(file, f.kind).then(function (p) {
        return api('POST', 'upload?name=' + encodeURIComponent(p.name), p.blob, true).then(function (r) {
          obj[f.name] = r.path; markDirty(); show();
          var t = shapeNote(f.kind, p.w, p.h); note.hidden = !t; note.textContent = t;
          toast('Image added. Remember to save.');
        });
      }).catch(function (e) { toast(e.message, true); })
        .finally(function () { chooseBtn.textContent = 'Choose image…'; fileInput.value = ''; });
    });
    show();
    wrap.append(h('span', { class: 'label', text: f.label }), h('div', { class: 'imgrow' }, [box, h('div', { class: 'imgside' }, [name, h('div', { class: 'imgbtns' }, [fileInput, chooseBtn, removeBtn]), note, help || ''])]));
    return wrap;
  }

  function renderAudio(f, obj, id, help) {
    var wrap = h('div', { class: 'field field--audio' });
    var player = h('div', { class: 'audiobox' });
    var name = h('p', { class: 'imgname' });
    var warn = h('p', { class: 'warn', hidden: true });
    var fileInput = h('input', { type: 'file', id: id, accept: 'audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,.mp3,.m4a', class: 'visually-hidden' });
    var chooseBtn = h('label', { for: id, class: 'btn btn--secondary', text: 'Choose audio file…' });
    var removeBtn = h('button', { type: 'button', class: 'btn btn--quiet', text: 'Remove', onclick: function () { obj[f.name] = ''; markDirty(); show(); } });
    function show() {
      player.innerHTML = '';
      if (obj[f.name]) {
        player.append(h('audio', { controls: true, preload: 'metadata', src: obj[f.name] }));
        name.textContent = obj[f.name].replace(/^\/media\//, '');
      } else { player.append(h('span', { class: 'imgbox__empty', text: 'No audio yet' })); name.textContent = ''; }
      removeBtn.hidden = !obj[f.name];
    }
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0]; if (!file) return;
      if (!/\.(mp3|m4a)$/i.test(file.name)) { fileInput.value = ''; return toast('Choose an MP3 or M4A audio file.', true); }
      var mb = file.size / 1048576;
      if (mb > 60) { fileInput.value = ''; return toast('That file is ' + mb.toFixed(0) + ' MB, which is too large. Keep excerpts under about 10 MB.', true); }
      chooseBtn.textContent = 'Adding…';
      api('POST', 'upload?name=' + encodeURIComponent(file.name), file, true).then(function (r) {
        obj[f.name] = r.path; markDirty(); show();
        warn.hidden = mb <= 12;
        warn.textContent = 'This file is ' + mb.toFixed(1) + ' MB. That\'s large for a website and may be slow on phones, and the online admin may not accept it. Try a shorter clip, or export it as MP3 at 64–96 kbps mono.';
        toast('Audio added. Remember to save.');
      }).catch(function (e) { toast(e.message, true); })
        .finally(function () { chooseBtn.textContent = 'Choose audio file…'; fileInput.value = ''; });
    });
    show();
    wrap.append(h('span', { class: 'label', text: f.label }), player, h('div', { class: 'imgbtns' }, [name, fileInput, chooseBtn, removeBtn]), warn, help || '');
    return wrap;
  }

  function renderObjList(f, obj, label, help) {
    var wrap = h('div', { class: 'field field--objlist' });
    var list = h('div', { class: 'objlist' });
    if (!Array.isArray(obj[f.name])) obj[f.name] = [];
    var arr = obj[f.name];
    function draw() {
      list.innerHTML = '';
      arr.forEach(function (item, i) {
        var title = h('h4', { text: f.itemLabel(item) });
        var fields = f.fields.map(function (sub) {
          var s2 = Object.assign({}, sub);
          if (sub.name === 'format' || sub.name === 'label') s2.onchange = function () { title.textContent = f.itemLabel(item); };
          var el = renderField(s2, item);
          if (sub.name === 'label') el.querySelector('input').addEventListener('input', function () { title.textContent = f.itemLabel(item); });
          return el;
        });
        var tools = h('div', { class: 'objlist__tools' }, [
          i > 0 ? h('button', { type: 'button', class: 'btn btn--quiet btn--sm', text: 'Move up', onclick: function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); markDirty(); draw(); } }) : null,
          h('button', { type: 'button', class: 'btn btn--quiet btn--sm', text: 'Remove', onclick: function () { if (confirm('Remove this ' + f.itemLabel(item) + '?')) { arr.splice(i, 1); markDirty(); draw(); } } }),
        ]);
        list.append(h('div', { class: 'objlist__item' }, [h('div', { class: 'objlist__head' }, [title, tools]), h('div', { class: 'grid' }, fields)]));
      });
    }
    draw();
    wrap.append(h('span', { class: 'label', text: f.label }), help || '', list,
      h('button', { type: 'button', class: 'btn btn--secondary', text: '+ ' + f.addLabel, onclick: function () { arr.push(f.newItem()); markDirty(); draw(); } }));
    return wrap;
  }

  // ---------- font chooser (Site settings > Text styles) ----------
  var fontsPromise = null, fontsLoaded = {};
  function loadFonts() {
    if (!fontsPromise) fontsPromise = fetch('/site-assets/fonts/fonts.json').then(function (r) { return r.json(); });
    return fontsPromise;
  }
  function fontFace(cat, id) {
    var key = id + (cat.headingList ? '-h' : '-b');
    if (fontsLoaded[key]) return fontsLoaded[key];
    var f = cat.fonts[id], file;
    if (id === 'poppins') file = 'Poppins-Bold.woff';
    else if (id === 'lora') file = 'Lora-Variable.woff';
    else { var want = cat.headingList ? 700 : 400; var face = f.faces.find(function (x) { return x[1] === want && x[2] === 'normal'; }) || f.faces[0]; file = id + '/' + face[0]; }
    var fam = 'Sample ' + f.name + (cat.headingList ? ' H' : ' B');
    try { var ff = new FontFace(fam, 'url(/site-assets/fonts/' + file + ')'); document.fonts.add(ff); ff.load(); } catch (e) { /* older browser: falls back */ }
    return (fontsLoaded[key] = fam);
  }
  function fontField(f, obj, id, help, wrap, set) {
    var group = h('div', { class: 'fontpick', role: 'radiogroup', 'aria-labelledby': id + '-label' }, [h('p', { class: 'loading', text: 'Loading fonts…' })]);
    wrap.append(h('span', { class: 'label', id: id + '-label', text: f.label }), help || '', group);
    loadFonts().then(function (cat) {
      group.innerHTML = '';
      var val = cat[f.list].indexOf(obj[f.name]) >= 0 ? obj[f.name] : f.default;
      if (!obj[f.name]) obj[f.name] = val;
      var heading = f.list === 'heading';
      cat[f.list].forEach(function (fid) {
        var font = cat.fonts[fid];
        var fam = fontFace({ fonts: cat.fonts, headingList: heading }, fid);
        var radio = h('input', { type: 'radio', name: id, value: fid, id: id + '-' + fid, onchange: function () { set(fid); } });
        radio.checked = fid === val;
        group.append(h('label', { class: 'fontpick__opt', for: id + '-' + fid }, [radio,
          h('span', { class: 'fontpick__text' }, [
            h('span', { class: 'fontpick__name', text: font.name + (fid === f.default ? ' (standard)' : '') }),
            h('span', { class: 'fontpick__style', text: font.style }),
            h('span', { class: 'fontpick__sample' + (heading ? ' fontpick__sample--h' : ''), style: 'font-family:"' + fam + '", ' + (font.fallback === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif'),
              text: heading ? 'Queer stories. Find your people.' : 'A love story across the Highlands, with second chances, wild coastlines and a castle full of secrets.' }),
          ])]));
      });
    });
    return wrap;
  }

  // ---------- colour chooser: brand swatches, a colour picker and a #code box ----------
  // The value saved is a swatch name (e.g. 'purple') or a #code (e.g. '#3a7bd5').
  var SWATCH_HEX = { ink: '#1e2422', red: '#e40303', orange: '#ff8c00', sun: '#f7c948', green: '#008026', cobalt: '#2f5fd0', navy: '#24408e', purple: '#732982', hot: '#d11f6b' };
  function hexOf(v) { return SWATCH_HEX[v] || (/^#[0-9a-f]{6}$/i.test(v || '') ? v.toLowerCase() : ''); }
  function normHex(t) {
    t = String(t || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(t)) t = t.split('').map(function (c) { return c + c; }).join('');
    return /^[0-9a-f]{6}$/i.test(t) ? '#' + t.toLowerCase() : '';
  }
  // Same rule as the website: use whichever text colour (white or dark) is easier to read.
  function lum(hex) {
    var c = [1, 3, 5].map(function (i) { var x = parseInt(hex.substr(i, 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function inkFor(hex) {
    var L = lum(hex), white = 1.05 / (L + 0.05), dark = (L + 0.05) / (lum('#1e2422') + 0.05);
    return white >= dark ? { ink: '#ffffff', ratio: white } : { ink: '#1e2422', ratio: dark };
  }
  function colourField(f, obj, id, help, wrap, set) {
    var val = obj[f.name] || f.default || 'hot';
    if (!obj[f.name]) obj[f.name] = val;
    var names = {}; f.options.forEach(function (o) { names[o[0]] = o[1]; });
    var sample = h('div', { class: 'colour__sample' + (f.paper ? ' colour__sample--paper' : '') }, f.paper ? [h('strong', { text: 'A heading on the page' }), h('span', { text: 'Paragraph text stays charcoal.', style: 'color:#1e2422' })] : [h('strong', { text: 'Page title' }), h('span', { text: 'Introduction text' })]);
    var status = h('p', { class: 'colour__status', 'aria-live': 'polite' });
    var picker = h('input', { type: 'color', class: 'colour__picker', 'aria-label': f.label + ': colour picker', oninput: function () { choose(picker.value); } });
    var code = h('input', { type: 'text', id: id, class: 'colour__code', maxlength: '7', spellcheck: 'false', autocomplete: 'off', placeholder: '#3a7bd5', 'aria-describedby': id + '-status',
      oninput: function () { var x = normHex(code.value); if (x) choose(x, true); },
      onblur: function () { code.value = hexOf(val); } });
    status.id = id + '-status';
    var sw = h('div', { class: 'colour__swatches', role: 'group', 'aria-label': f.label + ': colours' }, f.options.map(function (o) {
      return h('button', { type: 'button', class: 'colour__swatch', 'data-v': o[0], title: o[1], 'aria-label': o[1], style: 'background:' + SWATCH_HEX[o[0]], onclick: function () { choose(o[0]); } });
    }));
    function choose(v, fromCode) {
      // A #code that matches a swatch is saved as that swatch, so it follows the brand colour.
      var match = Object.keys(SWATCH_HEX).find(function (k) { return SWATCH_HEX[k] === v; });
      val = match || v; set(val); draw(fromCode);
    }
    function draw(fromCode) {
      var hex = hexOf(val), ink = inkFor(hex);
      if (f.paper) {
        // Heading colour: shown as a heading on the cream page background.
        var L1 = lum(hex), L2 = lum('#f6f2e9'), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        sample.style.background = '#f6f2e9'; sample.style.color = hex;
        picker.value = hex; if (!fromCode) code.value = hex;
        sw.querySelectorAll('.colour__swatch').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === val)); });
        status.className = 'colour__status' + (ratio < 3 ? ' colour__status--warn' : '');
        status.textContent = (names[val] ? names[val] + ' (' + hex + ')' : 'Your own colour ' + hex) + '.' + (ratio < 3 ? ' Headings in this colour are hard to read on the cream background: try a darker shade.' : '');
        return;
      }
      sample.style.background = hex; sample.style.color = ink.ink;
      picker.value = hex; if (!fromCode) code.value = hex;
      sw.querySelectorAll('.colour__swatch').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === val)); });
      var name = names[val] ? names[val] + ' (' + hex + ')' : 'Your own colour ' + hex;
      status.className = 'colour__status' + (ink.ratio < 4.5 ? ' colour__status--warn' : '');
      status.textContent = name + '. Text will be ' + (ink.ink === '#ffffff' ? 'white' : 'dark') + '.' +
        (ink.ratio < 4.5 ? ' This colour is hard to read text on: try a darker or lighter shade.' : '');
    }
    draw();
    wrap.append(h('span', { class: 'label', text: f.label }),
      h('div', { class: 'colour' }, [sw, h('div', { class: 'colour__own' }, [h('label', { for: id, text: 'Or your own:' }), picker, code]), sample, status]), help || '');
    return wrap;
  }

  // Pages a page can sit under: every page in the top menu, i.e. About us, Questions, Contact and the
  // top-level pages you've added (one level only). Policy pages live in the footer, so they can't have sub-pages.
  function parentChoices(items, me) {
    var built = (S.pages.builtIn || []);
    var has = function (f) { return items.some(function (it) { return it.file === f; }); };
    var out = has('about.json') ? [['about', 'About us']] : [];
    items.filter(function (it) { return built.indexOf(it.file) < 0 && !it.parent && it.file.replace(/\.json$/, '') !== me; })
      .forEach(function (it) { out.push([it.file.replace(/\.json$/, ''), it.title]); });
    if (has('faq.json')) out.push(['faq', 'Questions']);
    if (has('contact.json')) out.push(['contact', 'Contact']);
    return out;
  }

  function renderForm(schema, data, ctx) {
    ctx = ctx || {};
    var lay = data.layout || 'text';
    var fits = function (x) {
      if (x.when && x.when.indexOf(lay) < 0) return false;
      if (x.notFor && x.notFor.indexOf(lay) >= 0) return false;
      if (x.builtInOnly && !ctx.builtIn) return false;
      if (x.newOnly && ctx.builtIn) return false;
      if (x.builtInGroup && !ctx.builtIn) return false;
      if (x.notFile && x.notFile.indexOf(ctx.file) >= 0) return false;
      if (x.onlyFile && x.onlyFile.indexOf(ctx.file) < 0) return false;
      return true;
    };
    return schema.groups.filter(fits).map(function (g) {
      return h('section', { class: 'group' }, [h('h2', { text: g.title }), h('div', { class: 'grid' }, g.fields.filter(fits).map(function (f) { return renderField(f, data); }))]);
    });
  }

  function validate(schema, data) {
    var missing = [];
    schema.groups.forEach(function (g) { g.fields.forEach(function (f) { if (f.required && !String(data[f.name] || '').trim()) missing.push(f.label); }); });
    return missing;
  }

  // ---------- views ----------
  function setNav(key) {
    document.querySelectorAll('[data-nav]').forEach(function (a) { if (a.dataset.nav === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  function listView(key) {
    var schema = S[key];
    setNav(key); state.previewPath = key === 'books' ? '/books/' : key === 'merch' ? '/shop/' : key === 'news' ? '/news/' : '/';
    main.innerHTML = '';
    main.append(h('div', { class: 'head' }, [h('h1', { text: schema.label }), h('p', { class: 'intro', text: schema.intro })]));
    if (!schema.noNew) {
      var nameIn = h('input', { id: 'new-name', type: 'text', placeholder: schema.single === 'book' ? 'Title of the new book' : schema.single === 'page' ? 'Title of the new page' : 'Name of the new item', autocomplete: 'off' });
      var layoutSel = schema.layouts ? h('select', { id: 'new-layout', 'aria-label': 'Layout' }, schema.layouts.map(function (o) { return h('option', { value: o[0], text: o[1] }); })) : null;
      var parentSel = schema.layouts ? h('select', { id: 'new-parent', 'aria-label': 'Put it under' }, [h('option', { value: '', text: 'Top level' })]) : null;
      if (parentSel) api('GET', 'list/pages').then(function (items) { parentChoices(items, '').forEach(function (o) { parentSel.append(h('option', { value: o[0], text: 'Under ' + o[1] })); }); });
      var form = h('form', { class: 'newform', onsubmit: function (e) {
        e.preventDefault();
        var title = nameIn.value.trim();
        if (!title) { nameIn.focus(); return toast('Type a ' + (schema.single === 'book' ? 'title' : 'name') + ' first.', true); }
        api('POST', 'new/' + key, { title: title, data: schema.newData(title, layoutSel ? layoutSel.value : '', parentSel ? parentSel.value : '') }).then(function (r) { location.hash = '#/' + key + '/' + r.file; toast('Created. Fill in the details, then save.'); })
          .catch(function (e2) { toast(e2.message, true); });
      } }, [h('label', { for: 'new-name', text: 'Add a new ' + schema.single }), h('div', { class: 'newform__row' }, [nameIn, layoutSel, parentSel, h('button', { class: 'btn btn--primary', type: 'submit', text: 'Add' })]),
        schema.layouts ? h('p', { class: 'help', text: 'Layouts: Text page (words only) · Image and text (a picture beside your words) · Cards (up to six boxes with picture, text and button) · Gallery (pictures with captions) · Feature (a big bold opening for a launch or offer).' }) : null]);
      main.append(form);
    }
    var listEl = h('ul', { class: 'items' + (key === 'pages' ? ' items--pages' : '') }, [h('li', { class: 'loading', text: 'Loading…' })]);
    main.append(listEl);
    api('GET', 'list/' + key).then(function (items) {
      listEl.innerHTML = '';
      if (!items.length) listEl.append(h('li', { class: 'empty', text: 'Nothing here yet.' }));
      items.forEach(function (it) {
        var thumb = key === 'pages' ? null : h('span', { class: 'thumb thumb--' + (key === 'merch' ? 'square' : key === 'news' ? 'wide' : 'cover') }, [it.cover ? h('img', { src: it.cover, alt: '', loading: 'lazy' }) : h('span', { text: 'No image' })]);
        listEl.append(h('li', {}, [h('a', { href: '#/' + key + '/' + it.file }, [thumb, h('span', { class: 'items__text' }, [
          h('strong', { text: it.title }), it.sub ? h('span', { text: it.sub }) : null,
          it.unpublished ? h('span', { class: 'tag tag--off', text: 'Unpublished' }) : null,
          it.sample ? h('span', { class: 'tag', text: 'Sample' }) : null, it.draftFlag ? h('span', { class: 'tag tag--warn', text: 'Needs legal review' }) : null,
        ])])]));
      });
    }).catch(function (e) { listEl.innerHTML = ''; listEl.append(h('li', { class: 'empty', text: e.message })); });
    main.focus();
  }

  function editView(key, file) {
    var schema = S[key];
    setNav(key);
    main.innerHTML = '';
    main.append(h('p', { class: 'loading', text: 'Loading…' }));
    var url = schema.file ? 'file/' + schema.file : 'item/' + key + '/' + file;
    api('GET', url).then(function (data) {
      var titleText = schema.file ? schema.label : (data[schema.titleField] || file);
      if (key === 'books') state.previewPath = '/books/' + (data.slug || slug(data.title)) + '/';
      else if (key === 'pages') state.previewPath = '/' + (data.parent ? data.parent + '/' : '') + (data.slug || file.replace(/\.json$/, '')) + '/';
      else if (key === 'merch') state.previewPath = '/shop/';
      else if (key === 'news') state.previewPath = '/news/' + (data.slug || slug(data.title)) + '/';
      else state.previewPath = '/';
      main.innerHTML = '';
      var back = schema.file ? null : h('p', { class: 'crumb' }, [h('a', { href: '#/' + key, text: '← All ' + schema.label.toLowerCase() })]);
      main.append(back || '', h('div', { class: 'head' }, [h('h1', { text: titleText }), schema.file ? h('p', { class: 'intro', text: schema.intro }) : null]));
      if (data.sample) main.append(h('p', { class: 'note', text: 'This is a sample listing. Replace its details with a real one, or delete it.' }));
      var ctx = { builtIn: !!(schema.builtIn && schema.builtIn.indexOf(file) >= 0), file: file || '' };
      // Pages saved before the colour choice existed: show the colour the site actually uses, so saving doesn't change it.
      if (key === 'pages' && !data.tone) data.tone = file === 'faq.json' ? 'sun' : file === 'contact.json' || file === 'books.json' ? 'hot' : file === 'news.json' ? 'purple' : 'cobalt';
      state.currentFile = file || '';
      var formEl = h('form', { class: 'form', novalidate: true, onsubmit: function (e) { e.preventDefault(); save(false); } }, renderForm(schema, data, ctx));
      state.rerender = function () {
        var y = window.scrollY;
        formEl.innerHTML = ''; renderForm(schema, data, ctx).forEach(function (el) { formEl.append(el); });
        window.scrollTo(0, y);
        var sel = formEl.querySelector('select'); if (sel) sel.focus();
      };
      var saveState = h('span', { class: 'savebar__state', 'data-save-state': true, text: 'All changes saved' });
      function save(thenPreview) {
        var missing = validate(schema, data);
        if (missing.length) return toast('Fill in: ' + missing.join(', ') + '.', true);
        return api('PUT', url, data).then(function () {
          clean(); toast('Saved.');
          if (key === 'books') state.previewPath = '/books/' + (data.slug || slug(data.title)) + '/';
          if (thenPreview) preview();
        }).catch(function (e) { toast('Not saved: ' + e.message, true); });
      }
      var bar = h('div', { class: 'savebar' }, [
        h('button', { type: 'button', class: 'btn btn--primary', text: 'Save', onclick: function () { save(false); } }),
        h('button', { type: 'button', class: 'btn btn--secondary', 'data-preview': true, text: 'Save and preview', onclick: function () { save(true); } }),
        saveState,
        schema.file || schema.noNew || (schema.builtIn && schema.builtIn.indexOf(file) >= 0) ? null : h('button', { type: 'button', class: 'btn btn--danger', text: 'Delete', onclick: function () {
          if (!confirm('Delete "' + titleText + '"? It will be moved to the editor\'s trash folder, so you can get it back if you need to.')) return;
          api('DELETE', url).then(function () { clean(); toast('Deleted.'); location.hash = '#/' + key; }).catch(function (e) { toast(e.message, true); });
        } }),
      ]);
      main.append(formEl, bar);
      clean();
      main.focus();
    }).catch(function (e) { main.innerHTML = ''; main.append(h('p', { class: 'note note--bad', text: e.message })); });
  }

  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ---------- routing ----------
  var current = location.hash;
  // ---------- drag to reorder ----------
  // A grip handle for a list item. Works with a mouse, a trackpad or a finger.
  function grip() {
    return h('span', { class: 'grip', 'data-grip': true, title: 'Drag to move', 'aria-hidden': 'true' });
  }
  // Makes the <li data-key> children of ol draggable by their grip. When dropped, list is reordered to match and done() runs.
  function sortable(ol, list, done) {
    Array.prototype.forEach.call(ol.children, function (li) {
      var handle = li.querySelector(':scope > .order__row > [data-grip]');
      if (!handle || !li.hasAttribute('data-key')) return;
      handle.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        var startY = e.clientY, moved = false;
        li.classList.add('is-dragging'); document.body.classList.add('is-sorting');
        function onMove(ev) {
          if (!moved && Math.abs(ev.clientY - startY) < 3) return;
          moved = true;
          var sibs = Array.prototype.filter.call(ol.children, function (x) { return x !== li && x.hasAttribute('data-key'); });
          var target = sibs.find(function (x) { var r = (x.querySelector(':scope > .order__row') || x).getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
          if (target) { if (li.nextElementSibling !== target) ol.insertBefore(li, target); }
          else { var last = sibs[sibs.length - 1]; if (last && last.nextElementSibling !== li) ol.insertBefore(li, last.nextElementSibling); }
          // Keep the page scrolling when dragging near the top or bottom of the window.
          if (ev.clientY < 60) window.scrollBy(0, -12); else if (ev.clientY > window.innerHeight - 110) window.scrollBy(0, 12);
        }
        function onUp() {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          document.removeEventListener('pointercancel', onUp);
          li.classList.remove('is-dragging'); document.body.classList.remove('is-sorting');
          var keys = Array.prototype.filter.call(ol.children, function (x) { return x.hasAttribute('data-key'); }).map(function (x) { return x.getAttribute('data-key'); });
          if (keys.join('\n') === list.join('\n')) return;
          list.splice.apply(list, [0, list.length].concat(keys));
          markDirty(); done();
        }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
      });
    });
  }

  // ---------- menu order ----------
  function menuView() {
    setNav('menu'); state.previewPath = '/';
    main.innerHTML = '';
    main.append(h('div', { class: 'head' }, [h('h1', { text: 'Menu order' }), h('p', { class: 'intro', text: 'Drag items by their handle (or use Up and Down) to change the order of the menu at the top of every page, and of the pages inside each drop-down. Only pages ticked "Show in the menu" (in each page\'s settings, under Pages) are listed.' })]));
    var box = h('div', {}, [h('p', { class: 'loading', text: 'Loading…' })]);
    main.append(box);
    var hasNews = false;
    Promise.all([api('GET', 'list/pages'), api('GET', 'file/settings'), api('GET', 'list/news')]).then(function (res) {
      var pages = res[0], settings = res[1];
      hasNews = res[2].length > 0;
      return Promise.all(pages.map(function (it) { return api('GET', 'item/pages/' + it.file).then(function (d) { return { slug: it.file.replace(/\.json$/, ''), title: d.menu_label || d.title, parent: d.parent || '', menu: !!d.show_in_menu, menuOn: d.show_in_menu !== false && d.published !== false, label: d.menu_label || '', builtIn: S.pages.builtIn.indexOf(it.file) >= 0 }; }); }))
        .then(function (all) { draw(all, settings); });
    }).catch(function (e) { box.innerHTML = ''; box.append(h('p', { class: 'note note--bad', text: e.message })); });

    function draw(all, settings) {
      var bi = function (slug, name) { var p = all.find(function (x) { return x.slug === slug; }); return p && p.menuOn ? [[slug, p.label || name]] : []; };
      var items = [['books', (all.find(function (x) { return x.slug === 'books'; }) || {}).title || 'Our books']].concat(hasNews ? bi('news', 'News') : [], settings.show_shop ? [['shop', 'Shop']] : [], bi('about', 'About us'),
        all.filter(function (p) { return !p.builtIn && !p.parent && p.menu; }).map(function (p) { return [p.slug, p.title]; }),
        bi('faq', 'Questions'), bi('contact', 'Contact'));
      var keys = items.map(function (x) { return x[0]; });
      var order = (settings.menu_order || []).filter(function (k) { return keys.indexOf(k) >= 0; });
      keys.forEach(function (k, i) { if (order.indexOf(k) >= 0) return; var before = keys.slice(0, i).reverse().find(function (x) { return order.indexOf(x) >= 0; }); order.splice(before ? order.indexOf(before) + 1 : 0, 0, k); });
      var names = {}; items.forEach(function (x) { names[x[0]] = x[1]; });
      var sub = settings.submenu_order || {};
      var kidsOf = function (k) {
        var kids = all.filter(function (p) { return p.parent === k && p.menu; }).map(function (p) { return p.slug; });
        var saved = (sub[k] || []).filter(function (s) { return kids.indexOf(s) >= 0; });
        return saved.concat(kids.filter(function (s) { return saved.indexOf(s) < 0; }));
      };
      var titles = {}; all.forEach(function (p) { titles[p.slug] = p.title; });
      var subOrder = {}; order.forEach(function (k) { var kk = kidsOf(k); if (kk.length) subOrder[k] = kk; });

      function moveBtns(list, i, redraw, name) {
        return h('span', { class: 'order__btns' }, [
          h('button', { type: 'button', class: 'btn btn--quiet btn--sm', disabled: i === 0, 'aria-label': 'Move ' + name + ' up', text: '↑ Up', onclick: function () { list.splice(i - 1, 0, list.splice(i, 1)[0]); markDirty(); redraw(name, 'up'); } }),
          h('button', { type: 'button', class: 'btn btn--quiet btn--sm', disabled: i === list.length - 1, 'aria-label': 'Move ' + name + ' down', text: '↓ Down', onclick: function () { list.splice(i + 1, 0, list.splice(i, 1)[0]); markDirty(); redraw(name, 'down'); } }),
        ]);
      }
      function render(focusName, dir) {
        box.innerHTML = '';
        var ol = h('ol', { class: 'order' });
        order.forEach(function (k, i) {
          var kids = subOrder[k] || [];
          var li = h('li', { class: 'order__item', 'data-key': k }, [h('div', { class: 'order__row' }, [grip(), h('strong', { text: names[k] }), kids.length ? h('span', { class: 'tag', text: 'Drop-down' }) : null, moveBtns(order, i, render, names[k])])]);
          if (kids.length) {
            var sol = h('ol', { class: 'order order--sub' });
            sol.append(h('li', { class: 'order__item order__item--fixed' }, [h('div', { class: 'order__row' }, [h('span', { text: names[k] + ' (always first)' })])]));
            kids.forEach(function (c, ci) { sol.append(h('li', { class: 'order__item', 'data-key': c }, [h('div', { class: 'order__row' }, [grip(), h('span', { text: titles[c] || c }), moveBtns(kids, ci, render, titles[c] || c)])])); });
            li.append(sol);
            sortable(sol, kids, function () { render(); });
          }
          ol.append(li);
        });
        sortable(ol, order, function () { render(); });
        box.append(ol, h('p', { class: 'help', text: 'Instagram always comes last.' }));
        if (focusName) {
          var btn = Array.prototype.find.call(box.querySelectorAll('button'), function (b) { return b.getAttribute('aria-label') === 'Move ' + focusName + ' ' + dir && !b.disabled; })
            || Array.prototype.find.call(box.querySelectorAll('button'), function (b) { return (b.getAttribute('aria-label') || '').indexOf('Move ' + focusName + ' ') === 0 && !b.disabled; });
          if (btn) btn.focus();
        }
      }
      render();
      var bar = h('div', { class: 'savebar' }, [
        h('button', { type: 'button', class: 'btn btn--primary', text: 'Save', onclick: function () { save(false); } }),
        h('button', { type: 'button', class: 'btn btn--secondary', 'data-preview': true, text: 'Save and preview', onclick: function () { save(true); } }),
        h('span', { class: 'savebar__state', 'data-save-state': true, text: 'All changes saved' }),
      ]);
      main.append(bar);
      function save(thenPreview) {
        return api('GET', 'file/settings').then(function (fresh) {
          fresh.menu_order = order.slice();
          fresh.submenu_order = subOrder;
          return api('PUT', 'file/settings', fresh);
        }).then(function () { clean(); toast('Menu order saved.'); if (thenPreview) preview(); })
          .catch(function (e) { toast('Not saved: ' + e.message, true); });
      }
      clean();
    }
  }

  // ---------- book order ----------
  function bookOrderView() {
    setNav('bookorder'); state.previewPath = '/books/';
    main.innerHTML = '';
    main.append(h('div', { class: 'head' }, [h('h1', { text: 'Book order' }), h('p', { class: 'intro', text: 'Drag books by their handle (or use Up and Down) to set the order on the Our books page (shown as "Our pick", which visitors see first) and on the home page shelf and banner. Visitors can still sort by newest, title or price.' })]));
    var box = h('div', {}, [h('p', { class: 'loading', text: 'Loading…' })]);
    main.append(box);
    Promise.all([api('GET', 'list/books'), api('GET', 'file/settings')]).then(function (res) {
      var books = res[0], settings = res[1];
      return Promise.all(books.map(function (it) { return api('GET', 'item/books/' + it.file).then(function (d) {
        return { key: it.file.replace(/\.json$/, ''), title: d.title, author: d.author, date: d.publication_date || '', series: d.series || '', num: d.series_number || 0, sample: !!d.sample, cover: d.cover || '' };
      }); })).then(function (all) { draw(all, settings); });
    }).catch(function (e) { box.innerHTML = ''; box.append(h('p', { class: 'note note--bad', text: e.message })); });

    function draw(all, settings) {
      // The site's usual order (newest first), used for books you haven't placed yet.
      all.sort(function (a, b) { return (b.date || '9999').localeCompare(a.date || '9999') || a.series.localeCompare(b.series) || a.num - b.num || a.title.localeCompare(b.title); });
      var keys = all.map(function (b) { return b.key; });
      var order = (settings.book_order || []).filter(function (k) { return keys.indexOf(k) >= 0; });
      keys.forEach(function (k, i) { if (order.indexOf(k) >= 0) return; var before = keys.slice(0, i).reverse().find(function (x) { return order.indexOf(x) >= 0; }); order.splice(before ? order.indexOf(before) + 1 : 0, 0, k); });
      var byKey = {}; all.forEach(function (b) { byKey[b.key] = b; });
      var usingDefault = !(settings.book_order || []).length;
      function render(focusName, dir) {
        box.innerHTML = '';
        if (usingDefault) box.append(h('p', { class: 'note', text: 'Books are currently shown newest first. Move any book to start using your own order.' }));
        var ol = h('ol', { class: 'order order--books' });
        order.forEach(function (k, i) {
          var b = byKey[k];
          var name = b.title;
          ol.append(h('li', { class: 'order__item', 'data-key': k }, [h('div', { class: 'order__row' }, [
            grip(),
            h('span', { class: 'order__num', text: String(i + 1) }),
            h('span', { class: 'thumb thumb--cover' }, [b.cover ? h('img', { src: b.cover, alt: '' }) : h('span', { text: 'No image' })]),
            h('span', { class: 'items__text' }, [h('strong', { text: b.title }), h('span', { text: [b.author, b.series ? b.series + (b.num ? ' ' + b.num : '') : ''].filter(Boolean).join(' · ') }), b.sample ? h('span', { class: 'tag', text: 'Sample' }) : null]),
            h('span', { class: 'order__btns' }, [
              h('button', { type: 'button', class: 'btn btn--quiet btn--sm', disabled: i === 0, 'aria-label': 'Move ' + name + ' up', text: '↑ Up', onclick: function () { order.splice(i - 1, 0, order.splice(i, 1)[0]); usingDefault = false; markDirty(); render(name, 'up'); } }),
              h('button', { type: 'button', class: 'btn btn--quiet btn--sm', disabled: i === order.length - 1, 'aria-label': 'Move ' + name + ' down', text: '↓ Down', onclick: function () { order.splice(i + 1, 0, order.splice(i, 1)[0]); usingDefault = false; markDirty(); render(name, 'down'); } }),
            ]),
          ])]));
        });
        box.append(ol);
        sortable(ol, order, function () { usingDefault = false; render(); });
        box.append(h('p', {}, [h('button', { type: 'button', class: 'btn btn--secondary btn--sm', text: 'Go back to newest first', onclick: function () {
          if (!confirm('Go back to showing books newest first? Your own order will be cleared when you save.')) return;
          order = keys.slice(); usingDefault = true; markDirty(); render();
        } })]));
        if (focusName) {
          var btn = Array.prototype.find.call(box.querySelectorAll('button'), function (x) { return x.getAttribute('aria-label') === 'Move ' + focusName + ' ' + dir && !x.disabled; })
            || Array.prototype.find.call(box.querySelectorAll('button'), function (x) { return (x.getAttribute('aria-label') || '').indexOf('Move ' + focusName + ' ') === 0 && !x.disabled; });
          if (btn) btn.focus();
        }
      }
      render();
      main.append(h('div', { class: 'savebar' }, [
        h('button', { type: 'button', class: 'btn btn--primary', text: 'Save', onclick: function () { save(false); } }),
        h('button', { type: 'button', class: 'btn btn--secondary', 'data-preview': true, text: 'Save and preview', onclick: function () { save(true); } }),
        h('span', { class: 'savebar__state', 'data-save-state': true, text: 'All changes saved' }),
      ]));
      function save(thenPreview) {
        return api('GET', 'file/settings').then(function (fresh) {
          fresh.book_order = usingDefault ? [] : order.slice();
          return api('PUT', 'file/settings', fresh);
        }).then(function () { clean(); toast('Book order saved.'); if (thenPreview) preview(); })
          .catch(function (e) { toast('Not saved: ' + e.message, true); });
      }
      clean();
    }
  }

  function route() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'menu') return menuView();
    if (parts[0] === 'bookorder') return bookOrderView();
    var key = S[parts[0]] ? parts[0] : 'books';
    if (S[key].file) return editView(key);
    if (parts[1]) return editView(key, decodeURIComponent(parts[1]));
    return listView(key);
  }
  window.addEventListener('hashchange', function () {
    if (state.dirty && !confirm('You have unsaved changes. Leave without saving?')) {
      history.replaceState(null, '', current); return;
    }
    state.dirty = false; current = location.hash; route();
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      var b = document.querySelector('.savebar .btn--primary'); if (b) { e.preventDefault(); b.click(); }
    }
  });
  if (!location.hash) history.replaceState(null, '', '#/books');
  current = location.hash;
  route();
})();
