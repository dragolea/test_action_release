import { Inject, ServiceLogic, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import { OrdersRepository } from '../repository/OrdersRepository';
import { Context, Order, OrderItem, Orders } from '#cds-models/ServiceAccruals';
import util from '../util/helpers/util';
import { OrderItemsService } from './OrderItemsService';
import { A_PurchaseOrderItem, A_PurchaseOrder } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import constants from '../util/constants/constants';
import { Filter } from '@dxfrontier/cds-ts-repository';
import { RolesAndResult } from '../util/types/types';
import { A_PurchaseOrderItemRepository } from '../repository/A_PurchaseOrderItemRepository';
import { ContextsService } from './ContextsService';

@ServiceLogic()
export class OrdersService {
  @Inject(OrdersRepository) private ordersRepository: OrdersRepository;
  @Inject(OrderItemsService) private orderItemsService: OrderItemsService;
  @Inject(A_PurchaseOrderItemRepository) private purchaseOrderItemRepository: A_PurchaseOrderItemRepository;
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
    const context = await this.contextsService.getContext(req);

    if (!context) {
      req.reject(400, 'context not found');
      return;
    }

    const orderItems: A_PurchaseOrderItem[] | undefined =
      await this.orderItemsService.fetchPurchaseOrderItemsByContext(context);

    if (orderItems) {
      const filteredOrderItems: A_PurchaseOrderItem[] =
        await this.orderItemsService.filterPurchaseOrderItems(orderItems);
      const orders: A_PurchaseOrder[] = [];

      // checks if orderItems in the CAP database exist for the current user, which are not part of the filteredOrderItems and updates them
      if (context.SapUser) {
        await this.orderItemsService.checkForOutdatedOrderItems(filteredOrderItems, context.SapUser);
      }

      await this.orderItemsService.writeOrderItems(filteredOrderItems);

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
        const mappedOrder: Order = this.mapOrder(order);
        await this.ordersRepository.updateOrCreate(mappedOrder);
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

      this.orderItemsService.updateHighlightOnOrderItem(item);
    }

    order.OpenTotalAmountEditable = parseFloat(sumEditable.toFixed(3));
    order.OpenTotalAmount = parseFloat(sum.toFixed(3));

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
   * Filters and sums the results of orders based on the current year and user context.
   *
   * @param params - An object containing the parameters for filtering and summing results.
   *
   * @returns A promise that resolves when the filtering and summing is complete.
   */
  public async filterAndSumResults(params: RolesAndResult): Promise<void> {
    const context = await this.contextsService.getContext(params.req);

    if (!context) {
      params.req.reject(400, 'context not found');
      return;
    }

    const resultsCopy: Order[] = util.deepCopyArray(params.results);
    const filteredResults = this.filterResultsByYear(resultsCopy);
    const isNotGeneralUser = params.isGeneralUser === false;

    if (isNotGeneralUser) {
      await this.handleNotGeneralUser(context, params, filteredResults);
    }

    for (const order of filteredResults) {
      const orderItems: OrderItem[] | undefined = await this.orderItemsService.getFilteredOrderItems({
        userContext: context,
        order,
        isGeneralUser: params.isGeneralUser,
        isCCR: params.isCCR,
        isControlling: params.isControlling,
        isAccounting: params.isAccounting,
      });

      if (orderItems && orderItems.length > 0) {
        await this.calculateOrderSum(order, orderItems);
        order.to_OrderItems = orderItems;

        if (order.to_OrderItems!.length > 0) {
          if (order.PurchaseOrder) {
            order.NodeID = order.PurchaseOrder;
          }

          params.results.push(order);
        }
      }
    }
  }

  /**
   * Filters orders to include only those created in the current or previous year.
   *
   * @param resultsCopy - The list of orders to be filtered.
   * @returns A filtered list of orders matching the current or previous year.
   */
  private filterResultsByYear(resultsCopy: Order[]) {
    const filteredResultsCurrentYear = resultsCopy.filter((order) =>
      order.CreationDate?.includes(util.getCurrentYear()),
    );
    const filteredResultsLastYear = resultsCopy.filter((order) => order.CreationDate?.includes(util.getLastYear()));
    return [...filteredResultsCurrentYear, ...filteredResultsLastYear];
  }

  /**
   * Handles processing for non-general users by fetching and writing relevant purchase order items.
   *
   * @param context - The user context.
   * @param params - Role-specific parameters.
   * @param filteredResults - Filtered orders relevant to the user.
   */
  private async handleNotGeneralUser(context: Context, params: RolesAndResult, filteredResults: Order[]) {
    const allOrderItems: OrderItem[] = [];

    for (const order of filteredResults) {
      const orderItems: OrderItem[] | undefined = await this.orderItemsService.getFilteredOrderItems({
        userContext: context,
        order,
        isGeneralUser: params.isGeneralUser,
        isCCR: params.isCCR,
        isControlling: params.isControlling,
        isAccounting: params.isAccounting,
      });
      if (orderItems) {
        for (const item of orderItems) {
          allOrderItems.push(item);
        }
      }
    }

    const filtersArray = [];

    if (allOrderItems.length > 0) {
      for (const item of allOrderItems) {
        if (item.PurchaseOrder && item.PurchaseOrderItem) {
          const purchaseOrderFilter = new Filter<A_PurchaseOrderItem>({
            field: 'PurchaseOrder',
            operator: 'EQUALS',
            value: item.PurchaseOrder,
          });

          const purchaseOrderItemFilter = new Filter<A_PurchaseOrderItem>({
            field: 'PurchaseOrderItem',
            operator: 'EQUALS',
            value: item.PurchaseOrderItem,
          });

          const filter = new Filter('AND', purchaseOrderFilter, purchaseOrderItemFilter);
          filtersArray.push(filter);
        }
      }

      const filters = new Filter('OR', ...filtersArray);

      const purchaseOrderItems = await this.purchaseOrderItemRepository
        .builder()
        .find(filters)
        .getExpand('to_PurchaseOrder', 'to_AccountAssignment')
        .execute();

      if (purchaseOrderItems && purchaseOrderItems.length > 0) {
        await this.orderItemsService.writeOrderItems(purchaseOrderItems);
      }
    }
  }
}
