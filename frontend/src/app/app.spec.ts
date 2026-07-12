import { Component } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { SidebarComponent } from './shared/sidebar/sidebar.component';

@Component({
  selector: 'app-sidebar',
  template: ''
})
class SidebarStubComponent {}

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
      .overrideComponent(App, {
        remove: {
          imports: [SidebarComponent]
        },
        add: {
          imports: [SidebarStubComponent, RouterOutlet]
        }
      })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app).toBeTruthy();
  });

  it('should render the main router outlet container without the sidebar for guests', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.app-layout')).not.toBeNull();
    expect(compiled.querySelector('.main-content router-outlet')).not.toBeNull();
    expect(compiled.querySelector('app-sidebar')).toBeNull();
  });
});
