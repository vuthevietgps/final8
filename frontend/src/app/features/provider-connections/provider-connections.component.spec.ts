import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ProviderConnectionsComponent } from './provider-connections.component';
import { ProviderConnectionsService } from './provider-connections.service';

describe('Provider connection configuration', () => {
  let service: jasmine.SpyObj<ProviderConnectionsService>;
  let auth: { hasPermission: jasmine.Spy };
  beforeEach(async () => {
    service = jasmine.createSpyObj('ProviderConnectionsService', ['list', 'pages', 'save', 'check', 'status', 'syncAds', 'snapshot']);
    service.status.and.returnValue(of({ storageEnabled: true, reason: 'READY' }));
    service.list.and.returnValue(of([])); service.pages.and.returnValue(of([]));
    auth = { hasPermission: jasmine.createSpy().and.returnValue(true) };
    await TestBed.configureTestingModule({ imports: [ProviderConnectionsComponent], providers: [
      provideRouter([]), provideZonelessChangeDetection(), { provide: ProviderConnectionsService, useValue: service }, { provide: AuthService, useValue: auth },
    ] }).compileComponents();
  });

  it('clears entered keys even when saving fails', async () => {
    const component = TestBed.createComponent(ProviderConnectionsComponent).componentInstance;
    component.storageEnabled.set(true);
    component.apiKey = 'fixture-secret'; component.form.name = 'Shop'; component.accountsText = 'act_123, 123';
    service.save.and.returnValue(throwError(() => ({ status: 503 })));
    await component.save();
    expect(component.apiKey).toBe(''); expect(component.signingSecret).toBe('');
    expect(service.save.calls.mostRecent().args[1].accountIds).toEqual(['123']);
    expect(component.error()).not.toContain('fixture-secret');
  });

  it('omits credentials while editing a saved configuration', async () => {
    const component = TestBed.createComponent(ProviderConnectionsComponent).componentInstance;
    component.storageEnabled.set(true);
    const row = { id: 'abc', kind: 'windsor-google', name: 'Shop', revision: 1, state: 'configured', accountIds: ['123'],
      hasApiKey: true, hasSigningSecret: false, liveWriteEnabled: false, messagingEnabled: false } as const;
    component.edit({ ...row, accountIds: ['123'] });
    service.save.and.returnValue(of({ ...row, accountIds: ['123'], revision: 2 }));
    await component.save();
    const body = service.save.calls.mostRecent().args[1];
    expect(body.apiKey).toBeUndefined(); expect(body.signingSecret).toBeUndefined();
    expect(component.form.revision).toBe(2);
  });

  it('shows the actual incomplete rollout and does not offer live activation', async () => {
    const fixture = TestBed.createComponent(ProviderConnectionsComponent);
    fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 0)); await fixture.whenStable(); fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('kho staging');
    expect(text).toContain('Lưu kết nối');
    expect(fixture.nativeElement.querySelector('input[type=password]')).toBeTruthy();
  });

  it('hides credentials form from users without write permission', async () => {
    auth.hasPermission.and.returnValue(false);
    const fixture = TestBed.createComponent(ProviderConnectionsComponent);
    fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 0)); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    await fixture.componentInstance.save(); expect(service.save).not.toHaveBeenCalled();
  });

  it('does not equate Bird access with verified attribution', () => {
    const component = TestBed.createComponent(ProviderConnectionsComponent).componentInstance;
    expect(component.checkMessage('CHANNEL_ACCESS_TRACKING_UNVERIFIED')).toContain('Còn cần xác minh');
  });

  it('syncs read-only Windsor data and labels it as not materialized to profit', async () => {
    const component = TestBed.createComponent(ProviderConnectionsComponent).componentInstance;
    component.storageEnabled.set(true);
    const row = { id: 'google', kind: 'windsor-google', name: 'Google', revision: 1, state: 'configured', accountIds: ['1396730688'],
      hasApiKey: true, hasSigningSecret: false, liveWriteEnabled: false, messagingEnabled: false,
      check: { status: 'accessible', code: 'ACCOUNT_ACCESS_CONFIRMED', readAccessConfirmed: true } } as const;
    component.connections.set([{ ...row, accountIds: [...row.accountIds] }]);
    service.syncAds.and.returnValue(of({ runId: 'run-1', status: 'success', dateFrom: '2026-08-30', dateTo: '2026-09-05',
      accountIds: ['1396730688'], counts: { requests: 7, rows: 7, resources: 3, dailyMetrics: 7, skippedMetricRows: 0 }, errors: [] }));
    service.snapshot.and.returnValue(of({ source: 'windsor', provider: 'google', connector: 'google_ads',
      dateFrom: '2026-08-30', dateTo: '2026-09-05', summary: { spend: 408312, impressions: 268, clicks: 41,
        conversions: 4, conversionValue: 4, rows: 7, currencies: ['VND'] }, rows: [], resources: [], materializedToAdvertisingCost: false }));
    await component.syncAds({ ...row, accountIds: [...row.accountIds] });
    expect(service.syncAds).toHaveBeenCalledWith('google');
    expect(component.adsSnapshots()['google'].materializedToAdvertisingCost).toBeFalse();
    expect(component.notice()).toContain('7 dòng');
  });
});
