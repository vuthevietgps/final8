/**
 * File: app/app.ts
 * Mục đích: Khai báo App bootstrap (standalone) và thành phần root của ứng dụng.
 */
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shared/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('management-frontend');
}
