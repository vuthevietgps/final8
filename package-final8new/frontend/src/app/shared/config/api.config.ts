/**
 * File: api.config.ts
 * Mục đích: Cấu hình tập trung cho API base URL và các endpoints
 */

import { environment } from '../../../environments/environment';

export const API_CONFIG = {
  BASE_URL: environment.apiUrl,
  ENDPOINTS: {
    USERS: '/users',
    TEST_ORDERS: '/test-orders',
    TEST_ORDER2: '/test-order2',
    // SUMMARY1 & SUMMARY2 removed - replaced by SUMMARY4 & SUMMARY5
    DELIVERY_STATUS: '/delivery-status',
    PRODUCTION_STATUS: '/production-status',
    ORDER_STATUS: '/order-status',
    PRODUCT_CATEGORY: '/product-category',
    PRODUCTS: '/products',
    QUOTES: '/quotes',
    SALARY_CONFIG: '/salary-config',
    ADVERTISING_COST: '/advertising-cost',
    OTHER_COST: '/other-cost',
    LABOR_COST1: '/labor-cost1',
    AD_GROUPS: '/ad-groups',
    EXPORT_USERS: '/export-users',
    IMPORT_USERS: '/import-users'
  }
};

export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}
