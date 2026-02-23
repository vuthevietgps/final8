import 'dotenv/config';
import mongoose, { Connection } from 'mongoose';
import { User, UserSchema } from '../src/user/user.schema';
import { UserRole } from '../src/user/user.enum';
import { ProductCategory, ProductCategorySchema } from '../src/product-category/schemas/product-category.schema';
import { Product, ProductSchema } from '../src/product/schemas/product.schema';
import { PurchaseOrder, PurchaseOrderSchema } from '../src/purchase/schemas/purchase-order.schema';
import { PurchaseStatus } from '../src/purchase/dto/create-purchase-order.dto';
import { InventorySummary, InventorySummarySchema } from '../src/inventory/schemas/inventory-summary.schema';
import { InventoryTransaction, InventoryTransactionSchema } from '../src/inventory/schemas/inventory-transaction.schema';
import { SupplierPayable, SupplierPayableSchema } from '../src/supplier-payable/schemas/supplier-payable.schema';
import { SupplierPayableService } from '../src/supplier-payable/supplier-payable.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { TestOrder2, TestOrder2Schema } from '../src/test-order2/schemas/test-order2.schema';

async function connect(): Promise<Connection> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI. Please set it in .env before running the seed script.');
  }
  const conn = await mongoose.createConnection(uri).asPromise();
  console.log('Connected to MongoDB');
  return conn;
}

async function upsertCategory(conn: Connection) {
  const Model = conn.model<ProductCategory>('ProductCategory', ProductCategorySchema);
  const doc = await Model.findOneAndUpdate(
    { code: 'DEMO' },
    { $setOnInsert: { name: 'Demo Category', description: 'Nhóm demo', color: '#3B82F6', icon: '📦', isActive: true, order: 1, code: 'DEMO' } },
    { upsert: true, new: true },
  );
  return doc;
}

async function upsertSupplier(conn: Connection, fullName: string, email: string, role: UserRole) {
  const Model = conn.model<User>('User', UserSchema);
  const doc = await Model.findOneAndUpdate(
    { email },
    { $setOnInsert: { fullName, email, password: '123456', phone: '0900000000', role, isActive: true } },
    { upsert: true, new: true },
  );
  return doc;
}

async function upsertProduct(conn: Connection, params: { name: string; categoryId: mongoose.Types.ObjectId; importPrice: number; shippingCost: number; packagingCost: number; suppliers: any[]; color?: string }) {
  const Model = conn.model<Product>('Product', ProductSchema);
  const doc = await Model.findOneAndUpdate(
    { name: params.name },
    {
      $set: {
        categoryId: params.categoryId,
        importPrice: params.importPrice,
        shippingCost: params.shippingCost,
        packagingCost: params.packagingCost,
        estimatedDeliveryDays: 3,
        usageDurationMonths: 12,
        status: 'Hoạt động',
        color: params.color || '#3B82F6',
        notes: 'Demo product',
        resourceLink: '',
        suppliers: params.suppliers,
      },
    },
    { upsert: true, new: true },
  );
  return doc;
}

async function createPurchaseOrderWithReceive(conn: Connection, params: {
  supplierId: mongoose.Types.ObjectId;
  supplierName: string;
  items: Array<{ productId: mongoose.Types.ObjectId; productName: string; quantity: number; unitPrice: number }>;
}) {
  const POModel = conn.model<PurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
  const po = await POModel.create({
    supplierId: params.supplierId,
    supplierNameSnap: params.supplierName,
    status: PurchaseStatus.RECEIVED,
    expectedDeliveryDate: new Date(),
    receivedDate: new Date(),
    items: params.items.map(it => ({
      productId: it.productId,
      productNameSnap: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      currency: 'VND',
      quantityReceived: it.quantity,
    })),
    itemsTotal: params.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0),
    tax: 0,
    shippingFee: 0,
    discount: 0,
    grandTotal: params.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0),
    notes: 'Demo PO auto received',
  });
  return po;
}

async function createTestOrders(conn: Connection, params: {
  product1: mongoose.Types.ObjectId;
  product2: mongoose.Types.ObjectId;
  supplierA: mongoose.Types.ObjectId;
  supplierB: mongoose.Types.ObjectId;
}) {
  const Model = conn.model<TestOrder2>('TestOrder2', TestOrder2Schema);
  const docs = [
    {
      customerName: 'Nguyễn Văn Demo',
      productId: params.product1,
      quantity: 2,
      productSource: 'inventory',
      productionStatus: 'Chưa làm',
      orderStatus: 'Chưa có mã vận đơn',
      depositAmount: 0,
      codAmount: 0,
      manualPayment: 0,
      orderDate: new Date(),
    },
    {
      customerName: 'Trần Thị Dropship',
      productId: params.product2,
      quantity: 1,
      productSource: 'supplier',
      supplierId: params.supplierB,
      supplierPriceLevel: 1,
      supplierAppliedPrice: 180000,
      productionStatus: 'Chưa làm',
      orderStatus: 'Chưa có mã vận đơn',
      depositAmount: 0,
      codAmount: 0,
      manualPayment: 0,
      orderDate: new Date(),
    },
    {
      customerName: 'Lê Khách Test',
      productId: params.product1,
      quantity: 3,
      productSource: 'inventory',
      productionStatus: 'Chưa làm',
      orderStatus: 'Chưa có mã vận đơn',
      depositAmount: 50000,
      codAmount: 150000,
      manualPayment: 0,
      orderDate: new Date(),
    },
  ];
  await Model.insertMany(docs);
  return docs.length;
}

async function main() {
  const conn = await connect();

  const category = await upsertCategory(conn);
  const supplierA = await upsertSupplier(conn, 'Công ty Cung Ứng A', 'supplierA@example.com', UserRole.EXTERNAL_SUPPLIER);
  const supplierB = await upsertSupplier(conn, 'Nhà Cung Cấp B', 'supplierB@example.com', UserRole.EXTERNAL_SUPPLIER);

  const product1 = await upsertProduct(conn, {
    name: 'Sản phẩm Demo 1',
    categoryId: category._id,
    importPrice: 100000,
    shippingCost: 10000,
    packagingCost: 5000,
    suppliers: [
      { supplierId: supplierA._id, price1: 100000, appliedLevel: 1, appliedPrice: 100000, isDefault: true },
      { supplierId: supplierB._id, price1: 110000, appliedLevel: 1, appliedPrice: 110000 },
    ],
  });

  const product2 = await upsertProduct(conn, {
    name: 'Sản phẩm Demo 2',
    categoryId: category._id,
    importPrice: 180000,
    shippingCost: 12000,
    packagingCost: 6000,
    suppliers: [
      { supplierId: supplierB._id, price1: 180000, appliedLevel: 1, appliedPrice: 180000, isDefault: true },
      { supplierId: supplierA._id, price1: 190000, appliedLevel: 1, appliedPrice: 190000 },
    ],
    color: '#10B981',
  });

  // Instantiate services with models
  const invSummaryModel = conn.model<InventorySummary>('InventorySummary', InventorySummarySchema);
  const invTxModel = conn.model<InventoryTransaction>('InventoryTransaction', InventoryTransactionSchema);
  const payableModel = conn.model<SupplierPayable>('SupplierPayable', SupplierPayableSchema);
  const inventoryService = new InventoryService(invSummaryModel as any, invTxModel as any);
  const payableService = new SupplierPayableService(payableModel as any);

  // Create a received PO for supplier A
  const poA = await createPurchaseOrderWithReceive(conn, {
    supplierId: supplierA._id,
    supplierName: supplierA.fullName,
    items: [
      { productId: product1._id, productName: product1.name, quantity: 5, unitPrice: 100000 },
      { productId: product2._id, productName: product2.name, quantity: 2, unitPrice: 185000 },
    ],
  });

  // Record inventory and payable
  await inventoryService.recordReceiveFromPO(String(poA._id), String(supplierA._id), [
    { productId: String(product1._id), quantity: 5, unitPrice: 100000 },
    { productId: String(product2._id), quantity: 2, unitPrice: 185000 },
  ]);

  // Note: PO payable creation removed - using dropshipping model (orders only)
  // await payableService.upsertFromReceive({ ... });

  // Create a second PO for supplier B (partial receive) to test payable merge
  const poB = await createPurchaseOrderWithReceive(conn, {
    supplierId: supplierB._id,
    supplierName: supplierB.fullName,
    items: [
      { productId: product2._id, productName: product2.name, quantity: 3, unitPrice: 180000 },
    ],
  });

  await inventoryService.recordReceiveFromPO(String(poB._id), String(supplierB._id), [
    { productId: String(product2._id), quantity: 3, unitPrice: 180000 },
  ]);

  // Note: PO payable creation removed - using dropshipping model (orders only)
  // await payableService.upsertFromReceive({ ... });

  // Seed test-order2 demo orders
  const createdOrders = await createTestOrders(conn, {
    product1: product1._id,
    product2: product2._id,
    supplierA: supplierA._id,
    supplierB: supplierB._id,
  });

  console.log('Demo seed done:', {
    suppliers: [supplierA.email, supplierB.email],
    products: [product1.name, product2.name],
    purchaseOrders: [String(poA._id), String(poB._id)],
    testOrders: createdOrders,
  });

  await conn.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Seed error', err);
  process.exit(1);
});
