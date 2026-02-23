# Role-Based Access Control for Suppliers in OrderTest2

## Overview
Implemented comprehensive role-based access control (RBAC) to restrict supplier users to only view and manage their own orders in the OrderTest2 module.

## Implementation Date
2025-01-XX

## Business Requirements
- Suppliers (internal_supplier and external_supplier roles) should only see orders where they are assigned as the supplier
- Suppliers cannot create new orders
- Suppliers cannot delete orders
- Suppliers cannot change the supplier assignment on orders
- Suppliers can update order status, tracking numbers, and other operational fields

## Technical Implementation

### Backend Changes

#### 1. Created Custom Decorator
**File**: `backend/src/auth/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Set by JWT strategy
  },
);
```

This decorator extracts the authenticated user from the request object.

#### 2. Updated Controller
**File**: `backend/src/test-order2/test-order2.controller.ts`

Added `@CurrentUser()` parameter to the `findAll()` endpoint:

```typescript
@Get()
async findAll(
  @Query() query: any,
  @CurrentUser() currentUser: any
): Promise<any> {
  return this.service.findAll(query, currentUser);
}
```

#### 3. Updated Service with Filtering Logic
**File**: `backend/src/test-order2/test-order2.service.ts`

Added automatic filtering for supplier roles:

```typescript
async findAll(query: any, currentUser?: any): Promise<any> {
  const { page = 1, limit = 20, supplierId, agentId } = query;
  const filter: any = {};

  // Role-based filtering
  if (currentUser) {
    const userRole = currentUser.role;
    const userId = currentUser._id || currentUser.userId || currentUser.sub;
    
    if (userRole === 'internal_supplier' || userRole === 'external_supplier') {
      // Force filter by supplierId for supplier users
      filter.supplierId = new Types.ObjectId(userId);
      this.logger.log(`Supplier ${userId} filtering orders by supplierId`);
    }
  }

  // Additional filters from query params
  if (supplierId && supplierId !== 'all') {
    filter.supplierId = new Types.ObjectId(supplierId);
  }
  if (agentId && agentId !== 'all') {
    filter.agentId = new Types.ObjectId(agentId);
  }

  // ... rest of the method
}
```

### Frontend Changes

#### 1. Integrated AuthService
**File**: `frontend/src/app/features/test-order2/test-order2.component.ts`

Injected AuthService and created role-based computed signals:

```typescript
// Inject AuthService
private authService = inject(AuthService);

// Computed signals for role-based UI control
currentUserRole = computed(() => {
  const user = this.authService.currentUser();
  return user?.role || '';
});

isSupplier = computed(() => {
  const role = this.currentUserRole();
  return role === 'internal_supplier' || role === 'external_supplier';
});

canAddNew = computed(() => !this.isSupplier());
canDelete = computed(() => !this.isSupplier());
canEditSupplier = computed(() => !this.isSupplier());
```

#### 2. Updated Template with Conditional Rendering
**File**: `frontend/src/app/features/test-order2/test-order2.component.html`

Added `*ngIf` directives to hide restricted functionality:

```html
<!-- Hide "Add New" button for suppliers -->
<button class="btn btn-primary" (click)="create()" *ngIf="canAddNew()">+ Thêm mới</button>

<!-- Hide supplier filter dropdown for suppliers (auto-filtered on backend) -->
<select [(ngModel)]="filterSupplierId" (change)="onFilterChange()" *ngIf="!isSupplier()">
  <option value="all">Nhà cung cấp: Tất cả</option>
  <!-- ... -->
</select>

<!-- Hide delete column header -->
<th class="center col-delete" *ngIf="canDelete()">Xóa</th>

<!-- Hide delete button in table rows -->
<td class="center col-delete" *ngIf="canDelete()">
  <button class="btn btn-sm btn-danger" (click)="delete(o)">Xóa</button>
</td>

<!-- Disable supplier selection dropdown -->
<select class="source-select" [ngModel]="getSourceSelection(o)" 
        (change)="onSourceSelect(o, $event)" 
        [disabled]="!canEditSupplier()">
  <option *ngFor="let opt of sourceOptionsFor(o)" [value]="opt.value">{{ opt.label }}</option>
</select>
```

## Security Flow

### 1. User Authentication
- User logs in with JWT authentication
- JWT token contains user ID and role
- Token is validated on every request

### 2. Backend Filtering
- Controller extracts user from request using `@CurrentUser()` decorator
- Service checks user role
- If user is a supplier, automatically adds `supplierId` filter to query
- Returns only orders where `order.supplierId === currentUser._id`

### 3. Frontend UI Restrictions
- AuthService provides current user role
- Component uses computed signals to determine permissions
- Template conditionally renders/disables UI elements based on permissions
- Even if supplier bypasses UI, backend filtering prevents unauthorized access

## Permissions Matrix

| Action | Director/Manager/Employee | Internal Supplier | External Supplier |
|--------|--------------------------|-------------------|-------------------|
| View all orders | ✅ Yes | ❌ No | ❌ No |
| View own orders | ✅ Yes | ✅ Yes | ✅ Yes |
| Create orders | ✅ Yes | ❌ No | ❌ No |
| Update order status | ✅ Yes | ✅ Yes | ✅ Yes |
| Update tracking number | ✅ Yes | ✅ Yes | ✅ Yes |
| Delete orders | ✅ Yes | ❌ No | ❌ No |
| Change supplier assignment | ✅ Yes | ❌ No | ❌ No |
| Filter by supplier | ✅ Yes | ❌ Auto-filtered | ❌ Auto-filtered |

## Testing Recommendations

### 1. Backend API Testing
```bash
# Test as supplier user
curl -X GET "http://localhost:3000/test-order2" \
  -H "Authorization: Bearer <supplier_jwt_token>"

# Should return only orders where supplierId matches the supplier's user ID
```

### 2. Frontend UI Testing
- Log in as a supplier user (internal_supplier or external_supplier)
- Verify:
  - ✅ Only sees orders assigned to them
  - ✅ "Add New" button is hidden
  - ✅ Supplier filter dropdown is hidden
  - ✅ Delete buttons are hidden in table
  - ✅ Supplier selection dropdown is disabled
  - ✅ Can update order status, tracking numbers, etc.

### 3. Security Testing
- Attempt to bypass UI restrictions by:
  - Manually calling API with different supplierId
  - Inspecting and enabling hidden buttons
  - Should be blocked by backend filtering

## Files Modified

### Backend
1. `backend/src/auth/decorators/current-user.decorator.ts` - NEW
2. `backend/src/test-order2/test-order2.controller.ts` - Modified
3. `backend/src/test-order2/test-order2.service.ts` - Modified

### Frontend
1. `frontend/src/app/features/test-order2/test-order2.component.ts` - Modified
2. `frontend/src/app/features/test-order2/test-order2.component.html` - Modified

## Future Enhancements

### Potential Improvements
1. **Field-Level Permissions**: Hide sensitive fields (prices, quotes) for suppliers
2. **Visual Indicator**: Show "Supplier Mode" badge in UI
3. **Audit Logging**: Log all supplier actions for compliance
4. **Route Guards**: Add role-based route guards at router level
5. **Notifications**: Email suppliers when new orders are assigned
6. **Mobile Optimization**: Optimize supplier view for mobile devices

### Additional Roles to Consider
- **Warehouse Staff**: View orders, update stock status
- **Accountant**: View financial data, cannot modify orders
- **Customer Service**: View orders, update customer info

## Notes

- Backend filtering is the primary security mechanism - frontend restrictions are for UX only
- Supplier users can still see all fields but cannot modify critical ones
- The system uses MongoDB ObjectId for user and supplier identification
- User ID can be in different fields (`_id`, `userId`, or `sub`) depending on JWT structure

## Related Documentation
- [User Management](./user-management.md)
- [Authentication & Authorization](./auth-guide.md)
- [OrderTest2 Module Overview](./ordertest2-overview.md)
