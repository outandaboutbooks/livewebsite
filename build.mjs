// Out and About Books — site build.
// Reads the content/ folder (edited through Pages CMS) and writes a complete static website to _site/.
// No npm packages needed: run with `node build.mjs`.
//   --relative   writes links that work when the files are opened without a web server (used for previews)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, t, ti, md, slugify, stripMd, money, niceDate, hash } from './src/lib.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, '_site');
const RELATIVE = process.argv.includes('--relative');
const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// A clear message if the content folder is missing (e.g. an update was unzipped without it).
if (!fs.existsSync(path.join(ROOT, 'content/settings.json'))) {
  console.error(`\nThe "content" folder is missing from:\n  ${ROOT}\n\nIt holds your books, covers and page text. Copy your content folder back into this folder\n(from your backup, or the Recycle Bin if it was deleted) and try again.\n`);
  process.exit(1);
}

// ---------- load content ----------
const S = readJSON('content/settings.json');

// Hosting options, set by the GitHub Pages workflow (not needed on a normal web host):
//   OAB_SITE_URL  the site's real address, e.g. https://name.github.io/repo (used for search engines and sharing)
//   OAB_BASE      the folder the site lives in on that address, e.g. /repo/
//   OAB_FORMS=off hosts that can't run send.php: hides the newsletter and review forms, and the contact form shows a note
if (process.env.OAB_SITE_URL) S.site_url = process.env.OAB_SITE_URL;
const BASE = ('/' + (process.env.OAB_BASE || '').replace(/^\/+|\/+$/g, '') + '/').replace(/^\/\/$/, '/');
const FORMS_OFF = process.env.OAB_FORMS === 'off';

// ---------- Text styles (Site settings > Text styles) ----------
// Fonts come from src/assets/fonts/fonts.json; only the chosen ones are copied to the live site.
const FONTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/assets/fonts/fonts.json'), 'utf8'));
const pickFont = (id, list, dflt) => (FONTS[list].includes(id) ? id : dflt);
const HEAD_FONT = pickFont(S.heading_font, 'heading', 'poppins');
const BODY_FONT = pickFont(S.body_font, 'body', 'lora');
const SCALE = { smaller: 0.92, standard: 1, larger: 1.1 };
const H_SCALE = { smaller: 0.86, standard: 1, larger: 1.14 };
const COLOUR_KEYS = { ink: '', red: '#e40303', orange: '#ff8c00', sun: '#f7c948', green: '#008026', cobalt: '#2f5fd0', navy: '#24408e', purple: '#732982', hot: '#d11f6b' };
const headingColour = COLOUR_KEYS[S.heading_colour] ?? (/^#[0-9a-f]{6}$/i.test(S.heading_colour || '') ? S.heading_colour.toLowerCase() : '');
function themeCss() {
  const fam = (id) => {
    const f = FONTS.fonts[id];
    const fallback = f.fallback === 'serif' ? 'Georgia, "Times New Roman", serif' : 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    return `"${f.name}", ${fallback}`;
  };
  const faces = [...new Set([HEAD_FONT, BODY_FONT])].filter((id) => !FONTS.fonts[id].builtIn).flatMap((id) => {
    const f = FONTS.fonts[id];
    return f.faces.map(([file, weight, style]) => `@font-face { font-family: "${f.name}"; src: url("../fonts/${id}/${file}") format("woff"); font-weight: ${weight}; font-style: ${style}; font-display: swap;${f.sizeAdjust ? ` size-adjust: ${f.sizeAdjust};` : ''} }`);
  });
  return `/* Made by the build from Site settings > Text styles. Don't edit by hand. */
${faces.join('\n')}
:root { --display: ${fam(HEAD_FONT)}; --serif: ${fam(BODY_FONT)}; --ts: ${SCALE[S.text_size] || 1}; --hs: ${H_SCALE[S.heading_size] || 1}; }
${PIN_ID ? `html[data-announce-closed="${PIN_ID}"] .announce { display: none; }` : ''}
${headingColour ? `.section-head h2, .how h2, .how__steps h3, .empty h2, .book__title, .book section > h2, .editions__h, .reviews h2, .review-form h3, .related h2, .prose h2, .prose h3, .contact__aside h2, .layout-card__body h2, .listen h2 { color: ${headingColour}; }` : ''}
`;
}
const bodyPreload = FONTS.fonts[BODY_FONT].builtIn ? '/assets/fonts/Lora-Variable.woff' : `/assets/fonts/${BODY_FONT}/${FONTS.fonts[BODY_FONT].faces[0][0]}`;
const HOME = readJSON('content/home.json');
const PAGES = Object.fromEntries(
  fs.readdirSync(path.join(ROOT, 'content/pages')).filter((f) => f.endsWith('.json'))
    .map((f) => { const p = readJSON('content/pages/' + f); return [p.slug || f.replace(/\.json$/, ''), p]; })
);
// Unpublished pages, books and shop items stay in the editor but are left off the website.
// The editor's own preview builds with OAB_DRAFTS=1, so they can still be checked there, marked as drafts.
const DRAFTS = process.env.OAB_DRAFTS === '1';
const DRAFT_PAGES = {};
const DRAFT_URLS = new Set();
for (const [slug, p] of Object.entries(PAGES)) {
  if (p.published === false) { if (DRAFTS) DRAFT_PAGES[slug] = p; delete PAGES[slug]; }
}
// The News page (content/pages/news.json) only holds the News page's title, introduction and colour:
// the page itself is built from the news posts, further down. Unpublishing it switches news off on the website.
const NEWS_PAGE = PAGES.news || DRAFT_PAGES.news || {};
const NEWS_OFF = (NEWS_PAGE.published === false || (!PAGES.news && DRAFT_PAGES.news)) && !DRAFTS;
delete PAGES.news; delete DRAFT_PAGES.news;

const AVAIL = {
  available: { label: 'Available', order: 0, buyable: true },
  pre_order: { label: 'Pre-order', order: 1, buyable: true },
  coming_soon: { label: 'Coming soon', order: 2, buyable: false },
  out_of_stock: { label: 'Out of stock', order: 3, buyable: false },
};

// Promotions: switched on per book, optionally between a start and an end date (UK dates).
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const promoActive = (p) => Boolean(p && p.enabled && String(p.label || '').trim()
  && (!p.start || TODAY >= p.start) && (!p.end || TODAY <= p.end));

let BOOKS = fs.readdirSync(path.join(ROOT, 'content/books')).filter((f) => f.endsWith('.json'))
  .map((f) => ({ ...readJSON('content/books/' + f), _file: f.replace(/\.json$/, '') }))
  .filter((b) => b.title && (S.show_sample_listings || !b.sample))
  .map((b) => {
    const slug = slugify(b.slug || b.title);
    const promo = promoActive(b.promotion) ? { label: String(b.promotion.label).trim(), message: String(b.promotion.message || '').trim(), end: b.promotion.end || '' } : null;
    const formats = (b.formats || []).filter((f) => f.format).map((f) => {
      const av = AVAIL[f.availability] || AVAIL.coming_soon;
      const price = f.price === null || f.price === '' || isNaN(Number(f.price)) ? null : Number(f.price);
      const dealRaw = f.deal_price === null || f.deal_price === undefined || f.deal_price === '' || isNaN(Number(f.deal_price)) ? null : Number(f.deal_price);
      const deal = promo && dealRaw !== null && (price === null || dealRaw < price) ? dealRaw : null;
      return {
        ...f,
        price,
        deal,
        id: `${slug}--${slugify(f.format)}`,
        avLabel: av.label,
        avOrder: av.order,
      };
    });
    const prices = formats.map((f) => (f.deal !== null ? f.deal : f.price)).filter((p) => p !== null);
    const normalPrices = formats.map((f) => f.price).filter((p) => p !== null);
    const best = formats.slice().sort((a, b2) => a.avOrder - b2.avOrder)[0];
    return {
      ...b,
      slug,
      url: `/books/${slug}/`,
      formats,
      genres: (b.genres || []).filter(Boolean),
      minPrice: prices.length ? Math.min(...prices) : null,
      minNormal: normalPrices.length ? Math.min(...normalPrices) : null,
      promo,
      availability: best ? best.availability : 'coming_soon',
      avLabel: best ? best.avLabel : 'Coming soon',
      seriesSlug: b.series ? slugify(b.series) : '',
    };
  })
  .sort((a, b) => (b.publication_date || '9999').localeCompare(a.publication_date || '9999') || (a.series || '').localeCompare(b.series || '') || (a.series_number || 0) - (b.series_number || 0) || a.title.localeCompare(b.title));

const DRAFT_BOOKS = DRAFTS ? BOOKS.filter((b) => b.published === false) : [];
BOOKS = BOOKS.filter((b) => b.published !== false);

// Put keys in a saved order; anything not in the saved list keeps its usual place next to the item before it.
function orderKeys(keys, saved) {
  const out = (saved || []).filter((k) => keys.includes(k));
  keys.forEach((k, i) => {
    if (out.includes(k)) return;
    const before = keys.slice(0, i).reverse().find((x) => out.includes(x));
    out.splice(before ? out.indexOf(before) + 1 : 0, 0, k);
  });
  return out;
}
// Book order set in the editor's "Book order" section (Site settings: book_order). Used for "Our pick" and the home page.
const BOOK_ORDER_SET = Array.isArray(S.book_order) && S.book_order.length > 0;
if (BOOK_ORDER_SET) {
  const order = orderKeys(BOOKS.map((b) => b._file), S.book_order);
  BOOKS = order.map((k) => BOOKS.find((b) => b._file === k));
}

// ---------- News (content/news) ----------
// Posts appear newest first on /news/. A post dated in the future stays hidden until that day (the site rebuilds daily).
// A post linked to a book can mark it as a launch: "New release" on the home page banner for 60 days, until unticked.
// A pinned post shows a slim news bar at the top of every page until its "pin until" date.
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const longDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const NEWS_DIR = path.join(ROOT, 'content/news');
let NEWS = (fs.existsSync(NEWS_DIR) ? fs.readdirSync(NEWS_DIR) : []).filter((f) => f.endsWith('.json'))
  .map((f) => ({ ...readJSON('content/news/' + f), _file: f.replace(/\.json$/, '') }))
  .filter((n) => String(n.title || '').trim() && /^\d{4}-\d{2}-\d{2}$/.test(n.date || ''));
{
  const used = new Set();
  for (const n of NEWS.sort((a, b) => a._file.localeCompare(b._file))) {
    let slug = slugify(n.slug || n.title), k = 2;
    while (used.has(slug) || slug === 'page') slug = slugify(n.slug || n.title) + '-' + k++;
    used.add(slug); n.slug = slug; n.url = `/news/${slug}/`;
  }
}
const isLive = (n) => !NEWS_OFF && n.published !== false && n.date <= TODAY;
const DRAFT_NEWS = DRAFTS && !NEWS_OFF ? NEWS.filter((n) => !isLive(n)) : [];
NEWS = NEWS.filter(isLive).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
const bookFor = (ref) => ref ? BOOKS.find((b) => b._file === ref || b.slug === ref) : null;
// Book -> its launch post, while the launch is current.
const LAUNCHES = new Map();
for (const n of NEWS) {
  const b = bookFor(n.book);
  if (b && n.launch === true && TODAY <= addDays(n.date, 60) && !LAUNCHES.has(b)) LAUNCHES.set(b, n);
}
const launchWords = (b) => b.availability === 'available' ? ['New release', 'Out now'] : b.availability === 'pre_order' ? ['Coming soon', 'Pre-order now'] : ['Coming soon', 'Coming soon'];
// The newest pinned post whose "pin until" date hasn't passed.
const PIN = NEWS.find((n) => n.pin && (!n.pin_until || TODAY <= n.pin_until)) || null;
const PIN_ID = PIN ? (PIN.slug + '-' + PIN.date + '-' + (PIN.pin_until || '')).replace(/[^a-z0-9-]/gi, '') : '';

const GENRES = [...new Set(BOOKS.flatMap((b) => b.genres))].sort();
const FORMATS = [...new Set(BOOKS.flatMap((b) => b.formats.map((f) => f.format)))];
const SERIES = [...new Set(BOOKS.map((b) => b.series).filter(Boolean))];

// ---------- page chrome ----------
// Merchandise: shown only when "Show the shop" is ticked in Site settings.
const SHOP_ON = Boolean(S.show_shop);
const MERCH = fs.existsSync(path.join(ROOT, 'content/merch'))
  ? fs.readdirSync(path.join(ROOT, 'content/merch')).filter((f) => f.endsWith('.json'))
      .map((f) => readJSON('content/merch/' + f))
      .filter((m) => m.name && m.published !== false && (S.show_sample_listings || !m.sample))
  : [];

// Instagram: the header button and the "Follow us on Instagram" band only appear once an Instagram link is set in Site settings.
const INSTAGRAM = (S.social_links || []).find((s) => /instagram/i.test(s.label || '') && /^https?:\/\//.test(s.url || ''));
const IG_HANDLE = INSTAGRAM ? ((/instagram\.com\/([A-Za-z0-9._]+)/i.exec(INSTAGRAM.url) || [])[1] || '') : '';
const igIcon = (size) => `<img src="/assets/img/favicon.svg" alt="" width="${size}" height="${size}">`;

// Pages added in the editor can ask to be linked from the menu and/or the footer.
const BUILT_IN_PAGES = ['about', 'faq', 'contact', 'privacy', 'cookies', 'terms', 'delivery-returns'];
const RESERVED = ['books', 'series', 'shop', 'news', 'admin', 'media', 'assets', 'review', 'newsletter', 'send.php', '404.html'];
for (const slug of Object.keys(PAGES)) {
  if (RESERVED.includes(slug)) { console.log(`Skipped the page "${PAGES[slug].title}": its web address /${slug}/ is used by another part of the site. Give it a different title.`); delete PAGES[slug]; }
}
const navLabel = (p) => String(p.menu_label || p.title || '').trim();
// Pages can sit one level below a page in the top menu (e.g. /events/book-launch/). Two levels at most.
// Any page in the top menu can have sub-pages: About us, Questions, Contact and the top-level pages you've added.
const MENU_BUILT_IN = ['about', 'faq', 'contact'];
const isTopAdded = (slug) => PAGES[slug] && (MENU_BUILT_IN.includes(slug) || (!BUILT_IN_PAGES.includes(slug) && !PAGES[slug].parent));
for (const [slug, p] of Object.entries(PAGES)) {
  if (p.parent && (p.parent === slug || BUILT_IN_PAGES.includes(slug) || !isTopAdded(p.parent) || (p.parent === 'contact' && slug === 'thanks'))) {
    console.log(`The page "${p.title}" can't sit under "${p.parent}", so it's shown as a top-level page.`); p.parent = '';
  }
}
const pageUrl = (slug) => { const p = PAGES[slug] || DRAFT_PAGES[slug]; return p && p.parent && (PAGES[p.parent] || DRAFT_PAGES[p.parent]) ? `/${p.parent}/${slug}/` : `/${slug}/`; };
// Menu order is set in the editor's "Menu order" section (saved in Site settings as menu_order and submenu_order).
const byOrder = (list) => (a, b) => { const ia = list.indexOf(a), ib = list.indexOf(b); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); };
const childrenOf = (slug) => Object.entries(PAGES).filter(([, p]) => p.parent === slug && p.show_in_menu)
  .sort(([a], [b]) => byOrder(((S.submenu_order || {})[slug]) || [])(a, b));
const MENU_PAGES = Object.entries(PAGES).filter(([slug, p]) => !BUILT_IN_PAGES.includes(slug) && !p.parent && p.show_in_menu);
const FOOTER_PAGES = Object.entries(PAGES).filter(([slug, p]) => !BUILT_IN_PAGES.includes(slug) && p.show_in_footer);

const NAV_ITEMS = [
  ['books', ['/books/', 'Our books']],
  ...((NEWS.length || DRAFT_NEWS.length) && NEWS_PAGE.show_in_menu !== false ? [['news', ['/news/', esc(String(NEWS_PAGE.menu_label || NEWS_PAGE.title || 'News').trim())]]] : []),
  ...(SHOP_ON ? [['shop', ['/shop/', 'Shop']]] : []),
  ...(PAGES.about && PAGES.about.show_in_menu !== false ? [['about', ['/about/', esc(PAGES.about.menu_label ? navLabel(PAGES.about) : 'About us'), childrenOf('about').map(([c, cp]) => [pageUrl(c), esc(navLabel(cp))])]]] : []),
  ...MENU_PAGES.map(([slug, p]) => [slug, [pageUrl(slug), esc(navLabel(p)), childrenOf(slug).map(([c, cp]) => [pageUrl(c), esc(navLabel(cp))])]]),
  ...(PAGES.faq && PAGES.faq.show_in_menu !== false ? [['faq', ['/faq/', esc(PAGES.faq.menu_label ? navLabel(PAGES.faq) : 'Questions'), childrenOf('faq').map(([c, cp]) => [pageUrl(c), esc(navLabel(cp))])]]] : []),
  ...(PAGES.contact && PAGES.contact.show_in_menu !== false ? [['contact', ['/contact/', esc(PAGES.contact.menu_label ? navLabel(PAGES.contact) : 'Contact'), childrenOf('contact').map(([c, cp]) => [pageUrl(c), esc(navLabel(cp))])]]] : []),
];
// Items in the saved order first; anything new keeps its usual place next to the item before it.
function orderNav(items, saved) {
  const keys = items.map(([k]) => k);
  const out = (saved || []).filter((k) => keys.includes(k));
  keys.forEach((k, i) => {
    if (out.includes(k)) return;
    const before = keys.slice(0, i).reverse().find((x) => out.includes(x));
    out.splice(before ? out.indexOf(before) + 1 : 0, 0, k);
  });
  return out.map((k) => items.find(([x]) => x === k)[1]);
}
const NAV = orderNav(NAV_ITEMS, S.menu_order);

const wordmark = () => `<img class="site-logo" src="/assets/img/brand/logo-stacked-books-colour.svg" alt="" width="110" height="80">`;

const analytics = S.analytics_plausible_domain
  ? `<script defer data-domain="${esc(S.analytics_plausible_domain)}" src="https://plausible.io/js/script.js"></script>`
  : '';

const footLink = (slug, label) => PAGES[slug] && PAGES[slug].show_in_footer !== false ? `<li><a href="/${slug}/">${label}</a></li>` : '';
const draftBanner = `<p class="draft-banner" role="note"><strong>Draft.</strong> This isn't published, so it isn't on the live website. You're seeing it because this is the editor's preview.</p>`;

function layout({ title, description, body, current = '', og = {}, jsonld = null, scripts = [], noindex = false, canonical, draft = false }) {
  if (draft) { noindex = true; DRAFT_URLS.add(canonical); }
  const fullTitle = title ? `${title} | ${S.site_name}` : `${S.site_name}: ${S.tagline}`;
  const desc = stripMd(description || S.meta_description).slice(0, 158);
  const canon = S.site_url.replace(/\/$/, '') + (canonical || '/');
  const ogImage = og.image ? S.site_url.replace(/\/$/, '') + og.image : S.site_url.replace(/\/$/, '') + '/assets/img/og-default.png';
  const socials = (S.social_links || []).filter((s) => s.url);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canon)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:site_name" content="${esc(S.site_name)}">
<meta property="og:type" content="${og.type || 'website'}">
<meta property="og:title" content="${esc(title || S.site_name)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canon)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#D11F6B">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="preload" href="${bodyPreload}" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css">
<link rel="stylesheet" href="/assets/css/theme.css">
<script src="/assets/js/js-flag.js"></script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
${analytics}
</head>
<body${RELATIVE ? ' data-preview="true"' : ''}>
<a class="skip" href="#main">Skip to content</a>
${PIN ? `<aside class="announce" data-announce="${PIN_ID}" aria-label="News"><div class="wrap announce__inner"><span class="announce__tag">News</span><p class="announce__text">${ti(PIN.pin_text || PIN.title)}</p><a class="announce__link" href="${PIN.url}">Find out more<span class="visually-hidden">: ${esc(PIN.title)}</span></a><button type="button" class="announce__x" data-announce-close hidden aria-label="Hide this news"><span aria-hidden="true">&times;</span></button></div></aside>` : ''}
<header class="site-header">
  <div class="wrap site-header__inner">
    <a class="site-header__brand" href="/" aria-label="${esc(S.site_name)}, home">${wordmark()}</a>
    <button type="button" class="menu-toggle" aria-controls="site-nav" aria-expanded="false" hidden><span class="menu-toggle__icon" aria-hidden="true"></span><span class="menu-toggle__label">Menu</span></button>
    <nav class="site-nav" id="site-nav" aria-label="Main">
      <ul>
        ${NAV.map(([href, label, kids], i) => kids && kids.length
          ? `<li class="dd${kids.some(([k]) => k === current) || current === href ? ' is-current' : ''}">
              <button type="button" class="dd__btn" aria-expanded="false" aria-controls="dd-${i}">${label}<svg class="dd__chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
              <ul class="dd__panel" id="dd-${i}">
                <li><a class="dd__parent" href="${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a></li>
                ${kids.map(([kh, kl]) => `<li><a href="${kh}"${current === kh ? ' aria-current="page"' : ''}>${kl}</a></li>`).join('')}
              </ul>
            </li>`
          : `<li><a href="${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a></li>`).join('')}
        ${INSTAGRAM ? `<li class="site-nav__ig"><a class="ig-link" href="${esc(INSTAGRAM.url)}" rel="noopener" target="_blank">${igIcon(34)}<span>Instagram</span><span class="visually-hidden"> (opens in a new tab)</span></a></li>` : ''}
      </ul>
    </nav>
  </div>
</header>
<main id="main">
${draft ? draftBanner : ''}${body}
</main>
${INSTAGRAM ? `<section class="ig-band" aria-labelledby="ig-band-h">
  <div class="wrap ig-band__inner">
    <h2 id="ig-band-h">Follow us on Instagram</h2>
    <a class="ig-band__btn" href="${esc(INSTAGRAM.url)}" rel="noopener" target="_blank">${igIcon(30)}<span>${IG_HANDLE ? '@' + esc(IG_HANDLE) : 'Instagram'}</span><span class="visually-hidden"> on Instagram (opens in a new tab)</span></a>
  </div>
</section>` : ''}
<footer class="site-footer">
  <div class="wrap site-footer__grid">
    <div class="site-footer__brand">
      <a href="/" aria-label="${esc(S.site_name)}, home">${wordmark()}</a>
      <p>${t(S.strapline)}</p>
    </div>
    <nav aria-label="Books">
      <h2>Books</h2>
      <ul>
        <li><a href="/books/">All books</a></li>
        ${SHOP_ON ? '<li><a href="/shop/">Shop</a></li>' : ''}
        ${SERIES.map((s) => `<li><a href="/series/${slugify(s)}/">${esc(s)}</a></li>`).join('')}
        ${GENRES.slice(0, 4).map((g) => `<li><a href="/books/genre/${slugify(g)}/">${esc(g)}</a></li>`).join('')}
      </ul>
    </nav>
    ${((help) => help ? `<nav aria-label="Help">
      <h2>Help</h2>
      <ul>
        ${help}
      </ul>
    </nav>` : '')(footLink('faq', 'Questions') + footLink('delivery-returns', 'Delivery and returns') + footLink('contact', 'Contact us') + footLink('about', 'About us') + FOOTER_PAGES.map(([slug, p]) => `<li><a href="${pageUrl(slug)}">${esc(navLabel(p))}</a></li>`).join(''))}
    ${((pol) => pol ? `<nav aria-label="Policies">
      <h2>Policies</h2>
      <ul>
        ${pol}
      </ul>
    </nav>` : '')(footLink('terms', 'Terms and conditions') + footLink('privacy', 'Privacy policy') + footLink('cookies', 'Cookies'))}
    <div class="site-footer__contact">
      <h2>Get in touch</h2>
      <p>${EMAIL_RE.test(S.contact_email) ? `<a href="mailto:${esc(S.contact_email)}">${esc(S.contact_email)}</a>` : t(S.contact_email)}</p>
      ${socials.length ? `<ul class="socials">${socials.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>` : ''}
    </div>
  </div>
  <div class="wrap site-footer__legal">
    <p>&copy; ${new Date().getFullYear()} ${t(S.trading_name)}, trading as ${esc(S.site_name)}. ${t(S.business_address)}${S.company_number ? `. Company number ${esc(S.company_number)}` : ''}${S.vat_number ? `. VAT number ${esc(S.vat_number)}` : ''}.</p>
  </div>
</footer>
<script src="/assets/js/site.js" defer></script>
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

// ---------- components ----------
const COVER_TONES = ['pine', 'heather', 'navy', 'ochre'];

const TONES = [
  { bg: '#E5533D', ink: '#FFF6EE', art: '#F6B08F' },
  { bg: '#2F5FD0', ink: '#F2F5FF', art: '#8FB0F2' },
  { bg: '#2E9E5B', ink: '#F1FBF4', art: '#9DDAB5' },
  { bg: '#E9B824', ink: '#2B2F3A', art: '#F7DE8A' },
  { bg: '#7B4CC2', ink: '#F7F1FF', art: '#C3A6EE' },
  { bg: '#F08A24', ink: '#2B2F3A', art: '#FBC88F' },
  { bg: '#E46AA6', ink: '#2B2F3A', art: '#F7BCD9' },
];
const ART = [
  (c) => `<circle cx="50" cy="58" r="26" fill="${c.art}"/><path d="M0 92 Q25 78 50 88 T100 84 V120 H0Z" fill="${c.ink}" opacity=".9"/>`,
  (c) => `<path d="M30 110 V62 a20 20 0 0 1 40 0 V110" fill="none" stroke="${c.art}" stroke-width="9"/><circle cx="50" cy="58" r="7" fill="${c.ink}"/>`,
  (c) => `<path d="M0 80 Q20 64 40 78 T80 74 T120 72 V120 H0Z" fill="${c.art}"/><path d="M0 96 Q22 84 44 94 T100 90 V120 H0Z" fill="${c.ink}" opacity=".85"/>`,
  (c) => `<path d="M50 96 C20 74 22 50 38 48 C46 47 50 54 50 58 C50 54 54 47 62 48 C78 50 80 74 50 96Z" fill="${c.art}"/>`,
  (c) => `<g fill="${c.art}">${[0,1,2].map(r=>[0,1,2].map(q=>`<circle cx="${26+q*24}" cy="${50+r*22}" r="8"/>`).join('')).join('')}</g>`,
];
// The promotion ribbon across the top-right corner of the front cover.
const ribbon = (b) => b.promo ? `<span class="promo-ribbon"${b.promo.label.length > 16 ? ' data-long' : ''}><span class="visually-hidden">Promotion: </span>${esc(b.promo.label)}</span>` : '';

function cover(b, { size = 'md', eager = false, decorative = false } = {}) {
  if (b.cover) {
    return `<div class="cover cover--${size}${b.promo ? ' has-promo' : ''}">${ribbon(b)}<img src="${esc(b.cover)}" alt="${decorative ? '' : esc(b.cover_alt || `Front cover of ${b.title} by ${b.author}`)}" width="500" height="800" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`;
  }
  const i = Math.max(0, BOOKS.indexOf(b));
  const c = TONES[i % TONES.length];
  const art = ART[(i * 3 + 1) % ART.length](c);
  const label = b.sample ? 'Sample listing' : 'Placeholder cover';
  return `<div class="cover cover--${size} cover--placeholder${b.promo ? ' has-promo' : ''}" style="background:${c.bg};color:${c.ink}" ${decorative ? 'aria-hidden="true"' : `role="img" aria-label="${esc(label)} for ${esc(b.title)}. The real cover hasn't been added yet."`}>
    <div class="cover__top"><span>${esc(b.series || 'Out and About')}</span><span>${b.series_number ? esc(b.series_number) : ''}</span></div>
    <span class="cover__title">${esc(b.title)}</span>
    <span class="cover__byline">${esc(b.author)}</span>
    <svg class="cover__art" viewBox="0 0 100 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${art}</svg>
    <span class="cover__flag">${label}</span>
    ${ribbon(b)}
  </div>`;
}

function priceText(b) {
  if (b.minPrice === null) return 'Price to be confirmed';
  const multi = new Set(b.formats.map((f) => f.price).filter((p) => p !== null)).size > 1;
  const text = b.minPrice === 0 ? 'Free' : (multi ? 'From ' : '') + money(b.minPrice);
  return b.minNormal !== null && b.minPrice < b.minNormal ? `<del><span class="visually-hidden">Was </span>${money(b.minNormal)}</del> <strong class="deal">${text}</strong>` : text;
}

function bookCard(b, { headingLevel = 3, eager = false } = {}) {
  const h = `h${headingLevel}`;
  return `<article class="book-card" data-book
    data-title="${esc(b.title.toLowerCase())}"
    data-search="${esc([b.title, b.subtitle, b.author, b.series, b.short_description, ...b.genres].join(' ').toLowerCase())}"
    data-genres="${esc(b.genres.join('|'))}"
    data-formats="${esc(b.formats.map((f) => f.format).join('|'))}"
    data-availability="${esc(b.formats.map((f) => f.availability).join('|'))}"
    data-price="${b.minPrice ?? ''}"
    data-date="${esc(b.publication_date || '')}"
    data-pick="${BOOKS.indexOf(b)}">
    <a class="book-card__link" href="${b.url}">
      <${h} class="book-card__title">${t(b.title)}</${h}>
      <p class="book-card__author">${esc(b.author)}</p>
      ${b.promo ? `<span class="visually-hidden">On promotion: ${esc(b.promo.label)}.</span>` : ''}
      <p class="book-card__meta"><span class="status status--${esc(b.availability)}">${esc(b.avLabel)}</span> <span class="book-card__price">${b.minPrice === null ? '' : priceText(b)}</span></p>
      ${cover(b, { eager, decorative: true })}
    </a>
    ${b.short_description ? `<p class="book-card__desc">${ti(b.short_description)}</p>` : ''}
    ${b.sample ? '<p class="sample-note">Sample data, not a real book</p>' : ''}
  </article>`;
}

// Full-width colour band behind each page title. tone: red, orange, sun (yellow), green, cobalt (blue), navy, purple or hot (pink).
// A tone can also be your own #code, e.g. #3a7bd5: the text then turns white or dark, whichever is easier to read.
const TONE_KEYS = ['red', 'orange', 'sun', 'green', 'cobalt', 'navy', 'purple', 'hot'];
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));
const toneOr = (v, dflt) => TONE_KEYS.includes(v) || isHex(v) ? v : dflt;
function inkFor(hex) {
  const lum = (h) => [1, 3, 5].map((i) => { const x = parseInt(h.substr(i, 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; })
    .reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
  const L = lum(hex);
  return 1.05 / (L + 0.05) >= (L + 0.05) / (lum('#1e2422') + 0.05) ? '#fff' : 'var(--ink)';
}
function pageHead(title, intro, { needsReview = false, tone = 'hot' } = {}) {
  const band = isHex(tone) ? `page-band" style="--band:${tone.toLowerCase()};--band-ink:${inkFor(tone)}` : `page-band page-band--${toneOr(tone, 'hot')}`;
  return `<header class="${band}"><div class="page-head wrap">
    <h1>${t(title)}</h1>
    ${intro ? `<p class="page-head__intro">${ti(intro)}</p>` : ''}
    ${needsReview ? `<p class="review-flag" role="note"><strong>Needs legal review before launch.</strong> This page is a template. Fill in everything in square brackets and have it checked before taking real orders. <span class="review-flag__hint">(This notice disappears when you untick "Needs legal review" in the admin.)</span></p>` : ''}
  </div></header>`;
}

function newsletter() {
  if (!S.newsletter_enabled || FORMS_OFF) return '';
  return `<section class="newsletter" aria-labelledby="newsletter-h">
    <div class="wrap newsletter__inner">
      <div>
        <h2 id="newsletter-h">${t(S.newsletter_heading)}</h2>
        <p>${ti(S.newsletter_text)}</p>
      </div>
      <form class="newsletter__form" name="newsletter" method="POST" action="/send.php" data-ajax-form>
        <input type="hidden" name="form-name" value="newsletter">
        <p class="hp" aria-hidden="true"><label>Leave this empty <input name="company" tabindex="-1" autocomplete="off"></label></p>
        <div class="newsletter__row">
          <label for="nl-email" class="newsletter__label">Email address</label>
          <input id="nl-email" type="email" name="email" autocomplete="email" required>
          <button class="btn btn--primary" type="submit">Sign up</button>
        </div>
        <p class="small">We'll only use your email to send the newsletter. ${PAGES.privacy ? 'See our <a href="/privacy/">privacy policy</a>.' : ''}</p>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </section>`;
}

// ---------- reader reviews ----------
// Reviews readers send through the site arrive by email; you publish the ones you choose in the editor or admin.
const starsHTML = (n, size = '') => `<span class="stars${size}" role="img" aria-label="${n} out of 5 stars">${'★'.repeat(n)}<span class="stars__off">${'★'.repeat(5 - n)}</span></span>`;
const cleanReviews = (b) => (b.reviews || [])
  .filter((r) => r && String(r.text || '').trim() && String(r.name || '').trim())
  .map((r) => ({ name: String(r.name).trim(), text: String(r.text).trim(), rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))), date: r.date || '', home: !!r.show_on_home }));
// The Amazon product code (ASIN) from a link such as https://www.amazon.co.uk/dp/B0XXXXXXX
const asinFrom = (url) => { const m = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i.exec(url || ''); return m ? m[1].toUpperCase() : ''; };

// ---------- pages ----------
// Page text can include {{contact_email}}, {{trading_name}}, {{business_address}}, {{dispatch_time}} and {{reply_time}},
// which are filled in from Site settings so you only enter them once.
const EMAIL_RE = /^[^\s@\[\]]+@[^\s@]+\.[^\s@]+$/;
const fill = (text) => String(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => {
  const v = S[k];
  if (v === undefined || v === null || v === '') return m;
  return k === 'contact_email' && EMAIL_RE.test(v) ? `[${v}](mailto:${v})` : String(v);
});
// Where the contact form and newsletter sign-ups are emailed (used by send.php).
const FORM_TO = EMAIL_RE.test(S.contact_email || '') ? S.contact_email : '';
const SITE_HOST = (() => { try { return new URL(S.site_url).hostname.replace(/^www\./, ''); } catch { return 'example.com'; } })();
const FORM_FROM = EMAIL_RE.test(S.form_sender_email || '') ? S.form_sender_email : `website@${SITE_HOST}`;
const pages = {}; // outPath -> html
const add = (urlPath, html) => { pages[urlPath] = html; };

// Home
{
  const featured = BOOKS.filter((b) => b.featured || b.new_release);
  const shelf = (featured.length ? featured : BOOKS).slice(0, 5);
  const lead = BOOKS.find((b) => b.featured && !b.sample) || shelf[0];
  // Books that take turns in the home page banner: every featured book (real ones first), up to six.
  // Reader quotes chosen for the home page (up to three, real books before samples).
  const homeQuotes = [...BOOKS.filter((b) => !b.sample), ...BOOKS.filter((b) => b.sample)]
    .flatMap((b) => cleanReviews(b).filter((r) => r.home).map((r) => ({ r, b }))).slice(0, 3);
  const heroBooks = [...new Set([...LAUNCHES.keys(), ...BOOKS.filter((b) => b.featured && !b.sample), ...BOOKS.filter((b) => b.featured && b.sample)])].slice(0, 6);
  const sticker = (b) => LAUNCHES.has(b) ? `<span class="new-sticker" aria-hidden="true">${launchWords(b)[0]}</span>` : '';
  const launchLink = (b, i, hide) => LAUNCHES.has(b) ? `<a class="launch-link" href="${LAUNCHES.get(b).url}" data-hero-launch="${i}"${hide ? ' hidden' : ''}><span class="launch-link__tag">${launchWords(b)[1]}</span>Read the launch news<span class="visually-hidden">: ${esc(b.title)}</span> <span aria-hidden="true">&rarr;</span></a>` : '';
  const heroLead = heroBooks.length === 1 ? heroBooks[0] : lead;
  const heroLines = HOME.hero_heading.split(/(?<=\.)\s+/);
  const body = `
  <div class="bold-hero"><section class="bold-hero__inner wrap">
    <div class="bold-hero__text">
      <h1 class="bold-hero__title">${heroLines.map((l) => `<span>${esc(l)}</span>`).join(' ')}</h1>
      ${HOME.hero_strapline ? `<p class="bold-hero__strap">${HOME.hero_strapline.split(/(?<=\.)\s+/).map((l) => `<span>${esc(l)}</span>`).join(' ')}</p>` : ''}
      <p class="bold-hero__sub">${ti(HOME.hero_text)}</p>
      <p class="bold-hero__actions"><a class="btn btn--light" href="/books/">${esc(HOME.hero_button)}</a> <a class="btn btn--ghost" href="#how-to-buy">How to buy</a></p>
    </div>
    ${heroBooks.length > 1 ? `<div class="hero-books" data-hero-cycle aria-roledescription="carousel" aria-label="Featured books">
      ${heroBooks.map((hb, i) => `<a class="bold-hero__book${i === 0 ? ' is-active' : ''}${LAUNCHES.has(hb) ? ' is-launch' : ''}" href="${hb.url}"${i ? ' inert aria-hidden="true"' : ''}>${sticker(hb)}${cover(hb, { size: 'lg', eager: i === 0 })}${LAUNCHES.has(hb) ? `<span class="visually-hidden"> (${launchWords(hb)[0]})</span>` : ''}</a>`).join('')}
      <div class="hero-books__controls">
        <button type="button" class="hero-books__pause" data-hero-pause aria-pressed="false"><span class="visually-hidden">Pause the featured books</span><span aria-hidden="true" class="hero-books__pause-icon"></span></button>
        ${heroBooks.map((hb, i) => `<button type="button" class="hero-books__dot" data-hero-dot="${i}" aria-label="Show ${esc(hb.title)}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('')}
      </div>
      ${heroBooks.map((hb, i) => launchLink(hb, i, i !== 0)).join('')}
    </div>` : heroLead ? `<div class="hero-books hero-books--single"><a class="bold-hero__book${LAUNCHES.has(heroLead) ? ' is-launch' : ''}" href="${heroLead.url}">${sticker(heroLead)}${cover(heroLead, { size: 'lg', eager: true })}</a>${launchLink(heroLead, 0, false)}</div>` : ''}
  </section></div>
  ${(HOME.ticker || []).length ? `<div class="ticker" aria-hidden="true"><div class="ticker__track">${Array(4).fill((HOME.ticker || []).map((w) => `<span>${esc(w)}</span>`).join('')).join('')}</div></div>` : ''}
  <section class="shelf wrap" aria-labelledby="shelf-h">
    <div class="section-head">
      <h2 id="shelf-h">${t(HOME.books_heading)}</h2>
      <p>${ti(HOME.books_text)}</p>
    </div>
    <div class="book-grid">${shelf.map((b) => bookCard(b)).join('')}</div>
    <p class="shelf__more"><a class="btn btn--secondary" href="/books/">Browse all books</a></p>
  </section>

  ${homeQuotes.length ? `<section class="home-quotes" aria-labelledby="hq-h"><div class="wrap">
    <h2 id="hq-h">What readers say</h2>
    <div class="home-quotes__list">${homeQuotes.map(({ r, b }) => `<figure class="review-card">${starsHTML(r.rating)}<blockquote>${md(r.text)}</blockquote><figcaption>${esc(r.name)}, on <a href="${b.url}"><cite>${t(b.title)}</cite></a></figcaption></figure>`).join('')}</div>
  </div></section>` : ''}

  <div class="how-band"><section class="how wrap" id="how-to-buy" aria-labelledby="how-h">
    <h2 id="how-h">How to buy our books</h2>
    <ol class="how__steps">
      <li><h3>Choose a book</h3><p>Browse <a href="/books/">our books</a> and open any title to read the full description.</p></li>
      <li><h3>Pick a format</h3><p>Each book page lists the paperback, hardback and eBook editions that are available, with prices.</p></li>
      <li><h3>Buy it your way</h3><p>Buy on Amazon, where paperbacks are printed to order and eBooks arrive on Kindle straight away. Some titles are also sold by other shops, linked on the book page.</p></li>
    </ol>
  </section></div>

  <section class="imprint" aria-labelledby="imprint-h">
    <div class="wrap imprint__inner">
      <img class="imprint__mark" src="/assets/img/brand/logo-stacked-white.svg" alt="" width="160" height="110">
      <div>
        <h2 id="imprint-h">${t(HOME.about_heading)}</h2>
        <p>${ti(HOME.about_text)}</p>
        ${PAGES.about ? `<p><a class="link-light" href="/about/">${esc(HOME.about_link)}</a></p>` : ''}
      </div>
    </div>
  </section>
  ${newsletter()}`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: S.site_name,
    url: S.site_url,
    logo: S.site_url.replace(/\/$/, '') + '/assets/img/logo.png',
    slogan: S.tagline,
  };
  add('/', layout({ title: '', description: S.meta_description, body, current: '/', jsonld, canonical: '/' }));
}

// Catalogue
const BOOKS_TONE = toneOr(S.books_tone, 'hot');
function catalogue({ title, intro, list, canonical, filters = true, current = '/books/', crumbs = '' }) {
  const opt = (v, l = v) => `<option value="${esc(v)}">${esc(l)}</option>`;
  const avUsed = Object.entries(AVAIL).filter(([k]) => list.some((b) => b.formats.some((f) => f.availability === k)));
  return layout({
    title,
    description: intro,
    canonical,
    current,
    scripts: filters ? ['/assets/js/catalogue.js'] : [],
    body: `
    ${pageHead(title, intro, { tone: BOOKS_TONE })}
    ${crumbs}
    <section class="wrap catalogue" aria-label="Book list">
      ${filters ? `<form class="filters" role="search" aria-label="Search and filter books" data-filters>
        <div class="filters__field filters__field--search">
          <label for="f-q">Search</label>
          <input id="f-q" type="search" name="q" placeholder="Title, author or series" autocomplete="off">
        </div>
        <div class="filters__field">
          <label for="f-genre">Genre</label>
          <select id="f-genre" name="genre"><option value="">All genres</option>${GENRES.map((g) => opt(g)).join('')}</select>
        </div>
        <div class="filters__field">
          <label for="f-format">Format</label>
          <select id="f-format" name="format"><option value="">All formats</option>${FORMATS.map((f) => opt(f)).join('')}</select>
        </div>
        <div class="filters__field">
          <label for="f-av">Availability</label>
          <select id="f-av" name="availability"><option value="">Any</option>${avUsed.map(([k, v]) => opt(k, v.label)).join('')}</select>
        </div>
        <div class="filters__field">
          <label for="f-sort">Sort by</label>
          <select id="f-sort" name="sort">
            ${BOOK_ORDER_SET ? '<option value="pick">Our pick</option>' : ''}
            <option value="newest">Newest first</option>
            <option value="title">Title, A to Z</option>
            <option value="price-asc">Price, low to high</option>
            <option value="price-desc">Price, high to low</option>
          </select>
        </div>
      </form>
      <p class="results-count" role="status" aria-live="polite" data-count>${list.length} ${list.length === 1 ? 'book' : 'books'}</p>` : ''}
      <div class="book-grid book-grid--catalogue" data-grid>${list.map((b) => bookCard(b, { headingLevel: 2 })).join('')}</div>
      <div class="empty" data-empty hidden>
        <h2>No books match those filters</h2>
        <p>Try a different search or <button type="button" class="link-button" data-reset>clear all filters</button>.</p>
      </div>
    </section>`,
  });
}

add('/books/', catalogue({
  title: 'Our books',
  intro: 'LGBTQ+ fiction from Out and About Books: love stories, mysteries and journeys across the UK and Europe.',
  list: BOOKS,
  canonical: '/books/',
}));

for (const g of GENRES) {
  const list = BOOKS.filter((b) => b.genres.includes(g));
  add(`/books/genre/${slugify(g)}/`, catalogue({
    title: g,
    intro: `${list.length} ${list.length === 1 ? 'book' : 'books'} in ${g.toLowerCase()} from Out and About Books.`,
    list, canonical: `/books/genre/${slugify(g)}/`, filters: false,
    crumbs: `<p class="wrap crumbs"><a href="/books/">All books</a></p>`,
  }));
}
for (const s of SERIES) {
  const list = BOOKS.filter((b) => b.series === s).sort((a, b) => (a.series_number || 0) - (b.series_number || 0));
  add(`/series/${slugify(s)}/`, catalogue({
    title: s,
    intro: `The ${s} series, in reading order.`,
    list, canonical: `/series/${slugify(s)}/`, filters: false,
    crumbs: `<p class="wrap crumbs"><a href="/books/">All books</a></p>`,
  }));
}

// Book pages
for (const b of [...BOOKS, ...DRAFT_BOOKS]) {
  const isDraft = DRAFT_BOOKS.includes(b);
  const related = BOOKS.filter((o) => o.slug !== b.slug)
    .map((o) => ({ o, score: (o.series && o.series === b.series ? 10 : 0) + o.genres.filter((g) => b.genres.includes(g)).length + (o.sample ? -5 : 0) }))
    .filter((x) => x.score > 0).sort((a, b2) => b2.score - a.score).slice(0, 3).map((x) => x.o);

  // Reader reviews and Amazon review links.
  const reviews = cleanReviews(b);
  const avg = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0;
  const onSale = b.formats.find((f) => f.amazon_url && (f.availability === 'available' || f.availability === 'pre_order'));
  const asin = onSale ? asinFrom(onSale.amazon_url) : '';
  const amazonHost = onSale ? (/^https?:\/\/(www\.amazon\.[a-z.]+)/i.exec(onSale.amazon_url) || [, 'www.amazon.co.uk'])[1] : '';
  const amazonButtons = onSale ? `<p class="review-amazon">
      <a class="btn btn--secondary" href="${esc(onSale.amazon_url)}#customerReviews" rel="noopener" target="_blank">Read reviews on Amazon<span class="visually-hidden"> (opens in a new tab)</span></a>
      ${asin ? `<a class="btn btn--secondary" href="https://${esc(amazonHost)}/review/create-review?asin=${esc(asin)}" rel="noopener" target="_blank">Loved it? Leave a review on Amazon<span class="visually-hidden"> (opens in a new tab)</span></a>` : ''}
    </p>` : '';
  const reviewForm = FORMS_OFF ? '' : `<details class="review-write">
      <summary class="btn btn--primary">Write a review</summary>
      <form class="review-form" name="review" method="POST" action="/send.php" data-ajax-form novalidate>
        <input type="hidden" name="form-name" value="review">
        <input type="hidden" name="book" value="${esc(b.title)}">
        <input type="hidden" name="back" value="${b.url}">
        <p class="hp" aria-hidden="true"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label></p>
        <h3>Share your thoughts</h3>
        <div class="review-form__row">
          <div class="field">
            <label for="rv-name">Your name, as it should appear</label>
            <input id="rv-name" name="name" autocomplete="given-name" maxlength="80" required>
            <p class="field__error" id="rv-name-err" hidden>Enter a name to show with your review.</p>
          </div>
          <div class="field">
            <label for="rv-rating">Your rating</label>
            <select id="rv-rating" name="rating" required>
              <option value="">Choose…</option>
              <option value="5">5 stars: loved it</option>
              <option value="4">4 stars: really liked it</option>
              <option value="3">3 stars: liked it</option>
              <option value="2">2 stars: it was OK</option>
              <option value="1">1 star: not for me</option>
            </select>
            <p class="field__error" id="rv-rating-err" hidden>Choose a star rating.</p>
          </div>
        </div>
        <div class="field">
          <label for="rv-review">Your review</label>
          <textarea id="rv-review" name="review" rows="5" maxlength="3000" required></textarea>
          <p class="field__error" id="rv-review-err" hidden>Write a few words about the book.</p>
        </div>
        <div class="field">
          <label for="rv-email">Email address (optional, never shown)</label>
          <input id="rv-email" name="email" type="email" autocomplete="email">
          <p class="small">Only so we can reply or ask before quoting you elsewhere.</p>
        </div>
        <div class="check-field">
          <input id="rv-consent" name="consent" type="checkbox" value="yes" required>
          <label for="rv-consent">I'm happy for my name, rating and review to be published on this website.</label>
          <p class="field__error" id="rv-consent-err" hidden>Tick the box so we can publish your review.</p>
        </div>
        <p class="small review-policy">We read every review before it appears. We publish honest reviews, positive or negative, as they were written, but not ones that are abusive, discriminatory, off-topic or contain spoilers without warning. ${PAGES.privacy ? 'See our <a href="/privacy/">privacy policy</a>.' : ''}</p>
        <button class="btn btn--primary" type="submit">Send review</button>
        <p class="form-status" role="status" aria-live="polite" tabindex="-1"></p>
      </form>
    </details>`;
  const reviewsSection = `<section class="reviews" aria-labelledby="rev-h">
      <h2 id="rev-h">What readers say</h2>
      ${reviews.length ? `<p class="reviews__avg">${starsHTML(Math.round(avg))} <strong>${avg.toFixed(1).replace(/\.0$/, '')} out of 5</strong> <span>from ${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'} on this site</span></p>
      <div class="reviews__list">${reviews.map((r) => `<figure class="review-card">${starsHTML(r.rating)}<blockquote>${md(r.text)}</blockquote><figcaption>${esc(r.name)}${r.date ? `<span class="visually-hidden">, ${niceDate(r.date)}</span>` : ''}</figcaption></figure>`).join('')}</div>`
      : `<p class="reviews__none">No reviews on this site yet. ${onSale ? 'Have you read it? ' : ''}Be the first to share your thoughts.</p>`}
      ${amazonButtons}
      ${reviewForm}
    </section>`;

  // Audio excerpts: only those with both a title and an audio file are shown.
  const excerpts = (b.excerpts || []).filter((x) => x && x.audio && String(x.title || '').trim())
    .map((x) => ({ title: String(x.title).trim(), narrator: String(x.narrator || '').trim(), audio: x.audio, transcript: String(x.transcript || '').trim() }));

  const buyButtons = (f, primary) => {
    const btns = [];
    const cls = 'btn btn--secondary'; // all buy buttons look the same: outline, pink on hover
    const amazonBuyable = f.amazon_url && (f.availability === 'available' || f.availability === 'pre_order');
    if (amazonBuyable) btns.push(`<a class="${cls}" href="${esc(f.amazon_url)}" rel="noopener" target="_blank">${f.availability === 'pre_order' ? 'Pre-order' : 'Buy'} ${f.format === 'eBook' ? 'the eBook' : `the ${esc(f.format.toLowerCase())}`} on Amazon<span class="visually-hidden"> (opens in a new tab)</span></a>`);
    if (f.other_url && (f.availability === 'available' || f.availability === 'pre_order')) btns.push(`<a class="btn btn--secondary" href="${esc(f.other_url)}" rel="noopener" target="_blank">${esc(f.other_label || 'Buy elsewhere')}<span class="visually-hidden"> (opens in a new tab)</span></a>`);
    return btns.join(' ');
  };
  const anyBuyable = b.formats.some((f) => buyButtons(f, false));
  let primaryUsed = false;
  const editions = b.formats.map((f) => {
    const buttons = buyButtons(f, !primaryUsed);
    if (buttons) primaryUsed = true;
    return `<li class="edition">
      <div class="edition__info">
        <h3 class="edition__format">${esc(f.format)}</h3>
        <p class="edition__price">${f.deal !== null ? `${f.price !== null ? `<del><span class="visually-hidden">Was </span>${money(f.price)}</del> ` : ''}<strong class="deal">${f.deal === 0 ? 'Free' : money(f.deal)}</strong> <span class="deal-tag">Deal price</span>` : f.price !== null ? money(f.price) : 'Price to be confirmed'}</p>
        <p><span class="status status--${esc(f.availability)}">${esc(f.avLabel)}</span>${f.isbn ? ` <span class="edition__isbn">ISBN ${esc(f.isbn)}</span>` : ''}</p>
      </div>
      <div class="edition__buy">${buttons || (f.availability === 'coming_soon' ? '<p class="small">Not on sale yet</p>' : f.availability === 'out_of_stock' ? '<p class="small">Temporarily unavailable</p>' : '<p class="small">Buying link coming soon</p>')}</div>
    </li>`;
  }).join('');

  const details = [
    ['Author', esc(b.author)],
    b.series ? ['Series', `<a href="/series/${b.seriesSlug}/">${esc(b.series)}</a>${b.series_number ? `, book ${esc(b.series_number)}` : ''}`] : null,
    ['Publication date', b.publication_date ? niceDate(b.publication_date) : 'To be confirmed'],
    ['Publisher', esc(S.site_name)],
    b.page_count ? ['Pages', esc(b.page_count)] : null,
    ...b.formats.filter((f) => f.isbn).map((f) => [`ISBN (${esc(f.format.toLowerCase())})`, esc(f.isbn)]),
    b.setting ? ['Setting', esc(b.setting)] : null,
    b.genres.length ? ['Genres', b.genres.map((g) => `<a href="/books/genre/${slugify(g)}/">${esc(g)}</a>`).join(', ')] : null,
  ].filter(Boolean);

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: b.title,
    ...(b.subtitle ? { alternativeHeadline: b.subtitle } : {}),
    author: { '@type': 'Person', name: b.author },
    publisher: { '@type': 'Organization', name: S.site_name, url: S.site_url },
    url: S.site_url.replace(/\/$/, '') + b.url,
    description: stripMd(b.short_description || b.synopsis),
    ...(b.cover ? { image: S.site_url.replace(/\/$/, '') + b.cover } : {}),
    ...(b.genres.length ? { genre: b.genres } : {}),
    ...(b.series ? { isPartOf: { '@type': 'BookSeries', name: b.series }, position: b.series_number } : {}),
    inLanguage: 'en-GB',
    workExample: b.formats.map((f) => ({
      '@type': 'Book',
      bookFormat: f.format === 'eBook' ? 'https://schema.org/EBook' : f.format === 'Hardback' ? 'https://schema.org/Hardcover' : 'https://schema.org/Paperback',
      ...(f.isbn ? { isbn: f.isbn } : {}),
      ...(b.publication_date ? { datePublished: b.publication_date } : {}),
      ...(b.page_count && f.format !== 'eBook' ? { numberOfPages: b.page_count } : {}),
      ...(f.price !== null ? { offers: { '@type': 'Offer', price: f.price.toFixed(2), priceCurrency: 'GBP', availability: { available: 'https://schema.org/InStock', pre_order: 'https://schema.org/PreOrder', out_of_stock: 'https://schema.org/OutOfStock', coming_soon: 'https://schema.org/PreSale' }[f.availability] || 'https://schema.org/PreSale', url: S.site_url.replace(/\/$/, '') + b.url } } : {}),
    })),
  };
  // Leave structured data out of sample listings and of anything still holding placeholders.
  const cleanJsonld = !b.sample && !/\[[^\]]+\]/.test(b.title) ? jsonld : null;

  const body = `
  <article class="book wrap">
    <p class="crumbs"><a href="/books/">All books</a>${b.series ? ` <span aria-hidden="true">/</span> <a href="/series/${b.seriesSlug}/">${esc(b.series)}</a>` : ''}</p>
    ${b.sample ? '<p class="review-flag" role="note"><strong>Sample listing.</strong> This is not a real book. It shows how a finished book page looks. Delete it in the admin, or switch off "Show sample listings" in Site settings.</p>' : ''}
    <div class="book__grid">
      <div class="book__cover">${cover(b, { size: 'xl', eager: true })}${(b.cover && b.back_cover) || excerpts.length ? `
        <div class="cover-thumbs">${b.cover && b.back_cover ? `
        <div class="cover-switch" role="group" aria-label="Choose cover view">
          <a class="cover-switch__btn" href="${esc(b.cover)}" data-cover-src="${esc(b.cover)}" data-cover-alt="${esc(b.cover_alt || `Front cover of ${b.title} by ${b.author}`)}" aria-pressed="true"><img src="${esc(b.cover)}" alt="" width="50" height="80" loading="lazy"><span>Front</span></a>
          <a class="cover-switch__btn" href="${esc(b.back_cover)}" data-cover-src="${esc(b.back_cover)}" data-cover-alt="${esc(b.back_cover_alt || `Back cover of ${b.title} by ${b.author}`)}" aria-pressed="false"><img src="${esc(b.back_cover)}" alt="" width="50" height="80" loading="lazy"><span>Back</span></a>
        </div>` : ''}${excerpts.map((x, i) => `
          <a class="listen-tile" href="#ex-${i}" data-listen="${i}" aria-label="Play excerpt: ${esc(x.title)}"><span class="listen-tile__tile" aria-hidden="true"><span class="listen-tile__wave"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="listen-tile__icon"><svg class="listen-tile__play" viewBox="0 0 10 10"><path d="M2.5 1.2v7.6L8.8 5z"/></svg><svg class="listen-tile__pause" viewBox="0 0 10 10"><path d="M2 1h2.2v8H2zM5.8 1H8v8H5.8z"/></svg></span><span class="listen-tile__bar"><b></b></span></span><span class="listen-tile__label" data-listen-label>${excerpts.length > 1 ? `Listen ${i + 1}` : 'Listen'}</span></a>`).join('')}
        </div>` : ''}</div>
      <div class="book__main">
        <header class="book__head">
          ${b.series ? `<p class="book__series"><a href="/series/${b.seriesSlug}/">${esc(b.series)}</a>${b.series_number ? `, book ${esc(b.series_number)}` : ''}</p>` : ''}
          <h1 class="book__title">${t(b.title)}</h1>
          ${b.subtitle ? `<p class="book__subtitle">${t(b.subtitle)}</p>` : ''}
          <p class="book__author">by ${esc(b.author)}</p>
        </header>
        ${b.short_description ? `<p class="book__lede">${ti(b.short_description)}</p>` : ''}
        <section class="editions" aria-labelledby="buy-h">
          <h2 id="buy-h" class="editions__h">${anyBuyable ? 'Buy this book' : 'Formats'}</h2>
          ${b.promo && (b.promo.message || b.promo.end) ? `<p class="promo-note"><strong>${esc(b.promo.label)}.</strong> ${b.promo.message ? ti(b.promo.message) : ''}${b.promo.end && !/until|ends|end/i.testi(b.promo.message) ? ` Offer ends ${niceDate(b.promo.end)}.` : ''}</p>` : ''}
          <ul class="editions__list">${editions}</ul>
          ${!anyBuyable ? `<p class="editions__soon">This book isn't on sale yet. ${S.newsletter_enabled ? '<a href="#newsletter-h">Sign up to the newsletter</a> to hear the moment it is.' : ''}</p>` : ''}
          ${b.formats.some((f) => f.amazon_url) ? `<p class="small">${ti(S.amazon_note)}</p>` : ''}
        </section>
        <section class="book__synopsis" aria-labelledby="syn-h">
          <h2 id="syn-h">About the book</h2>
          <div class="prose">${md(b.synopsis)}</div>
        </section>
        ${excerpts.length ? `<section class="listen" aria-labelledby="listen-h">
          <h2 id="listen-h">${excerpts.length === 1 ? 'Listen to an excerpt' : 'Listen to excerpts'}</h2>
          ${excerpts.map((x, i) => `<div class="excerpt">
            <div class="player" data-player>
              <button type="button" class="player__btn" data-play aria-label="Play: ${esc(x.title)}" hidden><span class="player__icon" aria-hidden="true"></span></button>
              <div class="player__meta">
                <h3 class="player__title" id="ex-${i}">${t(x.title)}</h3>
                ${x.narrator ? `<p class="player__by">Read by ${esc(x.narrator)}</p>` : ''}
                <audio controls preload="metadata" src="${esc(x.audio)}" aria-labelledby="ex-${i}">Your browser can't play this audio. <a href="${esc(x.audio)}">Download the excerpt</a>.</audio>
                <div class="player__track" hidden>
                  <input type="range" class="player__seek" data-seek min="0" max="100" step="0.1" value="0" aria-label="Position in ${esc(x.title)}" aria-valuetext="0:00">
                  <p class="player__time"><span data-now>0:00</span><span data-total>–:––</span></p>
                </div>
              </div>
            </div>
            ${x.transcript ? `<details class="read-along"><summary>Read along</summary><div class="prose">${md(x.transcript)}</div></details>` : ''}
          </div>`).join('')}
        </section>` : ''}
        ${reviewsSection}
        <section aria-labelledby="det-h">
          <h2 id="det-h">Details</h2>
          <dl class="details">${details.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        </section>
      </div>
    </div>
  </article>
  ${related.length ? `<section class="wrap related" aria-labelledby="rel-h">
    <h2 id="rel-h">${related.every((r) => r.series && r.series === b.series) ? `More in ${esc(b.series)}` : 'You might also like'}</h2>
    <div class="book-grid book-grid--related">${related.map((r) => bookCard(r)).join('')}</div>
  </section>` : ''}
  ${newsletter()}`;
  add(b.url, layout({
    title: `${b.title}${b.author ? ` by ${b.author}` : ''}`,
    description: b.short_description || stripMd(b.synopsis),
    body,
    current: '/books/',
    og: { type: 'book', image: b.cover || '' },
    jsonld: cleanJsonld,
    canonical: b.url,
    draft: isDraft,
    noindex: !!b.sample,
  }));
}

// Content pages. Each page has a layout: text (default), image, cards, gallery or feature.
const linkAttrs = (url) => /^https?:\/\//i.test(url || '') ? ' rel="noopener" target="_blank"' : '';
const newTab = (url) => /^https?:\/\//i.test(url || '') ? '<span class="visually-hidden"> (opens in a new tab)</span>' : '';
const pageButton = (text, url, cls = 'btn btn--primary') => String(text || '').trim() && String(url || '').trim()
  ? `<a class="${cls}" href="${esc(url)}"${linkAttrs(url)}>${esc(text)}${newTab(url)}</a>` : '';

function renderPage(slug, p) {
  const tone = toneOr(p.tone, slug === 'faq' ? 'sun' : 'cobalt');
  const head = () => pageHead(p.title, fill(p.intro), { needsReview: p.needs_review, tone });
  const body = p.body ? `<div class="prose prose--page">${md(fill(p.body))}</div>` : '';
  switch (p.layout) {
    case 'image':
      return `${head()}
      <div class="wrap page-body layout-image">
        ${p.image ? `<figure class="layout-image__fig"><img src="${esc(p.image)}" alt="${esc(p.image_alt || '')}" loading="lazy">${p.caption ? `<figcaption>${t(p.caption)}</figcaption>` : ''}</figure>` : ''}
        <div>${body}${pageButton(p.button_text, p.button_url) ? `<p class="layout-btn">${pageButton(p.button_text, p.button_url)}</p>` : ''}</div>
      </div>`;
    case 'cards': {
      const cards = (p.cards || []).filter((c) => c && (c.heading || c.text)).slice(0, 6);
      return `${head()}
      <div class="wrap page-body layout-cards">
        ${body}
        ${cards.length ? `<div class="layout-cards__grid">${cards.map((c) => `<article class="layout-card">
          ${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.image_alt || '')}" loading="lazy">` : ''}
          <div class="layout-card__body">
            ${c.heading ? `<h2>${t(c.heading)}</h2>` : ''}
            ${c.text ? `<div class="layout-card__text">${md(fill(c.text))}</div>` : ''}
            ${pageButton(c.button_text, c.button_url, 'btn btn--secondary')}
          </div>
        </article>`).join('')}</div>` : ''}
      </div>`;
    }
    case 'gallery': {
      const pics = (p.gallery || []).filter((g) => g && g.image);
      return `${head()}
      <div class="wrap page-body layout-gallery">
        ${body}
        ${pics.length ? `<div class="layout-gallery__grid">${pics.map((g) => `<figure><img src="${esc(g.image)}" alt="${esc(g.image_alt || g.caption || '')}" loading="lazy">${g.caption ? `<figcaption>${t(g.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
      </div>`;
    }
    case 'feature':
      return `<section class="layout-feature">
        <div class="wrap layout-feature__inner">
          <div>
            <h1>${t(p.title)}</h1>
            ${p.intro ? `<p class="layout-feature__intro">${ti(fill(p.intro))}</p>` : ''}
            ${pageButton(p.button_text, p.button_url, 'btn btn--light')}
          </div>
          ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.image_alt || '')}">` : ''}
        </div>
      </section>
      ${body ? `<div class="wrap page-body layout-feature__body">${body}</div>` : ''}
      ${p.cta_heading ? `<section class="layout-cta"><div class="wrap layout-cta__inner"><h2>${t(p.cta_heading)}</h2>${pageButton(p.cta_button_text, p.cta_button_url)}</div></section>` : ''}`;
    default:
      return `${head()}
      <div class="wrap page-body">${body}</div>`;
  }
}

for (const [slug, p] of [...Object.entries(PAGES), ...Object.entries(DRAFT_PAGES)]) {
  if (slug === 'contact') continue;
  add(pageUrl(slug), layout({
    draft: !PAGES[slug],
    title: p.title,
    description: p.intro || stripMd(p.body || '').slice(0, 160),
    current: pageUrl(slug),
    canonical: pageUrl(slug),
    og: p.image ? { image: p.image } : {},
    body: renderPage(slug, p),
  }));
}

// News: list page and one page per post.
const PAGES_NEWS_LIVE = NEWS_PAGE.published !== false;
if (NEWS.length || DRAFT_NEWS.length || (DRAFTS && !NEWS_OFF)) {
  const tone = toneOr(NEWS_PAGE.tone, toneOr(S.news_tone, 'purple'));
  const newsTitle = String(NEWS_PAGE.title || S.news_heading || 'News').trim();
  const newsIntro = NEWS_PAGE.intro || S.news_intro || '';
  const card = (n) => `<li class="news-card">
      ${n.image ? `<a class="news-card__img" href="${n.url}" tabindex="-1" aria-hidden="true"><img src="${esc(n.image)}" alt="" loading="lazy" decoding="async"></a>` : ''}
      <div class="news-card__body">
        <p class="news-card__date"><time datetime="${n.date}">${longDate(n.date)}</time>${LAUNCHES.get(bookFor(n.book)) === n ? ' <span class="news-card__tag">Book launch</span>' : ''}</p>
        <h2 class="news-card__title"><a href="${n.url}">${t(n.title)}</a></h2>
        ${n.summary ? `<p>${ti(n.summary)}</p>` : ''}
      </div>
    </li>`;
  add('/news/', layout({
    draft: !PAGES_NEWS_LIVE, title: newsTitle, description: newsIntro || `News from ${S.site_name}.`, current: '/news/', canonical: '/news/',
    body: `${pageHead(newsTitle, fill(newsIntro), { tone })}
    <div class="wrap page-body">${NEWS_PAGE.body ? `<div class="prose news-intro">${md(fill(NEWS_PAGE.body))}</div>` : ''}${NEWS.length ? `<ul class="news-list">${NEWS.map(card).join('')}</ul>` : '<p>No news yet.</p>'}</div>`,
  }));
  for (const n of [...NEWS, ...DRAFT_NEWS]) {
    const draft = !NEWS.includes(n);
    const b = bookFor(n.book);
    add(n.url, layout({
      draft, title: n.title, description: n.summary || n.body, current: '/news/', canonical: n.url,
      og: { type: 'article', image: n.image || (b && b.cover) || '' },
      body: `${pageHead(n.title, '', { tone })}
    <article class="wrap news-post">
      <p class="news-post__date"><time datetime="${n.date}">${longDate(n.date)}</time>${draft && n.date > TODAY ? ` · <strong>Scheduled: appears on the website on this date</strong>` : ''}</p>
      ${n.image ? `<figure class="news-post__img"><img src="${esc(n.image)}" alt="${esc(n.image_alt || '')}" decoding="async"></figure>` : ''}
      <div class="prose">${n.summary && !n.body ? `<p>${ti(n.summary)}</p>` : md(fill(n.body || ''))}</div>
      ${b ? `<aside class="news-book" aria-label="The book">
        <a class="news-book__cover" href="${b.url}" tabindex="-1" aria-hidden="true">${cover(b, { size: 'md', decorative: true })}</a>
        <div><p class="news-book__kicker">${LAUNCHES.get(b) === n ? launchWords(b)[0] : 'The book'}</p><h2 class="news-book__title">${t(b.title)}</h2><p class="news-book__by">by ${esc(b.author || '')}</p>
        <p><a class="btn btn--secondary" href="${b.url}">See the book</a></p></div>
      </aside>` : ''}
      <p class="news-post__back"><a href="/news/">&larr; All news</a></p>
    </article>`,
    }));
  }
}

// Contact
{
  const p = PAGES.contact || DRAFT_PAGES.contact;
  if (p) add('/contact/', layout({
    draft: !PAGES.contact,
    title: p.title, description: p.intro, current: '/contact/', canonical: '/contact/',
    body: `${pageHead(p.title, p.intro, { tone: toneOr(p.tone, 'hot') })}
    <div class="wrap contact">
      ${FORMS_OFF ? `<div class="contact__form prose"><p>Our contact form is coming soon.${INSTAGRAM ? ` In the meantime, you can find us on Instagram at <a href="${esc(INSTAGRAM.url)}" rel="noopener">@${esc(IG_HANDLE)}</a>.` : ''}</p></div>` : `
      <form class="contact__form" name="contact" method="POST" action="/send.php" data-ajax-form novalidate>
        <input type="hidden" name="form-name" value="contact">
        <p class="hp" aria-hidden="true"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label></p>
        <div class="field">
          <label for="c-name">Your name</label>
          <input id="c-name" name="name" autocomplete="name" required>
          <p class="field__error" id="c-name-err" hidden>Enter your name.</p>
        </div>
        <div class="field">
          <label for="c-email">Email address</label>
          <input id="c-email" name="email" type="email" autocomplete="email" required>
          <p class="field__error" id="c-email-err" hidden>Enter an email address, like name@example.com.</p>
        </div>
        <div class="field">
          <label for="c-subject">Subject</label>
          <select id="c-subject" name="subject" required>
            <option value="">Choose a subject</option>
            <option>A book I bought</option>
            <option>A question about a book</option>
            <option>Bookshops, libraries and trade</option>
            <option>Press and events</option>
            <option>Something else</option>
          </select>
          <p class="field__error" id="c-subject-err" hidden>Choose a subject.</p>
        </div>
        <div class="field">
          <label for="c-message">Message</label>
          <textarea id="c-message" name="message" rows="7" required maxlength="5000"></textarea>
          <p class="field__error" id="c-message-err" hidden>Write your message.</p>
        </div>
        <p class="small">We'll use your details only to reply to you. ${PAGES.privacy ? 'See our <a href="/privacy/">privacy policy</a>.' : ''}</p>
        <button class="btn btn--primary btn--lg" type="submit">Send message</button>
        <p class="form-status" role="status" aria-live="polite" tabindex="-1"></p>
      </form>`}
      <aside class="contact__aside prose">
        <h2>Other ways to reach us</h2>
        ${md(fill(p.body))}
        <p>We aim to reply ${t(S.reply_time)}.</p>
      </aside>
    </div>`,
  }));
  const thanks = (h, msg, back) => layout({ title: h, noindex: true, canonical: back,
    body: `${pageHead(h, msg)}<div class="wrap page-body"><p><a class="btn btn--secondary" href="/">Back to the home page</a></p></div>` });
  add('/contact/thanks/', thanks('Message sent', "Thanks for getting in touch. We've received your message and will reply by email.", '/contact/thanks/'));
  add('/review/thanks/', thanks('Thanks for your review', "We've received it and will read it before it appears on the site.", '/review/thanks/'));
  add('/newsletter/thanks/', thanks("You're signed up", "Thanks for joining the Out and About Books newsletter.", '/newsletter/thanks/'));
}

// Shortcut to the admin: outandaboutbooks.co.uk/admin goes straight to the Pages CMS sign-in.
pages['/admin/'] = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="0; url=https://app.pagescms.org/">
<title>Admin | ${esc(S.site_name)}</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px"><p>Taking you to the admin… If nothing happens, <a href="https://app.pagescms.org/">open Pages CMS</a>.</p></body></html>`;

// Shop page (merchandise). Not built at all while the shop is switched off.
if (SHOP_ON) {
  const AV = { available: 'Available', coming_soon: 'Coming soon', sold_out: 'Sold out' };
  const card = (m) => {
    const canBuy = m.availability === 'available' && m.buy_url;
    return `<article class="merch-card">
      <div class="merch-card__img">${m.image ? `<img src="${esc(m.image)}" alt="${esc(m.image_alt || m.name)}" loading="lazy" width="600" height="600">` : ''}${m.sample ? '<span class="cover__flag">Sample listing</span>' : ''}</div>
      <h2 class="merch-card__name">${t(m.name)}</h2>
      <p class="merch-card__meta"><span class="status status--${m.availability === 'available' ? 'available' : m.availability === 'sold_out' ? 'out_of_stock' : 'coming_soon'}">${AV[m.availability] || 'Coming soon'}</span> ${m.price !== null && m.price !== '' && m.price !== undefined ? `<span class="book-card__price">${money(m.price)}</span>` : ''}</p>
      ${m.description ? `<p class="merch-card__desc">${ti(m.description)}</p>` : ''}
      ${m.options ? `<p class="small">${t(m.options)}</p>` : ''}
      ${canBuy ? `<a class="btn btn--primary" href="${esc(m.buy_url)}" rel="noopener" target="_blank">${esc(m.buy_label || 'Buy now')}<span class="visually-hidden"> (opens in a new tab)</span></a>` : `<p class="small">${m.availability === 'sold_out' ? 'Sold out for now.' : 'Not on sale yet.'}</p>`}
    </article>`;
  };
  add('/shop/', layout({
    title: S.shop_heading || 'Shop', description: S.shop_intro, current: '/shop/', canonical: '/shop/',
    body: `${pageHead(S.shop_heading || 'Shop', S.shop_intro, { tone: toneOr(S.shop_tone, 'sun') })}
    <section class="wrap merch" aria-label="Products">
      ${MERCH.length ? `<div class="merch-grid">${MERCH.map(card).join('')}</div>` : '<div class="empty"><h2>Nothing here yet</h2><p>Our first bookmarks, bags and T-shirts are on their way. <a href="#newsletter-h">Join the newsletter</a> to hear when they arrive.</p></div>'}
    </section>
    ${newsletter()}`,
  }));
}

add('/404.html', layout({
  title: 'Page not found', noindex: true, canonical: '/404.html',
  body: `${pageHead('Page not found', "We couldn't find that page. It may have moved, or the link may be mistyped.")}
  <div class="wrap page-body"><p><a class="btn btn--primary" href="/books/">Browse our books</a> <a class="btn btn--quiet" href="/">Go to the home page</a></p></div>`,
}));

// ---------- write files ----------
fs.rmSync(OUT, { recursive: true, force: true });
const relPrefix = (urlPath) => {
  const depth = urlPath.replace(/[^/]*$/, '').split('/').filter(Boolean).length;
  return depth ? '../'.repeat(depth) : './';
};
const relativise = (html, urlPath) => {
  const pre = relPrefix(urlPath);
  return html.replace(/(href|src|action)="\/(?!\/)([^"#?]*)([^"]*)"/g, (m, attr, p, rest) => {
    let target = p;
    if (target === '') target = 'home.html';
    else if (target.endsWith('/')) target += 'index.html';
    return `${attr}="${pre}${target}${rest}"`;
  });
};
// ---------- Coming soon page (Site settings > Coming soon page) ----------
// When switched on, the live website shows only a holding page, at every address, and asks search engines
// not to list it. The editor's Preview still shows the full website, plus the holding page at /coming-soon/.
const HOLDING = S.holding_page === true;
function holdingPage() {
  const lines = String(HOME.hero_heading || 'Out. About. Unapologetic.').split(/(?<=\.)\s+/);
  const msg = S.holding_text || `Our new website is on its way.${INSTAGRAM ? ' In the meantime, follow us on Instagram for news, cover reveals and new releases.' : ''}`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(S.site_name)}: coming soon</title>
<meta name="description" content="${esc(stripMd(msg))}">
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/site.css">
<link rel="stylesheet" href="/assets/css/theme.css">
</head>
<body class="holding-body">
<main class="holding">
  <div class="holding__inner">
    <p class="holding__brand"><img class="holding__logo" src="/assets/img/brand/logo-stacked-books-white.svg" alt="${esc(S.site_name)}" width="110" height="100"><img class="holding__flag" src="/assets/img/brand/pride-flag.svg" alt="" width="63" height="40"></p>
    <h1 class="holding__title">${lines.map((l) => `<span>${esc(l)}</span>`).join(' ')}</h1>
    ${HOME.hero_strapline ? `<p class="holding__strap">${esc(HOME.hero_strapline)}</p>` : ''}
    <p class="holding__soon">Coming soon</p>
    <p class="holding__msg">${ti(msg)}</p>
    ${INSTAGRAM ? `<p><a class="holding__ig" href="${esc(INSTAGRAM.url)}" rel="noopener">${igIcon(30)}<span>Follow ${IG_HANDLE ? '@' + esc(IG_HANDLE) : 'us'}<span class="visually-hidden"> on Instagram</span></span></a></p>` : ''}
  </div>
</main>
</body>
</html>
`;
}
if (DRAFTS) pages['/coming-soon/'] = holdingPage();
else if (HOLDING) { for (const k of Object.keys(pages)) delete pages[k]; pages['/'] = holdingPage(); pages['/404.html'] = holdingPage(); }

for (const [urlPath, html] of Object.entries(pages)) {
  const file = urlPath.endsWith('/') ? path.join(OUT, urlPath, 'index.html') : path.join(OUT, urlPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const based = BASE === '/' || RELATIVE ? html : html.replace(/((?:href|src|action|value|data-cover-src)=")\/(?!\/)/g, `$1${BASE}`);
  fs.writeFileSync(file, RELATIVE ? relativise(html, urlPath) : based);
}
if (RELATIVE) fs.copyFileSync(path.join(OUT, 'index.html'), path.join(OUT, 'home.html'));
fs.cpSync(path.join(ROOT, 'src/assets'), path.join(OUT, 'assets'), { recursive: true });
// Only the fonts chosen in Text styles go to the live site.
for (const id of Object.keys(FONTS.fonts)) {
  if (id !== HEAD_FONT && id !== BODY_FONT) fs.rmSync(path.join(OUT, 'assets/fonts', id), { recursive: true, force: true });
}
fs.rmSync(path.join(OUT, 'assets/fonts/fonts.json'), { force: true });
fs.writeFileSync(path.join(OUT, 'assets/css/theme.css'), themeCss());
if (fs.existsSync(path.join(ROOT, 'content/media'))) fs.cpSync(path.join(ROOT, 'content/media'), path.join(OUT, 'media'), { recursive: true });

// Form handler and web-server settings for IONOS and similar hosts (Apache).
const phpStr = (v) => String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
fs.writeFileSync(path.join(OUT, 'send.php'), fs.readFileSync(path.join(ROOT, 'src/php/send.php'), 'utf8')
  .replace("'__TO__'", () => `'${phpStr(FORM_TO)}'`).replace("'__FROM__'", () => `'${phpStr(FORM_FROM)}'`).replace("'__SITE__'", () => `'${phpStr(S.site_name)}'`));
fs.copyFileSync(path.join(ROOT, 'src/htaccess'), path.join(OUT, '.htaccess'));

// sitemap + robots
const base = S.site_url.replace(/\/$/, '');
const indexable = Object.keys(pages).filter((u) => !(HOLDING && !DRAFTS) && !DRAFT_URLS.has(u) && u !== '/coming-soon/' && !['/404.html', '/contact/thanks/', '/newsletter/thanks/', '/review/thanks/', '/admin/'].includes(u) && !BOOKS.find((b) => b.sample && b.url === u));
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable.map((u) => `  <url><loc>${base}${u}</loc></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), HOLDING && !DRAFTS ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${base}/sitemap.xml\n`);

console.log(`${HOLDING && !DRAFTS ? 'COMING SOON PAGE IS ON: the website shows only the holding page. ' : ''}Built ${Object.keys(pages).length} pages, ${BOOKS.length} books.${FORM_TO || FORMS_OFF ? '' : ' Note: the contact form has no address to send to until you add your contact email in Site settings.'}`);
