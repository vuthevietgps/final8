import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { redactDataPack } from '../utils/redaction.util';

@Injectable()
export class XlsxExporterService {
  private static readonly EXCEL_TEXT_LIMIT = 32767;

  export(sheets: Record<string, unknown>): Buffer {
    const workbook = XLSX.utils.book_new();
    for (const [name, value] of Object.entries(redactDataPack(sheets))) {
      const rows = this.toRows(value);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ status: 'empty' }]), name.slice(0, 31));
    }
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer', compression: true });
  }

  private toRows(value: any): Record<string, unknown>[] {
    if (Array.isArray(value)) return value.map((item) => this.flatten(item));
    if (Array.isArray(value?.data)) {
      if (!value.data.length) {
        return [{ status: 'empty', ...this.qualityColumns(value.quality) }];
      }
      return value.data.map((item: any) => ({ ...this.flatten(item), ...this.qualityColumns(value.quality) }));
    }
    if (value?.data !== undefined) return [{ ...this.flatten(value.data), ...this.qualityColumns(value.quality) }];
    return [{ ...this.flatten(value) }];
  }

  private qualityColumns(quality: any): Record<string, unknown> {
    return quality ? {
      data_quality_status: quality.data_quality_status,
      confidence: quality.confidence,
      warning: (quality.warning || []).join('; '),
      missing_fields: (quality.missing_fields || []).join('; '),
      can_use_for_decision: quality.can_use_for_decision,
      source: quality.source,
      source_table_or_service: quality.source_table_or_service,
      freshness_at: quality.freshness_at,
      calculation_method: quality.calculation_method,
      period: quality.period,
      data_state: quality.data_state,
      value_state: quality.value_state ?? quality.data_state,
      empty_reason: quality.empty_reason,
    } : {};
  }

  private flatten(value: any, prefix = '', result: Record<string, unknown> = {}): Record<string, unknown> {
    if (value === null || value === undefined || typeof value !== 'object' || value instanceof Date) {
      result[prefix || 'value'] = value instanceof Date ? value.toISOString() : value;
      return result;
    }
    for (const [key, item] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(item)) {
        result[path] = this.toCellText(JSON.stringify(item));
        result[`${path}.row_count`] = item.length;
        const findingKeys = item
          .map((row: any) => row?.finding_key)
          .filter((findingKey): findingKey is string => typeof findingKey === 'string' && findingKey.length > 0);
        if (findingKeys.length) {
          result[`${path}.finding_keys`] = Array.from(new Set(findingKeys)).join('; ');
        }
      } else if (item && typeof item === 'object' && !(item instanceof Date)) {
        this.flatten(item, path, result);
      } else {
        result[path] = item instanceof Date ? item.toISOString() : this.toCellText(item as any);
      }
    }
    return result;
  }

  private toCellText(value: unknown): unknown {
    if (typeof value !== 'string' || value.length <= XlsxExporterService.EXCEL_TEXT_LIMIT) {
      return value;
    }
    const suffix = `... [truncated_for_xlsx_cell_limit original_length=${value.length}]`;
    return `${value.slice(0, XlsxExporterService.EXCEL_TEXT_LIMIT - suffix.length)}${suffix}`;
  }
}
