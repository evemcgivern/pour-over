# Live Brew (pour-over)

> Experiment — answers: does a free coffee-first ratio calculator with taste guidance and local-only brew history help people brew a better pour-over? | archive/delete by: 2026-11-15, or sooner if I stop using it

A free pour-over ratio calculator. Static site, no build, no accounts, no analytics, no sync. Planned home: `https://evemcgivern.github.io/pour-over/` (GitHub Pages project site; the repo is not published yet).

## What it does
- Coffee-first, water-first, and finished-mug modes
- Ratios 1:14 to 1:18, g / oz / mL / fl oz conversion
- Finished-mug mode estimates water kept by the grounds (about 2.1 g per g of coffee; [UC Davis study](https://doi.org/10.1111/1750-3841.16531))
- "Adjust by taste" tips
- Opt-in brew history saved in the browser only, with per-entry delete, undo, and clear-all
- Backup and restore as JSON (restore adds brews, never replaces)
- Copy for Google Sheets, or download a CSV
- Installable as a home-screen app; works offline once loaded
- Buy Me a Coffee link (plain outbound link, no embed)

## Files
- `index.html` — page, SEO tags, FAQ
- `styles.css`, `app.js` — all styles and logic (kept out of the HTML so the security policy can ban inline code)
- `sw.js`, `manifest.webmanifest`, `icon*.png`, `apple-touch-icon.png` — offline and install
- `llms.txt`, `sitemap.xml`, `og-image.*` — discoverability
- `.github/ISSUE_TEMPLATE/` — bug and suggestion forms behind the page's "File an issue" link

## Security
- **Content Security Policy** (meta tag in `index.html`): scripts and styles only from this site, no third-party code, no network calls except to this site, no inline code, no forms, no `<base>`. `no-referrer` is set, and outbound links use `noopener noreferrer`.
- **Data stays on the device.** The only storage is the browser's localStorage. Copy and download happen only when a user taps the button. Imported files are size-limited (1 MB) and every field is validated; text is rendered with `textContent`, never as HTML. Spreadsheet exports neutralize cells that start with `= + - @`.
- **Limits of GitHub Pages:** it cannot send HTTP headers, so `frame-ancestors` (clickjacking protection) and HSTS are not set by this repo. GitHub serves HTTPS and HSTS for `github.io` itself.
- **Repo rules:** the default branch is protected: changes arrive by pull request only, with no direct pushes, force-pushes, or deletion. Pages enforces HTTPS. Secret scanning, push protection, and private vulnerability reporting are on. Keep third-party scripts out; if one is ever needed, update the CSP deliberately.

## Maintenance
- Any change to a cached file: bump `CACHE` in `sw.js` (now `live-brew-v4`), or installed copies keep the old version.
- If the public URL differs from the one above, change it in `index.html` (canonical, `og:url`, `og:image`, `twitter:image`, JSON-LD `url` and `image`), `sitemap.xml`, and `llms.txt`.
- After editing `og-image.svg`: `rsvg-convert -w 1200 -h 630 og-image.svg -o og-image.png`.

## Status
- Tested in a headless browser at phone width. Not yet tested on a real iPhone or Android phone, with VoiceOver or TalkBack, or over https.
- Not a native iOS app, and not a paid product.
- Follow-ups outside this repo: crawlers read `robots.txt` only from the root of `evemcgivern.github.io` (a different repo), so add the Sitemap line there; then add the site to Google Search Console and Bing Webmaster Tools.
- Licensed under MIT (see `LICENSE`).
