# Lee Solutions and Consulting — website

Static website for https://www.leesc.in, published with GitHub Pages from the `docs/` folder.

- **No dependencies.** Plain HTML, CSS and JavaScript. No frameworks, no external fonts, no tracking.
- **Node.js is only needed for the tests** (version 20 or newer, built-in modules only).

## Folder layout

```
docs/                     <- the website (this is what GitHub Pages publishes)
  index.html              home page (intro, four service areas, contact)
  services/               one page per service area:
    digital-transformation.html
    solution-consulting.html
    it-operations-governance.html
    ai-adoption.html
  privacy.html            privacy notice
  404.html                "page not found" page
  CNAME                   tells GitHub Pages the domain: www.leesc.in
  favicon.svg             placeholder icon (replace with your own)
  robots.txt, sitemap.xml search-engine files
  assets/css/styles.css   all styling; brand colours are the tokens at the top
  assets/js/contact-logic.js   pure checking + mailto link logic (unit tested)
  assets/js/main.js       connects the contact form to the logic
scripts/                  small helper scripts used by tests and preflight
tests/                    automated tests
```

## Before publishing

1. Replace every `{{PLACEHOLDER}}` in `docs/` with your real detail, or delete the line that holds it.
2. Run `npm run preflight`. It lists any placeholder still left and fails until none remain.
3. Run `npm test`. All tests must pass.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Runs all automated tests (logic, accessibility colours, links, structure). |
| `npm run preflight` | Lists unfinished `{{PLACEHOLDER}}` text. |
| `python3 -m http.server 8080 --directory docs` | Preview the site at http://localhost:8080 (the contact form needs a web server, so do not open the file by double-clicking). |

## Changing things

- **Colours:** edit the `--color-...` lines at the top of `docs/assets/css/styles.css` (light and dark blocks). Keep them as 6-digit hex colours. `npm test` then checks the text is still readable.
- **Logo:** save it as `docs/assets/img/logo.svg` (or `.png`) and follow the comment inside the header of `docs/index.html`. Give the image meaningful `alt` text.
- **Contact topics:** the list lives in `docs/assets/js/contact-logic.js` (`TOPICS`) and must match the `<select>` in `docs/index.html`. A test fails if they differ.
- **Contact address:** change `data-recipient` on the form and the visible `mailto:` links in `docs/index.html`, and the `email` in the structured data block.

## How the contact form works

The website cannot send email by itself. The form checks the visitor's input, then opens the visitor's own email program with the message filled in. The visitor presses send there. If you later want messages delivered without the visitor's email program, you will need a form service or your own small server.
