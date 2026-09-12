export const DAY_MS = 24 * 60 * 60 * 1000;

export function trimText(value: any, maxLength: number): string | null {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > maxLength
    ? `${text.slice(0, Math.max(0, maxLength - 3))}...`
    : text;
}

export function maskPhone(value: any): string | null {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length <= 4) return '***';
  return `${digits.slice(0, Math.min(3, digits.length - 4))}***${digits.slice(-4)}`;
}

export function dateRangeMatch(startDate: Date, endDate: Date) {
  return {
    $or: [
      { orderDate: { $gte: startDate, $lte: endDate } },
      {
        orderDate: { $exists: false },
        createdAt: { $gte: startDate, $lte: endDate },
      },
      { orderDate: null, createdAt: { $gte: startDate, $lte: endDate } },
    ],
  };
}

export function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
