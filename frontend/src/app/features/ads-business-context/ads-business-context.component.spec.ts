import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../product/product.service';
import { AdsBusinessContextComponent } from './ads-business-context.component';
import { AdsBusinessContextApi, LandingPageContext } from './ads-business-context.service';

describe('AdsBusinessContextComponent', () => {
  let fixture: ComponentFixture<AdsBusinessContextComponent>;
  let component: AdsBusinessContextComponent;
  let api: jasmine.SpyObj<AdsBusinessContextApi>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdsBusinessContextApi>('AdsBusinessContextApi', [
      'listLandingPages',
      'listDailyNotes',
      'createLandingPage',
      'updateLandingPage',
      'approveLandingPage',
      'rejectLandingPage',
      'createDailyNote',
      'updateDailyNote',
    ]);
    api.listLandingPages.and.returnValue(of({ data: [] }));
    api.listDailyNotes.and.returnValue(of({ data: [] }));

    await TestBed.configureTestingModule({
      imports: [AdsBusinessContextComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AdsBusinessContextApi, useValue: api },
        { provide: ProductService, useValue: { getAll: () => of([{ _id: 'product-1', name: 'Product' }]) } },
        { provide: AuthService, useValue: { hasPermission: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdsBusinessContextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads landing pages, daily notes and products', () => {
    expect(component.products()).toEqual([{ _id: 'product-1', name: 'Product' }]);
    expect(api.listLandingPages).toHaveBeenCalled();
    expect(api.listDailyNotes).toHaveBeenCalled();
  });

  it('creates a pending landing page context without any provider action', () => {
    const created: LandingPageContext = {
      _id: 'landing-1',
      url: 'https://example.com/offer',
      domain: 'example.com',
      productId: 'product-1',
      approvalStatus: 'pending',
      approvedForAds: false,
    };
    api.createLandingPage.and.returnValue(of(created));
    component.landingUrl = created.url;
    component.landingProductId = 'product-1';
    component.landingTitle = 'Offer';

    component.saveLandingPage();

    expect(api.createLandingPage).toHaveBeenCalledWith(jasmine.objectContaining({
      url: 'https://example.com/offer',
      productId: 'product-1',
      title: 'Offer',
    }));
    expect(component.success()).toContain('chờ duyệt');
  });
});
