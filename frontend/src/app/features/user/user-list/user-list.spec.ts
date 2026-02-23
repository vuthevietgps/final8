/**
 * File: features/user/user-list/user-list.spec.ts
 * Mục đích: Kiểm thử đơn vị cho logic danh sách người dùng.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserList } from './user-list';

describe('UserList', () => {
  let component: UserList;
  let fixture: ComponentFixture<UserList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
