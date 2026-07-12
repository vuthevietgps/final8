import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { FinanceService } from './finance.service';

describe('FinanceService budget bucket validation', () => {
  const categoryId = new Types.ObjectId().toHexString();

  const createService = () => {
    const saved = { _id: new Types.ObjectId(), save: jest.fn() };
    saved.save.mockResolvedValue(saved);
    const budgetBucketModel: any = jest.fn().mockImplementation((payload) => Object.assign(saved, payload));
    budgetBucketModel.findById = jest.fn();
    budgetBucketModel.findByIdAndUpdate = jest.fn();
    budgetBucketModel.find = jest.fn();
    const productCategoryModel = {
      countDocuments: jest.fn().mockImplementation(async (filter: any) => filter?._id?.$in?.length || 0),
    };
    const eventEmitter = { emit: jest.fn() };
    const service = new FinanceService(
      {} as any,
      budgetBucketModel,
      productCategoryModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventEmitter as any,
      {} as any,
    );
    return { service, budgetBucketModel, productCategoryModel, eventEmitter, saved };
  };

  it('creates a normalized global bucket and emits finance state change', async () => {
    const { service, budgetBucketModel, productCategoryModel, eventEmitter } = createService();

    await service.createBudgetBucket({
      name: '  Global safety  ',
      code: 'global_safe',
      dailyCap: 500_000,
      weeklyCap: 2_000_000,
      monthlyCap: 8_000_000,
    });

    expect(budgetBucketModel).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Global safety',
      code: 'GLOBAL_SAFE',
      productGroupIds: [],
      active: true,
    }));
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ source: 'budget_bucket.create' }),
    );
    expect(productCategoryModel.countDocuments).not.toHaveBeenCalled();
  });

  it('checks all scoped ProductCategory ids in one batch before creating', async () => {
    const { service, budgetBucketModel, productCategoryModel } = createService();
    const secondCategoryId = new Types.ObjectId().toHexString();

    await service.createBudgetBucket({
      name: 'Category safety',
      productGroupIds: [categoryId, secondCategoryId],
    });

    expect(productCategoryModel.countDocuments).toHaveBeenCalledTimes(1);
    expect(productCategoryModel.countDocuments).toHaveBeenCalledWith({
      _id: { $in: [categoryId, secondCategoryId] },
    });
    expect(budgetBucketModel).toHaveBeenCalledWith(expect.objectContaining({
      productGroupIds: [categoryId, secondCategoryId],
    }));
  });

  it('rejects a scoped bucket when any ProductCategory does not exist', async () => {
    const { service, budgetBucketModel, productCategoryModel } = createService();
    const missingCategoryId = new Types.ObjectId().toHexString();
    productCategoryModel.countDocuments.mockResolvedValue(1);

    await expect(service.createBudgetBucket({
      name: 'Invalid category scope',
      productGroupIds: [categoryId, missingCategoryId],
    })).rejects.toThrow('ProductCategory that does not exist');

    expect(productCategoryModel.countDocuments).toHaveBeenCalledTimes(1);
    expect(budgetBucketModel).not.toHaveBeenCalled();
  });

  it('fails closed when ProductCategory verification cannot be completed', async () => {
    const { service, budgetBucketModel, productCategoryModel } = createService();
    productCategoryModel.countDocuments.mockRejectedValue(new Error('category lookup unavailable'));

    await expect(service.createBudgetBucket({
      name: 'Unverified category scope',
      productGroupIds: [categoryId],
    })).rejects.toThrow('category lookup unavailable');

    expect(productCategoryModel.countDocuments).toHaveBeenCalledTimes(1);
    expect(budgetBucketModel).not.toHaveBeenCalled();
  });

  it.each([
    [{ dailyCap: -1 }, 'non-negative'],
    [{ dailyCap: 500_000, weeklyCap: 400_000 }, 'weeklyCap'],
    [{ weeklyCap: 2_000_000, monthlyCap: 1_000_000 }, 'monthlyCap'],
    [{ dailyCap: 500_000, monthlyCap: 400_000 }, 'monthlyCap'],
    [{ productGroupIds: ['not-a-category-id'] }, 'Product.categoryId'],
  ])('rejects an invalid bucket relation: %j', async (fields, message) => {
    const { service } = createService();

    await expect(service.createBudgetBucket({
      name: 'Invalid bucket',
      ...fields,
    } as any)).rejects.toThrow(message);
  });

  it('merges existing caps before validating an update', async () => {
    const { service, budgetBucketModel } = createService();
    const id = new Types.ObjectId().toHexString();
    budgetBucketModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: id,
        name: 'Category cap',
        productGroupIds: [categoryId],
        dailyCap: 500_000,
        weeklyCap: 2_000_000,
        monthlyCap: 8_000_000,
        active: true,
      }),
    });

    await expect(service.updateBudgetBucket(id, { monthlyCap: 1_000_000 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(budgetBucketModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('updates active state without changing valid caps', async () => {
    const { service, budgetBucketModel, productCategoryModel, eventEmitter } = createService();
    const id = new Types.ObjectId().toHexString();
    const existing = {
      _id: id,
      name: 'Category cap',
      productGroupIds: [categoryId],
      dailyCap: 500_000,
      weeklyCap: 2_000_000,
      monthlyCap: 8_000_000,
      active: true,
    };
    budgetBucketModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(existing) });
    const lean = jest.fn().mockResolvedValue({ ...existing, active: false });
    budgetBucketModel.findByIdAndUpdate.mockReturnValue({ lean });

    const result = await service.updateBudgetBucket(id, { active: false });

    expect(result.active).toBe(false);
    expect(budgetBucketModel.findByIdAndUpdate).toHaveBeenCalledWith(
      id,
      { active: false },
      { new: true, runValidators: true },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ source: 'budget_bucket.update', entityId: id }),
    );
    expect(productCategoryModel.countDocuments).toHaveBeenCalledWith({
      _id: { $in: [categoryId] },
    });
  });

  it('rejects an update when its ProductCategory scope no longer exists', async () => {
    const { service, budgetBucketModel, productCategoryModel } = createService();
    const id = new Types.ObjectId().toHexString();
    budgetBucketModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: id,
        name: 'Global cap',
        productGroupIds: [],
        dailyCap: 0,
        weeklyCap: 0,
        monthlyCap: 0,
      }),
    });
    productCategoryModel.countDocuments.mockResolvedValue(0);

    await expect(service.updateBudgetBucket(id, { productGroupIds: [categoryId] }))
      .rejects.toThrow('ProductCategory that does not exist');

    expect(productCategoryModel.countDocuments).toHaveBeenCalledTimes(1);
    expect(budgetBucketModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('supports active-only listing', async () => {
    const { service, budgetBucketModel } = createService();
    const lean = jest.fn().mockResolvedValue([]);
    const sort = jest.fn(() => ({ lean }));
    budgetBucketModel.find.mockReturnValue({ sort });

    await service.listBudgetBuckets(true);

    expect(budgetBucketModel.find).toHaveBeenCalledWith({ active: true });
  });
});
