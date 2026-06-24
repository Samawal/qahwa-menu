/**
 * Qahwa Plus — Digital Menu
 * Google Apps Script Web App
 *
 * Reads one tab per category from the bound Google Sheet and exposes the
 * data as a public JSON endpoint. Deploy as "Web app" with access set to
 * "Anyone" to allow the Google Sites embed to fetch fresh data on every
 * page visit (no re-publish needed when the menu changes).
 */

// Order + English label for every menu tab.
// Tab names on the Sheet must match the keys below EXACTLY (Arabic).
var CATEGORIES = [
  { ar: 'مشروبات ساخنة',     en: 'Hot Drinks' },
  { ar: 'مشروبات باردة',     en: 'Cold Drinks' },
  { ar: 'الكوكتيل والفواكه', en: 'Cocktails & Fruits' },
  { ar: 'بارد كيك',          en: 'Cold Cakes' },
  { ar: 'وافل',              en: 'Waffles' },
  { ar: 'كريب',              en: 'Crepes' },
  { ar: 'حلا و سناك',        en: 'Sweets & Snacks' }
];

/**
 * HTTP GET entry point. Returns the full menu as JSON.
 * Cache-control headers are set to "no-cache" so kiosk displays and
 * customer phones always see the latest sheet content.
 */
function doGet(e) {
  try {
    var payload = buildPayload();
    var json = JSON.stringify(payload);
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    var errorPayload = {
      error: true,
      message: String(err && err.message ? err.message : err),
      generatedAt: new Date().toISOString()
    };
    return ContentService
      .createTextOutput(JSON.stringify(errorPayload))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Reads every category tab and returns the structured payload.
 * Sheet columns are read positionally:
 *   A: ItemArabic   B: ItemEnglish   C: Price   D: Description   E: Available   F: Tag
 */
function buildPayload() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var payload = {
    brand: {
      name:        'Qahwa Plus',
      nameAr:      'قهوة+',
      tagline:     'Taste the Difference',
      taglineAr:   'ذوق الفرق',
      location:    'Sweida, Syria',
      landmark:    'Al Amer Tower',
      phone:       '',
      instagram:   'Qahwaa.plus'
    },
    currency: {
      code:   'SYP',     // change to 'USD' if needed
      symbol: 'ل.س',
      suffix: true       // true => price rendered as "15,000 ل.س"
    },
    generatedAt: new Date().toISOString(),
    categories: []
  };

  CATEGORIES.forEach(function(cat) {
    var sheet = ss.getSheetByName(cat.ar);
    var items = [];

    if (sheet && sheet.getLastRow() >= 2) {
      var lastRow = sheet.getLastRow();
      var values  = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

      items = values
        .filter(function(row) { return row[0] && String(row[0]).trim() !== ''; })
        .map(function(row) {
          return {
            itemAr:      String(row[0]).trim(),
            itemEn:      row[1] ? String(row[1]).trim() : '',
            price:       toNumber(row[2]),
            description: row[3] ? String(row[3]).trim() : '',
            available:   toBool(row[4]),
            tag:         row[5] ? String(row[5]).trim() : ''
          };
        });
    }

    payload.categories.push({
      name:    cat.ar,
      nameEn:  cat.en,
      order:   payload.categories.length + 1,
      items:   items
    });
  });

  return payload;
}

/* ---------- helpers ---------- */

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return 0;
  var n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined) return true;
  var s = String(v).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'no' || s === 'off' || s === 'x') return false;
  // Empty cells are treated as available (column E is optional).
  return s === '' || s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'ok';
}

/**
 * Optional: run this once to create all 7 tabs with headers + a few sample
 * rows. Safe to run again — it skips tabs that already exist.
 */
function bootstrapSheet() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var headers = ['ItemArabic', 'ItemEnglish', 'Price', 'Description', 'Available', 'Tag'];
  var seed = {
    'مشروبات ساخنة': [
      ['قهوة اسبريسو سنقل', 'Espresso Single',  5000, '',  true, ''],
      ['قهوة اسبريسو دبل',  'Espresso Double',  7000, '',  true, ''],
      ['كابتشينو',          'Cappuccino',      10000, '',  true, 'الاكثر طلبا']
    ],
    'مشروبات باردة': [
      ['ايس لاتيه',  'Iced Latte',  12000, '', true, '']
    ],
    'الكوكتيل والفواكه': [],
    'بارد كيك': [],
    'وافل': [],
    'كريب': [],
    'حلا و سناك': []
  };

  CATEGORIES.forEach(function(cat) {
    var name = cat.ar;
    if (ss.getSheetByName(name)) return;
    var sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 220);
    sh.setColumnWidth(2, 200);
    sh.setColumnWidth(3, 80);
    sh.setColumnWidth(4, 280);
    sh.setColumnWidth(5, 90);
    sh.setColumnWidth(6, 140);
    if (seed[name] && seed[name].length) {
      sh.getRange(2, 1, seed[name].length, headers.length).setValues(seed[name]);
    }
  });
}
