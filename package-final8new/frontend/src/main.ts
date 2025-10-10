/**
 * File: src/main.ts
 * Mục đích: Điểm khởi động ứng dụng Angular trên trình duyệt; bootstrap App theo cấu hình.
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
