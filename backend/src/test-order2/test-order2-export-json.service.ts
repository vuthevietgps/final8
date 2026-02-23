import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from './schemas/test-order2.schema';

@Injectable()
export class TestOrder2ExportJsonService {
  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
  ) {}

  async exportJson(query: any = {}) {
    const items = await this.model.find(query).sort({ createdAt: -1 }).lean();
    return { items, count: items.length };
  }
}
