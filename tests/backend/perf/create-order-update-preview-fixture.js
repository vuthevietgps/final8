#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function loadXlsx() {
  const candidates = [
    path.resolve(__dirname, '../../../backend/node_modules/xlsx'),
    path.resolve(process.cwd(), 'backend/node_modules/xlsx'),
    'xlsx',
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next candidate.
    }
  }

  throw new Error('Unable to load xlsx from backend/node_modules or the current environment');
}

const XLSX = loadXlsx();

const COLUMN_COUNT = 33;
const DEFAULT_ROW_COUNT = 12;

function buildHeaderRow() {
  const header = Array.from({ length: COLUMN_COUNT }, (_, index) => `COL_${String(index + 1).padStart(2, '0')}`);
  header[1] = 'trackingNumber';
  header[10] = 'receiverName';
  header[11] = 'receiverAddress';
  header[12] = 'receiverPhone';
  header[17] = 'codAmount';
  header[32] = 'orderStatus';
  return header;
}

function buildDataRow(index) {
  const row = Array.from({ length: COLUMN_COUNT }, () => '');
  const group = Math.floor(index / 3) + 1;
  const trackingNumber = `VTP20260419-${String(group).padStart(4, '0')}`;
  const codAmount = 150000 + index * 25000;
  const statuses = ['Chờ giao', 'Đang giao', 'Hoàn thành'];

  row[1] = trackingNumber;
  row[10] = `Nguoi nhan ${index + 1}`;
  row[11] = `So ${index + 1}, Duong QA, Phuong ${((index % 5) + 1)}`;
  row[12] = `0900${String(100000 + index).slice(-6)}`;
  row[17] = `${codAmount.toLocaleString('en-US')} VND`;
  row[32] = statuses[index % statuses.length];

  return row;
}

function buildRows(rowCount) {
  const count = Number.isFinite(rowCount) && rowCount > 0 ? rowCount : DEFAULT_ROW_COUNT;
  return Array.from({ length: count }, (_, index) => buildDataRow(index));
}

function createOrderUpdatePreviewFixture(outputPath, rowCount) {
  if (!outputPath || !String(outputPath).trim()) {
    throw new Error('outputPath is required');
  }

  const resolvedOutputPath = path.resolve(String(outputPath));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([buildHeaderRow(), ...buildRows(rowCount)]);

  XLSX.utils.book_append_sheet(workbook, sheet, 'Preview');
  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  XLSX.writeFile(workbook, resolvedOutputPath, { bookType: 'xlsx' });

  return {
    outputPath: resolvedOutputPath,
    rowCount: Number.isFinite(rowCount) && rowCount > 0 ? rowCount : DEFAULT_ROW_COUNT,
  };
}

function main() {
  const outputPath = process.argv[2] || process.env.ORDER_UPDATE_PREVIEW_FILE;
  const parsedRowCount = Number(process.argv[3] || process.env.ORDER_UPDATE_PREVIEW_ROWS || DEFAULT_ROW_COUNT);
  const rowCount = Number.isFinite(parsedRowCount) && parsedRowCount > 0 ? parsedRowCount : DEFAULT_ROW_COUNT;

  if (!outputPath) {
    throw new Error('Provide an output path as argv[2] or ORDER_UPDATE_PREVIEW_FILE');
  }

  const result = createOrderUpdatePreviewFixture(outputPath, rowCount);
  process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  createOrderUpdatePreviewFixture,
};
