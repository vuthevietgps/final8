import { Injectable, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  theme = signal<AppTheme>('light');

  constructor() {
    const stored = localStorage.getItem('app-theme') as AppTheme | null;
    if (stored === 'dark' || stored === 'light') {
      this.theme.set(stored);
    } else {
      // Prefer system dark if set
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.theme.set('dark');
      }
    }
    this.applyTheme();
  }

  toggleTheme() {
    const next: AppTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    localStorage.setItem('app-theme', next);
    this.applyTheme();
  }

  applyTheme() {
    const body = document.body;
    if (this.theme() === 'dark') body.classList.add('dark'); else body.classList.remove('dark');
  }
}
