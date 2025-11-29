import { PartialType } from '@nestjs/mapped-types';
import { CreateTestOrder2Dto } from './create-test-order2.dto';

export class UpdateTestOrder2Dto extends PartialType(CreateTestOrder2Dto) {}