import { validate } from 'class-validator';
import { CreateTestOrder2Dto } from './create-test-order2.dto';

describe('CreateTestOrder2Dto ad group attribution', () => {
  it.each([undefined, '', '0'])('rejects placeholder adGroupId=%p for marketing orders', async (adGroupId) => {
    const dto = Object.assign(new CreateTestOrder2Dto(), {
      customerName: 'Customer',
      productSource: 'marketing',
      adGroupId,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'adGroupId')).toBe(true);
  });

  it('accepts a real ad group identifier for marketing orders', async () => {
    const dto = Object.assign(new CreateTestOrder2Dto(), {
      customerName: 'Customer',
      productSource: 'marketing',
      adGroupId: '1234567890',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'adGroupId')).toBe(false);
  });
});
