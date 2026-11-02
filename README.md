# Lee Solutions and Consulting — website

Static website for https://www.leesc.in, published with GitHub Pages straight from the root of this repository. `index.html` is the home page.

- **No build step and no dependencies.** Plain HTML, CSS and JavaScript. No frameworks, no external fonts, no tracking.
- **Node.js is only needed for the tests and the preflight check** (version 20 or newer, built-in modules only).
- **Two languages:** every visible text is written in Thai and English. Thai is the default; visitors switch with the TH | EN toggle.

## Folder layout

```
index.html                  home page: intro, six service areas, Health Check, contact form
services/                   one page per service area (six pages, see "Adding a service")
  digital-transformation.html
  solution-consulting.html
  it-operations-governance.html
  ai-adoption.html
  cyber-security.html
  project-management.html
privacy.html                privacy notice
404.html                    "page not found" page
Logo.png                    company logo, shown in the header of every page
favicon.svg                 browser-tab icon
CNAME                       tells GitHub Pages the custom domain: www.leesc.in
.nojekyll                   tells GitHub Pages to serve the files as they are
robots.txt, sitemap.xml     search-engine files
assets/css/styles.css       all styling; colour tokens are at the top
assets/js/main.js           wires the page up: contact form, hero box, steps, language toggle
assets/js/contact-logic.js  contact form checks and the mailto link (unit tested)
assets/js/hero-logic.js     checks the email box at the top of the home page
assets/js/steps.js          the interactive "How we work" steps
assets/js/language.js       rules for the Thai / English choice
scripts/                    helper scripts for preflight and the tests
tests/                      automated tests
backup/                     old copies kept on this computer (not published, ignored by git)
```

## Publishing on GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to **Deploy from a branch**, branch **main**, folder **/ (root)**.
4. Keep `CNAME` containing `www.leesc.in`, and point the DNS record for `www` to GitHub Pages.

GitHub Pages is case-sensitive, so file names in the code must match the files exactly (for example `Logo.png`, not `logo.png`).

Before every publish:

1. Run `npm run preflight`. It lists any `{{PLACEHOLDER}}` still left and fails until none remain.
2. Run `npm test`. All tests must pass.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Runs all automated tests (logic, colour contrast, links, structure, bilingual text). |
| `npm run preflight` | Lists unfinished `{{PLACEHOLDER}}` text in the website files. |
| `python -m http.server 8080` | Preview the site at http://localhost:8080. Run it from this folder. On macOS or Linux, use `python3`. |

The contact form needs a web server to work, so do not open the HTML files by double-clicking them.

## Language (Thai / English)

- Each visible text is written twice inside the same page: `<span class="en">…</span><span class="th" lang="th">…</span>`. CSS shows only the chosen one.
- The page starts in Thai (`<html lang="th" data-lang="th">`). The toggle in the header switches language and remembers the choice in the visitor's browser.
- Without JavaScript the page stays in Thai and the toggle stays hidden.
- The test `tests/language.test.mjs` fails if a page has an English text without a Thai text (or the other way round).
- Contact form topics keep their English value; the dropdown label is switched by the `data-th` attribute on each option.
- Validation messages in the contact form are English only.

## Adding a service

A new service area needs changes in these places:

1. Create `services/<name>.html`, copying an existing service page. Write both English and Thai text.
2. Add a card for it in the `.cards` grid on `index.html`, and add a link to its page.
3. Add its link to the **Services** list in the footer of `index.html` and of every service page.
4. Update the "Service X of N" labels and the "All N service areas" links, so the count is right on every page.
5. Add the topic to `TOPICS` in `assets/js/contact-logic.js`, and add an `<option>` with the same value in the `<select>` on `index.html`. A test fails if they differ.
6. Add the page path to `SERVICE_PAGES` in `tests/site.test.mjs` and to `PAGES` in `tests/language.test.mjs`.
7. Add the page to `sitemap.xml`.
8. Run `npm test`.

## Changing things

- **Colours:** edit the `--color-…` lines at the top of `assets/css/styles.css` (light and dark blocks). Keep them as 6-digit hex colours. `npm test` checks that the text stays readable.
- **Logo:** replace `Logo.png` at the root, keeping the same name. Every page uses it in the header.
- **Wording:** change the English and Thai text in the same place. Keep the two languages in step.
- **Contact address:** change `data-recipient` on the form in `index.html`, the visible `mailto:` links, and the `email` in the structured data block.

## How the contact form works

The website cannot send email by itself. The form checks the visitor's input, then opens the visitor's own email program with the message filled in. The visitor presses send there. If you later want messages delivered without the visitor's email program, you will need a form service or your own small server.
