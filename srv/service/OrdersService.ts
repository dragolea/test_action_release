import { Inject, ServiceLogic, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import { OrdersRepository } from '../repository/OrdersRepository';
import { Order, OrderItem, Orders } from '#cds-models/ServiceAccruals';
import { OrderItemsRepository } from '../repository/OrderItemsRepository';
import util from '../util/helpers/util';
import { OrderItemsService } from './OrderItemsService';
import { A_PurchaseOrderItem, A_PurchaseOrder } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import constants from '../util/constants/constants';
import { Filter } from '@dxfrontier/cds-ts-repository';
import { UserContext } from '../util/types/types';

@ServiceLogic()
export class OrdersService {
  @Inject(OrdersRepository) private readonly ordersRepository: OrdersRepository;
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
      ProcessingState_code: constants.ProcessingState.USER,
      ApprovedByCCR: false,
      ApprovedByCON: false,
      ApprovedByACC: false,
      CreationDate: new Date().toISOString().substring(0, 10),
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
   * @param req - The request containing criteria for fetching orders.
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
   * Calculates the total and editable total amounts for a given order based on its items,
   * updates the order's sums, and triggers item and order highlight updates.
   *
   * @param order - The order to calculate sums for.
   * @param orderItems - The list of order items associated with the order.
   */
  private calculateOrderSum(order: Order, orderItems: OrderItem[]) {
    let sum = 0;
    let sumEditable = 0;

    orderItems?.forEach((item) => {
      if (item.OpenTotalAmountEditable) {
        sumEditable += item.OpenTotalAmountEditable;
      }

      if (item.OpenTotalAmount) {
        sum += item.OpenTotalAmount;
      }

      this.updateHighlightOnItem(item);
    });

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
  private updateHighlightOnOrder(order: Order, orderItems: OrderItem[]) {
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

    // amount changed, not all orderItems final, orderItems edited
    if (
      order.OpenTotalAmount !== order.OpenTotalAmountEditable &&
      finalCounter !== orderItems.length &&
      informationCounter !== 0
    ) {
      order.Highlight = constants.HIGHLIGHT.INFORMATION;
      return;
    }

    // amount not changed, not all orderItems final, orderItems edited
    if (
      order.OpenTotalAmount === order.OpenTotalAmountEditable &&
      finalCounter !== orderItems.length &&
      informationCounter !== 0
    ) {
      order.Highlight = constants.HIGHLIGHT.INFORMATION;
      return;
    }

    // amount changed, all orderItems final
    if (order.OpenTotalAmount !== order.OpenTotalAmountEditable && finalCounter === orderItems.length) {
      order.Highlight = constants.HIGHLIGHT.SUCCESS;
      return;
    }

    // amount not changed, all orderItems final
    if (order.OpenTotalAmount === order.OpenTotalAmountEditable && finalCounter === orderItems.length) {
      order.Highlight = constants.HIGHLIGHT.SUCCESS;
      return;
    }

    // amount changed, at lest one orderItem changed
    if (order.OpenTotalAmount !== order.OpenTotalAmountEditable && informationCounter !== 0) {
      order.Highlight = constants.HIGHLIGHT.INFORMATION;
      return;
    }

    // default
    order.Highlight = constants.HIGHLIGHT.NONE;
  }

  /**
   * Updates the highlight status of an order item based on its processing state and total amounts.
   *
   * @param orderItem - The order item to update the highlight status for.
   */
  private updateHighlightOnItem(orderItem: OrderItem) {
    // amount changed, ProcessingState not final
    if (
      orderItem.ProcessingState_code != constants.ProcessingState.FINAL &&
      orderItem.OpenTotalAmount !== orderItem.OpenTotalAmountEditable
    ) {
      orderItem.Highlight = constants.HIGHLIGHT.INFORMATION;
      return;
    }

    // ProcessingState final
    if (orderItem.ProcessingState_code === constants.ProcessingState.FINAL) {
      orderItem.Highlight = constants.HIGHLIGHT.SUCCESS;
      orderItem.Editable = false;
      return;
    }

    // default
    orderItem.Highlight = constants.HIGHLIGHT.NONE;
  }

  /**
   * Filters and sums the results of orders based on the current year and user context.
   *
   * @param params - An object containing the parameters for filtering and summing results.
   * @param params.results - An array of orders to be filtered and summed.
   * @param params.req - The request object containing user context information.
   * @param params.isGeneralUser - Indicates if the user has general user permissions.
   * @param params.isCCR - Indicates if the user has cost center responsibility.
   * @param params.isControlling - Indicates if the user is in the controlling department.
   * @param params.isAccounting - Indicates if the user is in the accounting department.
   *
   * @returns A promise that resolves when the filtering and summing is complete.
   */
  public async filterAndSumResults(params: {
    results: Order[];
    req: TypedRequest<Orders>;
    isGeneralUser: boolean;
    isCCR: boolean;
    isControlling: boolean;
    isAccounting: boolean;
  }) {
    const currentYear: string = new Date().getFullYear().toString();
    let filteredResults = [...params.results];
    params.results.length = 0;

    const userContext = await util.getUserContext(params.req);

    // current year of order
    filteredResults = filteredResults.filter((order) => order.CreationDate?.includes(currentYear));

    for (const order of filteredResults) {
      const orderItems: OrderItem[] | undefined = await this.getFilteredOrderItems({
        userContext,
        order,
        isGeneralUser: params.isGeneralUser,
        isCCR: params.isCCR,
        isControlling: params.isControlling,
        isAccounting: params.isAccounting,
      });

      if (orderItems) {
        this.calculateOrderSum(order, orderItems);
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
  private getFilter(role: string, userContext: UserContext, purchaseOrder: string) {
    const filterRequester = new Filter<OrderItem>({
      field: 'Requester',
      operator: 'EQUALS',
      value: userContext.SapUser,
    });

    const filterProcessingStateCCR = new Filter<OrderItem>({
      field: 'ProcessingState_code',
      operator: 'NOT EQUAL',
      value: constants.ProcessingState.USER,
    });

    const filterProcessingStateCON = new Filter<OrderItem>({
      field: 'ProcessingState_code',
      operator: 'EQUALS',
      value: constants.ProcessingState.CONTROLLING,
    });

    const filterProcessingStateACC = new Filter<OrderItem>({
      field: 'ProcessingState_code',
      operator: 'EQUALS',
      value: constants.ProcessingState.ACCOUNTING,
    });

    const filterProcessingStateFinal = new Filter<OrderItem>({
      field: 'ProcessingState_code',
      operator: 'EQUALS',
      value: constants.ProcessingState.FINAL,
    });

    const filterPurchaseOrder = new Filter<OrderItem>({
      field: 'PurchaseOrder',
      operator: 'EQUALS',
      value: purchaseOrder,
    });

    // ! for testing
    // let filterCostCenter = new Filter<OrderItem>({
    //   field: 'CostCenterID',
    //   operator: 'EQUALS',
    //   value: '1018040191',
    // });

    // useless empty filter for concatenation
    let filterCostCenter = new Filter<OrderItem>({ field: 'CostCenterID', operator: 'EQUALS', value: null });

    userContext.to_CostCenters.forEach((costCenter) => {
      const filterCostCenterTemp = new Filter<OrderItem>({
        field: 'CostCenterID',
        operator: 'EQUALS',
        value: costCenter.CostCenter,
      });
      filterCostCenter = new Filter('OR', filterCostCenter, filterCostCenterTemp);
    });

    const filtersProcessingCON = new Filter(
      'OR',
      filterProcessingStateCON,
      filterProcessingStateACC,
      filterProcessingStateFinal,
    );

    const filtersProcessingACC = new Filter('OR', filterProcessingStateACC, filterProcessingStateFinal);

    switch (role) {
      case 'user':
        return new Filter('AND', filterPurchaseOrder, filterRequester);

      case 'costCenter':
        return new Filter('AND', filterPurchaseOrder, filterCostCenter, filterProcessingStateCCR);

      case 'controlling':
        return new Filter('AND', filterPurchaseOrder, filtersProcessingCON);

      case 'accounting':
        return new Filter('AND', filterPurchaseOrder, filtersProcessingACC);

      default:
        return undefined;
    }
  }

  /**
   * Retrieves filtered order items based on user context and role.
   *
   * @param params - An object containing the parameters for retrieving filtered order items.
   * @param params.userContext - The context of the user requesting the order items.
   * @param params.order - The order for which the items are being retrieved.
   * @param params.isGeneralUser - Indicates if the user has general user permissions.
   * @param params.isCCR - Indicates if the user has cost center responsibility.
   * @param params.isControlling - Indicates if the user is in the controlling department.
   * @param params.isAccounting - Indicates if the user is in the accounting department.
   *
   * @returns A promise that resolves to an array of filtered order items or undefined if no items are found.
   */
  private async getFilteredOrderItems(params: {
    userContext: UserContext;
    order: Order;
    isGeneralUser: boolean;
    isCCR: boolean;
    isControlling: boolean;
    isAccounting: boolean;
  }) {
    let orderItems: OrderItem[] | undefined = [];

    if (params.order.PurchaseOrder) {
      const filtersUSER = this.getFilter('user', params.userContext, params.order.PurchaseOrder);

      const filtersCCR = this.getFilter('costCenter', params.userContext, params.order.PurchaseOrder);

      const filtersCON = this.getFilter('controlling', params.userContext, params.order.PurchaseOrder);

      const filtersACC = this.getFilter('accounting', params.userContext, params.order.PurchaseOrder);

      switch (true) {
        case params.isGeneralUser:
          if (filtersUSER) {
            orderItems = await this.orderItemsRepository.builder().find(filtersUSER).execute();
          }
          break;

        case params.isCCR:
          if (filtersCCR) {
            orderItems = await this.orderItemsRepository.builder().find(filtersCCR).execute();
          }
          break;

        case params.isControlling:
          if (filtersCON) {
            orderItems = await this.orderItemsRepository.builder().find(filtersCON).execute();
          }
          break;

        case params.isAccounting:
          if (filtersACC) {
            orderItems = await this.orderItemsRepository.builder().find(filtersACC).execute();
          }
          break;
      }

      return orderItems;
    }
  }
}
