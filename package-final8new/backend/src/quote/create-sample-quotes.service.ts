import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quote, QuoteDocument } from './schemas/quote.schema';

@Injectable()
export class CreateSampleQuotes implements OnModuleInit {
  constructor(
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>
  ) {}

  async onModuleInit() {
    // Kiểm tra xem đã có quotes chưa
    const count = await this.quoteModel.countDocuments().exec();
    console.log(`Current quotes count: ${count}`);
    
    if (count === 0) {
      console.log('Creating sample quotes...');
      await this.createSampleQuotes();
    }
  }

  private async createSampleQuotes() {
    const sampleQuotes = [
      {
        productId: new Types.ObjectId('68b7835cf402c3931acd7b35'), // Thẻ Tập Huấn 3 năm
        agentId: new Types.ObjectId('68bfa75d2cbc0f781d9de469'), // Giấy Phép Vào Phố
        price: 230000,
        status: 'Đã duyệt',
        isActive: true,
        notes: 'Sample quote 1'
      },
      {
        productId: new Types.ObjectId('68b7835cf402c3931acd7b35'), // Thẻ Tập Huấn 3 năm
        agentId: new Types.ObjectId('68bfae652cbc0f781d9de478'), // Mạnh Nguyễn
        price: 250000,
        status: 'Đã duyệt',
        isActive: true,
        notes: 'Sample quote 2'
      },
      {
        productId: new Types.ObjectId('68b725607ec5d28a0d499d1e'), // Phù Hiệu Xe 3 Năm
        agentId: new Types.ObjectId('68bfae652cbc0f781d9de478'), // Mạnh Nguyễn
        price: 180000,
        status: 'Đã duyệt',
        isActive: true,
        notes: 'Sample quote 3'
      },
      {
        productId: new Types.ObjectId('68b7255f7ec5d28a0d499d12'), // Phù Hiệu Xe 7 năm
        agentId: new Types.ObjectId('68bfae652cbc0f781d9de478'), // Mạnh Nguyễn
        price: 320000,
        status: 'Đã duyệt',
        isActive: true,
        notes: 'Sample quote 4'
      },
      {
        productId: new Types.ObjectId('68b7833df402c3931acd7b2e'), // Thẻ Tập Huấn 5 năm
        agentId: new Types.ObjectId('68b9af7afb7a0875783bcf19'), // Trần Thị Vui
        price: 280000,
        status: 'Đã duyệt',
        isActive: true,
        notes: 'Sample quote 5'
      }
    ];

    try {
      await this.quoteModel.insertMany(sampleQuotes);
      console.log(`Created ${sampleQuotes.length} sample quotes`);
    } catch (error) {
      console.error('Error creating sample quotes:', error);
    }
  }
}