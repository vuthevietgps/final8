function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function buildCsvFromObjects(headers: string[], rows: Array<Record<string, any>>): string {
  const headerRow = headers.join(',');
  const dataRows = rows.map(r => headers.map(h => escapeCsvValue(r[h])).join(','));
  return headerRow + '\n' + dataRows.join('\n');
}

export function downloadCsv(filename: string, csvContent: string, addBom = true): void {
  const BOM = addBom ? '\uFEFF' : '';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
