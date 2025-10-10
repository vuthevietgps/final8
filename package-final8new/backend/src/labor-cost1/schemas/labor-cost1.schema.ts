import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../user/user.schema';

@Schema({ timestamps: true })
export class LaborCost1 {
  @Prop({ type: Date, required: true, index: true })
  date: Date; // Ngày (00:00:00) theo local, lưu dạng Date

  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  userId: Types.ObjectId; // Nhân công

  @Prop({ type: String, required: true })
  startTime: string; // HH:mm

  @Prop({ type: String, required: true })
  endTime: string; // HH:mm

  @Prop({ type: Number, required: true, min: 0 })
  workHours: number; // Số giờ làm (end - start)

  @Prop({ type: Number, required: true, min: 0 })
  hourlyRate: number; // Cấu hình lương tại thời điểm ghi nhận (snapshot)

  @Prop({ type: Number, required: true, min: 0 })
  cost: number; // workHours * hourlyRate

  @Prop({ type: String })
  notes?: string;
}

export type LaborCost1Document = HydratedDocument<LaborCost1>;
export const LaborCost1Schema = SchemaFactory.createForClass(LaborCost1);
