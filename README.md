# Out and About Books: website guide

This folder is the complete website for **Out and About Books**. It's set up for **IONOS web hosting**, and works the same on most other UK hosts. This guide covers:

1. [How the site works](#1-how-the-site-works)
2. [Accounts and costs](#2-accounts-and-costs)
3. [Previewing the site](#3-previewing-the-site)
4. [Publishing the site](#4-publishing-the-site)
5. [Adding books and changing prices](#5-adding-books-and-changing-prices)
6. [The contact form and newsletter](#6-the-contact-form-and-newsletter)
7. [Selling directly later (Shopify)](#7-selling-directly-later-shopify)
8. [What you can edit, and what needs a developer](#8-what-you-can-edit-and-what-needs-a-developer)
9. [Checklist before launch](#9-checklist-before-launch)

---

## 1. How the site works

- **The website** is a set of fast, plain web pages built from your content. There's no database to look after, and nothing to update or patch.
- **Your content** (books, page text, settings) lives in the `content` folder as simple files.
- **GitHub** keeps the master copy of all the files and controls who can edit them.
- **The admin** is [Pages CMS](https://pagescms.org), a free point-and-click editor. You sign in with your GitHub account, and it saves your changes to GitHub.
- **Publishing is automatic.** Each time something changes on GitHub, including every save in the admin, GitHub builds the site and uploads it to your web host. It's live within a couple of minutes.
- **Buying books.** Each edition has an Amazon link, plus one optional link to another shop. You don't take payments on the site, so there's no checkout to secure and no customer data to store.
- **Forms.** The contact form and newsletter sign-up are emailed to you by a small script on your web host (`send.php`), with a hidden spam trap.

```
You edit in Pages CMS  →  saved to GitHub  →  GitHub builds the site  →  uploaded to IONOS  →  live
```

## 2. Accounts and costs

| Service | What it's for | Cost |
|---|---|---|
| **GitHub** | Stores the website files, controls who can edit, builds and uploads the site | Free. The free plan includes about 2,000 build minutes a month for private projects, and each publish takes about a minute. |
| **Pages CMS** | Admin for books and pages | Free (open source) |
| **IONOS web hosting** (or similar) | Hosting, a free SSL certificate (the padlock), email mailboxes | A monthly fee; check IONOS for current prices. Choose a package that includes **PHP** and **SFTP access**: their standard Web Hosting packages do. Avoid "website builder" packages, which can't host this site. |
| **Your domain** | Your web address, e.g. outandaboutbooks.co.uk | Often free for the first year with a hosting package, then a yearly fee |
| **Email newsletter tool** (optional) | Sending newsletters to people who sign up | e.g. MailerLite or Buttondown have free plans |
| **Plausible** (optional) | Cookie-free visitor statistics | Paid, roughly $9 a month. Off unless you add it in Site settings. |

There's no limit on how often you save or publish.

## 3. Previewing the site

**The quick way:** with [Node.js](https://nodejs.org) installed, double-click **Preview website (Mac).command** or **Preview website (Windows).bat** in this folder. It builds the site and opens it in your browser at http://localhost:3000. Close the window that opens to stop the preview.

- *Mac, first time:* if macOS says it can't be opened, right-click the file, choose **Open**, then **Open** again. If it still refuses, go to *System Settings → Privacy & Security* and click **Open Anyway**.
- *Windows, first time:* if a blue "Windows protected your PC" box appears, click **More info → Run anyway**.

**The manual way** (needs [Node.js](https://nodejs.org) version 20 or newer):

```
cd out-and-about-books
node build.mjs
npx serve _site
```

Then open the address it shows, usually http://localhost:3000. The forms only work on a host with PHP. If you have PHP on your computer, `php -S localhost:8000 -t _site` serves the site with working forms.

**Before your domain is ready:** IONOS gives each hosting package a temporary address, which you can use to check the live site.

### Editing on your computer

Double-click **Edit website (Mac).command** or **Edit website (Windows).bat**. The editor opens in your browser at http://localhost:3001. It works without the internet or GitHub, and only on your computer.

- It has the same sections as the online admin: **Books**, **Shop items**, **Pages**, **Home page text** and **Site settings**.
- **Add a book:** type the title under *Add a new book* and click **Add**, then fill in the form and click **Save**.
- **Covers:** click **Choose image…** and pick the file. Large images are shrunk and saved as JPG for you, into `content/media`. If a cover isn't the 5:8 book shape, you'll see a warning.
- **Save and preview** saves your changes and opens the website preview (http://localhost:3000) at that page.
- **Delete** moves a book or item into the `editor/trash` folder, so you can get it back if you need to.
- Close the editor's window when you've finished. The same first-time warnings apply as for the preview shortcut.

Your changes are saved in the `content` folder on your computer. Once the site is live, publish them by sending them to GitHub with GitHub Desktop. If you've also edited in the online admin, click *Fetch origin* in GitHub Desktop **before** editing on your computer, so you're working on the latest version.

## 4. Publishing the site

Nothing has been published and no DNS records have been changed. Do these steps when you're ready.

**A. Put the files on GitHub**

1. Create a free account at [github.com](https://github.com).
2. Create a **private** repository called `out-and-about-books`.
3. Upload everything in this folder. On the repository page, choose *Add file → Upload files* and drag the contents of the folder in. Make sure the hidden `.github` folder and the `.pages.yml` and `.gitignore` files are included. On a Mac, press Cmd+Shift+. in Finder to show hidden files.

**B. Buy hosting and a domain**

1. Buy an IONOS **Web Hosting** package (with PHP and SFTP), and your domain. Buying both from IONOS keeps them in one account.
2. If your domain is with another company, you can still use it. Point it at IONOS by following IONOS's instructions for an external domain, and **leave any email (MX) records alone** if you already have email on that domain.

**C. Set up the hosting in IONOS**

The menu names below may be worded slightly differently in IONOS.

1. **Create a folder for the site.** In *Hosting → Webspace*, create a folder just for this website, e.g. `/outandaboutbooks`. Every upload replaces the contents of this folder, so don't keep anything else in it.
2. **Point your domain at that folder.** In *Domains & SSL*, open your domain, choose *Use with webspace*, and pick the folder.
3. **Turn on the SSL certificate** for your domain (it's included). The site always switches visitors to the secure `https://` address.
4. **Create an SFTP user.** In *Hosting → SFTP & SSH*, create a user and note the **server name**, **username** and **password**.
5. **Create your email.** Create a mailbox for your contact address, e.g. `hello@yourdomain`. Also create a second address, `website@yourdomain`, which the website sends form messages from. It can be a forwarding alias to your mailbox.

**D. Connect GitHub to IONOS**

1. On GitHub, open the repository, then *Settings → Secrets and variables → Actions → New repository secret*. Add these four secrets:

   | Name | Value |
   |---|---|
   | `SFTP_HOST` | the SFTP server name from IONOS |
   | `SFTP_USER` | the SFTP username |
   | `SFTP_PASSWORD` | the SFTP password |
   | `SFTP_FOLDER` | the folder from step C1, e.g. `/outandaboutbooks` |

2. Go to the **Actions** tab, choose **Publish website**, then **Run workflow**. After a minute or two the site is live on your domain. If anything goes wrong, the Actions tab shows a red cross, and clicking it shows the error.

From now on, the site republishes automatically whenever you save in the admin.

**E. Fill in your details**

In Pages CMS **Site settings**, set:

- **Website address**, e.g. `https://outandaboutbooks.co.uk`, used by search engines and sharing links
- **Contact email address**, where form messages and newsletter sign-ups go
- **Website sender address**, the `website@` address from step C5. You can leave it blank if that's exactly `website@` plus your domain.

**F. Set up the admin**

1. Go to [app.pagescms.org](https://app.pagescms.org) and sign in with GitHub. Once the site is live, you can also type **yourdomain/admin**, which takes you straight there.
2. Allow it access to the `out-and-about-books` repository.
3. Open the repository. You'll see **Books**, **Shop items**, **Home page text**, **Pages**, **Site settings** and **Media**.
4. To let someone else edit, add them as a collaborator on the GitHub repository.

**Not using IONOS?** Any host that offers PHP, SFTP and the Apache web server works the same way, and most UK shared hosting does. Follow the same steps with that host's equivalent menus.

## 5. Adding books and changing prices

**Add a new book**

1. In Pages CMS, open **Books → Add an entry**.
2. Fill in the title, author, series (if any), short description and full description.
3. **Covers:** upload JPGs in the 5:8 shape of a 5 × 8 inch paperback, so nothing gets cropped. Squash them to under 400 KB first at [squoosh.app](https://squoosh.app). Without a front cover, a placeholder cover marked "Placeholder cover" is shown.
   - **Front cover:** your Kindle eBook cover (1600 × 2560 pixels, KDP's recommended size) is exactly the right shape. Or use the front panel of your paperback cover, cut at the trim lines.
   - **Back cover (optional):** the back panel of your paperback cover, cut at the trim lines. When it's added, visitors can switch between front and back on the book page.
   - KDP's paperback cover file has an extra 0.125 inch (3.2 mm) of **bleed** around the outside edges, plus the spine. Cut those off when you make the website images: a 5 × 8 inch panel at 320 pixels per inch is 1600 × 2560 pixels.
4. Add **genres**. Spell them the same way each time, because each genre gets its own page.
5. Under **Formats and buying options**, add one entry per edition (Paperback, eBook and so on). For each, set the price, ISBN, availability and Amazon link.
6. Tick **Feature on the home page** and/or **Mark as a new release** if you want it on the home page.
7. Save. The site updates within a couple of minutes.

**Change a price, description or availability:** open the book, change the field and save.

**Add an Amazon link:** open the book, go to the format (for example Paperback) and paste the full Amazon address, such as `https://www.amazon.co.uk/dp/B0XXXXXXX`. Buy buttons only appear for editions marked *Available* or *Pre-order*.

**Add another shop:** fill in **Other shop link** and **Other shop button text** on that edition, e.g. "Buy on Kobo".

**Add an audio excerpt:** open the book and go to **Audio excerpts**, then click **Add an excerpt**.

Each excerpt also gets a small pink **Listen** tile beside the Front and Back cover thumbnails (Listen 1, Listen 2… when there's more than one), which plays it straight away; it stays in step with the full player further down the page. There's no limit on the number of excerpts, but two or three is best: on a phone, the tiles wrap onto a second row.

1. Give it a title, e.g. "Chapter 1: The hire car", and optionally who it's read by.
2. Choose the audio file. MP3 plays in every browser. Keep clips to a few minutes and under about 10 MB: exporting spoken word as MP3 at 64 to 96 kbps mono keeps files small without losing quality.
3. Paste the words of the excerpt into **Read-along text**. It's optional, but recommended so that people who can't listen can still enjoy it.
4. Save. The book page gets a **Listen to an excerpt** section under the blurb. Add as many excerpts as you like; only one plays at a time.

Only use recordings you have the rights to. If someone else narrates, get their written agreement. Background music needs a licence.

**Publish reader reviews:** each book page has a **What readers say** section with a **Write a review** button. Reviews readers send arrive in your inbox, the same way contact messages do. Nothing appears on the site until you add it.

1. Open the book and go to **Reader reviews**, then click **Add a review**.
2. Copy in the reader's name, stars and review **word for word**, and the date you received it.
3. Tick **Show on the home page** for up to three favourites; they appear in a blue **What readers say** band on the home page.
4. Save.

Publish honest reviews, positive and negative, without editing them. UK law bans fake reviews and hiding negative ones in a misleading way. The note under the review form tells readers how you handle them. The average rating counts only reviews on your site, and says so. **Read reviews on Amazon** and **Leave a review on Amazon** buttons appear once a book is on sale. The second needs an Amazon link containing the book's product code, e.g. `https://www.amazon.co.uk/dp/B0XXXXXXXX`.

**Run a promotion:** open the book and go to **Promotion**.

1. Tick **Promotion on** and type the **Ribbon text**, the words on the pink corner ribbon. Short works best, around 16 characters, e.g. "99p Kindle deal" or "Free this week".
2. Optionally add a **Message on the book page**, and a **Start date** and **End date**. With dates set, the promotion only shows between them, and the end date is added to the message for you.
3. To show a sale price, enter a **Deal price** on the edition, e.g. the eBook at 0.99. While the promotion runs, it shows with the normal price crossed out. A deal price of 0 shows as "Free".
4. Save. Untick **Promotion on** to stop it early.

Amazon sets the actual price, so check the deal price matches Amazon's before you switch a promotion on, and only show a crossed-out price that's genuinely what the book normally costs. Once the site is on GitHub, it rebuilds itself every night, so promotions start and end on their dates on their own. Until then, dates take effect when you preview or save.

**Instagram:** add your Instagram address in **Site settings → Social media links** (the entry labelled Instagram), e.g. `https://www.instagram.com/yourhandle/`. Your pink OA icon, labelled "Instagram", then appears at the end of the menu on every page, with a purple **Follow us on Instagram** band above the footer. Leave the link empty to hide both.

**Feature or unfeature a book:** tick or untick **Feature on the home page**. You can feature as many as you like. Featured books take turns in the home page banner (up to six, fading every five seconds, real books before samples), with dots and a pause button underneath. The **New and featured** shelf shows up to five books that are featured or marked as new releases, newest first.

**Add a page:** in **Pages**, type the title under *Add a new page*, choose a layout and click **Add**. The form then shows only the fields that layout needs:

- **Text page**: words under a coloured title band, like the About page. Every layout except Feature has a **Title band colour** chooser. Click one of the swatches (Red, Orange, Yellow, Green, Blue, Navy blue, Purple, Pink), or choose your own colour with the picker, or type a #code such as #3a7bd5. The sample shows how it will look. The text turns white or dark automatically, whichever is easier to read, and you'll see a warning if a colour makes text hard to read. (In the online admin, type the colour name or #code instead.) The **Our books** page (and its genre and series pages) and the **Shop** page aren't in Pages, so their colours are under **Site settings → Title band colours**.
- **Image and text**: a large picture beside your words, with an optional caption and button.
- **Cards**: an introduction, then up to six cards, each with a picture, heading, short text and button.
- **Gallery**: an introduction, then pictures with captions.
- **Feature**: a big pink opening with a picture and button, more detail, and an optional closing call to action.

Under **Where it appears**, new pages are ticked to **Show in the menu** and **Show in the footer**; untick either if you'd rather not. Keep the top menu short. You can give the page a shorter **Menu name**.

**Pages under other pages:** when adding a page, choose where it goes in the third box (e.g. *Under Events*), or change **Parent page** at the top of its form later. A page can go under any page in the top menu: **About us**, **Questions**, **Contact**, or any top-level page you've added, e.g. *Book launch* under *Events*. The policy pages (privacy, cookies, terms, delivery) live in the footer, so they can't have pages under them. The parent then shows a drop-down in the menu, listing itself first and then its pages, and the page's address becomes /events/book-launch/. Only one level is allowed, so a page that's already under another can't have pages of its own, and a page that has pages under it can't itself go under another. On phones, the menu folds behind a **Menu** button, with each drop-down opening in place. The page's web address is made from its title when you add it, e.g. "Events" becomes /events/. You can change the layout at any time without losing what you've typed. Pages you add can be deleted; the built-in ones can't.

**Change the order of books:** in the editor on your computer, open **Book order**. Drag each book by the dotted handle on its left (or use **Up** and **Down**), then **Save**. Your order becomes **Our pick**, the first option in Sort by on the Our books page, and also sets the order of the home page shelf and the featured books in the banner. Visitors can still sort by newest, title or price. New books appear in their usual newest-first place until you move them. **Go back to newest first** clears your order. Series pages always stay in series order.

**Change the menu order:** in the editor on your computer, open **Menu order**. Drag items by the dotted handle on their left (or use **Up** and **Down**) to arrange the items in the top menu, and the pages inside each drop-down, then click **Save**. The drop-down's own page always comes first in its list, and Instagram always comes last. New pages you add appear next to where they'd normally go until you move them. (In the online admin, Site settings has a simple **Menu order** list instead.)

**Unpublish a page, book or shop item:** open it and untick **Published on the website** (the green box at the top), then **Save**. It disappears from the live site, the menu, the footer, the book lists and the sitemap, but stays in the editor so you can tick it again later. The editor's **Preview website** still shows it, with a yellow **Draft** banner, so you can keep working on it. If you unpublish a page that has pages nested under it, those pages stay live and move up into the main menu until you publish it again (unpublish them too if you want them hidden). Links to it that you typed into other text will stop working while it's unpublished. Keep the **Privacy policy** published: the law expects one, and the forms link to it.

**Edit page text:** use **Pages** for About, Questions, Contact and the policy pages, and **Home page text** for the home page (including the yellow strapline). Anything in [square brackets] is highlighted in yellow on the site, so you can see what still needs filling in.

**Formatting text:** in the editor on your computer, every text box longer than a line has a toolbar, like a word processor. Select words, then click **B** (bold), **I** (italic) or **Link**. Big text boxes (page text, book blurbs, card text) also have **Heading**, **Sub-heading**, **Normal**, **• List**, **1. List** and **“ Quote**. One-line boxes (introductions, short descriptions) only offer bold, italic and links. **Clear** removes formatting from the selected words. You can paste from Word, Google Docs or a web page: headings, bold, italic, links and lists are kept, and fonts, colours and sizes are dropped, so pasted text always matches the site. Behind the scenes the text is saved with the same simple codes as before (## heading, **bold**, _italic_, [link](/page/)), which is what you type in the online admin.

**Text styles:** in **Site settings → Text styles**, choose the **headings font** (also used for the menu and buttons) and the **paragraph font** from a shortlist, with a sample of each. You can also make headings or paragraph text **smaller** or **larger**, and pick a **heading colour** for headings on the cream background (headings on coloured bands keep white or dark text). Changes apply to every page. All the fonts are web fonts stored with the site (no Google connection), which work in every current browser, and only the two you choose are uploaded. Small working text (the footer, form labels, prices and ISBNs, card details and notes) deliberately stays in each visitor's own system font and size, for clarity, so it doesn't change with these settings.

**Turn on the shop (merchandise)**

The site has a ready-made Shop page for bookmarks, tote bags, T-shirts and so on. It's switched off, so visitors can't see it.

1. In Pages CMS, open **Shop items**. Replace the three sample items with your real products: photo, name, price, sizes and availability.
2. Paste each product's **Buy link**. This is where the Buy button goes, for example the product's Shopify page (section 7). The button only appears when an item is marked Available and has a link.
3. In **Site settings**, tick **Show the shop** and save. A "Shop" link appears in the menu and footer.

Untick it again any time to hide the shop.

**Remove the sample listings:** untick **Show sample listings** in **Site settings**, or delete the two "Sample listing" books.

## 6. The contact form and newsletter

- **Contact form:** each message is emailed to your **Contact email address**. Press *Reply* to answer the sender directly.
- **Newsletter sign-up:** each sign-up arrives as an email saying who has signed up. Add them to your mailing list, or to a newsletter tool when you start using one. A developer (or Claude) can later connect the sign-up box straight to MailerLite or similar.
- **Spam:** a hidden field catches most spam bots, and the form only accepts messages sent from your own website.
- **Not arriving?** Check your spam folder. Then check that the **Website sender address** exists as a mailbox or alias in IONOS: many email providers reject messages from addresses that don't exist.

## 7. Selling directly later (Shopify)

When you have stock, the simplest route is a Shopify shop alongside this site:

1. Set up Shopify and add your products. Shopify handles payments, postage, stock and receipts.
2. Paste each product's Shopify address into this site: as **Other shop link** on a book's paperback edition, or as the **Buy link** on a shop item.
3. **Before your first sale,** replace the Delivery and returns page with a full delivery, cancellation and returns policy, and add sales terms to the Terms page. Have both checked by a solicitor. The current pages only cover buying through Amazon and other shops.

Shopify can also embed its own "Buy" buttons into pages. A developer (or Claude) can add those if you'd rather customers didn't leave this site.

## 8. What you can edit, and what needs a developer

**You can do these yourself in the admin:**

- add, edit and remove books
- upload covers
- change prices, ISBNs, dates, availability and links
- feature or unfeature books
- edit every page's text, including the home page heading and strapline
- change contact details and the business address
- add shop items and switch the shop on or off
- turn the newsletter, sample listings and analytics on or off

**You'll need a developer (or Claude) for:**

- changes to layout, colours or fonts
- new kinds of page or new fields
- connecting a newsletter service such as MailerLite directly
- embedding Shopify buy buttons
- moving to a host without PHP

## 9. Checklist before launch

**Business details**

- [ ] Add your contact email, trading name and business postal address in **Site settings**.
- [ ] Add your company number and VAT number if you have them.
- [ ] Check whether you need to pay the ICO data protection fee at [ico.org.uk](https://ico.org.uk/for-organisations/data-protection-fee/).

**Policies**

- [ ] Fill in every [square-bracket] placeholder in Terms, Privacy, Cookies, and Delivery and returns. On the Privacy page, name your web host (e.g. IONOS).
- [ ] Have those four pages reviewed, then untick **Needs legal review** on each.
- [ ] Fill in the placeholders on the Questions page (submissions, trade orders).

**Books**

- [ ] Untick **Show sample listings** before launch.
- [ ] Add real covers, prices, ISBNs, publication dates and Amazon links.
- [ ] Replace the draft blurb for *Kilts, Castles and Kissing My Ex* with your final KDP blurb.
- [ ] Give Highland Hearts book 2 its real title, or hide it until it's announced by removing it.

**Launch**

- [ ] Run the **Publish website** workflow and check the site loads on your domain with the padlock.
- [ ] Send yourself a test contact message and a test newsletter sign-up.
- [ ] Submit `https://yourdomain/sitemap.xml` in [Google Search Console](https://search.google.com/search-console).

---

### Technical notes (for a developer)

- `build.mjs` is a dependency-free Node build (no `npm install`) that reads `content/` and writes `_site/`. `node build.mjs --relative` writes file-relative links for offline previews.
- `.github/workflows/publish.yml` builds on every push to `main` and once a day (for promotion dates) and mirrors `_site/` to the host over SFTP with `lftp --delete`, using the four repository secrets. Without secrets it only builds.
- `src/php/send.php` is copied to `_site/send.php` with the recipient, sender and site name filled in from `content/settings.json`. It needs PHP 7.4+ with `mail()`. It strips line breaks from header values, checks the Origin/Referer host and has a honeypot field. It answers JSON to `fetch` (with `Accept: application/json`) and redirects to the thanks pages for plain form posts, so it works without JavaScript.
- `src/htaccess` becomes `_site/.htaccess` (Apache): HTTPS redirect, trailing-slash redirect, custom 404, security headers including the Content Security Policy, and cache headers. If a host loops on the HTTPS redirect, remove the three `RewriteCond`/`RewriteRule` lines under "Always use the secure https:// address".
- Each book page carries Book structured data (schema.org), Open Graph tags and a canonical URL. The build also writes `sitemap.xml` and `robots.txt`. Sample listings are `noindex` and left out of the sitemap.
- Fonts: Lora and Poppins (SIL Open Font License), self-hosted. No third-party requests unless Plausible is configured.
- Content is JSON, edited through Pages CMS (`.pages.yml`).
- `editor/server.mjs` is the offline editor: a dependency-free Node server bound to 127.0.0.1 (editor on port 3001, built-site preview on 3000). Its form fields are defined in `editor/app/schema.js`; keep them in step with `.pages.yml`. `Edit website (Mac).command` and `Edit website (Windows).bat` start it.
- `Preview website (Mac).command` and `Preview website (Windows).bat` run `node build.mjs` then `npx -y serve _site -l 3000` and open the browser. Keep them working whenever the build changes; the owner relies on them for previews.

## Hosting on GitHub Pages

`.github/workflows/github-pages.yml` builds and publishes the site on GitHub Pages every time the repository changes (including saves in Pages CMS), and once a day for promotions. Turn it on once: **Settings → Pages → Source → GitHub Actions**. The address shows at the top of that page after the first run. It works at `https://yourname.github.io/repository-name/` and on your own domain once you add it under **Settings → Pages → Custom domain** (then tick **Enforce HTTPS**).

GitHub Pages can't run send.php, so on GitHub Pages the newsletter and review forms are hidden and the contact page shows a short note (with your Instagram link) instead of the form. On a free GitHub account the repository must be public, so anyone can read the content folder, including unpublished pages.

**Publishing changes with GitHub Desktop:** your website folder on your PC is the `livewebsite` folder that GitHub Desktop cloned. Edit and preview as usual, then in GitHub Desktop type a short summary, click **Commit to main** and then **Push origin**. The live site updates about two minutes later (watch for the green tick in the **Actions** tab). Update packs: extract into the same folder, choose Replace, then commit and push. To undo a published change, right-click it in the **History** tab and choose **Revert**, then push.

If you later move to a host that runs PHP (e.g. IONOS), use `publish.yml` instead and the forms come back automatically.
