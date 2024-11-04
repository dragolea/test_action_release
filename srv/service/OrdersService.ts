import { Inject, ServiceLogic, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import { OrdersRepository } from '../repository/OrdersRepository';
import { Order, OrderItem, Orders } from '#cds-models/ServiceAccruals';
import { OrderItemsRepository } from '../repository/OrderItemsRepository';
import util from '../util/helpers/util';
import { OrderItemsService } from './OrderItemsService';
import { A_PurchaseOrderItem, A_PurchaseOrder } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import constants from '../util/constants/constants';
import { Filter } from '@dxfrontier/cds-ts-repository';
import { RolesAndResult, RolesAndUserContext, UserContext } from '../util/types/types';

@ServiceLogic()
export class OrdersService {
  @Inject(OrdersRepository) private ordersRepository: OrdersRepository;
  @Inject(OrderItemsRepository) private orderItemsRepository: OrderItemsRepository;
  @Inject(OrderItemsService) private orderItemsService: OrderItemsService;

  /**
   * Maps an A_PurchaseOrder to a corresponding Order object,
   * setting properties related to the purchase order.
   *
   * @param order - The purchase order to map.
   * @returns The mapped order object with relevant properties.
   */
  private mapOrder(order: A_PurchaseOrder): Order {
    return {
      PurchaseOrder: order.PurchaseOrder,
      ID: order.PurchaseOrder,
      PurchaseOrderItem: null,
      Supplier: order.Supplier,
      SupplierText: order.AddressName,
      PurchaseOrderItemText: null,
      AccountAssignmentCategory: null,
      OrderID: null,
      CostCenterID: null,
      ProcessingState_code: constants.PROCESSING_STATE.USER,
      ApprovedByCCR: false,
      ApprovedByCON: false,
      ApprovedByACC: false,
      CreationDate: util.getDateAsCDSDate(),
      Editable: true,
      IsOrderItem: false,
    };
  }

  /**
   * Asynchronously retrieves unique purchase orders from order items for the current year.
   *
   * @param req - The request containing criteria for fetching order items.
   * @returns A promise that resolves to an array of unique purchase orders.
   */
  private async getOrders(req: TypedRequest<Orders>): Promise<A_PurchaseOrder[] | undefined> {
    const context: UserContext[] | undefined = await this.orderItemsService.fetchContext(req);

    if (!context || context.length === 0) {
      req.reject(400, 'Context not found');
      return;
    }

    const orderItems: A_PurchaseOrderItem[] | undefined = await this.orderItemsService.fetchPurchaseOrderItems(
      context[0],
    );

    if (orderItems) {
      const filteredOrderItems: A_PurchaseOrderItem[] = await util.filterOrderItemsByCurrentYear(orderItems);
      const orders: A_PurchaseOrder[] = [];

      for (const item of filteredOrderItems) {
        const existingOrder: A_PurchaseOrder | undefined = orders.find(
          (orders) => orders.PurchaseOrder === item.PurchaseOrder,
        );

        if (!existingOrder) {
          const order: A_PurchaseOrder | null | undefined = item.to_PurchaseOrder;
          if (order) {
            orders.push(order);
          }
        }
      }

      return orders;
    }
  }

  /**
   * Asynchronously writes unique purchase orders to the repository,
   * creating them if they do not already exist, and writes their associated order items.
   *
   * @param req - The request containing criteria for fetching orders.
   */
  public async writeOrders(req: TypedRequest<Orders>): Promise<void> {
    const orders: A_PurchaseOrder[] | undefined = await this.getOrders(req);

    if (orders) {
      for (const order of orders) {
        const found = await this.ordersRepository.exists({
          PurchaseOrder: order.PurchaseOrder,
        });

        if (!found) {
          const mappedOrder: Order = this.mapOrder(order);
          await this.ordersRepository.updateOrCreate(mappedOrder);
          await this.orderItemsService.writeOrderItems(req);
        }
      }
    }
  }

  /**
   * Verifies and updates the total invoice amount for a given order item.
   * Also recalculates the open total amount based on the new total invoice amount.
   *
   * @param item - The order item whose invoice amount is to be checked and updated.
   * @returns A promise that resolves when the check and potential update are complete.
   */
  private async ckeckTotalInvoiceAmount(item: OrderItem): Promise<void> {
    const totalInvoiceAmount = await this.orderItemsService.fetchTotalInvoiceAmount(item);

    if (totalInvoiceAmount !== item.TotalInvoiceAmount) {
      item.TotalInvoiceAmount = totalInvoiceAmount;
      if (item.NetPriceAmount && item.OrderQuantity) {
        item.OpenTotalAmount = item.NetPriceAmount * item.OrderQuantity - totalInvoiceAmount;
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
      await this.ckeckTotalInvoiceAmount(item);

      if (item.OpenTotalAmount) {
        sum += parseFloat(item.OpenTotalAmount.toString());
      }

      if (item.OpenTotalAmountEditable) {
        sumEditable += parseFloat(item.OpenTotalAmountEditable.toString());
      }

      this.updateHighlightOnItem(item);
    }

    order.OpenTotalAmountEditable = sumEditable;
    order.OpenTotalAmount = sum;

    this.updateHighlightOnOrder(order, orderItems);
  }

  /**
   * Updates the highlight status of an order based on its total amounts and the highlight statuses of its items.
   *
   * @param order - The order to update the highlight status for.
   * @param orderItems - The list of order items associated with the order.
   */
  private updateHighlightOnOrder(order: Order, orderItems: OrderItem[]): void {
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
      return;
    }

    if (allOrderItemsOnSuccess) {
      order.Highlight = constants.HIGHLIGHT.SUCCESS;
      return;
    }

    if (orderItemsOnSuccess && !allOrderItemsOnSuccess) {
      order.Highlight = constants.HIGHLIGHT.INFORMATION;
      return;
    }

    order.Highlight = constants.HIGHLIGHT.NONE;
  }

  /**
   * Updates the highlight status of an order item based on its processing state and total amounts.
   *
   * @param orderItem - The order item to update the highlight status for.
   */
  private updateHighlightOnItem(orderItem: OrderItem): void {
    const finalProcessingStateAndAmountChanged =
      orderItem.ProcessingState_code != constants.PROCESSING_STATE.FINAL &&
      orderItem.OpenTotalAmount !== orderItem.OpenTotalAmountEditable;

    if (finalProcessingStateAndAmountChanged) {
      orderItem.Highlight = constants.HIGHLIGHT.INFORMATION;
      return;
    }

    const finalProcessingState = orderItem.ProcessingState_code === constants.PROCESSING_STATE.FINAL;

    if (finalProcessingState) {
      orderItem.Highlight = constants.HIGHLIGHT.SUCCESS;
      orderItem.Editable = false;
      return;
    }

    orderItem.Highlight = constants.HIGHLIGHT.NONE;
  }

  /**
   * Filters and sums the results of orders based on the current year and user context.
   *
   * @param params - An object containing the parameters for filtering and summing results.
   *
   * @returns A promise that resolves when the filtering and summing is complete.
   */
  public async filterAndSumResults(params: RolesAndResult): Promise<void> {
    let filteredResults: Order[] = util.deepCopyArray(params.results);

    const userContext: UserContext[] | undefined = await this.orderItemsService.fetchContext(params.req);

    if (!userContext) {
      params.req.reject(400, 'userContext not found');
      return;
    }

    // current year of order
    filteredResults = filteredResults.filter((order) => order.CreationDate?.includes(util.getCurrentYear()));

    for (const order of filteredResults) {
      const orderItems: OrderItem[] | undefined = await this.getFilteredOrderItems({
        userContext: userContext[0],
        order,
        isGeneralUser: params.isGeneralUser,
        isCCR: params.isCCR,
        isControlling: params.isControlling,
        isAccounting: params.isAccounting,
      });

      if (orderItems) {
        await this.calculateOrderSum(order, orderItems);
        order.to_OrderItems = orderItems;
      }

      if (order.to_OrderItems!.length > 0) {
        if (order.PurchaseOrder) {
          order.NodeID = order.PurchaseOrder;
        }

        params.results.push(order);
      }
    }
  }

  /**
   * Generates a filter based on the provided role, user context, and purchase order,
   * applying specific conditions for requesters, cost centers, and processing states.
   *
   * @param role - The role of the user (e.g., 'user', 'costCenter', 'controlling', 'accounting').
   * @param userContext - The context of the user, including SAP user and cost centers.
   * @param purchaseOrder - The purchase order identifier for filtering.
   * @returns A filter object based on the role or undefined if no valid role is provided.
   */
  private getFilter(role: string, userContext: UserContext, purchaseOrder: string): Filter<OrderItem> | undefined {
    const filterByRequester = new Filter<OrderItem>({
      field: 'Requester',
      operator: 'EQUALS',
      value: userContext.SapUser,
    });

    const filterByProcessingStateCCR = new Filter<OrderItem>({
      field: 'ProcessingState_code',
      operator: 'NOT EQUAL',
      value: constants.PROCESSING_STATE.USER,
    });

    const filterByProcessingStateCON = new Filter<OrderItem>({
      field: 'ProcessingState_code',
      operator: 'EQUALS',
      value: constants.PROCESSING_STATE.CONTROLLING,
    });

    const filterByProcessingStateACC = new Filter<OrderItem>({
      field: 'ProcessingState_code',
      operator: 'EQUALS',
      value: constants.PROCESSING_STATE.ACCOUNTING,
    });

    const filterByProcessingStateFinal = new Filter<OrderItem>({
      field: 'ProcessingState_code',
      operator: 'EQUALS',
      value: constants.PROCESSING_STATE.FINAL,
    });

    const filterByPurchaseOrder = new Filter<OrderItem>({
      field: 'PurchaseOrder',
      operator: 'EQUALS',
      value: purchaseOrder,
    });

    // empty filter for concatenation
    let filterByCostCenter: Filter<OrderItem> = new Filter<OrderItem>({
      field: 'CostCenterID',
      operator: 'EQUALS',
      value: null,
    });

    // ! for testing
    userContext.to_CostCenters.push({ CostCenter: '1018040191', to_Contexts: userContext.UserId });

    userContext.to_CostCenters.forEach((costCenter) => {
      const filterCostCenterTemp = new Filter<OrderItem>({
        field: 'CostCenterID',
        operator: 'EQUALS',
        value: costCenter.CostCenter,
      });

      filterByCostCenter = new Filter('OR', filterByCostCenter, filterCostCenterTemp);
    });

    const filtersProcessingCON = new Filter(
      'OR',
      filterByProcessingStateCON,
      filterByProcessingStateACC,
      filterByProcessingStateFinal,
    );

    const filtersProcessingACC = new Filter('OR', filterByProcessingStateACC, filterByProcessingStateFinal);

    switch (role) {
      case 'user':
        return new Filter('AND', filterByPurchaseOrder, filterByRequester);

      case 'costCenter':
        return new Filter('AND', filterByPurchaseOrder, filterByCostCenter, filterByProcessingStateCCR);

      case 'controlling':
        return new Filter('AND', filterByPurchaseOrder, filtersProcessingCON);

      case 'accounting':
        return new Filter('AND', filterByPurchaseOrder, filtersProcessingACC);

      default:
        return undefined;
    }
  }

  /**
   * Retrieves filtered order items based on user context and role.
   *
   * @param params - An object containing the parameters for retrieving filtered order items.
   *
   * @returns A promise that resolves to an array of filtered order items or undefined if no items are found.
   */
  private async getFilteredOrderItems(params: RolesAndUserContext): Promise<OrderItem[] | undefined> {
    let orderItems: OrderItem[] | undefined = [];

    if (params.order.PurchaseOrder) {
      const filtersUSER = this.getFilter('user', params.userContext, params.order.PurchaseOrder);
      const filtersCCR = this.getFilter('costCenter', params.userContext, params.order.PurchaseOrder);
      const filtersCON = this.getFilter('controlling', params.userContext, params.order.PurchaseOrder);
      const filtersACC = this.getFilter('accounting', params.userContext, params.order.PurchaseOrder);

      switch (true) {
        case params.isGeneralUser: {
          if (filtersUSER) {
            orderItems = await this.orderItemsRepository.find(filtersUSER);
          }

          break;
        }

        case params.isCCR: {
          if (filtersCCR) {
            orderItems = await this.orderItemsRepository.find(filtersCCR);
          }

          break;
        }

        case params.isControlling: {
          if (filtersCON) {
            orderItems = await this.orderItemsRepository.find(filtersCON);
          }

          break;
        }

        case params.isAccounting: {
          if (filtersACC) {
            orderItems = await this.orderItemsRepository.find(filtersACC);
          }

          break;
        }
      }

      return orderItems;
    }
  }
}
