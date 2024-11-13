import { Inject, ServiceLogic, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import { OrdersRepository } from '../repository/OrdersRepository';
import { Context, Order, OrderItem, Orders } from '#cds-models/ServiceAccruals';
import { OrderItemsRepository } from '../repository/OrderItemsRepository';
import util from '../util/helpers/util';
import { OrderItemsService } from './OrderItemsService';
import { A_PurchaseOrderItem, A_PurchaseOrder } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import constants from '../util/constants/constants';
import { Filter } from '@dxfrontier/cds-ts-repository';
import { RolesAndResult, RolesAndUserContext } from '../util/types/types';
import { ContextsRepository } from '../repository/ContextsRepository';
import { ContextsService } from './ContextsService';

@ServiceLogic()
export class OrdersService {
  @Inject(OrdersRepository) private ordersRepository: OrdersRepository;
  @Inject(OrderItemsRepository) private orderItemsRepository: OrderItemsRepository;
  @Inject(OrderItemsService) private orderItemsService: OrderItemsService;
  @Inject(ContextsRepository) private contextsRepository: ContextsRepository;
  @Inject(ContextsService) private contextsService: ContextsService;

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
      CreationDate: order.CreationDate,
      Editable: true,
      IsOrderItem: false,
    };
  }

  /**
   * Asynchronously retrieves unique purchase orders from order items for the current and the last year.
   *
   * @param req - The request containing criteria for fetching order items.
   * @returns A promise that resolves to an array of unique purchase orders.
   */
  private async getOrders(req: TypedRequest<Orders>): Promise<A_PurchaseOrder[] | undefined> {
    const context = await this.contextsRepository
      .builder()
      .findOne({ UserId: req.user.id })
      .getExpand('to_CostCenters')
      .execute();

    if (!context) {
      req.reject(400, 'context not found');
      return;
    }

    const orderItems: A_PurchaseOrderItem[] | undefined = await this.orderItemsService.fetchPurchaseOrderItems(context);

    if (orderItems) {
      const filteredOrderItems: A_PurchaseOrderItem[] = await util.filterOrderItemsByYear(orderItems);
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
    await this.contextsService.writeContexts(req);

    const orders: A_PurchaseOrder[] | undefined = await this.getOrders(req);

    if (orders) {
      for (const order of orders) {
        const mappedOrder: Order = this.mapOrder(order);
        await this.ordersRepository.updateOrCreate(mappedOrder);
      }
    }

    await this.orderItemsService.writeOrderItems(req);
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
   * HANA driver typing is broken for decimals (hence toString on strings), refer:
   * https://community.sap.com/t5/technology-q-a/cap-nodejs-different-representation-of-decimal-with-sqlite-and-hana/qaq-p/12461752
   *
   * @param orderItem - The order item to update the highlight status for.
   */
  private updateHighlightOnItem(orderItem: OrderItem): void {
    if (!orderItem.OpenTotalAmountEditable) {
      return;
    }

    const finalProcessingStateAndAmountChanged =
      orderItem.ProcessingState_code != constants.PROCESSING_STATE.FINAL &&
      orderItem.OpenTotalAmount !== parseFloat(orderItem.OpenTotalAmountEditable.toString());

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
    const context = await this.contextsRepository
      .builder()
      .findOne({ UserId: params.req.user.id })
      .getExpand('to_CostCenters')
      .execute();

    if (!context) {
      params.req.reject(400, 'context not found');
      return;
    }

    let filteredResults: Order[] = util.deepCopyArray(params.results);

    // current year of order
    const filteredResultsCurrentYear = filteredResults.filter((order) =>
      order.CreationDate?.includes(util.getCurrentYear()),
    );
    const filteredResultsLastYear = filteredResults.filter((order) => order.CreationDate?.includes(util.getLastYear()));
    filteredResults = [...filteredResultsCurrentYear, ...filteredResultsLastYear];

    for (const order of filteredResults) {
      const orderItems: OrderItem[] | undefined = await this.getFilteredOrderItems({
        userContext: context,
        order,
        isGeneralUser: params.isGeneralUser,
        isCCR: params.isCCR,
        isControlling: params.isControlling,
        isAccounting: params.isAccounting,
      });

      if (orderItems) {
        const isNotGeneralUser = params.isGeneralUser === false;

        if (isNotGeneralUser) {
          await this.updateOrderItems(context);
        }

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
   * Updates the specified order items with current net price and order quantity information.
   *
   * @param orderItems - An array of `OrderItem` objects to update in the repository.
   * @returns A promise that resolves once all specified order items have been updated.
   */
  private async updateOrderItems(context: Context): Promise<void> {
    const orderItems: A_PurchaseOrderItem[] | undefined = await this.orderItemsService.fetchPurchaseOrderItems(context);

    if (orderItems) {
      for (const orderItem of orderItems) {
        const item: OrderItem | undefined = await this.orderItemsRepository.findOne({
          PurchaseOrder: orderItem.PurchaseOrder,
          PurchaseOrderItem: orderItem.PurchaseOrderItem,
        });

        const totalInvoiceAmount = await this.orderItemsService.fetchTotalInvoiceAmount(orderItem);

        if (item) {
          await this.orderItemsRepository.update(
            { PurchaseOrder: item.PurchaseOrder, PurchaseOrderItem: item.PurchaseOrderItem },
            {
              NetPriceAmount: item.NetPriceAmount,
              OrderQuantity: item.OrderQuantity,
              TotalInvoiceAmount: totalInvoiceAmount,
            },
          );
        }
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
  private getFilter(role: string, userContext: Context, purchaseOrder: string): Filter<OrderItem> | undefined {
    if (!userContext.SapUser || !userContext.to_CostCenters) {
      return;
    }

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
    // userContext.to_CostCenters.push({ CostCenter: '1018040191', to_Contexts: userContext.UserId });

    userContext.to_CostCenters.forEach((costCenter) => {
      if (!costCenter.CostCenter) {
        return;
      }

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
      switch (true) {
        case params.isGeneralUser: {
          const filtersUSER = this.getFilter('user', params.userContext, params.order.PurchaseOrder);
          if (filtersUSER) {
            orderItems = await this.orderItemsRepository.find(filtersUSER);
          }

          break;
        }

        case params.isCCR: {
          const filtersCCR = this.getFilter('costCenter', params.userContext, params.order.PurchaseOrder);
          if (filtersCCR) {
            orderItems = await this.orderItemsRepository.find(filtersCCR);
          }

          break;
        }

        case params.isControlling: {
          const filtersCON = this.getFilter('controlling', params.userContext, params.order.PurchaseOrder);
          if (filtersCON) {
            orderItems = await this.orderItemsRepository.find(filtersCON);
          }

          break;
        }

        case params.isAccounting: {
          const filtersACC = this.getFilter('accounting', params.userContext, params.order.PurchaseOrder);
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
