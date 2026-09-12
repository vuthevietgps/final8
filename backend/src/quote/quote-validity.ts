import { BadRequestException } from '@nestjs/common';
import { businessDay } from '../common/business-day';
export function quoteDate(value: string | Date, end = false): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}+07:00`);
    if (!Number.isFinite(+date) || businessDay(date) !== value) throw new BadRequestException('Ngày hiệu lực không hợp lệ.');
    return date;
  }
  const date = new Date(value);
  if (!Number.isFinite(+date)) throw new BadRequestException('Ngày hiệu lực không hợp lệ.');
  return date;
}
export function quoteValidity(from: string | Date, to: string | Date) {
  const validFrom = quoteDate(from), validUntil = quoteDate(to, true);
  if (validFrom > validUntil) throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  return { validFrom, validUntil };
}
