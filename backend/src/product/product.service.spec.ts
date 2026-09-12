import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductService } from './product.service';

describe('Product history protection', () => {
  it('does not hard-delete a product referenced by an order', async () => {
    const productId = new Types.ObjectId();
    const deleteCall = jest.fn(() => ({ exec: async () => ({ _id: productId }) }));
    const productModel = {
      db: {
        collection: (name: string) => ({
          countDocuments: async () => name === 'ordertest2' ? 1 : 0,
        }),
      },
      findByIdAndDelete: deleteCall,
    };
    const service = new ProductService(productModel as any, {} as any);

    await expect(service.remove(String(productId))).rejects.toThrow(ConflictException);
    expect(deleteCall).not.toHaveBeenCalled();
  });

  it('allows deletion when the product has no historical references', async () => {
    const productId = new Types.ObjectId();
    const deleteCall = jest.fn(() => ({ exec: async () => ({ _id: productId }) }));
    const productModel = {
      db: { collection: () => ({ countDocuments: async () => 0 }) },
      findByIdAndDelete: deleteCall,
    };
    const service = new ProductService(productModel as any, {} as any);

    await service.remove(String(productId));
    expect(deleteCall).toHaveBeenCalledWith(String(productId));
  });
});
