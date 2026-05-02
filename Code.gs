// ==========================================
// Brand House - საწყობის სისტემა
// Google Apps Script Backend
// ==========================================

// ⚠️ შეცვალე შენი Google Sheet-ის ID
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getOperation')      return respond(getOperation(e.parameter.id));
    if (action === 'getOperationsList') return respond(getOperationsList());
    if (action === 'getResults')        return respond(getResults(e.parameter.id));
    return respond({ error: 'Unknown action' });
  } catch (err) {
    return respond({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'createOperation') return respond(createOperation(data));
    if (data.action === 'submitScans')     return respond(submitScans(data));
    if (data.action === 'updateStatus')    return respond(updateStatus(data));
    if (data.action === 'deleteOperation') return respond(deleteOperation(data));
    return respond({ error: 'Unknown action' });
  } catch (err) {
    return respond({ error: err.toString() });
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== SHEET HELPERS ==========

function ensureSheet(name, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getNextId() {
  const sheet = ensureSheet('Operations', []);
  const last = sheet.getLastRow();
  if (last <= 1) return 1001;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues().flat().filter(x => x);
  return ids.length ? Math.max(...ids) + 1 : 1001;
}

// ========== OPERATIONS ==========

function createOperation(data) {
  const opsSheet = ensureSheet('Operations', [
    'ID', 'თარიღი', 'ფაილი', 'სტატუსი', 'ჯამი', 'შექმნილია', 'თანამშრომელი'
  ]);
  const itemsSheet = ensureSheet('Items', [
    'OperationID', 'ბარკოდი', 'საქონელი', 'ფერი/ზომა', 'მოსალოდნელი', 'ფასი'
  ]);

  const id = getNextId();
  const now = Utilities.formatDate(new Date(), 'Asia/Tbilisi', 'dd.MM.yyyy HH:mm');
  const date = Utilities.formatDate(new Date(), 'Asia/Tbilisi', 'dd.MM.yyyy');

  opsSheet.appendRow([id, date, data.fileName, 'მიმდინარე', data.items.length, now, '']);

  const rows = data.items.map(item => [
    id, item.barcode, item.productName, item.colorSize, item.expectedQty, item.price || 0
  ]);
  if (rows.length > 0) {
    itemsSheet.getRange(itemsSheet.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
  }

  return { success: true, operationId: id };
}

function getOperationsList() {
  const opsSheet = ensureSheet('Operations', [
    'ID', 'თარიღი', 'ფაილი', 'სტატუსი', 'ჯამი', 'შექმნილია', 'თანამშრომელი'
  ]);
  const last = opsSheet.getLastRow();
  if (last <= 1) return { operations: [] };

  const rows = opsSheet.getRange(2, 1, last - 1, 7).getValues();
  const operations = rows.map(r => ({
    id: r[0], date: r[1], fileName: r[2],
    status: r[3], totalItems: r[4], createdAt: r[5], employee: r[6] || ''
  })).reverse();

  return { operations };
}

// ========== ITEMS ==========

function getOperation(id) {
  const opsSheet = ensureSheet('Operations', []);
  const itemsSheet = ensureSheet('Items', []);

  const opsLast = opsSheet.getLastRow();
  if (opsLast <= 1) return { error: 'ოპერაცია ვერ მოიძებნა' };

  const opsRows = opsSheet.getRange(2, 1, opsLast - 1, 7).getValues();
  const opRow = opsRows.find(r => String(r[0]) === String(id));
  if (!opRow) return { error: 'ოპერაცია ვერ მოიძებნა: ' + id };

  const itemsLast = itemsSheet.getLastRow();
  let items = [];
  if (itemsLast > 1) {
    const itemsRows = itemsSheet.getRange(2, 1, itemsLast - 1, 6).getValues();
    items = itemsRows
      .filter(r => String(r[0]) === String(id))
      .map(r => ({
        barcode: r[1], productName: r[2],
        colorSize: r[3], expectedQty: Number(r[4]), price: r[5]
      }));
  }

  return {
    operationId: id, date: opRow[1], fileName: opRow[2],
    status: opRow[3], items
  };
}

// ========== RESULTS ==========

function submitScans(data) {
  const resultsSheet = ensureSheet('Results', [
    'OperationID', 'თანამშრომელი', 'ბარკოდი', 'საქონელი', 'ფერი/ზომა',
    'მოსალოდნელი', 'დათვლილი', 'სხვაობა', 'სტატუსი', 'გაგზავნილია'
  ]);

  // წინა შედეგების წაშლა ამ ოპერაციაზე
  const last = resultsSheet.getLastRow();
  if (last > 1) {
    const existing = resultsSheet.getRange(2, 1, last - 1, 1).getValues();
    for (let i = existing.length - 1; i >= 0; i--) {
      if (String(existing[i][0]) === String(data.operationId)) {
        resultsSheet.deleteRow(i + 2);
      }
    }
  }

  const now = Utilities.formatDate(new Date(), 'Asia/Tbilisi', 'dd.MM.yyyy HH:mm:ss');
  const rows = data.results.map(item => {
    const diff = item.scannedQty - item.expectedQty;
    const status = diff === 0 ? 'სწორი' : (diff > 0 ? 'ლიშნური' : 'ნაკლები');
    return [
      data.operationId, data.employee, item.barcode, item.productName,
      item.colorSize, item.expectedQty, item.scannedQty, diff, status, now
    ];
  });

  if (rows.length > 0) {
    resultsSheet.getRange(resultsSheet.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
  }

  // სტატუსის განახლება
  const opsSheet = getSpreadsheet().getSheetByName('Operations');
  const opsLast = opsSheet.getLastRow();
  if (opsLast > 1) {
    const opsRows = opsSheet.getRange(2, 1, opsLast - 1, 1).getValues();
    for (let i = 0; i < opsRows.length; i++) {
      if (String(opsRows[i][0]) === String(data.operationId)) {
        opsSheet.getRange(i + 2, 4).setValue('დასრულებული');
        opsSheet.getRange(i + 2, 7).setValue(data.employee);
        break;
      }
    }
  }

  return { success: true };
}

function updateStatus(data) {
  const opsSheet = getSpreadsheet().getSheetByName('Operations');
  if (!opsSheet) return { error: 'No operations sheet' };
  const last = opsSheet.getLastRow();
  if (last <= 1) return { error: 'Not found' };
  const rows = opsSheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.operationId)) {
      opsSheet.getRange(i + 2, 4).setValue(data.status);
      return { success: true };
    }
  }
  return { error: 'Operation not found' };
}

function deleteOperation(data) {
  const ss = getSpreadsheet();
  const id = String(data.operationId);

  // Delete from Operations
  const opsSheet = ss.getSheetByName('Operations');
  if (opsSheet && opsSheet.getLastRow() > 1) {
    const rows = opsSheet.getRange(2, 1, opsSheet.getLastRow() - 1, 1).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][0]) === id) opsSheet.deleteRow(i + 2);
    }
  }

  // Delete from Items
  const itemsSheet = ss.getSheetByName('Items');
  if (itemsSheet && itemsSheet.getLastRow() > 1) {
    const rows = itemsSheet.getRange(2, 1, itemsSheet.getLastRow() - 1, 1).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][0]) === id) itemsSheet.deleteRow(i + 2);
    }
  }

  // Delete from Results
  const resSheet = ss.getSheetByName('Results');
  if (resSheet && resSheet.getLastRow() > 1) {
    const rows = resSheet.getRange(2, 1, resSheet.getLastRow() - 1, 1).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][0]) === id) resSheet.deleteRow(i + 2);
    }
  }

  return { success: true };
}

function getResults(id) {
  const resultsSheet = ensureSheet('Results', []);
  const last = resultsSheet.getLastRow();
  if (last <= 1) return { results: [] };

  const rows = resultsSheet.getRange(2, 1, last - 1, 10).getValues();
  const results = rows
    .filter(r => String(r[0]) === String(id))
    .map(r => ({
      barcode: r[2], productName: r[3], colorSize: r[4],
      expectedQty: r[5], scannedQty: r[6], difference: r[7], status: r[8]
    }));

  return { results };
}
