// Search, filter and sort on the Our books page. Without JavaScript every book is still listed.
(function () {
  'use strict';
  var form = document.querySelector('[data-filters]');
  var grid = document.querySelector('[data-grid]');
  if (!form || !grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-book]'));
  var count = document.querySelector('[data-count]');
  var empty = document.querySelector('[data-empty]');

  // Allow links like /books/?genre=Romantic%20comedy
  var params = new URLSearchParams(location.search);
  ['q', 'genre', 'format', 'availability', 'sort'].forEach(function (k) {
    if (params.get(k) && form.elements[k]) form.elements[k].value = params.get(k);
  });

  function has(list, value) { return !value || (list || '').split('|').indexOf(value) !== -1; }

  function apply() {
    var q = form.elements.q.value.trim().toLowerCase();
    var genre = form.elements.genre.value;
    var format = form.elements.format.value;
    var av = form.elements.availability.value;
    var sort = form.elements.sort.value;
    var shown = 0;

    cards.forEach(function (c) {
      var ok = (!q || c.dataset.search.indexOf(q) !== -1) &&
        has(c.dataset.genres, genre) && has(c.dataset.formats, format) && has(c.dataset.availability, av);
      c.hidden = !ok;
      if (ok) shown++;
    });

    var sorted = cards.slice().sort(function (a, b) {
      var pa = a.dataset.price === '' ? Infinity : parseFloat(a.dataset.price);
      var pb = b.dataset.price === '' ? Infinity : parseFloat(b.dataset.price);
      if (sort === 'title') return a.dataset.title.localeCompare(b.dataset.title);
      if (sort === 'price-asc') return pa - pb;
      if (sort === 'price-desc') return (pb === Infinity ? -1 : pb) - (pa === Infinity ? -1 : pa);
      if (sort === 'pick') return Number(a.dataset.pick) - Number(b.dataset.pick);
      return (b.dataset.date || '9999').localeCompare(a.dataset.date || '9999') || Number(a.dataset.pick) - Number(b.dataset.pick);
    });
    sorted.forEach(function (c) { grid.appendChild(c); });

    count.textContent = shown + (shown === 1 ? ' book' : ' books');
    empty.hidden = shown !== 0;

    var next = new URLSearchParams();
    ['q', 'genre', 'format', 'availability'].forEach(function (k) { if (form.elements[k].value) next.set(k, form.elements[k].value); });
    if (sort !== form.elements.sort.options[0].value) next.set('sort', sort);
    var qs = next.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) {}
  }

  form.addEventListener('input', apply);
  form.addEventListener('change', apply);
  form.addEventListener('submit', function (e) { e.preventDefault(); apply(); });
  var reset = document.querySelector('[data-reset]');
  if (reset) reset.addEventListener('click', function () { form.reset(); apply(); form.elements.q.focus(); });
  apply();
})();
