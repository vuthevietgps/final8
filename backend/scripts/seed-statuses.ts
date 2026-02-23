import * as path from 'path';
import * as dotenv from 'dotenv';
import mongoose, { Schema } from 'mongoose';

// Load env from common locations (root and backend)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/smarterp-dev';

// Delivery Status schema (aligned with Nest model)
const DeliveryStatusSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    icon: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: false },
    isFinal: { type: Boolean, default: false },
    isPaymentTrigger: { type: Boolean, default: false },  // trigger thanh toán NCC + hoa hồng
    isReturnStatus: { type: Boolean, default: false },     // trạng thái hoàn (tính phí hoàn)
    order: { type: Number, default: 0 },
    estimatedDays: { type: Number },
    trackingNote: { type: String },
    metadata: { type: Object },
  },
  { timestamps: true },
);

// Production Status schema (aligned with Nest model)
const ProductionStatusSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const DeliveryStatusModel = mongoose.model('DeliveryStatus', DeliveryStatusSchema, 'deliverystatuses');
const ProductionStatusModel = mongoose.model('ProductionStatus', ProductionStatusSchema, 'productionstatuses');

// CHỈ 4 TRẠNG THÁI GIAO HÀNG CẦN THIẾT - ĐƠN GIẢN VÀ RÕ RÀNG
const deliveryStatuses = [
  {
    name: 'Chưa có mã vận đơn',
    description: 'Đơn hàng chưa được tạo mã vận đơn',
    color: '#6b7280',  // gray
    icon: '📦',
    isActive: true,
    isFinal: false,
    isPaymentTrigger: false,
    isReturnStatus: false,
    order: 1,
    estimatedDays: 0,
    trackingNote: 'Chờ tạo mã vận đơn',
  },
  {
    name: 'Đang giao',
    description: 'Hàng hóa đang được vận chuyển đến khách hàng',
    color: '#3b82f6',  // blue
    icon: '🚚',
    isActive: true,
    isFinal: false,
    isPaymentTrigger: false,
    isReturnStatus: false,
    order: 2,
    estimatedDays: 3,
    trackingNote: 'Dự kiến giao trong 2-3 ngày',
  },
  {
    name: 'Giao thành công',
    description: 'Đơn hàng đã giao thành công → TRIGGER THANH TOÁN',
    color: '#22c55e',  // green
    icon: '✅',
    isActive: true,
    isFinal: true,
    isPaymentTrigger: true,   // ← TRIGGER THANH TOÁN NCC + HOA HỒNG
    isReturnStatus: false,
    order: 3,
    estimatedDays: 0,
    trackingNote: 'Đơn hoàn thành - ghi nhận thanh toán',
  },
  {
    name: 'Hàng hoàn',
    description: 'Đơn hàng bị hoàn → TRIGGER THANH TOÁN + PHÍ HOÀN',
    color: '#ef4444',  // red
    icon: '↩️',
    isActive: true,
    isFinal: true,
    isPaymentTrigger: true,   // ← TRIGGER THANH TOÁN NCC + HOA HỒNG
    isReturnStatus: true,     // ← TÍNH PHÍ HOÀN
    order: 4,
    estimatedDays: 0,
    trackingNote: 'Đơn hoàn - tính phí hoàn hàng',
  },
];

const productionStatuses = [
  {
    name: 'Đã điền thông tin chưa thi',
    color: '#7c3aed',
    description: 'Mô tả',
    order: 1,
    isActive: true,
  },
  {
    name: 'Đã trả kết quả',
    color: '#16a34a',
    description: 'Đã Trả kết quả',
    order: 2,
    isActive: true,
  },
  {
    name: 'Đang Xử Lý',
    color: '#fbbf24',
    description: 'Mô tả',
    order: 3,
    isActive: true,
  },
  {
    name: 'Đã Nộp',
    color: '#c084fc',
    description: 'Mô tả',
    order: 4,
    isActive: true,
  },
  {
    name: 'Tạm Dừng Xử Lý',
    color: '#ef4444',
    description: 'Mô tả',
    order: 5,
    isActive: true,
  },
];

async function upsertMany(model: mongoose.Model<any>, rows: any[]) {
  for (const row of rows) {
    await model.findOneAndUpdate(
      { name: row.name },
      { $set: row },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected');

  console.log('Upserting delivery statuses...');
  await upsertMany(DeliveryStatusModel, deliveryStatuses);
  console.log(`Delivery statuses upserted: ${deliveryStatuses.length}`);

  console.log('Upserting production statuses...');
  await upsertMany(ProductionStatusModel, productionStatuses);
  console.log(`Production statuses upserted: ${productionStatuses.length}`);
}

main()
  .then(() => {
    console.log('Done');
  })
  .catch((err) => {
    console.error('Error seeding statuses:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
