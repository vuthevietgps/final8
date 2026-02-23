/**
 * File: app/app.routes.server.ts
 * Mục đích: Định nghĩa route dành cho SSR (nếu có khác biệt với client).
 */
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
