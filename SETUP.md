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

Total time: 20–30 minutes. Only steps **3**, **5**, and **6**
have to be repeated when the menu changes — and step 3 is the
*only* one the client has to do day-to-day (edit the Sheet).

---

## 1. Create the Google Sheet

1. Go to <https://sheets.new> and create a blank workbook.
2. Rename it **Qahwa Plus — Menu**.
3. Create **7 tabs** (one per category) using these EXACT names
   (case-sensitive, including the leading Arabic characters):

   | # | Tab name (Arabic)    | English label         |
   |---|----------------------|-----------------------|
   | 1 | مشروبات ساخنة        | Hot Drinks            |
   | 2 | مشروبات باردة        | Cold Drinks           |
   | 3 | الكوكتيل والفواكه    | Cocktails & Fruits    |
   | 4 | بارد كيك             | Cold Cakes            |
   | 5 | وافل                 | Waffles               |
   | 6 | كريب                 | Crêpes                |
   | 7 | حلا و سناك           | Sweets & Snacks       |

4. In each tab, put these headers in row 1:

   | A            | B           | C    | D           | E         | F   |
   |--------------|-------------|------|-------------|-----------|-----|
   | `ItemArabic` | `ItemEnglish` | `Price` | `Description` | `Available` | `Tag` |

5. Freeze row 1 in every tab: **View ▸ Freeze ▸ 1 row**.

> **Tip — fast start:** instead of typing everything by hand, open
> `sheet-template/_README.txt` for two ways to bulk-import the sample
> menu: (a) the per-tab CSV files in that folder, or (b) running
> `bootstrapSheet()` from the Apps Script editor (next step).

---

## 2. Attach the Apps Script

1. In the Sheet, click **Extensions ▸ Apps Script**.
2. Delete the placeholder `function myFunction() {}` in `Code.gs`.
3. Open `apps-script/Code.gs` from this repo, copy its full contents,
   and paste it into the editor.
4. **Save** (💾) and name the project `Qahwa Plus Menu API`.
5. *(Optional but recommended)* run the function
   `bootstrapSheet` once: select it from the toolbar dropdown and
   press **Run**. This will create any missing tabs and a couple of
   sample rows. (Approve the permissions prompt on first run.)

> **Currency / phone / instagram** live at the top of `Code.gs` —
> edit `payload.brand.phone` and the `currency` block before you
> deploy if needed. SYP / ل.س is the default; change `code: 'USD'`
> to switch to dollars.

---

## 3. Deploy the Apps Script as a Web App

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

> If you ever change `Code.gs`, repeat step 3 with
> **Deploy ▸ Manage deployments ▸ ✏ Edit ▸ Version: New version**
> — the URL stays the same.

---

## 4. Host the menu HTML

You only need a static host that serves `menu/index.html` over
**HTTPS**. Two free options:

### Option A — GitHub Pages (recommended)

```bash
# from the project root
git init
git add menu/
git commit -m "Qahwa Plus menu"
gh repo create qahwa-menu --public --source=. --push
# enable Pages: Repo ▸ Settings ▸ Pages ▸ Source: main / menu
```

Your URL will be:
`https://<your-github-username>.github.io/qahwa-menu/`

### Option B — Netlify Drop

1. Visit <https://app.netlify.com/drop>.
2. Drag the `menu/` folder onto the page.
3. Copy the assigned `*.netlify.app` URL.

> **Important:** the page must be served from a public, non-`google.com`
> domain — Google Sites refuses to embed URLs on Google's own CDN inside
> an `<iframe>`.

---

## 5. Wire the endpoint into the page

Open `menu/index.html` and find this line near the top of the `<script>`:

```js
var MENU_ENDPOINT = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
```

Replace the placeholder with the Web App URL from step 3. Re-deploy
(commit + push to GitHub Pages, or re-drop the folder on Netlify).

---

## 6. Embed into Google Sites

1. Open (or create) your Google Site.
2. On the page you want the menu on: **Insert ▸ Embed ▸ Embed code**.
3. Open `google-sites-embed.html` and copy the `<iframe>` block.
4. Paste into the Google Sites embed dialog. Replace
   `MENU_PAGE_URL` with the public URL from step 4.
5. Resize the embed to full width and **publish** the site.

You're done 🎉 — edits to the Google Sheet show up on the next page
load (or every 5 minutes for kiosk mode, set by `AUTO_REFRESH_MS` in
`menu/index.html`).

---

## Updating the menu day-to-day

Only the Google Sheet needs to be touched:

- **Add a row** → new item appears on the next refresh.
- **Set `Available = FALSE`** → item stays visible but greyed out with
  a "غير متوفر" label. (Set to `TRUE` or clear the cell to bring it back.)
- **Add a tag** in column F — keywords are recognised automatically:
  - `جديد`            → teal "new" pill
  - `الأكثر طلباً`     → amber "bestseller" pill
  - `موسمي`           → gold "seasonal" pill
- **Change price** in column C — number only, e.g. `12000` not `"12,000"`.

---

## Troubleshooting

| Symptom                                  | Fix |
|------------------------------------------|-----|
| Page shows "تعذر تحميل القائمة"          | `MENU_ENDPOINT` is still the placeholder, or the Web App is not deployed as "Anyone". |
| Empty categories                         | Sheet tab names don't EXACTLY match the Arabic strings in `Code.gs` `CATEGORIES`. Fix the tab name. |
| Prices show as `0`                       | Column C contains a string (e.g. `12,000 ل.س`). Replace with the raw number `12000`. |
| Embed shows a blank box on the Site      | The menu URL is on a Google domain or not HTTPS. Re-host on GitHub Pages or Netlify. |
| Fonts look like the default OS font      | The page can't reach `fonts.googleapis.com`. Pre-bundle the fonts (or accept the system fallback). |

---

## File map

```
Qahwa+
├── apps-script/
│   └── Code.gs             ← paste into Extensions ▸ Apps Script
├── menu/
│   └── index.html          ← self-contained page; set MENU_ENDPOINT
├── sheet-template/
│   ├── _README.txt
│   ├── hot-drinks.csv
│   ├── cold-drinks.csv
│   ├── cocktails-fruits.csv
│   ├── cold-cakes.csv
│   ├── waffles.csv
│   ├── crepes.csv
│   └── sweets-snacks.csv
├── google-sites-embed.html ← <iframe> to paste into Google Sites
└── SETUP.md                ← this file
```
