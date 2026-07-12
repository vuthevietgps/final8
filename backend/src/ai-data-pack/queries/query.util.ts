import { Connection } from 'mongoose';

export function dayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00.000+07:00`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

export async function findRows(
  connection: Connection,
  collection: string,
  filter: Record<string, unknown> = {},
  projection: Record<string, number> = {},
): Promise<any[]> {
  return connection.collection(collection).find(filter, { projection }).toArray();
}

export function sum(rows: any[], field: string): number {
  return rows.reduce((total, row) => total + (Number(row?.[field]) || 0), 0);
}

export function countWith(rows: any[], predicate: (row: any) => boolean): number {
  return rows.reduce((count, row) => count + (predicate(row) ? 1 : 0), 0);
}

