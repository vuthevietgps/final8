import { validate } from 'class-validator';
import { CreateTestOrder2Dto } from './create-test-order2.dto';

describe('CreateTestOrder2Dto ad group attribution', () => {
  it.each([undefined, '', '0'])('rejects placeholder adGroupId=%p for ads orders', async (adGroupId) => {
    const dto = Object.assign(new CreateTestOrder2Dto(), {
      customerName: 'Customer',
      customerAcquisitionSource: 'ads',
      adGroupId,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'adGroupId')).toBe(true);
  });

  it('accepts a real ad group identifier for marketing orders', async () => {
    const dto = Object.assign(new CreateTestOrder2Dto(), {
      customerName: 'Customer',
      customerAcquisitionSource: 'ads',
      adGroupId: '1234567890',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'adGroupId')).toBe(false);
  });

  it('accepts an explicitly non-ads order without an ad group', async () => {
    const dto = Object.assign(new CreateTestOrder2Dto(), {
      customerName: 'Walk-in customer', customerAcquisitionSource: 'non_ads', adGroupId: '',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => ['customerAcquisitionSource', 'adGroupId'].includes(error.property))).toBe(false);
  });

  it('rejects an ad group on an order declared as non-ads', async () => {
    const dto = Object.assign(new CreateTestOrder2Dto(), {
      customerName: 'Customer', customerAcquisitionSource: 'non_ads', adGroupId: '1234567890',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'adGroupId')).toBe(true);
  });

  it('requires an explicit customer acquisition source', async () => {
    const dto = Object.assign(new CreateTestOrder2Dto(), { customerName: 'Customer', adGroupId: '' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'customerAcquisitionSource')).toBe(true);
  });
});
