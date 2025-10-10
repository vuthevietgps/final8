/**
 * File: core/components/coming-soon.component.ts
 * Mục đích: Component hiển thị thông báo "Sắp ra mắt" cho tính năng chưa hoàn thiện.
 */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Component hiển thị thông báo "Coming Soon" cho các tính năng chưa được phát triển
 * Sử dụng cho các route tạm thời trong quá trình phát triển
 */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="coming-soon-container">
      <div class="coming-soon-content">
        <div class="icon">🚧</div>
        <h1>Tính Năng Đang Phát Triển</h1>
        <p class="description">
          Chức năng này đang được phát triển và sẽ sớm ra mắt.
          <br>
          Vui lòng quay lại sau hoặc liên hệ với đội phát triển để biết thêm thông tin.
        </p>
        
        <div class="current-route">
          <strong>Route hiện tại:</strong> {{ getCurrentRoute() }}
        </div>
        
        <div class="actions">
          <button 
            type="button" 
            class="btn btn-primary"
            (click)="goBack()">
            <span class="icon">⬅️</span>
            Quay Lại
          </button>
          
          <button 
            type="button" 
            class="btn btn-secondary"
            (click)="goHome()">
            <span class="icon">🏠</span>
            Trang Chủ
          </button>
        </div>
        
        <div class="features-list">
          <h3>Các tính năng đã hoàn thành:</h3>
          <ul>
            <li>✅ Quản lý người dùng</li>
            <li>✅ Xuất/Nhập CSV người dùng</li>
            <li>✅ Quản lý trạng thái sản xuất</li>
            <li>✅ Quản lý trạng thái đơn hàng</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .coming-soon-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }
    
    .coming-soon-content {
      background: white;
      border-radius: 20px;
      padding: 3rem;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      max-width: 600px;
      width: 100%;
    }
    
    .icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
      display: block;
    }
    
    h1 {
      color: #2c3e50;
      margin-bottom: 1rem;
      font-size: 2.5rem;
      font-weight: 700;
    }
    
    .description {
      color: #6c757d;
      font-size: 1.1rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    
    .current-route {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      color: #495057;
      font-family: monospace;
    }
    
    .actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 2rem;
    }
    
    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      border: none;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
    }
    
    .btn-primary {
      background: #007bff;
      color: white;
    }
    
    .btn-primary:hover {
      background: #0056b3;
      transform: translateY(-2px);
    }
    
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    
    .btn-secondary:hover {
      background: #545b62;
      transform: translateY(-2px);
    }
    
    .features-list {
      text-align: left;
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
      border-left: 4px solid #28a745;
    }
    
    .features-list h3 {
      color: #495057;
      margin-bottom: 1rem;
      font-size: 1.2rem;
    }
    
    .features-list ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .features-list li {
      padding: 0.5rem 0;
      color: #6c757d;
      font-weight: 500;
    }
    
    @media (max-width: 768px) {
      .coming-soon-container {
        padding: 1rem;
      }
      
      .coming-soon-content {
        padding: 2rem;
      }
      
      h1 {
        font-size: 2rem;
      }
      
      .actions {
        flex-direction: column;
      }
      
      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class ComingSoonComponent {
  private router = inject(Router);

  /**
   * Lấy route hiện tại
   */
  getCurrentRoute(): string {
    return this.router.url;
  }

  /**
   * Quay lại trang trước
   */
  goBack(): void {
    window.history.back();
  }

  /**
   * Về trang chủ (danh sách người dùng)
   */
  goHome(): void {
    this.router.navigate(['/users']);
  }
}
