const XLSX = require('xlsx');

// Tạo data test đơn giản
const data = [
  ['ID Nhóm quảng cáo', 'Ngày', 'Cột C', 'Tần suất', 'Cột E', 'Đã Chi', 'CPC', 'CPM'],
  ['TEST123', '2025-10-16', '', 2.5, '', 100000, 1.5, 15.0],
  ['TEST456', '2025-10-16', '', 3.0, '', 200000, 2.0, 20.0]
];

const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

XLSX.writeFile(wb, 'test-simple.xlsx');
console.log('Đã tạo test-simple.xlsx');