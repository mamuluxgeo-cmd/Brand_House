# Brand House · საწყობის სისტემა
## დაყენების ინსტრუქცია

---

## ნაბიჯი 1 — Google Sheets-ის მომზადება

1. გახსენი [sheets.google.com](https://sheets.google.com)
2. შექმენი ახალი Spreadsheet
3. მისი URL-დან გამოიტანე **ID**:
   ```
   https://docs.google.com/spreadsheets/d/ >>>THIS_IS_THE_ID<<< /edit
   ```

---

## ნაბიჯი 2 — Apps Script-ის დაყენება

1. Sheets-ში გახსენი: **Extensions → Apps Script**
2. წაშალე ყველაფერი, ჩასვი `Code.gs`-ის შინაარსი
3. პირველ ხაზზე შეცვალე:
   ```javascript
   const SHEET_ID = 'შენი_SHEET_ID_აქ';
   ```
4. შეინახე (Ctrl+S)
5. გამოაქვეყნე: **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. **Copy** გამოსული URL — ეს არის შენი `SCRIPT_URL`

---

## ნაბიჯი 3 — HTML ფაილების განახლება

`index.html` და `scan.html` ფაილებში შეცვალე:
```javascript
const SCRIPT_URL = 'შენი_APPS_SCRIPT_URL_აქ';
```

---

## ნაბიჯი 4 — GitHub Pages-ზე ატვირთვა

1. გახსენი [github.com](https://github.com) → New repository
2. სახელი: `brandhouse-scan` (ან სხვა)
3. **Public** (სავალდებულოა GitHub Pages-ისთვის)
4. ატვირთე ყველა ფაილი:
   - `index.html`
   - `scan.html`
   - `logo.png`
5. Settings → Pages → Source: **main branch**
6. გადაარჩევ `/ (root)`
7. შენი საიტი: `https://USERNAME.github.io/brandhouse-scan/`

---

## მზა! ასე გამოიყენე:

| გვერდი | URL | ვინ იყენებს |
|--------|-----|------------|
| `index.html` | `...github.io/.../index.html` | ოფისი / კომპიუტერი |
| `scan.html` | `...github.io/.../scan.html` | საწყობი / ტელეფონი |

---

## ფაილების სტრუქტურა

```
brandhouse-scan/
├── index.html     ← ადმინ პანელი
├── scan.html      ← სკანერის გვერდი  
├── logo.png       ← Brand House ლოგო
└── Code.gs        ← Google Apps Script (მხოლოდ Sheets-ში)
```
