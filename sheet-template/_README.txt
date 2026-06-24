Qahwa Plus — Google Sheet template
==================================

This folder contains ONE CSV per Sheet tab. To recreate the workbook
in Google Sheets:

  1. Create a new Google Sheet (sheets.new).
  2. For each CSV file below, add a tab whose name EXACTLY matches
     the Arabic category name (the file name without ".csv"), then
     File > Import > Upload the matching CSV. When importing:
        - "Import location": Replace current sheet
        - "Separator type": Comma
        - "Convert text to numbers...": ON (so prices stay numeric)
        - Tick "Do not convert text that starts with..." if prompted
  3. Repeat until all 7 tabs exist with the right names.
  4. In each tab, the first row is the header. Freeze row 1
     (View > Freeze > 1 row).

Alternatively, open `bootstrap.js` and run the included
`bootstrapSheet()` function inside the Apps Script editor — it
creates all 7 tabs with headers and a few sample rows automatically.

Sheet column order (do not reorder):
  A: ItemArabic
  B: ItemEnglish   (optional)
  C: Price         (number, no symbols — type 15000 not "15,000 ل.س")
  D: Description   (optional)
  E: Available     (TRUE / FALSE  — empty is treated as TRUE)
  F: Tag           (جديد | الأكثر طلباً | موسمي — or blank)
