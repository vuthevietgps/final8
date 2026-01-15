import { PartialType } from '@nestjs/mapped-types';
import { CreateLoanContractDto } from './create-loan-contract.dto';

export class UpdateLoanContractDto extends PartialType(CreateLoanContractDto) {}
