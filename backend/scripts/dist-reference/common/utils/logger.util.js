"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerUtil = void 0;
class LoggerUtil {
    static formatMessage(serviceName, methodName, message) {
        return `[${serviceName}.${methodName}] ${message}`;
    }
    static logOperation(serviceName, methodName, operation, duration, metadata) {
        const durationStr = duration ? ` (${duration}ms)` : '';
        const metadataStr = metadata ? ` - ${JSON.stringify(metadata)}` : '';
        return this.formatMessage(serviceName, methodName, `${operation}${durationStr}${metadataStr}`);
    }
    static logError(serviceName, methodName, error, context) {
        return {
            service: serviceName,
            method: methodName,
            error: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        };
    }
    static createTracker(serviceName, methodName) {
        let startTime = 0;
        return {
            start: () => {
                startTime = Date.now();
            },
            duration: () => Date.now() - startTime,
            end: (message, metadata) => {
                const duration = Date.now() - startTime;
                return this.logOperation(serviceName, methodName, message, duration, metadata);
            }
        };
    }
    static formatVND(amount) {
        return amount.toLocaleString('vi-VN') + ' VNĐ';
    }
    static logValidationError(serviceName, methodName, field, value) {
        return this.formatMessage(serviceName, methodName, `Invalid ${field} provided: ${value}`);
    }
    static logNotFound(serviceName, methodName, resource, id) {
        return this.formatMessage(serviceName, methodName, `${resource} not found: ${id}`);
    }
}
exports.LoggerUtil = LoggerUtil;
//# sourceMappingURL=logger.util.js.map