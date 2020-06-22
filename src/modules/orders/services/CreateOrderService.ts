import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';
import OrdersProducts from '../infra/typeorm/entities/OrdersProducts';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if (!findCustomer) {
      throw new AppError('Customer is not found');
    }
    const productsId = products.map(product => ({ id: product.id }));

    const findProducts = await this.productsRepository.findAllById(productsId);

    if (findProducts.length !== products.length) {
      throw new AppError('One or more products were not found');
    }

    const productsUpdated: IUpdateProductsQuantityDTO[] = [];

    const updatedProducts = findProducts.map(findProduct => {
      const orderProduct = products.find(
        product => findProduct.id === product.id,
      );

      if (orderProduct) {
        if (orderProduct.quantity > findProduct.quantity) {
          throw new AppError('insufficient quantity');
        }
        productsUpdated.push({
          id: orderProduct.id,
          quantity: findProduct.quantity - orderProduct.quantity,
        });
        return {
          ...findProduct,
          quantity: orderProduct.quantity,
        };
      }
      return findProduct;
    });

    await this.productsRepository.updateQuantity(productsUpdated);

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: updatedProducts.map(product => ({
        product_id: product.id,
        price: product.price,
        quantity: product.quantity,
      })),
    });
    console.log(order);
    return order;
  }
}

export default CreateOrderService;
