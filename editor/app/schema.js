// The fields shown in the editor. Keep this in step with .pages.yml (the online admin),
// so both editors offer the same things.
window.SCHEMA = (function () {
  var AV_BOOK = [['available', 'Available'], ['pre_order', 'Pre-order'], ['coming_soon', 'Coming soon'], ['out_of_stock', 'Out of stock']];
  var AV_MERCH = [['available', 'Available'], ['coming_soon', 'Coming soon'], ['sold_out', 'Sold out']];
  var TONE_OPTIONS = [['red', 'Red'], ['orange', 'Orange'], ['sun', 'Yellow'], ['green', 'Green'], ['cobalt', 'Blue'], ['navy', 'Navy blue'], ['purple', 'Purple'], ['hot', 'Pink']];
  return {
    books: {
      label: 'Books', single: 'book', titleField: 'title',
      intro: 'Every book on the website. Click one to edit it, or add a new one.',
      newData: function (title) {
        return { title: title, subtitle: '', slug: '', author: '', series: '', series_number: null, cover: '', cover_alt: '', back_cover: '', back_cover_alt: '',
          short_description: '', synopsis: '', genres: [], setting: '', publication_date: '', page_count: null, status: 'coming_soon', featured: false, new_release: false, sample: false,
          promotion: { enabled: false, label: '', message: '', start: '', end: '' }, excerpts: [], reviews: [],
          formats: [
            { format: 'Paperback', price: null, isbn: '', availability: 'coming_soon', deal_price: null, amazon_url: '', other_url: '', other_label: '' },
            { format: 'eBook', price: null, isbn: '', availability: 'coming_soon', deal_price: null, amazon_url: '', other_url: '', other_label: '' }] };
      },
      groups: [
        { title: 'The book', fields: [
          { name: 'published', label: 'Published on the website', type: 'bool', default: true, publish: true, help: 'Untick to take this book off the website. It stays here in the editor, and you can still see it in Preview, marked as a draft.' },
          { name: 'title', label: 'Title', type: 'string', required: true },
          { name: 'subtitle', label: 'Subtitle', type: 'string' },
          { name: 'author', label: 'Author', type: 'string', required: true },
          { name: 'series', label: 'Series name', type: 'string', help: "Leave blank if the book isn't part of a series." },
          { name: 'series_number', label: 'Number in series', type: 'number', small: true },
        ] },
        { title: 'Covers', fields: [
          { name: 'cover', label: 'Front cover', type: 'image', kind: 'cover', help: 'Use your Kindle cover (1600 × 2560 pixels), or the front of your paperback cover cut at the trim lines. Large images are shrunk automatically.' },
          { name: 'cover_alt', label: 'Front cover description (for screen readers)', type: 'string', help: "Optional. Leave blank to use 'Front cover of [title] by [author]'." },
          { name: 'back_cover', label: 'Back cover (optional)', type: 'image', kind: 'cover', help: 'The back of your paperback cover, cut at the trim lines, without the spine.' },
          { name: 'back_cover_alt', label: 'Back cover description (for screen readers)', type: 'string' },
        ] },
        { title: 'Descriptions', fields: [
          { name: 'short_description', label: 'Short description', type: 'text', rich: 'inline', links: false, rows: 3, help: 'One or two sentences for book lists and search results. About 150 characters is ideal.' },
          { name: 'synopsis', label: 'Full description (blurb)', type: 'text', rich: 'block', headings: false, rows: 12, help: 'Press Enter for a new paragraph. Select words and use B or I for bold or italic.' },
          { name: 'genres', label: 'Genres', type: 'list', help: 'One per line, e.g. Gay romance. Spell them the same way every time: each genre gets its own page.' },
          { name: 'setting', label: 'Setting', type: 'string' },
        ] },
        { title: 'Audio excerpts', fields: [
          { name: 'excerpts', label: 'Excerpts', type: 'objlist', itemLabel: function (x) { return x.title || 'Excerpt'; }, addLabel: 'Add an excerpt',
            help: 'Optional. Short readings from the book, shown under the blurb with a play button.',
            newItem: function () { return { title: '', narrator: '', audio: '', transcript: '' }; },
            fields: [
              { name: 'title', label: 'Excerpt title', type: 'string', help: 'e.g. Chapter 1: The hire car' },
              { name: 'narrator', label: 'Read by (optional)', type: 'string' },
              { name: 'audio', label: 'Audio file', type: 'audio', help: 'An MP3 file works everywhere. Keep each clip to a few minutes, under about 10 MB.' },
              { name: 'transcript', label: 'Read-along text (recommended)', type: 'text', rich: 'block', headings: false, rows: 6, help: 'The words of the excerpt, for people who can\'t listen. Leave a blank line between paragraphs.' },
            ] },
        ] },
        { title: 'Reader reviews', fields: [
          { name: 'reviews', label: 'Reviews', type: 'objlist', itemLabel: function (r) { return (r.name || 'Review') + (r.rating ? ' · ' + r.rating + '★' : ''); }, addLabel: 'Add a review',
            help: 'Reviews readers send through the website arrive by email. Copy them in word for word. Publish honest ones, positive and negative.',
            newItem: function () { return { name: '', rating: '5', text: '', date: new Date().toISOString().slice(0, 10), show_on_home: false }; },
            fields: [
              { name: 'name', label: "Reader's name", type: 'string', small: true },
              { name: 'rating', label: 'Stars', type: 'select', small: true, options: [['5', '5 stars'], ['4', '4 stars'], ['3', '3 stars'], ['2', '2 stars'], ['1', '1 star']] },
              { name: 'date', label: 'Date received', type: 'date', small: true },
              { name: 'text', label: 'Review', type: 'text', rich: 'block', headings: false, links: false, rows: 4 },
              { name: 'show_on_home', label: 'Show on the home page', type: 'bool', help: 'Up to three reviews ticked here appear on the home page.' },
            ] },
        ] },
        { title: 'Promotion', fields: [
          { name: 'promotion', type: 'object', fields: [
            { name: 'enabled', label: 'Promotion on', type: 'bool', help: 'Shows a ribbon across the corner of the front cover, and any deal prices you set on the editions below.' },
            { name: 'label', label: 'Ribbon text', type: 'string', maxlength: 22, help: 'Short is best, about 16 characters, e.g. 99p Kindle deal or Free this week.' },
            { name: 'message', label: 'Message on the book page (optional)', type: 'text', rich: 'inline', rows: 2, help: 'e.g. Kindle Countdown Deal: 99p for one week only. The end date is added for you if you set one.' },
            { name: 'start', label: 'Start date', type: 'date', small: true, help: 'Optional.' },
            { name: 'end', label: 'End date', type: 'date', small: true, help: 'Optional. Stops showing after this day.' },
          ] },
        ] },
        { title: 'Publishing details', fields: [
          { name: 'publication_date', label: 'Publication date', type: 'date', small: true },
          { name: 'page_count', label: 'Number of pages', type: 'number', small: true },
          { name: 'status', label: 'Book status', type: 'select', options: [['published', 'Out now'], ['coming_soon', 'Coming soon']], small: true },
          { name: 'featured', label: 'Feature on the home page', type: 'bool', help: 'Featured books take turns in the home page banner (up to six, fading every few seconds) and appear on the New and featured shelf.' },
          { name: 'new_release', label: 'Mark as a new release', type: 'bool', help: 'New releases also appear on the home page.' },
          { name: 'slug', label: 'Web address', type: 'string', help: "The end of the book's web address. Leave blank to make one from the title. Don't change it once the book is live." },
        ] },
        { title: 'Formats and buying options', fields: [
          { name: 'formats', label: 'Editions', type: 'objlist', itemLabel: function (f) { return f.format || 'Edition'; }, addLabel: 'Add an edition',
            newItem: function () { return { format: 'Paperback', price: null, isbn: '', availability: 'coming_soon', deal_price: null, amazon_url: '', other_url: '', other_label: '' }; },
            fields: [
              { name: 'format', label: 'Format', type: 'select', options: [['Paperback', 'Paperback'], ['Hardback', 'Hardback'], ['eBook', 'eBook'], ['Audiobook', 'Audiobook']], small: true },
              { name: 'price', label: 'Price (£)', type: 'number', step: '0.01', small: true, help: 'Leave blank if not decided.' },
              { name: 'availability', label: 'Availability', type: 'select', options: AV_BOOK, small: true },
              { name: 'deal_price', label: 'Deal price (£)', type: 'number', step: '0.01', small: true, help: 'Optional. Only shown while the promotion is on. Match the Amazon price.' },
              { name: 'isbn', label: 'ISBN', type: 'string', small: true, help: "Leave blank for Kindle eBooks." },
              { name: 'amazon_url', label: 'Amazon link', type: 'url', help: 'The full Amazon address, e.g. https://www.amazon.co.uk/dp/XXXXXXXXXX' },
              { name: 'other_url', label: 'Other shop link (optional)', type: 'url', help: 'e.g. Kobo, Waterstones, or your own Shopify page.' },
              { name: 'other_label', label: 'Other shop button text', type: 'string', help: 'e.g. Buy on Kobo' },
            ] },
        ] },
        { title: 'Sample', fields: [
          { name: 'sample', label: 'Sample listing (not a real book)', type: 'bool', help: 'Only for the example listings. Leave unticked for real books.' },
        ] },
      ],
    },
    merch: {
      label: 'Shop items', single: 'shop item', titleField: 'name',
      intro: 'Merchandise for the Shop page. The shop only appears on the website when "Show the shop" is ticked in Site settings.',
      newData: function (name) { return { name: name, slug: '', description: '', price: null, image: '', image_alt: '', options: '', buy_url: '', buy_label: '', availability: 'coming_soon', sample: false }; },
      groups: [
        { title: 'The item', fields: [
          { name: 'published', label: 'Published on the website', type: 'bool', default: true, publish: true, help: 'Untick to take this item off the website. It stays here in the editor, and you can still see it in Preview, marked as a draft.' },
          { name: 'name', label: 'Product name', type: 'string', required: true },
          { name: 'image', label: 'Product photo', type: 'image', kind: 'square', help: 'A square photo works best. Large images are shrunk automatically.' },
          { name: 'image_alt', label: 'Photo description (for screen readers)', type: 'string' },
          { name: 'description', label: 'Description', type: 'text', rich: 'inline', links: false, rows: 4 },
          { name: 'options', label: 'Sizes or options', type: 'string', help: 'Optional, e.g. Sizes S to XXL.' },
          { name: 'price', label: 'Price (£)', type: 'number', step: '0.01', small: true },
          { name: 'availability', label: 'Availability', type: 'select', options: AV_MERCH, small: true },
          { name: 'buy_url', label: 'Buy link', type: 'url', help: 'Where the Buy button goes, e.g. the Shopify page. The button only shows when this is filled in and the item is Available.' },
          { name: 'buy_label', label: 'Buy button text', type: 'string', help: 'Optional. Defaults to Buy now.' },
          { name: 'slug', label: 'Web address', type: 'string', help: 'Leave blank to make one from the name.' },
          { name: 'sample', label: 'Sample listing (not a real product)', type: 'bool' },
        ] },
      ],
    },
    news: {
      label: 'News', single: 'news post', titleField: 'title',
      intro: 'News posts, newest first on the News page (in the top menu once there is a post). A post dated in the future stays hidden until that day.',
      newData: function (title) {
        var d = new Date(); var today = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        return { title: title, date: today, summary: '', image: '', image_alt: '', body: '', book: '', launch: false, pin: false, pin_text: '', pin_until: '', slug: '' };
      },
      groups: [
        { title: 'The post', fields: [
          { name: 'published', label: 'Published on the website', type: 'bool', default: true, publish: true, help: 'Untick to keep this post as a draft. It stays here, and you can still see it in Preview, marked as a draft.' },
          { name: 'title', label: 'Headline', type: 'string', required: true },
          { name: 'date', label: 'Date', type: 'date', small: true, help: 'Shown on the post. Posts are listed newest first. A future date keeps the post hidden until that day.' },
          { name: 'summary', label: 'Summary', type: 'text', rich: 'inline', rows: 2, help: 'One or two sentences for the News page and for Google.' },
          { name: 'image', label: 'Picture (optional)', type: 'image', kind: 'wide', help: 'A landscape picture works best.' },
          { name: 'image_alt', label: 'Picture description (for screen readers)', type: 'string' },
          { name: 'body', label: 'The full post', type: 'text', rich: 'block', rows: 12 },
          { name: 'slug', label: 'Web address', type: 'string', help: 'Leave blank to make one from the headline, e.g. /news/launch-evening/.' },
        ] },
        { title: 'Book', fields: [
          { name: 'book', label: 'Which book is this about? (optional)', type: 'bookpick', help: 'Shows the book, with a button to its page, at the end of the post.' },
          { name: 'launch', label: 'This is the book\'s launch: promote it on the home page', type: 'bool', default: false, help: 'For 60 days from the post\'s date, the book goes first in the big banner on the home page with a "New release" sticker (or "Coming soon" before it\'s out) and a "Read the launch news" button. Untick to stop early. Leave unticked for other news about the book, such as a cover reveal.' },
        ] },
        { title: 'News bar on every page', fields: [
          { name: 'pin', label: 'Pin this post to the top of every page', type: 'bool', help: 'Shows a slim yellow news bar above the menu, with a link to this post. If several posts are pinned, the newest is shown. Visitors can close it.' },
          { name: 'pin_text', label: 'Text for the news bar', type: 'string', help: 'One short line, e.g. Launch evening and reading: Saturday 14 March, 7pm. Leave blank to use the headline.' },
          { name: 'pin_until', label: 'Show the news bar until', type: 'date', small: true, help: 'The bar disappears after this day. Leave blank to keep it until you untick Pin.' },
        ] },
      ],
    },
    pages: {
      label: 'Pages', single: 'page', titleField: 'title',
      intro: 'The built-in pages (About, Questions, Contact and the policies), plus any pages you add.',
      builtIn: ['about.json', 'faq.json', 'contact.json', 'news.json', 'privacy.json', 'cookies.json', 'terms.json', 'delivery-returns.json'],
      layouts: [['text', 'Text page'], ['image', 'Image and text'], ['cards', 'Cards'], ['gallery', 'Gallery'], ['feature', 'Feature']],
      newData: function (title, layout, parent) {
        return { title: title, slug: '', layout: layout || 'text', tone: 'cobalt', intro: '', body: '', parent: parent || '', show_in_menu: true, show_in_footer: true, menu_label: '',
          image: '', image_alt: '', caption: '', button_text: '', button_url: '', cards: [], gallery: [], cta_heading: '', cta_button_text: '', cta_button_url: '' };
      },
      groups: [
        { title: 'The page', fields: [
          { name: 'published', label: 'Published on the website', type: 'bool', default: true, publish: true, help: 'Untick to take this page off the website: it disappears from the menu and footer too. It stays here in the editor, and you can still see it in Preview, marked as a draft. Links to it from your own text will stop working while it is unpublished. Keep the privacy policy published: the law expects one.' },
          { name: 'title', label: 'Page title', type: 'string', required: true },
          { name: 'parent', label: 'Parent page (put this page under another)', type: 'pageparent', newOnly: true, help: 'Any page in the top menu can have sub-pages: About us, Questions, Contact or a page you\'ve added. e.g. put Book launch under Events, or Meet the author under About us. It then appears in that page\'s drop-down menu, and its address becomes /events/book-launch/. One level only, so a sub-page can\'t have sub-pages of its own.' },
          { name: 'layout', label: 'Layout', type: 'select', rerender: true, small: true, notFile: ['news.json'], options: [['text', 'Text page'], ['image', 'Image and text'], ['cards', 'Cards'], ['gallery', 'Gallery'], ['feature', 'Feature']], help: 'Changing the layout keeps everything you have typed.' },
          { name: 'tone', label: 'Title band colour', type: 'colour', notFor: ['feature'], options: TONE_OPTIONS },
          { name: 'menu_label', label: 'Menu name (optional)', type: 'string', small: true, onlyFile: ['news.json'], help: 'A shorter name for the menu, e.g. News. The News page is in the menu once there is a post.' },
          { name: 'intro', label: 'Introduction', type: 'text', rich: 'inline', rows: 3, help: 'Shown under the title. On the Feature layout, this is the line under the big heading.' },
          { name: 'needs_review', label: 'Needs legal review', type: 'bool', builtInOnly: true, notFile: ['news.json'], help: "Shows a 'needs legal review' notice on the page. Untick once the page has been checked." },
        ] },
        { title: 'Picture and button', when: ['image', 'feature'], fields: [
          { name: 'image', label: 'Picture', type: 'image', kind: 'wide', help: 'Large images are shrunk automatically.' },
          { name: 'image_alt', label: 'Picture description (for screen readers)', type: 'string', help: 'Describe what the picture shows, in a few words.' },
          { name: 'caption', label: 'Caption (optional)', type: 'string', when: ['image'] },
          { name: 'button_text', label: 'Button text (optional)', type: 'string', small: true },
          { name: 'button_url', label: 'Button link', type: 'string', help: 'A page on this site, e.g. /books/, or a full address starting https://' },
        ] },
        { title: 'Cards', when: ['cards'], fields: [
          { name: 'cards', label: 'Cards (up to six)', type: 'objlist', itemLabel: function (c) { return c.heading || 'Card'; }, addLabel: 'Add a card',
            newItem: function () { return { heading: '', text: '', image: '', image_alt: '', button_text: '', button_url: '' }; },
            fields: [
              { name: 'heading', label: 'Heading', type: 'string' },
              { name: 'image', label: 'Picture (optional)', type: 'image', kind: 'wide' },
              { name: 'image_alt', label: 'Picture description', type: 'string' },
              { name: 'text', label: 'Text', type: 'text', rich: 'block', rows: 3 },
              { name: 'button_text', label: 'Button text (optional)', type: 'string', small: true },
              { name: 'button_url', label: 'Button link', type: 'string', help: 'e.g. /books/ or https://…' },
            ] },
        ] },
        { title: 'Gallery', when: ['gallery'], fields: [
          { name: 'gallery', label: 'Pictures', type: 'objlist', itemLabel: function (g) { return g.caption || 'Picture'; }, addLabel: 'Add a picture',
            newItem: function () { return { image: '', image_alt: '', caption: '' }; },
            fields: [
              { name: 'image', label: 'Picture', type: 'image', kind: 'wide' },
              { name: 'caption', label: 'Caption (optional)', type: 'string' },
              { name: 'image_alt', label: 'Picture description (for screen readers)', type: 'string', help: 'Leave blank to use the caption.' },
            ] },
        ] },
        { title: 'Page content', fields: [
          { name: 'body', label: 'Text', type: 'text', rich: 'block', rows: 14, help: 'Use the toolbar for headings, bold, italic, links and lists. Anything in [square brackets] is highlighted on the site as a placeholder. {{contact_email}}, {{trading_name}}, {{business_address}} and {{reply_time}} are filled in from Site settings. On the Cards and Gallery layouts this text appears above them.' },
        ] },
        { title: 'Closing call to action', when: ['feature'], fields: [
          { name: 'cta_heading', label: 'Heading (leave blank to hide this strip)', type: 'string' },
          { name: 'cta_button_text', label: 'Closing button text', type: 'string', small: true },
          { name: 'cta_button_url', label: 'Closing button link', type: 'string' },
        ] },
        { title: 'Where it appears', newOnly: true, fields: [
          { name: 'show_in_menu', label: 'Show in the menu', type: 'bool', help: 'For a top-level page, this adds it to the menu at the top. For a page with a parent, it adds it to the parent\'s drop-down. Keep the top menu short.' },
          { name: 'menu_label', label: 'Menu name (optional)', type: 'string', small: true, help: 'A shorter name for the menu and footer, e.g. Events.' },
          { name: 'show_in_footer', label: 'Show in the footer', type: 'bool' },
          { name: 'slug', label: 'Web address', type: 'string', readonly: true, help: 'Made from the title when the page was added.' },
        ] },
        { title: 'Web address', builtInGroup: true, fields: [
          { name: 'slug', label: 'Web address', type: 'string', readonly: true, help: 'Fixed for the built-in pages.' },
        ] },
      ],
    },
    home: {
      label: 'Home page text', file: 'home',
      intro: 'The words on the home page.',
      groups: [
        { title: 'Opening banner', fields: [
          { name: 'hero_heading', label: 'Main heading', type: 'string', help: 'Each sentence goes on its own line.' },
          { name: 'hero_strapline', label: 'Strapline', type: 'string', help: 'The yellow line under the heading. Leave blank to hide it.' },
          { name: 'hero_text', label: 'Introduction', type: 'text', rich: 'inline', rows: 3 },
          { name: 'hero_button', label: 'Button text', type: 'string', small: true },
          { name: 'ticker', label: 'Words in the moving strip', type: 'list', help: 'One phrase per line. Leave empty to hide the strip.' },
        ] },
        { title: 'Further down', fields: [
          { name: 'books_heading', label: 'Books section heading', type: 'string' },
          { name: 'books_text', label: 'Books section text', type: 'text', rich: 'inline', rows: 2 },
          { name: 'about_heading', label: 'About section heading', type: 'string' },
          { name: 'about_text', label: 'About section text', type: 'text', rich: 'inline', rows: 4 },
          { name: 'about_link', label: 'About link text', type: 'string' },
        ] },
      ],
    },
    settings: {
      label: 'Site settings', file: 'settings',
      intro: 'Contact details, business details and switches for parts of the site.',
      groups: [
        { title: 'Your website', fields: [
          { name: 'site_name', label: 'Site name', type: 'string' },
          { name: 'tagline', label: 'Tagline', type: 'string' },
          { name: 'strapline', label: 'Footer strapline', type: 'string' },
          { name: 'site_url', label: 'Website address', type: 'url', help: 'e.g. https://outandaboutbooks.co.uk (used for search engines and sharing links).' },
          { name: 'meta_description', label: 'Search engine description', type: 'text', rows: 3 },
        ] },
        { title: 'Contact and business details', fields: [
          { name: 'contact_email', label: 'Contact email address', type: 'string', help: 'Shown on the site, and where contact form messages and newsletter sign-ups are sent.' },
          { name: 'form_sender_email', label: 'Website sender address', type: 'string', help: 'Optional. The address form emails come from, e.g. website@yourdomain.co.uk.' },
          { name: 'reply_time', label: 'Reply time for enquiries', type: 'string', help: 'e.g. within 2 working days' },
          { name: 'trading_name', label: 'Legal or trading name', type: 'string', help: "Your name if you're a sole trader, or your company's registered name." },
          { name: 'business_address', label: 'Business postal address', type: 'text', rows: 3 },
          { name: 'company_number', label: 'Company number', type: 'string', small: true, help: "Only if you're a limited company." },
          { name: 'vat_number', label: 'VAT number', type: 'string', small: true, help: "Only if you're VAT registered." },
          { name: 'social_links', label: 'Social media links', type: 'objlist', itemLabel: function (s) { return s.label || 'Link'; }, addLabel: 'Add a link',
            newItem: function () { return { label: '', url: '' }; },
            fields: [{ name: 'label', label: 'Name', type: 'string', small: true }, { name: 'url', label: 'Link', type: 'url' }] },
        ] },
        { title: 'Text styles', fields: [
          { name: 'heading_font', label: 'Headings font', type: 'font', list: 'heading', default: 'poppins', help: 'Also used for the menu and buttons.' },
          { name: 'body_font', label: 'Paragraph font', type: 'font', list: 'body', default: 'lora' },
          { name: 'heading_size', label: 'Heading size', type: 'select', small: true, default: 'standard', options: [['smaller', 'Smaller'], ['standard', 'Standard'], ['larger', 'Larger']] },
          { name: 'text_size', label: 'Paragraph text size', type: 'select', small: true, default: 'standard', options: [['smaller', 'Smaller'], ['standard', 'Standard'], ['larger', 'Larger']] },
          { name: 'heading_colour', label: 'Heading colour', type: 'colour', paper: true, default: 'ink', options: [['ink', 'Charcoal (standard)']].concat(TONE_OPTIONS), help: 'For headings on the cream background. Headings on coloured bands and banners keep their white or dark text.' },
        ] },
        { title: 'Title band colours', fields: [
          { name: 'books_tone', label: 'Our books page', type: 'colour', default: 'hot', options: TONE_OPTIONS, help: 'Also used for the genre and series pages.' },
          { name: 'shop_tone', label: 'Shop page', type: 'colour', default: 'sun', options: TONE_OPTIONS },
        ] },
        { title: 'Switches', fields: [
          { name: 'show_sample_listings', label: 'Show sample listings', type: 'bool', help: 'Untick before launch to hide the example books and shop items.' },
          { name: 'newsletter_enabled', label: 'Show newsletter sign-up', type: 'bool' },
          { name: 'newsletter_heading', label: 'Newsletter heading', type: 'string' },
          { name: 'newsletter_text', label: 'Newsletter text', type: 'text', rich: 'inline', rows: 2 },
          { name: 'show_shop', label: 'Show the shop', type: 'bool', help: 'Adds a Shop page and menu link for merchandise.' },
          { name: 'shop_heading', label: 'Shop page heading', type: 'string' },
          { name: 'shop_intro', label: 'Shop page introduction', type: 'text', rich: 'inline', rows: 2 },
          { name: 'amazon_note', label: 'Note under Amazon buttons', type: 'text', rich: 'inline', rows: 2 },
          { name: 'analytics_plausible_domain', label: 'Plausible analytics domain', type: 'string', help: 'Optional, paid service. Leave blank for no analytics.' },
        ] },
      ],
    },
  };
})();
