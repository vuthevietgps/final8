// Backup snapshot of src/test-order2/test-order2.service.ts on 2025-10-30
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../../src/test-order2/schemas/test-order2.schema';
import { CreateTestOrder2Dto } from '../../src/test-order2/dto/create-test-order2.dto';

@Injectable()
export class TestOrder2ServiceBackup {
  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
  ) {}

  // This is just a snapshot; not used at runtime.
}
