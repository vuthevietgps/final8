/** Order and cost cohorts always use the Vietnam business day, independent of host TZ. */
export function businessDay(value: Date | string): string {
  return new Date(+new Date(value) + 7 * 3_600_000).toISOString().slice(0, 10);
}
export function previousBusinessDay(value: Date | string = new Date()): string {
  return businessDay(new Date(+new Date(value) - 24 * 3_600_000));
}
export function businessDayRange(value: Date | string) {
  const day = businessDay(value);
  return { day, start: new Date(`${day}T00:00:00+07:00`), end: new Date(`${day}T23:59:59.999+07:00`) };
}
