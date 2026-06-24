/**
 * Qahwa Plus — Digital Menu
 * Google Apps Script Web App (dynamic, settings-driven)
 *
 * Discovers menu categories from any tab in the bound Google Sheet,
 * reads item columns by header name (not position), and pulls brand,
 * currency, and tab order from an optional "Settings" tab.
 *
 * Deploy as "Web app" with access set to "Anyone" so the Google Sites
 * embed can fetch fresh data on every page visit.
 */

/* ============================================================
 * 1. DEFAULT SETTINGS
 *    Used as fallback if the "Settings" tab is missing or empty.
 *    Anything the client puts in the Settings tab overrides these.
 * ============================================================ */

var DEFAULTS = {
  brand: {
    name:      'Qahwa Plus',
    nameAr:    'قهوة+',
    tagline:   'Taste the Difference',
    taglineAr: 'ذوق الفرق',
    location:  'Sweida, Syria',
    landmark:  'Al Amer Tower',
    phone:     '',
    instagram: 'Qahwaa.plus'
  },
  currency: {
    code:   'SYP',
    symbol: 'ل.س',
    suffix: true
  },
  // Tab names explicitly listed here show up first, in this order.
  // Tabs not in this list keep their natural left-to-right order
  // after the listed ones.
  tabOrder: [],
  // English label overrides keyed by Arabic tab name.
  tabAliases: {
    'مشروبات ساخنة':     'Hot Drinks',
    'مشروبات باردة':     'Cold Drinks',
    'الكوكتيل والفواكه': 'Cocktails & Fruits',
    'بارد كيك':          'Cold Cakes',
    'وافل':              'Waffles',
    'كريب':              'Crêpes',
    'حلا و سناك':        'Sweets & Snacks'
  }
};

/* ============================================================
 * 2. COLUMN HEADER MAP
 *    Each entry accepts any of the listed header strings
 *    (case- and whitespace-insensitive, Arabic or English).
 * ============================================================ */

var COLUMN_ALIASES = {
  itemAr:      ['ItemArabic', 'Arabic', 'Ar', 'الاسم', 'العربي', 'اسم', 'الصنف'],
  itemEn:      ['ItemEnglish', 'English', 'En', 'الانجليزي', 'الإنجليزي', 'بالإنجليزي'],
  price:       ['Price', 'السعر', 'سعر'],
  description: ['Description', 'Desc', 'الوصف', 'وصف'],
  available:   ['Available', 'متوفر', 'متاح', 'التوفر'],
  tag:         ['Tag', 'الوسم', 'وسم']
};

/* ============================================================
 * 3. HTTP ENTRY POINT
 * ============================================================ */

function doGet(e) {
  try {
    var payload = buildPayload();
    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: true,
        message: String(err && err.message ? err.message : err),
        generatedAt: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ============================================================
 * 4. PAYLOAD BUILDER
 * ============================================================ */

function buildPayload() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var settings = readSettings(ss);
  var tabs     = discoverMenuTabs(ss, settings);

  var payload = {
    brand:       settings.brand,
    currency:    settings.currency,
    generatedAt: new Date().toISOString(),
    categories:  tabs.map(function (t, i) {
      return {
        name:    t.name,
        nameEn:  t.nameEn,
        order:   i + 1,
        items:   t.items
      };
    })
  };

  return payload;
}

/* ============================================================
 * 5. SETTINGS TAB READER
 *    A tab named exactly "Settings" with two columns:
 *        A: Key     B: Value
 *    Plus optional `tab.alias.<ArabicName>` keys for English labels.
 * ============================================================ */

function readSettings(ss) {
  var out = JSON.parse(JSON.stringify(DEFAULTS)); // deep clone defaults

  var sh = ss.getSheetByName('Settings');
  if (!sh || sh.getLastRow() < 2) return out;

  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();

  rows.forEach(function (row) {
    var key   = String(row[0] || '').trim();
    var value = String(row[1] || '').trim();
    if (!key) return;

    if (key.indexOf('brand.') === 0) {
      out.brand[key.slice('brand.'.length)] = value;
    } else if (key.indexOf('currency.') === 0) {
      var sub = key.slice('currency.'.length);
      if (sub === 'suffix') {
        out.currency.suffix = /^(1|true|yes|on)$/i.test(value);
      } else {
        out.currency[sub] = value;
      }
    } else if (key === 'tab.order') {
      // Comma-separated Arabic tab names in the desired order.
      out.tabOrder = value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    } else if (key.indexOf('tab.alias.') === 0) {
      out.tabAliases[key.slice('tab.alias.'.length)] = value;
    }
    // Unknown keys are silently ignored — keeps the sheet forward-compatible.
  });

  return out;
}

/* ============================================================
 * 6. TAB DISCOVERY
 *    Walks every tab in the workbook, picks the ones that look
 *    like menu tabs, and returns them in the right order.
 * ============================================================ */

function discoverMenuTabs(ss, settings) {
  var all = ss.getSheets();

  // Identify the index of the Settings tab so we can skip it.
  var settingsIndex = -1;
  for (var s = 0; s < all.length; s++) {
    if (all[s].getName() === 'Settings') { settingsIndex = s; break; }
  }

  // Collect candidate tabs (skip Settings, skip blank sheets, skip
  // single-cell template/helper sheets).
  var candidates = [];
  for (var i = 0; i < all.length; i++) {
    if (i === settingsIndex) continue;
    var sh  = all[i];
    var name = sh.getName();
    if (!name) continue;
    if (name.charAt(0) === '_') continue;       // _scratch, _template, ...
    if (/^template$/i.test(name)) continue;
    if (sh.getLastRow() < 2) continue;           // empty / header-only sheets
    candidates.push(sh);
  }

  // Build category objects.
  var cats = candidates.map(function (sh) {
    return {
      name:   sh.getName(),
      nameEn: resolveLabel(sh.getName(), settings),
      sheet:  sh
    };
  });

  // Order: explicit tabOrder first (preserving that list's order),
  // then everything else in natural workbook order.
  var byName = {};
  cats.forEach(function (c) { byName[c.name] = c; });

  var ordered = [];
  var seen    = {};
  (settings.tabOrder || []).forEach(function (n) {
    if (byName[n] && !seen[n]) {
      ordered.push(byName[n]);
      seen[n] = true;
    }
  });
  cats.forEach(function (c) {
    if (!seen[c.name]) ordered.push(c);
  });

  // Read items for each tab.
  ordered.forEach(function (c) {
    c.items = readItems(c.sheet);
  });

  return ordered;
}

/* ============================================================
 * 7. LABEL RESOLUTION
 *    Explicit alias → fallback alias → transliteration → ""
 * ============================================================ */

function resolveLabel(name, settings) {
  if (settings.tabAliases[name]) return settings.tabAliases[name];
  // Built-in transliteration table for the seven known categories.
  var builtin = {
    'قهوة':            'Coffee',
    'شاي':             'Tea',
    'حلويات':          'Desserts',
    'عصائر':           'Juices',
    'سناك':            'Snacks',
    'كيك':             'Cakes',
    'كوكتيل':          'Cocktails',
    'فواكه':           'Fruits',
    'وافل':            'Waffles',
    'كريب':            'Crêpes',
    'بارد':            'Cold',
    'ساخن':            'Hot',
    'ساخنة':           'Hot',
    'باردة':           'Cold'
  };
  // First-word transliteration (works for the common pattern
  // "Hot X" / "Cold X" — e.g. "مشروبات ساخنة" → "Hot Drinks" is
  // already covered by the alias table; this is a last-ditch effort).
  for (var stem in builtin) {
    if (name.indexOf(stem) !== -1) {
      // Combine with any other recognised stems in the name.
      var parts = [];
      for (var k in builtin) if (name.indexOf(k) !== -1) parts.push(builtin[k]);
      if (parts.length) return parts.join(' ');
    }
  }
  return '';
}

/* ============================================================
 * 8. ITEM READER (header-driven)
 *    Reads the header row, maps every column to a field by name,
 *    then walks the data rows producing structured items.
 * ============================================================ */

function readItems(sheet) {
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastCol < 1 || lastRow < 2) return [];

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var fieldMap  = mapHeaders(headerRow);

  // No recognised item-name column? Not a menu tab.
  if (fieldMap.itemAr === -1 && fieldMap.itemEn === -1) return [];

  var data    = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var items   = [];

  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var nameAr = pick(row, fieldMap.itemAr);
    var nameEn = pick(row, fieldMap.itemEn);
    if (!nameAr && !nameEn) continue;          // skip blank rows

    items.push({
      itemAr:      nameAr,
      itemEn:      nameEn,
      price:       toNumber(pick(row, fieldMap.price)),
      description: pick(row, fieldMap.description),
      available:   toBool(pick(row, fieldMap.available)),
      tag:         pick(row, fieldMap.tag)
    });
  }

  return items;
}

function mapHeaders(headerRow) {
  var map = {
    itemAr: -1, itemEn: -1, price: -1,
    description: -1, available: -1, tag: -1
  };
  for (var field in COLUMN_ALIASES) {
    var aliases = COLUMN_ALIASES[field];
    for (var a = 0; a < aliases.length; a++) {
      var target = normaliseHeader(aliases[a]);
      for (var c = 0; c < headerRow.length; c++) {
        if (normaliseHeader(headerRow[c]) === target) {
          map[field] = c;
          break;
        }
      }
      if (map[field] !== -1) break;
    }
  }
  return map;
}

function normaliseHeader(s) {
  return String(s == null ? '' : s)
    .replace(/[\s_\-]+/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

function pick(row, idx) {
  if (idx < 0 || idx >= row.length) return '';
  var v = row[idx];
  return v == null ? '' : String(v).trim();
}

/* ============================================================
 * 9. TYPE COERCION HELPERS
 * ============================================================ */

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
  // Empty cells default to available.
  return s === '' || s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'ok';
}

/* ============================================================
 * 10. ONE-CLICK SETUP
 *     Run `bootstrapSheet()` once on a fresh Sheet to create:
 *       - a "Settings" tab pre-populated with sensible defaults
 *       - one tab per category with headers + a couple of sample rows
 *     Safe to re-run; existing tabs are left alone.
 * ============================================================ */

function bootstrapSheet() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var headers = ['ItemArabic', 'ItemEnglish', 'Price', 'Description', 'Available', 'Tag'];

  // ---- Settings tab ----
  var settingsName = 'Settings';
  if (!ss.getSheetByName(settingsName)) {
    var sh = ss.insertSheet(settingsName, 0); // first position
    sh.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 200);
    sh.setColumnWidth(2, 360);
    var rows = [
      ['brand.name',         DEFAULTS.brand.name],
      ['brand.nameAr',       DEFAULTS.brand.nameAr],
      ['brand.tagline',      DEFAULTS.brand.tagline],
      ['brand.taglineAr',    DEFAULTS.brand.taglineAr],
      ['brand.location',     DEFAULTS.brand.location],
      ['brand.landmark',     DEFAULTS.brand.landmark],
      ['brand.phone',        DEFAULTS.brand.phone],
      ['brand.instagram',    DEFAULTS.brand.instagram],
      ['currency.code',      DEFAULTS.currency.code],
      ['currency.symbol',    DEFAULTS.currency.symbol],
      ['currency.suffix',    String(DEFAULTS.currency.suffix)],
      ['tab.order',          Object.keys(DEFAULTS.tabAliases).join(', ')],
      ['tab.alias.قهوة',     'Coffee'],
      ['tab.alias.شاي',      'Tea'],
      ['tab.alias.حلويات',   'Desserts']
    ];
    sh.getRange(2, 1, rows.length, 2).setValues(rows);
  }

  // ---- Sample tabs ----
  var tabs = [
    {
      name: 'مشروبات ساخنة', seed: [
        ['قهوة اسبريسو سنقل', 'Espresso Single',  5000, '', true, ''],
        ['قهوة اسبريسو دبل',  'Espresso Double',  7000, '', true, ''],
        ['كابتشينو',          'Cappuccino',      10000, '', true, 'الأكثر طلباً']
      ]
    },
    {
      name: 'مشروبات باردة', seed: [
        ['ايس لاتيه', 'Iced Latte', 12000, '', true, '']
      ]
    },
    { name: 'الكوكتيل والفواكه', seed: [] },
    { name: 'بارد كيك',          seed: [] },
    { name: 'وافل',              seed: [] },
    { name: 'كريب',              seed: [] },
    { name: 'حلا و سناك',        seed: [] }
  ];

  tabs.forEach(function (t) {
    if (ss.getSheetByName(t.name)) return;
    var sh = ss.insertSheet(t.name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 220);
    sh.setColumnWidth(2, 200);
    sh.setColumnWidth(3, 80);
    sh.setColumnWidth(4, 280);
    sh.setColumnWidth(5, 90);
    sh.setColumnWidth(6, 140);
    if (t.seed && t.seed.length) {
      sh.getRange(2, 1, t.seed.length, headers.length).setValues(t.seed);
    }
  });
}
