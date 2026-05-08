// ==========================================
// Brand House - საწყობის სისტემა
// Google Apps Script Backend
// ==========================================

// ⚠️ შეცვალე შენი Google Sheet-ის ID
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';
const TZ = 'Asia/Tbilisi';

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
    if (headers && headers.length) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }
  } else if (headers && headers.length && sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function nowDate() {
  return Utilities.formatDate(new Date(), TZ, 'dd.MM.yyyy');
}

function nowDateTime() {
  return Utilities.formatDate(new Date(), TZ, 'dd.MM.yyyy HH:mm:ss');
}

function getNextIdLocked(opsSheet) {
  const last = opsSheet.getLastRow();
  if (last <= 1) return 1001;
  const ids = opsSheet.getRange(2, 1, last - 1, 1)
    .getValues()
    .flat()
    .map(v => Number(v))
    .filter(v => !isNaN(v));
  return ids.length ? Math.max.apply(null, ids) + 1 : 1001;
}

function deleteRowsByOperationId(sheet, operationId, columnIndex) {
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  const id = String(operationId);
  const last = sheet.getLastRow();
  const values = sheet.getRange(2, columnIndex, last - 1, 1).getValues();
  let deleted = 0;

  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === id) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}

function deleteRowsByOperationAndEmployee(sheet, operationId, employee) {
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  const id = String(operationId);
  const emp = String(employee || '').trim();
  const last = sheet.getLastRow();
  const values = sheet.getRange(2, 1, last - 1, 2).getValues();
  let deleted = 0;

  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === id && String(values[i][1] || '').trim() === emp) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}

// ========== OPERATIONS ==========

function createOperation(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const opsSheet = ensureSheet('Operations', [
      'ID', 'თარიღი', 'ფაილი', 'სტატუსი', 'ჯამი', 'შექმნილია', 'თანამშრომელი'
    ]);
    const itemsSheet = ensureSheet('Items', [
      'OperationID', 'ბარკოდი', 'საქონელი', 'ფერი/ზომა', 'მოსალოდნელი', 'ფასი'
    ]);

    const id = getNextIdLocked(opsSheet);
    const items = Array.isArray(data.items) ? data.items : [];

    opsSheet.appendRow([id, nowDate(), data.fileName || '', 'მიმდინარე', items.length, nowDateTime(), '']);

    const rows = items.map(item => [
      id,
      String(item.barcode || '').trim(),
      item.productName || '',
      item.colorSize || '',
      Number(item.expectedQty || 0),
      Number(item.price || 0)
    ]);

    if (rows.length > 0) {
      itemsSheet.getRange(itemsSheet.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
    }

    return { success: true, operationId: id };
  } finally {
    lock.releaseLock();
  }
}

function getOperationsList() {
  const opsSheet = ensureSheet('Operations', [
    'ID', 'თარიღი', 'ფაილი', 'სტატუსი', 'ჯამი', 'შექმნილია', 'თანამშრომელი'
  ]);
  const last = opsSheet.getLastRow();
  if (last <= 1) return { operations: [] };

  const rows = opsSheet.getRange(2, 1, last - 1, 7).getValues();
  const operations = rows.map(r => ({
    id: r[0],
    date: r[1],
    fileName: r[2],
    status: r[3],
    totalItems: r[4],
    createdAt: r[5],
    employee: r[6] || ''
  })).reverse();

  return { operations };
}

// ========== ITEMS ==========

function getOperation(id) {
  const opsSheet = ensureSheet('Operations', [
    'ID', 'თარიღი', 'ფაილი', 'სტატუსი', 'ჯამი', 'შექმნილია', 'თანამშრომელი'
  ]);
  const itemsSheet = ensureSheet('Items', [
    'OperationID', 'ბარკოდი', 'საქონელი', 'ფერი/ზომა', 'მოსალოდნელი', 'ფასი'
  ]);

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
        barcode: String(r[1] || '').trim(),
        productName: r[2] || '',
        colorSize: r[3] || '',
        expectedQty: Number(r[4] || 0),
        price: Number(r[5] || 0)
      }));
  }

  return {
    operationId: id,
    date: opRow[1],
    fileName: opRow[2],
    status: opRow[3],
    employee: opRow[6] || '',
    items
  };
}

// ========== RESULTS ==========

function submitScans(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const operationId = String(data.operationId || '').trim();
    const employee = String(data.employee || '').trim();
    const incoming = Array.isArray(data.results) ? data.results : [];

    if (!operationId) return { error: 'Operation ID is required' };
    if (!employee) return { error: 'Employee is required' };

    const resultsSheet = ensureSheet('Results', [
      'OperationID', 'თანამშრომელი', 'ბარკოდი', 'საქონელი', 'ფერი/ზომა',
      'მოსალოდნელი', 'დათვლილი', 'სხვაობა', 'სტატუსი', 'გაგზავნილია'
    ]);

    // მხოლოდ ამ თანამშრომლის ძველი გაგზავნა იცვლება.
    // სხვა თანამშრომლის შედეგები იგივე ოპერაციაზე რჩება და getResults-ში ჯამდება.
    const replacedRows = deleteRowsByOperationAndEmployee(resultsSheet, operationId, employee);

    const submittedAt = nowDateTime();
    const rows = incoming.map(item => {
      const expectedQty = Number(item.expectedQty || 0);
      const scannedQty = Number(item.scannedQty || 0);
      const diff = scannedQty - expectedQty;
      const status = diff === 0 ? 'სწორი' : (diff > 0 ? 'მეტობა' : 'ნაკლები');
      return [
        operationId,
        employee,
        String(item.barcode || '').trim(),
        item.productName || '',
        item.colorSize || '',
        expectedQty,
        scannedQty,
        diff,
        status,
        submittedAt
      ];
    });

    if (rows.length > 0) {
      resultsSheet.getRange(resultsSheet.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
    }

    const opsSheet = getSpreadsheet().getSheetByName('Operations');
    if (opsSheet && opsSheet.getLastRow() > 1) {
      const opsRows = opsSheet.getRange(2, 1, opsSheet.getLastRow() - 1, 7).getValues();
      for (let i = 0; i < opsRows.length; i++) {
        if (String(opsRows[i][0]) === operationId) {
          opsSheet.getRange(i + 2, 4).setValue('დასრულებული');
          const oldEmployee = String(opsRows[i][6] || '').trim();
          const employees = oldEmployee ? oldEmployee.split(',').map(x => x.trim()).filter(Boolean) : [];
          if (employees.indexOf(employee) === -1) employees.push(employee);
          opsSheet.getRange(i + 2, 7).setValue(employees.join(', '));
          break;
        }
      }
    }

    return { success: true, saved: rows.length, replacedRows, submittedAt };
  } finally {
    lock.releaseLock();
  }
}

function updateStatus(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const opsSheet = getSpreadsheet().getSheetByName('Operations');
    if (!opsSheet) return { error: 'No operations sheet' };
    const last = opsSheet.getLastRow();
    if (last <= 1) return { error: 'Not found' };

    const operationId = String(data.operationId || '').trim();
    const status = String(data.status || '').trim();
    const rows = opsSheet.getRange(2, 1, last - 1, 1).getValues();

    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === operationId) {
        opsSheet.getRange(i + 2, 4).setValue(status || 'მიმდინარე');
        return { success: true };
      }
    }
    return { error: 'Operation not found' };
  } finally {
    lock.releaseLock();
  }
}

function deleteOperation(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = getSpreadsheet();
    const id = String(data.operationId || '').trim();
    if (!id) return { error: 'Operation ID is required' };

    const deleted = {
      operations: deleteRowsByOperationId(ss.getSheetByName('Operations'), id, 1),
      items: deleteRowsByOperationId(ss.getSheetByName('Items'), id, 1),
      results: deleteRowsByOperationId(ss.getSheetByName('Results'), id, 1)
    };

    return { success: true, deleted };
  } finally {
    lock.releaseLock();
  }
}

function getResults(id) {
  const resultsSheet = ensureSheet('Results', [
    'OperationID', 'თანამშრომელი', 'ბარკოდი', 'საქონელი', 'ფერი/ზომა',
    'მოსალოდნელი', 'დათვლილი', 'სხვაობა', 'სტატუსი', 'გაგზავნილია'
  ]);
  const last = resultsSheet.getLastRow();
  if (last <= 1) return { results: [] };

  const rows = resultsSheet.getRange(2, 1, last - 1, 10).getValues()
    .filter(r => String(r[0]) === String(id));

  const byBarcode = {};
  rows.forEach(r => {
    const barcode = String(r[2] || '').trim();
    if (!barcode) return;

    if (!byBarcode[barcode]) {
      byBarcode[barcode] = {
        employees: [],
        barcode,
        productName: r[3] || '',
        colorSize: r[4] || '',
        expectedQty: Number(r[5] || 0),
        scannedQty: 0,
        submittedAt: r[9] || ''
      };
    }

    const emp = String(r[1] || '').trim();
    if (emp && byBarcode[barcode].employees.indexOf(emp) === -1) byBarcode[barcode].employees.push(emp);
    byBarcode[barcode].scannedQty += Number(r[6] || 0);
    if (r[9]) byBarcode[barcode].submittedAt = r[9];
  });

  const results = Object.keys(byBarcode).map(barcode => {
    const r = byBarcode[barcode];
    const difference = r.scannedQty - r.expectedQty;
    const status = difference === 0 ? 'სწორი' : (difference > 0 ? 'მეტობა' : 'ნაკლები');
    return {
      employee: r.employees.join(', '),
      barcode: r.barcode,
      productName: r.productName,
      colorSize: r.colorSize,
      expectedQty: r.expectedQty,
      scannedQty: r.scannedQty,
      difference,
      status,
      submittedAt: r.submittedAt
    };
  });

  return { results };
}
