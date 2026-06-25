Qahwa Plus — Google Sheet template (dynamic)
=============================================

This folder holds CSV imports that pre-populate the Qahwa Plus Google
Sheet. The Apps Script (apps-script/Code.gs) discovers menu categories
AUTOMATICALLY — no more hard-coded list of tab names. To customise the
menu, just edit the Sheet.

How to build the Sheet from scratch
-----------------------------------

  1. Create a new Google Sheet (sheets.new).
  2. Run the Apps Script bootstrap function once:

       Extensions ▸ Apps Script ▸ select bootstrapSheet ▸ Run

     This creates a "Settings" tab + seven sample category tabs in
     one shot. Approve the permissions prompt on first run.

  3. Customise "Settings" to taste — see settings.csv for the default
     contents and the docs in apps-script/Code.gs for every supported
     key.
  4. Drop your items into each category tab (or import the matching
     CSV from this folder).

How tab discovery works
-----------------------

  * The "Settings" tab is skipped (it's configuration, not a menu).
  * Any other tab whose first row contains an ItemArabic or ItemEnglish
     column header is treated as a menu category.
  * Tab order is taken from the `tab.order` row in Settings; if not
     set, tabs appear in their natural left-to-right Sheet order.
  * Hidden helper tabs (names starting with `_` or exactly "template")
     are skipped.
  * Tabs without a recognised item-name column are skipped.

How column mapping works
------------------------

  The script reads the FIRST ROW of every tab and matches column
  headers by name (Arabic or English), so the client can reorder or
  drop columns without breaking the menu.

  Header strings recognised (case-insensitive, Arabic-alef normalised):

     itemAr      ItemArabic | Arabic | Ar | الاسم | العربي | اسم | الصنف
     itemEn      ItemEnglish | English | En | الانجليزي | بالإنجليزي
     price       Price | السعر | سعر
     description Description | Desc | الوصف | وصف
     image       Image | Img | Photo | صورة | الصورة | رابط الصورة | URL
     available   Available | متوفر | متاح | التوفر
     tag         Tag | الوسم | وسم

  Columns not in this list are ignored. Missing columns simply mean
  the corresponding field is empty (e.g. drop the Description column
  entirely and descriptions will be blank — no error).

  The Image column accepts:
    - a plain https:// URL (CDN, your own hosting, Imgur, etc.)
    - a Google Drive share link, e.g. https://drive.google.com/file/d/<ID>/view
    - a bare Drive file ID, e.g. 1aBcDeFgHiJkLmNoPqRsT
    - any other text or an empty cell — the page will use a Q+ brand
      mark as the placeholder, so you can ship the menu before every
      photo is uploaded.

  Make the Drive file public ("Anyone with the link can view") and
  paste the link into the cell. The script handles the URL rewrite.

How English labels work
-----------------------

  Each tab's English label is resolved in this order:

     1. Explicit `tab.alias.<ArabicName>` row in Settings
     2. Built-in default table in apps-script/Code.gs
     3. Substring matching against common Arabic menu stems
        (e.g. tabs containing "وافل" → "Waffles")
     4. Empty string

  To add a new category with a clean English label, add a row to the
  Settings tab like:

     tab.alias.عصائر طازجة,    Fresh Juices

CSV files in this folder
------------------------

  settings.csv    Two columns: Key, Value. Goes into the "Settings"
                  tab. The tab.order value is comma-separated and
                  MUST stay quoted when imported.

  hot-drinks.csv, cold-drinks.csv, cocktails-fruits.csv, cold-cakes.csv,
  waffles.csv, crepes.csv, sweets-snacks.csv
                  One CSV per category tab. Headers in row 1, items
                  from row 2. Prices are plain numbers (no currency
                  symbol). Column order can be anything — Apps Script
                  matches by header name.

Importing a CSV into Google Sheets
----------------------------------

  File ▸ Import ▸ Upload ▸ pick the CSV ▸ "Replace current sheet" ▸
  Separator: Comma ▸ "Convert text to numbers, dates, and formulas" ON.
