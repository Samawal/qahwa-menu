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
  },
  // Tab visibility overrides keyed by Arabic tab name.
  // Value `false` (or 0 / no / off) hides the tab in the rendered
  // menu page; anything else (default) keeps it visible.
  // Settings tab key: tab.visible.<ArabicName>   e.g. tab.visible.وافل = false
  hiddenTabs: {}
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
  productKey:  ['ProductKey', 'Product', 'Key', 'مفتاح', 'كود المنتج', 'المنتج'],
  image:       ['Image', 'Img', 'Photo', 'صورة', 'الصورة', 'رابط الصورة', 'URL'],
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
    } else if (key.indexOf('tab.visible.') === 0) {
      // tab.visible.<ArabicName> = false   -> hide that tab
      var vname = key.slice('tab.visible.'.length);
      if (isFalsey(value)) out.hiddenTabs[vname] = true;
      else delete out.hiddenTabs[vname];
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

  // Tabs we never treat as menu categories.
  var SKIP_NAMES = { Settings: 1, IMAGES: 1, Products: 1 };
  var candidates = [];
  for (var i = 0; i < all.length; i++) {
    var sh  = all[i];
    var name = sh.getName();
    if (!name) continue;
    if (SKIP_NAMES[name]) continue;
    if (name.charAt(0) === '_') continue;
    if (/^template$/i.test(name)) continue;
    if (sh.getLastRow() < 2) continue;
    if (!looksLikeMenuTab(sh)) continue;          // header must include item-name column
    candidates.push(sh);
  }

  // Build category wrappers with English label resolved now so we can
  // order them. We don't read items yet — order matters, items come
  // after.
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

  // Drop tabs that the Settings tab marked hidden
  // (tab.visible.<ArabicName> = false / 0 / no / off).
  var hidden = settings.hiddenTabs || {};
  ordered = ordered.filter(function (c) { return !hidden[c.name]; });

  // Read items for each tab. Pass the products lookup so per-row
  // ProductKey columns can resolve to an image via the Products tab.
  var products = readProducts(ss);
  ordered.forEach(function (c) {
    c.items = readItems(c.sheet, products);
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

function readItems(sheet, products) {
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastCol < 1 || lastRow < 2) return [];
  products = products || {};

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

    /* Image resolution order:
     *   1. Per-row Image cell  (one-off overrides win)
   *   2. ProductKey -> Products[productKey].image  (shared photo)
   *   3. Empty string         (page shows Q+ placeholder)
   */
    var image = normaliseImage(pick(row, fieldMap.image));
    if (!image) {
      var key = pick(row, fieldMap.productKey);
      if (key && products[key] && products[key].image) {
        image = products[key].image;
      }
    }

    items.push({
      itemAr:      nameAr,
      itemEn:      nameEn,
      price:       toNumber(pick(row, fieldMap.price)),
      description: pick(row, fieldMap.description),
      image:       image,
      available:   toBool(pick(row, fieldMap.available)),
      tag:         pick(row, fieldMap.tag)
    });
  }

  return items;
}

/* readProducts: read the optional "Products" tab into a lookup map.
 *   Columns (header-driven, any order):
 *     - ProductKey / Key / Product / مفتاح  -> the join key
 *     - Image / URL / Photo / صورة          -> image URL
 *     - Caption / Note / وصف / ملاحظة       -> optional caption (unused by page today,
 *                                               but kept for future use)
 * Returns: { productKey: { image, caption } }  — empty object if no Products tab.
 */
function readProducts(ss) {
  var out = {};
  var sh = ss.getSheetByName('Products');
  if (!sh || sh.getLastRow() < 2) return out;
  var lastCol = sh.getLastColumn();
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var keyCol = -1, imgCol = -1, capCol = -1;
  for (var c = 0; c < header.length; c++) {
    var h = normaliseHeader(header[c]);
    if (keyCol === -1 && (h === normaliseHeader('ProductKey') || h === normaliseHeader('Key') || h === normaliseHeader('Product'))) keyCol = c;
    if (imgCol === -1 && (h === normaliseHeader('Image') || h === normaliseHeader('URL') || h === normaliseHeader('Photo') || h === normaliseHeader('صورة'))) imgCol = c;
    if (capCol === -1 && (h === normaliseHeader('Caption') || h === normaliseHeader('Note') || h === normaliseHeader('وصف') || h === normaliseHeader('ملاحظة'))) capCol = c;
  }
  if (keyCol === -1 || imgCol === -1) return out;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();
  rows.forEach(function (r) {
    var k = String(r[keyCol] || '').trim();
    if (!k) return;
    out[k] = {
      image:   normaliseImage(r[imgCol]),
      caption: capCol >= 0 ? String(r[capCol] || '').trim() : ''
    };
  });
  return out;
}

/* looksLikeMenuTab: true if the first row contains at least one
 * recognised item-name header (itemAr or itemEn). Used to filter
 * out reference / config tabs (IMAGES, Products, etc.) that might
 * share a name pattern with menu tabs.
 */
function looksLikeMenuTab(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return false;
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headerRow.length; i++) {
    var h = normaliseHeader(headerRow[i]);
    if (!h) continue;
    var aliases = COLUMN_ALIASES.itemAr.concat(COLUMN_ALIASES.itemEn);
    for (var a = 0; a < aliases.length; a++) {
      if (normaliseHeader(aliases[a]) === h) return true;
    }
  }
  return false;
}

function mapHeaders(headerRow) {
  var map = {
    itemAr: -1, itemEn: -1, price: -1,
    description: -1, productKey: -1, image: -1, available: -1, tag: -1
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

/* normaliseImage: accept a wide range of cell values and return
 * either a clean absolute URL or empty string. The page uses "" to
 * mean "use placeholder". Recognised inputs:
 *   - "https://..." or "http://..."        -> returned as-is
 *   - "drive.google.com/...", "//...", "//lh3..."
 *   - "//drive.google.com/file/d/ID/view"  -> turned into /uc?export=view&id=ID
 *   - "/d/ID" or "ID" alone (Google Drive) -> turned into the public /thumbnail link
 *   - any other text or empty              -> empty string (placeholder)
 */
function normaliseImage(v) {
  var s = String(v == null ? "" : v).trim();
  if (!s) return "";
  // already absolute http(s)
  if (/^https?:\/\//i.test(s)) return s;
  // protocol-relative
  if (/^\/\//.test(s)) return "https:" + s;
  // bare Google Drive file id
  var m;
  if ((m = s.match(/^\/d\/([a-zA-Z0-9_-]{10,})/))) return "https://lh3.googleusercontent.com/d/" + m[1];
  if ((m = s.match(/^[a-zA-Z0-9_-]{20,}$/)) && /^[a-zA-Z0-9_-]+$/.test(s)) return "https://lh3.googleusercontent.com/d/" + s;
  // Google Drive sharing link -> thumbnail
  if ((m = s.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/))) return "https://lh3.googleusercontent.com/d/" + m[1];
  if ((m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/))) return "https://lh3.googleusercontent.com/d/" + m[1];
  return "";
}

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
  var headers = ['ItemArabic', 'ItemEnglish', 'Price', 'Description', 'Image', 'Available', 'Tag'];

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

  // Make sure every category tab has an Image column. Safe to run
  // on tabs that already have one.
  tabs.forEach(function (t) {
    var sh2 = ss.getSheetByName(t.name);
    if (sh2) {
      var hdr2 = sh2.getRange(1, 1, 1, sh2.getLastColumn()).getValues()[0];
      var hasImage2 = hdr2.some(function (h) { return /^(image|img|photo)$/i.test(String(h).trim()); });
      if (!hasImage2 && sh2.getLastColumn() >= 1) {
        var newCol = sh2.getLastColumn() + 1;
        sh2.getRange(1, newCol).setValue('Image');
      }
    }
  });

  tabs.forEach(function (t) {
    if (ss.getSheetByName(t.name)) return;
    var sh = ss.insertSheet(t.name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 220);
    sh.setColumnWidth(2, 200);
    sh.setColumnWidth(3, 80);
    sh.setColumnWidth(4, 260);
    sh.setColumnWidth(5, 280);
    sh.setColumnWidth(6, 90);
    sh.setColumnWidth(7, 140);
    if (t.seed && t.seed.length) {
      sh.getRange(2, 1, t.seed.length, headers.length).setValues(t.seed);
    }
  });


  // ---- IMAGES guide tab (one-time, doesn't overwrite) -------------------
  var imagesTabName = 'IMAGES';
  if (!ss.getSheetByName(imagesTabName)) {
    var im = ss.insertSheet(imagesTabName);
    im.getRange(1, 1, 1, 2).setValues([['Topic', 'Tip']]).setFontWeight('bold');
    im.setFrozenRows(1);
    im.setColumnWidth(1, 220);
    im.setColumnWidth(2, 720);
    var tips = [
      ['dimensions',       'Recommended: 800 × 600 px (4:3 aspect). The card crops with object-fit:cover so any aspect 4:3 ± 10% looks great.'],
      ['max_file_size',    'Aim for ≤ 150 KB per image. Anything over 250 KB will load slowly on the cheap Syrian mobile data the kiosk and customers use.'],
      ['format',           'JPG for photos (smallest), WebP if you can export it (best quality / size), PNG only if you need transparency. Avoid BMP and TIFF.'],
      ['aspect_warning',   'Square or tall images look bad in the card — they crop to a thin strip. Re-shoot or re-export in landscape 4:3 before uploading.'],
      ['hosting',          'Best options (in order): 1) GitHub Pages inside this repo under menu/assets/items/  2) Imgur or any public CDN  3) Google Drive (must be shared "Anyone with link can view") — the script auto-rewrites Drive URLs.'],
      ['drive_instructions','In Google Drive, right-click the photo ▸ Share ▸ Change to "Anyone with the link" ▸ Viewer. Then copy the link and paste it into the Image cell. The script converts it to a thumbnail URL automatically.'],
      ['naming',           'Use lowercase ASCII and dashes, no spaces. e.g. cappuccino-classic.jpg. This keeps file paths clean and predictable for future migrations.'],
      ['do_not',           'Do NOT upload images with: watermarks baked in, text overlays (use the Description column instead), heavy filters that hide the actual drink, or screenshots of other apps.'],
      ['cache_buster',     'If you change an image but the page still shows the old one, the image was cached. Hard-refresh (Cmd+Shift+R) or open in an incognito window.']
    ];
    im.getRange(2, 1, tips.length, 2).setValues(tips);
    // Make the Tip column wrap and the Topic column bold for readability.
    im.getRange(2, 1, tips.length, 1).setFontWeight('bold');
    im.getRange(2, 2, tips.length, 1).setWrap(true);
    // Walk past any tab the bootstrap creates later — put IMAGES first.
    ss.setActiveSheet(im);
    ss.moveActiveSheet(1);
  }

  // ---- Products tab (the new image-catalog workflow) ---------------
  // Recommended. Each row is a single product (not a menu item); menu
  // rows reference the product by key in their ProductKey column. This
  // way one photo can be reused across multiple menu items without
  // pasting the same URL on every row.
  var productsName = 'Products';
  if (!ss.getSheetByName(productsName)) {
    var pr = ss.insertSheet(productsName);
    pr.getRange(1, 1, 1, 3).setValues([['ProductKey', 'Image', 'Caption']]).setFontWeight('bold');
    pr.setFrozenRows(1);
    pr.setColumnWidth(1, 200);
    pr.setColumnWidth(2, 480);
    pr.setColumnWidth(3, 240);
    var sampleProducts = [
      ['cappuccino',   '', 'espresso + whipped milk, cocoa dusting'],
      ['spanish-latte','', 'espresso + condensed milk'],
      ['iced-latte',   '', 'tall glass'],
      ['mocha',        '', 'chocolate + espresso + milk'],
      ['cheesecake',   '', 'classic NY slice'],
      ['waffle',       '', 'liege-style, pearl sugar'],
      ['crepe',        '', 'folded, dusting of sugar']
    ];
    pr.getRange(2, 1, sampleProducts.length, 3).setValues(sampleProducts);
  }
}

/* isFalsey: small helper so 'false / 0 / no / off / x' all
 * hide a tab when present in tab.visible.<name> settings cells. */
function isFalsey(v) {
  if (typeof v === 'boolean') return v === false;
  if (v === null || v === undefined) return false;
  var s = String(v).trim().toLowerCase();
  return s === 'false' || s === '0' || s === 'no' || s === 'off' || s === 'x';
}
