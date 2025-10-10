/**
 * File: main.ts
 * Mục đích: Điểm khởi động ứng dụng NestJS, cấu hình global (CORS, ValidationPipe, UTF-8),
 *   và lắng nghe cổng HTTP cho backend.
 *
 * Chức năng:
 * - Khởi tạo NestJS application
 * - Cấu hình CORS cho phép frontend kết nối
 * - Khởi động server trên port 3000 (có thể cấu hình qua biến môi trường PORT)
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import * as nodeCrypto from 'crypto';

// Ensure global crypto with randomUUID exists (Node 18 may not expose global crypto by default)
// Some libs (e.g., @nestjs/schedule) call global `crypto.randomUUID()`. Provide a safe polyfill.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
try {
  const g: any = global as any;
  const desc = Object.getOwnPropertyDescriptor(g, 'crypto');
  if (!g.crypto) {
    // define if missing
    Object.defineProperty(g, 'crypto', {
      value: nodeCrypto,
      writable: false,
      configurable: true,
      enumerable: false,
    });
  } else if (desc && desc.writable) {
    g.crypto = g.crypto || nodeCrypto;
  }
} catch {
  // ignore if environment doesn't allow redefining crypto
}

async function bootstrap() {
  // Tạo NestJS application instance từ AppModule
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Set global API prefix for all routes, but keep /health at root for container healthchecks
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.ALL }],
  });

  // Cấu hình static files cho uploads
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  // Phục vụ static cho thư mục MEDIA_DIR tại prefix MEDIA_PUBLIC_BASE (hữu ích cho dev)
  const mediaDir = process.env.MEDIA_DIR || join(process.cwd(), 'uploads', 'media');
  // Ensure media directory exists so static serving doesn't fail in dev
  try {
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
  } catch {}
  const base = process.env.MEDIA_PUBLIC_BASE || '/media';
  const mediaPrefix = base.endsWith('/') ? base : base + '/';
  try {
    app.useStaticAssets(mediaDir, { prefix: mediaPrefix });
    // Fallback: legacy path when previous builds saved to backend/uploads/media
    const legacyMediaDir = join(process.cwd(), 'backend', 'uploads', 'media');
    if (legacyMediaDir !== mediaDir) {
      try { if (fs.existsSync(legacyMediaDir)) app.useStaticAssets(legacyMediaDir, { prefix: mediaPrefix }); } catch {}
    }
    console.log(`[media] static mounted`, { mediaDir, mediaPrefix });
  } catch {}
  
  // Cấu hình CORS để cho phép frontend kết nối
  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://localhost:4201',
      'http://localhost:8080'
    ],  // Cho phép cả port 4200, 4201 và 8080 (nginx container)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',          // Các HTTP methods được phép
    credentials: true,                                   // Cho phép gửi cookies/credentials
  });

  // Cấu hình để handle UTF-8 encoding
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  // Thêm validation pipe cho toàn bộ ứng dụng
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // Chỉ cho phép properties được định nghĩa trong DTO
    forbidNonWhitelisted: true,  // Trả lỗi nếu có property không được định nghĩa
    transform: true,        // Tự động transform data type
    transformOptions: {
      enableImplicitConversion: true, // Cho phép chuyển đổi chuỗi số sang number/date tự động
    },
  }));

  // Khởi động server trên port cấu hình (PORT env) hoặc mặc định 3000
  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  console.log(`Backend server is running on http://localhost:${port}`);
}

// Gọi hàm bootstrap để khởi động ứng dụng
bootstrap();
