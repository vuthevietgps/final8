import { PartialType } from '@nestjs/mapped-types';
import { CreateAdsManagerAccountDto } from './create-ads-manager-account.dto';

export class UpdateAdsManagerAccountDto extends PartialType(CreateAdsManagerAccountDto) {}
