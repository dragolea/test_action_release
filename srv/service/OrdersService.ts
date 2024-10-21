import { Inject, ServiceLogic, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import { OrdersRepository } from '../repository/OrdersRepository';
import { Order, Orders } from '#cds-models/ServiceAccruals';
import { OrderItemsRepository } from '../repository/OrderItemsRepository';
import util from '../util/helpers/util';
import { OrderItemsService } from './OrderItemsService';
import { A_PurchaseOrderItem, A_PurchaseOrder } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import constants from '../util/constants/constants';

@ServiceLogic()
export class OrdersService {
  @Inject(OrdersRepository) private readonly ordersRepository: OrdersRepository;
  @Inject(OrderItemsRepository) private orderItemsRepository: OrderItemsRepository;
  @Inject(OrderItemsService) private orderItemsService: OrderItemsService;

  /**
   * Maps an A_PurchaseOrder to a corresponding Order object,
   * setting properties related to the purchase order.
   *
   * @param {A_PurchaseOrder} order - The purchase order to map.
   * @returns {Order} The mapped order object with relevant properties.
   */
  private mapOrder(order: A_PurchaseOrder): Order {
    return {
      PurchaseOrder: order.PurchaseOrder,
      PurchaseOrderItem: null,
      Supplier: order.Supplier,
      SupplierText: order.AddressName,
      PurchaseOrderItemText: null,
      AccountAssignmentCategory: null,
      AccountAssignmentCategoryText: null,
      ProcessingState_code: constants.ProcessingState.USER,
    };
  }

  /**
   * Asynchronously retrieves unique purchase orders from order items for the current year.
   *
   * @param {TypedRequest<Orders>} req - The request containing criteria for fetching order items.
   * @returns {Promise<A_PurchaseOrder[]>} A promise that resolves to an array of unique purchase orders.
   */
  private async getOrders(req: TypedRequest<Orders>) {
    const orderItems: A_PurchaseOrderItem[] = (await util.getPurchaseOrderItemsForCurrentYear(
      req,
    )) as A_PurchaseOrderItem[];

    const purchaseOrders: A_PurchaseOrder[] = [];

    for (const orderItem of orderItems) {
      const existingPurchaseOrder = purchaseOrders.find(
        (purchaseOrders) => purchaseOrders.PurchaseOrder === orderItem.PurchaseOrder,
      );

      if (!existingPurchaseOrder) {
        const purchaseOrder = orderItem.to_PurchaseOrder;
        if (purchaseOrder) {
          purchaseOrders.push(purchaseOrder);
        }
      }
    }
    return purchaseOrders;
  }

  /**
   * Asynchronously writes unique purchase orders to the repository,
   * creating them if they do not already exist, and writes their associated order items.
   *
   * @param {TypedRequest<Orders>} req - The request containing criteria for fetching orders.
   */
  public async writeOrders(req: TypedRequest<Orders>) {
    const orders: A_PurchaseOrder[] = await this.getOrders(req);

    for (const order of orders) {
      const foundOrder = await this.ordersRepository.exists({
        PurchaseOrder: order.PurchaseOrder,
      });

      if (!foundOrder) {
        const mappedOrder: Order = this.mapOrder(order);
        await this.ordersRepository.updateOrCreate(mappedOrder);
        await this.orderItemsService.writeOrderItems(req);
      }
    }
  }

  /**
   * Asynchronously calculates the total and editable total amounts for each order
   * and updates the respective properties in the order objects.
   *
   * @param {Order[]} results - An array of order objects to calculate sums for.
   */
  public async calculateSum(results: Order[]) {
    for (const order of results) {
      let sum = 0;
      let sumEditable = 0;

      const orderItems = await this.orderItemsRepository
        .builder()
        .find({ PurchaseOrder: order.PurchaseOrder })
        .execute();

      orderItems?.forEach((item) => {
        if (item.OpenTotalAmountEditable) {
          sumEditable += item.OpenTotalAmountEditable;
        }

        if (item.OpenTotalAmount) {
          sum += item.OpenTotalAmount;
        }
      });

      order.OpenTotalAmountEditable = sumEditable;
      order.OpenTotalAmount = sum;
    }
  }
}
