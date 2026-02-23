/**
 * Logging utilities for consistent logging format across services
 */
export class LoggerUtil {
  /**
   * Format log message with service name and method
   */
  static formatMessage(serviceName: string, methodName: string, message: string): string {
    return `[${serviceName}.${methodName}] ${message}`;
  }

  /**
   * Log operation with timing
   */
  static logOperation(
    serviceName: string, 
    methodName: string, 
    operation: string, 
    duration?: number,
    metadata?: any
  ): string {
    const durationStr = duration ? ` (${duration}ms)` : '';
    const metadataStr = metadata ? ` - ${JSON.stringify(metadata)}` : '';
    return this.formatMessage(serviceName, methodName, `${operation}${durationStr}${metadataStr}`);
  }

  /**
   * Log error with structured format
   */
  static logError(
    serviceName: string,
    methodName: string,
    error: Error,
    context?: any
  ): any {
    return {
      service: serviceName,
      method: methodName,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create performance tracker
   */
  static createTracker(serviceName: string, methodName: string): {
    start: () => void;
    end: (message: string, metadata?: any) => string;
    duration: () => number;
  } {
    let startTime = 0;
    
    return {
      start: () => {
        startTime = Date.now();
      },
      duration: () => Date.now() - startTime,
      end: (message: string, metadata?: any) => {
        const duration = Date.now() - startTime;
        return this.logOperation(serviceName, methodName, message, duration, metadata);
      }
    };
  }

  /**
   * Log with Vietnamese currency format
   */
  static formatVND(amount: number): string {
    return amount.toLocaleString('vi-VN') + ' VNĐ';
  }

  /**
   * Log validation error
   */
  static logValidationError(serviceName: string, methodName: string, field: string, value: any): string {
    return this.formatMessage(serviceName, methodName, `Invalid ${field} provided: ${value}`);
  }

  /**
   * Log not found error
   */
  static logNotFound(serviceName: string, methodName: string, resource: string, id: string): string {
    return this.formatMessage(serviceName, methodName, `${resource} not found: ${id}`);
  }
}