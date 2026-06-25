# Qahwa Plus · Live Digital Menu

A bilingual (Arabic-primary, RTL) digital menu for **Qahwa Plus** (قهوة+) in Sweida, Syria. The menu pulls live from a Google Sheet via an Apps Script Web App and renders into a single self-contained HTML page — no build step, no servers.

**[Live menu](https://samawal.github.io/qahwa-menu/menu/)** ← open this on your phone or the kiosk

## What's inside

| File | Purpose |
|---|---|
| `apps-script/Code.gs` | Google Apps Script — reads the Sheet, returns JSON. Deploy as Web App with access "Anyone". |
| `menu/index.html` | The page itself. Self-contained HTML + CSS + JS. Drop on GitHub Pages or any static host. |
| `menu/assets/*.svg` | Brand mark (Q+.svg) and Arabic typography logo (arabicTypoLogo.svg), inlined into the page. |
| `google-sites-embed.html` | `<iframe>` block to paste into Google Sites. URL already set to the live deployment. |
| `sheet-template/*.csv` | CSV imports for the Sheet: 7 category tabs + Settings + IMAGES reference tab. |
| `sheet-template/_README.txt` | How to build the Sheet from scratch using these CSVs. |
| `SETUP.md` | End-to-end deployment walkthrough (Sheet → Apps Script → Web App → GitHub Pages → Google Sites). |

## How the data flow works

```
Google Sheet (one tab per menu category)
        │  read on every request
        ▼
Apps Script → JSON over HTTPS  ← anyone can GET
        ▲
        │  fetch() on page load + every 5 minutes
        │
menu/index.html  (served from GitHub Pages)
        ▲
        │  Insert ▸ Embed ▸ Embed code
        │
Google Sites page
```

Edit the Sheet → next page load shows the change. No redeploy needed.

## Features

- **Bilingual RTL/LTR**: Arabic primary, English secondary, full right-to-left layout
- **Dynamic tab discovery**: add/rename a tab in the Sheet → it appears in the menu automatically
- **Header-driven columns**: rearrange columns freely, header names (Arabic or English) drive the data model
- **Per-row images**: each menu row has an optional Image column — paste any URL (CDN, Imgur, Google Drive share link) and the page shows that photo. Empty cell = Q+ brand placeholder. The page handles Drive URL rewriting automatically.
- **Graceful placeholders**: items without photos show the Q+ brand mark; items without prices still render; bad URLs swap silently to placeholder
- **Brand-consistent fallback**: Q+ capsule mark serves as every fallback (no broken-image icons, no error messages to customers)
- **Tab visibility**: hide any tab via `tab.visible.<name>` in the Settings tab — opt-in to hide, never opt-out to show
- **Kiosk-friendly**: auto-refresh every 5 minutes, large touch targets, no parallax/heavy JS, gentle animations
- **No third-party UI library**: vanilla CSS, fully owned styling, easy to modify

## Quick deploy

1. Open the menu:
   ```
   https://samawal.github.io/qahwa-menu/menu/
   ```
2. Embed in Google Sites: `google-sites-embed.html` is ready to paste as-is.

To deploy your own copy, follow `SETUP.md`.

## Configuration

The Sheet's `Settings` tab is the runtime config:

| Key | Purpose | Default |
|---|---|---|
| `brand.name` / `brand.nameAr` / `brand.tagline` / `brand.taglineAr` | Brand identity on the page | `Qahwa Plus` / `قهوة+` / `Taste the Difference` / `ذوق الفرق` |
| `brand.location` / `brand.landmark` | Hero meta line | `Sweida, Syria` / `Al Amer Tower` |
| `brand.phone` / `brand.instagram` | Contact info | empty / `Qahwaa.plus` |
| `currency.code` / `currency.symbol` / `currency.suffix` | Price formatting | `SYP` / `ل.س` / `true` |
| `tab.order` | Comma-separated Arabic tab names in the desired display order | natural order |
| `tab.alias.<ArabicName>` | English label override | falls back to built-in table |
| `tab.visible.<ArabicName>` | Set `false` to hide a tab | visible by default |

`SETUP.md` walks through every step in detail.

## Photo guidelines (one-time read)

- **800 × 600 px (4:3 landscape)** — card frame crops, anything else looks bad
- **≤ 150 KB target** — every 100 KB matters on cheap Syrian mobile data
- **JPG for photos, WebP if you can, PNG only for transparency**
- See the `IMAGES` tab in the Sheet for the full spec

## License

Proprietary — built for Qahwa Plus. All rights reserved.
