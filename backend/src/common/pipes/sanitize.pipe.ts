import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * Global pipe to sanitize string inputs by stripping HTML tags.
 * Prevents stored XSS attacks.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') return value;
    if (value && typeof value === 'object') {
      return this.sanitizeObject(value);
    }
    return value;
  }

  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeValue(item));
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeValue(val);
      }
      return sanitized;
    }
    return obj;
  }

  private sanitizeValue(val: any): any {
    if (typeof val === 'string') {
      return this.stripHtmlTags(val);
    }
    if (Array.isArray(val)) {
      return val.map(item => this.sanitizeValue(item));
    }
    if (val && typeof val === 'object') {
      return this.sanitizeObject(val);
    }
    return val;
  }

  private stripHtmlTags(str: string): string {
    return str.replace(/<[^>]*>/g, '');
  }
}
