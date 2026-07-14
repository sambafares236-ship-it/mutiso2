export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvValue(c.value(row))).join(',')
  );
  return [header, ...lines].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
