# Qahwa Plus — Digital Menu · Setup Guide

This guide takes you from a brand-new Google account to a live,
auto-updating digital menu embedded in Google Sites.

```
 ┌───────────────┐   fetch    ┌────────────────┐   reads   ┌──────────────┐
 │  Google Sites │  ───────►  │   menu page    │  ───────► │  Google Sheet│
 │  (embed)      │            │  (GitHub Pages │           │  (one tab    │
 │               │            │   / Netlify)   │           │   per cat.)  │
 └───────────────┘            └────────────────┘           └──────────────┘
                                        ▲
                                        │ doGet()  (JSON)
                                        │
                                ┌───────────────┐
                                │  Apps Script  │
                                │  (Web App)    │
                                └───────────────┘
```

Total time: 20–30 minutes for a fresh deployment. After that,
only **editing the Sheet** is needed to change the menu.

---

## 1. Create the Google Sheet

1. Go to <https://sheets.new> and create a blank workbook.
2. Rename it **Qahwa Plus — Menu**.
3. Open **Extensions ▸ Apps Script**.
4. Delete the placeholder `function myFunction() {}` in `Code.gs`.
5. Copy the full contents of `apps-script/Code.gs` from this repo into
   the editor. **Save** (💾) and name the project **Qahwa Plus Menu API**.
6. Back in the Sheet, in the Apps Script editor select `bootstrapSheet`
   from the function dropdown and press **Run**. Approve the permissions
   prompt on first run.
7. The Sheet now has 10 tabs in this order:
   - `Settings` — runtime config (brand, currency, tab order, aliases,
     visibility)
   - `IMAGES` — photo spec (size, format, hosting, Drive tips)
   - 7 category tabs — menu items
8. To bulk-populate menu items: **File ▸ Import ▸ Upload** the matching
   CSV from `sheet-template/`. **Separator: Comma**, **"Replace current
   sheet"**, **"Convert text to numbers"** ON.

> The Sheet is now the source of truth. The page reads from it on every
> load. **No redeploy needed** when you change prices, descriptions,
> availability, photos, or categories.

---

## 2. Deploy the Apps Script as a Web App

1. In the Apps Script editor: **Deploy ▸ New deployment**.
2. Click the gear icon ⚙ next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** `Qahwa Plus menu JSON`
   - **Execute as:** `Me (your@email)`
   - **Who has access:** **`Anyone`**
4. Click **Deploy** → approve the scopes → copy the **Web app URL**.
   It looks like:
   `https://script.google.com/macros/s/AKfycbx…/exec`
5. Test it: open that URL in a browser. You should see JSON like
   `{ "brand": {…}, "currency": {…}, "categories": [ … ] }`.

> If you ever change `Code.gs`, repeat step 1 with **Deploy ▸ Manage
> deployments ▸ ✏ Edit ▸ Version: New version** — the URL stays the same.

---

## 3. Wire the endpoint into the page

Open `menu/index.html` and find this line near the top of the `<script>`:

```js
var MENU_ENDPOINT = "https://script.google.com/macros/s/AKfycbx…/exec";
```

Replace the placeholder with the Web App URL from step 2. The default
in the repo is already a live URL — only change it if you redeployed
and got a new one.

Re-deploy: commit + push to GitHub Pages, or re-drop the folder on
Netlify, depending on your host.

---

## 4. Host the menu HTML

You only need a static host that serves `menu/index.html` over
**HTTPS**. Two free options:

### Option A — GitHub Pages (recommended)

```bash
cd "qahwa-menu"
git init -b main
git add .
git commit -m "Initial menu deploy"
gh repo create qahwa-menu --public --source=. --push
# Then on github.com/qahwa-menu/settings/pages:
#   Source: "Deploy from a branch"  ·  Branch: main  ·  Folder: / (root)
```

Your URL will be:
`https://<your-github-username>.github.io/qahwa-menu/menu/`

### Option B — Netlify Drop

1. Visit <https://app.netlify.com/drop>.
2. Drag the `menu/` folder onto the page.
3. Copy the assigned `*.netlify.app` URL.

> The menu must be served from a public, non-Google domain —
> Google Sites refuses to embed URLs on Google's own CDN inside an
> `<iframe>`.

---

## 5. Embed into Google Sites

1. Open (or create) your Google Site.
2. On the page you want the menu on: **Insert ▸ Embed ▸ Embed code**.
3. Open `google-sites-embed.html` and copy the `<iframe>` block. The URL
   is already set to the live GitHub Pages deployment.
4. Paste into the Google Sites embed dialog. Resize to full width and
   **publish** the site.

---

## 6. Configure via the Settings tab (no code changes needed)

The Sheet's `Settings` tab controls everything client-facing. Add rows
as needed:

| Key | Purpose |
|---|---|
| `brand.name` | Latin brand name |
| `brand.nameAr` | Arabic brand name |
| `brand.tagline` / `brand.taglineAr` | Hero tagline |
| `brand.location` / `brand.landmark` | Hero meta line |
| `brand.phone` / `brand.instagram` | Contact info |
| `currency.code` / `currency.symbol` | e.g. `SYP` + `ل.س` |
| `currency.suffix` | `true` to render "10,000 ل.س", `false` for "$10,000" |
| `tab.order` | Comma-separated Arabic tab names in the desired display order |
| `tab.alias.<ArabicName>` | English label override for that tab |
| `tab.visible.<ArabicName>` | `false` (or `no` / `off` / `0` / `x`) to hide the tab. Default if absent: **visible**. |

Edit a row, hard-refresh the page → change is live. No redeploy.

---

## Updating the menu day-to-day

The Sheet is the source of truth. Edits propagate automatically.

| What you want to do | How |
|---|---|
| Add a row | New item appears on the next refresh |
| Change a price | Type the new number in column C |
| Mark unavailable | Set column E (`Available`) to `FALSE` — item stays visible but greyed out with "غير متوفر" |
| Add a tag | `جديد` (teal pill), `الأكثر طلباً` (amber), `موسمي` (gold) |
| Add a new category | New tab with the right header row → auto-discovered |
| Rename a category | Rename the tab + add a `tab.alias.<newname>` row in Settings |
| Reorder categories | Edit `tab.order` in Settings (comma-separated Arabic names) |
| Hide a category | Add `tab.visible.<name>` = `false` in Settings |
| Change phone / Instagram | Edit `Settings` — no code change |
| Change currency | Edit `Settings.currency.code` and `currency.symbol` |

---

## Adding photos

Each menu row has an optional `Image` column. Paste a URL in any of
these forms and the page will show that photo on the card:

- a plain `https://` URL (CDN, Imgur, your own hosting, etc.)
- a Google Drive share link (must be **"Anyone with the link can view"**)
- a bare Google Drive file ID
- an empty cell — the page shows the Q+ brand placeholder

**Resolution** is direct: row's own `Image` cell, or empty if blank.
No second tab to maintain. If your menu tab does not have an Image
column, every card shows the placeholder — no error, no broken icons.

See the `IMAGES` tab for size / format / Drive sharing tips.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Page shows "تعذر تحميل القائمة" | `MENU_ENDPOINT` placeholder wasn't replaced, or the Web App isn't deployed as "Anyone" |
| Empty categories | Sheet tab names don't EXACTLY match the Arabic strings used in `Code.gs`. Fix the tab name. |
| Prices show as `0` | Column C contains a string (e.g. `12,000 ل.س`). Replace with the raw number `12000`. |
| Embed shows a blank box on the Site | The menu URL is on a Google domain or not HTTPS. Re-host on GitHub Pages or Netlify. |
| Fonts look like the default OS font | The page can't reach `fonts.googleapis.com`. Accept the system fallback (already declared in `--serif`). |
| Tab is missing from the menu | A `tab.visible.<name>` row in Settings says `false`. Delete it or change to `true`. |

---

## File map

```
qahwa-menu/
├── README.md                         ← you are here (repo front page)
├── SETUP.md                          ← this file
├── .gitignore
├── apps-script/
│   └── Code.gs                       ← paste into Extensions ▸ Apps Script
├── menu/
│   ├── index.html                    ← the page; edit MENU_ENDPOINT
│   └── assets/
│       ├── q-plus.placeholder.svg    ← brand mark for placeholder cards
│       ├── q-plus.inline.svg         ← inlined into the page
│       ├── arabic-typo-logo.svg      ← original (kept for reference)
│       └── arabic-typo-logo.inline.svg
├── google-sites-embed.html           ← <iframe> to paste into Google Sites
└── sheet-template/                   ← CSV imports
    ├── _README.txt                   ← how to build the Sheet from these
    ├── settings.csv                  ← 2 columns: Key, Value
    ├── images.csv                    ← photo spec (Topic, Tip)
    ├── hot-drinks.csv
    ├── cold-drinks.csv
    ├── cocktails-fruits.csv
    ├── cold-cakes.csv
    ├── waffles.csv
    ├── crepes.csv
    └── sweets-snacks.csv
```
