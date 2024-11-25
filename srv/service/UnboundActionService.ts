import { Inject, ServiceLogic } from '@dxfrontier/cds-ts-dispatcher';
import { OrdersRepository } from '../repository/OrdersRepository';
import { OrderItemsRepository } from '../repository/OrderItemsRepository';
import { Order, OrderItem } from '../../@cds-models/ServiceAccruals';
import constants from '../util/constants/constants';

@ServiceLogic()
export class UnboundActionsService {
  @Inject(OrdersRepository) private ordersRepository: OrdersRepository;
  @Inject(OrderItemsRepository) private orderItemsRepository: OrderItemsRepository;

  /**
   * Updates the sum of an order item and recalculates the corresponding order's total.
   *
   * @param data - Contains the order item and its new value to update.
   * @returns A promise that resolves to the updated order if applicable.
   */
  async sum(data: { orderItem: OrderItem | null; newValue: number | null }) {
    if (data.orderItem && data.newValue) {
      await this.orderItemsRepository.update(
        { PurchaseOrder: data.orderItem.PurchaseOrder, PurchaseOrderItem: data.orderItem.PurchaseOrderItem },
        { OpenTotalAmountEditable: data.newValue },
      );
      await this.updateHighlightOnItem(data.orderItem);

      if (data.orderItem.to_Orders_PurchaseOrder) {
        const order = await this.ordersRepository
          .builder()
          .findOne({ PurchaseOrder: data.orderItem.to_Orders_PurchaseOrder })
          .getExpand('to_OrderItems')
          .execute();

        const orderItems = order?.to_OrderItems;

        if (order && orderItems) {
          await this.calculateOrderSum(order, orderItems);

          return order;
        }
      }
    }
  }

  /**
   * Calculates the total and editable total amounts for a given order based on its items,
   * updates the order's sums, and triggers item and order highlight updates.
   * HANA driver typing is broken for decimals (hence toString on strings), refer:
   * https://community.sap.com/t5/technology-q-a/cap-nodejs-different-representation-of-decimal-with-sqlite-and-hana/qaq-p/12461752
   *
   * @param order - The order to calculate sums for.
   * @param orderItems - The list of order items associated with the order.
   */
  private async calculateOrderSum(order: Order, orderItems: OrderItem[]): Promise<void> {
    let sum = 0;
    let sumEditable = 0;

    for (const item of orderItems) {
      if (item.OpenTotalAmount) {
        sum += parseFloat(item.OpenTotalAmount.toString());
      }

      if (item.OpenTotalAmountEditable) {
        sumEditable += parseFloat(item.OpenTotalAmountEditable.toString());
      }
    }

    order.OpenTotalAmountEditable = parseFloat(sumEditable.toFixed(3));
    order.OpenTotalAmount = parseFloat(sum.toFixed(3));
    await this.ordersRepository.update(
      { PurchaseOrder: order.PurchaseOrder },
      { OpenTotalAmountEditable: sumEditable, OpenTotalAmount: sum },
    );

    await this.updateHighlightOnOrder(order, orderItems);
  }

  /**
   * Updates the highlight status of an order based on its total amounts and the highlight statuses of its items.
   *
   * @param order - The order to update the highlight status for.
   * @param orderItems - The list of order items associated with the order.
   */
  private async updateHighlightOnOrder(order: Order, orderItems: OrderItem[]): Promise<void> {
    let finalCounter = 0;
    let informationCounter = 0;

    orderItems.forEach((orderItem) => {
      if (orderItem.Highlight === constants.HIGHLIGHT.SUCCESS) {
        finalCounter++;
      }

      if (orderItem.Highlight === constants.HIGHLIGHT.INFORMATION) {
        informationCounter++;
      }
    });

    const orderItemsOnInformation = informationCounter > 0;
    const orderItemsOnSuccess = finalCounter > 0;
    const allOrderItemsOnSuccess = finalCounter === orderItems.length;

    if (orderItemsOnInformation) {
      order.Highlight = constants.HIGHLIGHT.INFORMATION;

      await this.ordersRepository.update(
        { PurchaseOrder: order.PurchaseOrder },
        { Highlight: constants.HIGHLIGHT.INFORMATION },
      );
      return;
    }

    if (allOrderItemsOnSuccess) {
      order.Highlight = constants.HIGHLIGHT.SUCCESS;

      await this.ordersRepository.update(
        { PurchaseOrder: order.PurchaseOrder },
        { Highlight: constants.HIGHLIGHT.SUCCESS },
      );

      return;
    }

    if (orderItemsOnSuccess && !allOrderItemsOnSuccess) {
      order.Highlight = constants.HIGHLIGHT.INFORMATION;

      await this.ordersRepository.update(
        { PurchaseOrder: order.PurchaseOrder },
        { Highlight: constants.HIGHLIGHT.INFORMATION },
      );

      return;
    }

    order.Highlight = constants.HIGHLIGHT.NONE;
    await this.ordersRepository.update({ PurchaseOrder: order.PurchaseOrder }, { Highlight: constants.HIGHLIGHT.NONE });
  }

  /**
   * Updates the highlight status of an order item based on its processing state and total amounts.
   * HANA driver typing is broken for decimals (hence toString on strings), refer:
   * https://community.sap.com/t5/technology-q-a/cap-nodejs-different-representation-of-decimal-with-sqlite-and-hana/qaq-p/12461752
   *
   * @param orderItem - The order item to update the highlight status for.
   */
  private async updateHighlightOnItem(orderItem: OrderItem): Promise<void> {
    if (!orderItem.OpenTotalAmountEditable || !orderItem.OpenTotalAmount) {
      return;
    }

    const finalProcessingStateAndAmountChanged =
      orderItem.ProcessingState_code != constants.PROCESSING_STATE.FINAL &&
      parseFloat(orderItem.OpenTotalAmount.toString()) !== parseFloat(orderItem.OpenTotalAmountEditable.toString());

    if (finalProcessingStateAndAmountChanged) {
      orderItem.Highlight = constants.HIGHLIGHT.INFORMATION;

      await this.orderItemsRepository.update(
        { PurchaseOrder: orderItem.PurchaseOrder, PurchaseOrderItem: orderItem.PurchaseOrderItem },
        { Highlight: constants.HIGHLIGHT.INFORMATION },
      );

      return;
    }

    const finalProcessingState = orderItem.ProcessingState_code === constants.PROCESSING_STATE.FINAL;

    if (finalProcessingState) {
      orderItem.Highlight = constants.HIGHLIGHT.SUCCESS;

      await this.orderItemsRepository.update(
        { PurchaseOrder: orderItem.PurchaseOrder, PurchaseOrderItem: orderItem.PurchaseOrderItem },
        { Highlight: constants.HIGHLIGHT.SUCCESS, Editable: false },
      );

      return;
    }

    orderItem.Highlight = constants.HIGHLIGHT.NONE;
    await this.orderItemsRepository.update(
      { PurchaseOrder: orderItem.PurchaseOrder, PurchaseOrderItem: orderItem.PurchaseOrderItem },
      { Highlight: constants.HIGHLIGHT.NONE },
    );
  }

  /**
   * Updates the processing state of order items within the provided orders.
   *
   * @param data - Object containing an array of orders to update.
   * @returns A promise that resolves with the updated orders or null if no orders are provided.
   */
  async updateProcessingState(data: {
    orders: Order[] | null;
    isGeneralUser: boolean | null;
    isCCR: boolean | null;
    isControlling: boolean | null;
    isAccounting: boolean | null;
  }): Promise<Order[] | null> {
    if (data.orders) {
      const orderPromises = data.orders.map(async (order) => {
        if (order.to_OrderItems !== null && order.to_OrderItems !== undefined) {
          const orderItemPromises = order.to_OrderItems.map(async (orderItem) => {
            switch (true) {
              case data.isGeneralUser:
                if (orderItem.ProcessingState_code === constants.PROCESSING_STATE.USER) {
                  orderItem.ProcessingState_code = constants.PROCESSING_STATE.CCR;

                  await this.orderItemsRepository.update(
                    {
                      PurchaseOrder: orderItem.PurchaseOrder,
                      PurchaseOrderItem: orderItem.PurchaseOrderItem,
                    },
                    { ProcessingState_code: constants.PROCESSING_STATE.CCR },
                  );
                }
                break;

              case data.isCCR:
                if (
                  orderItem.ProcessingState_code === constants.PROCESSING_STATE.CCR &&
                  orderItem.ApprovedByCCR === true
                ) {
                  orderItem.ProcessingState_code = constants.PROCESSING_STATE.CONTROLLING;

                  await this.orderItemsRepository.update(
                    {
                      PurchaseOrder: orderItem.PurchaseOrder,
                      PurchaseOrderItem: orderItem.PurchaseOrderItem,
                    },
                    { ProcessingState_code: constants.PROCESSING_STATE.CONTROLLING },
                  );
                }
                break;

              case data.isControlling:
                if (
                  orderItem.ProcessingState_code === constants.PROCESSING_STATE.CONTROLLING &&
                  orderItem.ApprovedByCON === true
                ) {
                  orderItem.ProcessingState_code = constants.PROCESSING_STATE.ACCOUNTING;

                  await this.orderItemsRepository.update(
                    {
                      PurchaseOrder: orderItem.PurchaseOrder,
                      PurchaseOrderItem: orderItem.PurchaseOrderItem,
                    },
                    { ProcessingState_code: constants.PROCESSING_STATE.ACCOUNTING },
                  );
                }
                break;

              case data.isAccounting:
                if (
                  orderItem.ProcessingState_code === constants.PROCESSING_STATE.ACCOUNTING &&
                  orderItem.ApprovedByACC === true
                ) {
                  orderItem.ProcessingState_code = constants.PROCESSING_STATE.FINAL;
                  orderItem.Highlight = constants.HIGHLIGHT.SUCCESS;
                  orderItem.Editable = false;

                  await this.orderItemsRepository.update(
                    {
                      PurchaseOrder: orderItem.PurchaseOrder,
                      PurchaseOrderItem: orderItem.PurchaseOrderItem,
                    },
                    {
                      ProcessingState_code: constants.PROCESSING_STATE.FINAL,
                      Highlight: constants.HIGHLIGHT.SUCCESS,
                      Editable: false,
                    },
                  );

                  if (order.to_OrderItems) {
                    this.updateHighlightOnOrder(order, order.to_OrderItems);
                  }
                }
                break;

              default:
                break;
            }
          });

          await Promise.all(orderItemPromises);
        }
      });
      await Promise.all(orderPromises);

      return data.orders;
    }
    return null;
  }

  /**
   * Toggles the approval status of an order item for the specified role.
   *
   * @param data - Object containing the order item, the new approval value, and the roles to update.
   * @returns A promise that resolves with the updated order item or undefined if no order item is provided.
   */
  async toggleApprove(data: {
    orderItem: OrderItem | null;
    newValue: boolean | null;
    isCCR: boolean | null;
    isControlling: boolean | null;
    isAccounting: boolean | null;
  }) {
    if (data.orderItem) {
      switch (true) {
        case data.isCCR:
          data.orderItem.ApprovedByCCR = data.newValue;

          await this.orderItemsRepository.update(
            {
              PurchaseOrder: data.orderItem.PurchaseOrder,
              PurchaseOrderItem: data.orderItem.PurchaseOrderItem,
            },
            { ApprovedByCCR: data.newValue },
          );
          break;

        case data.isControlling:
          data.orderItem.ApprovedByCON = data.newValue;

          await this.orderItemsRepository.update(
            {
              PurchaseOrder: data.orderItem.PurchaseOrder,
              PurchaseOrderItem: data.orderItem.PurchaseOrderItem,
            },
            { ApprovedByCON: data.newValue },
          );
          break;

        case data.isAccounting:
          data.orderItem.ApprovedByACC = data.newValue;

          await this.orderItemsRepository.update(
            {
              PurchaseOrder: data.orderItem.PurchaseOrder,
              PurchaseOrderItem: data.orderItem.PurchaseOrderItem,
            },
            { ApprovedByACC: data.newValue },
          );
          break;

        default:
          break;
      }
      return data.orderItem;
    }
  }
}
