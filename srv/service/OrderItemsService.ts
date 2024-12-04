import { A_PurchaseOrderItem } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import { Context, OrderItem } from '#cds-models/ServiceAccruals';
import { Inject, ServiceLogic } from '@dxfrontier/cds-ts-dispatcher';
import { OrderItemsRepository } from '../repository/OrderItemsRepository';
import constants from '../util/constants/constants';
import { A_InternalOrderRepository } from '../repository/A_InternalOrderRepository';
import { A_PurchaseOrderItemRepository } from '../repository/A_PurchaseOrderItemRepository';
import { ZI_PURCHASEORDERHISTORY } from '#cds-models/ZAPI_PURCHASE_ORDER_HISTORY_SRV';
import { ZI_PURCHASEORDERHISTORY_Repository } from '../repository/ZI_PURCHASEORDERHISTORY_Repository';
import { CostCenterData, OrderItemHistory, RolesAndUserContext } from '../util/types/types';
import { Filter } from '@dxfrontier/cds-ts-repository';
import { A_InternalOrder } from '#cds-models/API_INTERNALORDER_SRV';
import util from '../util/helpers/util';

@ServiceLogic()
export class OrderItemsService {
  @Inject(OrderItemsRepository) private orderItemsRepository: OrderItemsRepository;
  @Inject(A_InternalOrderRepository) private internalOrderRepository: A_InternalOrderRepository;
  @Inject(A_PurchaseOrderItemRepository) private purchaseOrderItemRepository: A_PurchaseOrderItemRepository;
  @Inject(ZI_PURCHASEORDERHISTORY_Repository)
  private purchaseOrderHistoryRepository: ZI_PURCHASEORDERHISTORY_Repository;

  /**
   * Fetches the history of the specified purchase order item.
   *
   * @param item - The purchase order item for which to fetch the history.
   * @returns A promise resolving to the order item history containing the total invoice amount and final invoicing status.
   */
  public async fetchOrderItemHistory(item: OrderItem | A_PurchaseOrderItem): Promise<OrderItemHistory> {
    let totalInvoiceAmount = 0;

    const purchaseOrderHistories: ZI_PURCHASEORDERHISTORY[] | undefined = await this.purchaseOrderHistoryRepository
      .builder()
      .find({
        PurchaseOrder: item.PurchaseOrder,
        PurchaseOrderItem: item.PurchaseOrderItem,
        PurchasingHistoryCategory: 'Q',
      })
      .getExpand('to_PurchaseOrderItem')
      .execute();

    if (purchaseOrderHistories?.length !== 0 && purchaseOrderHistories) {
      purchaseOrderHistories.forEach((purchaseOrderHistory) => {
        if (purchaseOrderHistory.InvoiceAmtInCoCodeCrcy) {
          totalInvoiceAmount += parseFloat(purchaseOrderHistory.InvoiceAmtInCoCodeCrcy.toString());
        }
      });
    }

    return { totalInvoiceAmount };
  }

  /**
   * Retrieves purchase order items associated with the specified user context.
   *
   * @param context - The user context containing the SAP user information for filtering purchase order items.
   * @returns A promise that resolves to an array of purchase order items with relevant associations expanded.
   */
  public async fetchPurchaseOrderItemsByContext(context: Context): Promise<A_PurchaseOrderItem[] | undefined> {
    return await this.purchaseOrderItemRepository
      .builder()
      .find({ RequisitionerName: context.SapUser })
      .getExpand('to_PurchaseOrder', 'to_AccountAssignment', 'to_PurchaseOrderPricingElement')
      .orderDesc('PurchaseOrder')
      .execute();
  }

  /**
   * Fetches a purchase order item from the repository by its unique key.
   *
   * @param purchaseOrder - The identifier for the purchase order.
   * @param purchaseOrderItem - The identifier for the purchase order item within the purchase order.
   * @returns A promise that resolves to the `A_PurchaseOrderItem` object if found, or `undefined` if no matching item is found.
   */
  public async fetchPurchaseOrderItemByKey(
    purchaseOrder: string,
    purchaseOrderItem: string,
  ): Promise<A_PurchaseOrderItem | undefined> {
    return await this.purchaseOrderItemRepository
      .builder()
      .findOne({
        PurchaseOrder: purchaseOrder,
        PurchaseOrderItem: purchaseOrderItem,
      })
      .getExpand('to_PurchaseOrder', 'to_AccountAssignment')
      .execute();
  }

  /**
   * Adds filters for cost centers based on the `OrderID` associated with the provided item.
   *
   * @param item - The purchase order item to process.
   * @param orderIDFiltersArray - An array of filters to be updated with new `OrderID` filters.
   */
  private async getCostCenters(item: A_PurchaseOrderItem, orderIDFiltersArray: Filter<A_InternalOrder>[]) {
    if (item.AccountAssignmentCategory === constants.ACCOUNT_ASSIGNMENT_CATEGORY.ORDER) {
      if (item.to_AccountAssignment) {
        const orderID = item.to_AccountAssignment[0].OrderID;

        // the orderID matches to one costCenterID
        if (orderID) {
          const orderIDFilter = new Filter<A_InternalOrder>({
            field: 'InternalOrder',
            operator: 'EQUALS',
            value: orderID,
          });

          if (!orderIDFiltersArray.find((filter) => filter.value === orderIDFilter.value)) {
            orderIDFiltersArray.push(orderIDFilter);
          }
        }
      }
    }
  }

  /**
   * Constructs and adds a filter for purchase order histories based on the provided item.
   *
   * @param item - The purchase order item to process.
   * @param orderItemHistoryFiltersArray - An array of filters to be updated with a new filter for the item.
   */
  private async getHistories(
    item: A_PurchaseOrderItem,
    orderItemHistoryFiltersArray: Filter<ZI_PURCHASEORDERHISTORY>[],
  ) {
    if (item.PurchaseOrder && item.PurchaseOrderItem) {
      const purchaseOrderFilter = new Filter<ZI_PURCHASEORDERHISTORY>({
        field: 'PurchaseOrder',
        operator: 'EQUALS',
        value: item.PurchaseOrder,
      });

      const purchaseOrderItemFilter = new Filter<ZI_PURCHASEORDERHISTORY>({
        field: 'PurchaseOrderItem',
        operator: 'EQUALS',
        value: item.PurchaseOrderItem,
      });

      const purchasingHistoryCategoryFilter = new Filter<ZI_PURCHASEORDERHISTORY>({
        field: 'PurchasingHistoryCategory',
        operator: 'EQUALS',
        value: 'Q',
      });

      const orderItemHistoryFilter = new Filter(
        'AND',
        purchasingHistoryCategoryFilter,
        purchaseOrderFilter,
        purchaseOrderItemFilter,
      );

      orderItemHistoryFiltersArray.push(orderItemHistoryFilter);
    }
  }

  /**
   * Processes purchase order items by fetching related data, formatting the data,
   * and updating or creating entries in the order items repository.
   *
   * @param purchaseOrderItems - List of purchase order items to process.
   */
  public async writeOrderItems(purchaseOrderItems: A_PurchaseOrderItem[]) {
    const orderIDFiltersArray: Filter<A_InternalOrder>[] = [];

    const orderItemHistoryFiltersArray: Filter<ZI_PURCHASEORDERHISTORY>[] = [];

    for (const item of purchaseOrderItems) {
      await this.getCostCenters(item, orderIDFiltersArray);
      await this.getHistories(item, orderItemHistoryFiltersArray);
    }

    const orderIDFilters = new Filter('OR', ...orderIDFiltersArray);

    const costCenters = await this.internalOrderRepository.find(orderIDFilters);

    const orderItemHistoryFilter = new Filter('OR', ...orderItemHistoryFiltersArray);

    const purchaseOrderHistories = await this.purchaseOrderHistoryRepository
      .builder()
      .find(orderItemHistoryFilter)
      .getExpand('to_PurchaseOrderItem')
      .execute();

    if (costCenters && purchaseOrderHistories) {
      const orderItems = await this.formatOrderItemData(purchaseOrderItems, costCenters, purchaseOrderHistories);
      for (const item of orderItems) {
        const found = await this.orderItemsRepository.exists({
          PurchaseOrder: item.PurchaseOrder,
          PurchaseOrderItem: item.PurchaseOrderItem,
        });
        if (found) {
          await this.orderItemsRepository.update(
            {
              PurchaseOrder: item.PurchaseOrder,
              PurchaseOrderItem: item.PurchaseOrderItem,
            },
            {
              Supplier: item.Supplier,
              SupplierText: item.SupplierText,
              PurchaseOrderItemText: item.PurchaseOrderItemText,
              AccountAssignmentCategory: item.AccountAssignmentCategory,
              OrderID: item.OrderID,
              CostCenterID: item.CostCenterID,
              TotalInvoiceAmount: item.TotalInvoiceAmount,
              OpenTotalAmount: item.OpenTotalAmount,
              NetPriceAmount: item.NetPriceAmount,
              OrderQuantity: item.OrderQuantity,
            },
          );
        } else {
          await this.orderItemsRepository.create(item);
        }
      }
    }
  }

  /**
   * Formats purchase order items by enriching them with related cost center and invoice history data.
   *
   * @param purchaseOrderItems - List of purchase order items to format.
   * @param costCenters - List of cost centers associated with the items.
   * @param purchaseOrderHistories - List of purchase order histories to calculate totals.
   * @returns List of formatted order items.
   */
  private async formatOrderItemData(
    purchaseOrderItems: A_PurchaseOrderItem[],
    costCenters: A_InternalOrder[],
    purchaseOrderHistories: ZI_PURCHASEORDERHISTORY[],
  ): Promise<OrderItem[]> {
    const orderItems: OrderItem[] = [];
    for (const orderItem of purchaseOrderItems) {
      let orderID = '';
      let costCenterID = '';

      if (orderItem.AccountAssignmentCategory === constants.ACCOUNT_ASSIGNMENT_CATEGORY.ORDER) {
        if (orderItem.to_AccountAssignment) {
          const orderIDTemp = orderItem.to_AccountAssignment[0].OrderID;
          if (orderIDTemp) {
            orderID = orderIDTemp;
            const costCenter = costCenters.find((costCenter) => costCenter.InternalOrder === orderID);
            if (costCenter) {
              const costCenterIDTemp = costCenter.ResponsibleCostCenter;
              if (costCenterIDTemp) {
                costCenterID = costCenterIDTemp;
              }
            }
          }
        }
      }

      if (orderItem.AccountAssignmentCategory === constants.ACCOUNT_ASSIGNMENT_CATEGORY.COST_CENTER) {
        if (orderItem.to_AccountAssignment) {
          const costCenterIDTemp = orderItem.to_AccountAssignment![0].CostCenter;
          if (costCenterIDTemp) {
            costCenterID = costCenterIDTemp;
          }
        }
      }

      let totalInvoiceAmount = 0;
      const filteredHistories = purchaseOrderHistories.filter(
        (history) =>
          history.PurchaseOrder === orderItem.PurchaseOrder &&
          history.PurchaseOrderItem!.replace(/^0+/, '') === orderItem.PurchaseOrderItem,
      );

      if (filteredHistories?.length !== 0 && filteredHistories) {
        filteredHistories.forEach((purchaseOrderHistory) => {
          if (purchaseOrderHistory.InvoiceAmtInCoCodeCrcy) {
            totalInvoiceAmount += parseFloat(purchaseOrderHistory.InvoiceAmtInCoCodeCrcy.toString());
          }
        });
      }

      let ID = '';
      if (orderItem.PurchaseOrder && orderItem.PurchaseOrderItem) {
        ID = orderItem.PurchaseOrder + orderItem.PurchaseOrderItem;
      }

      let openTotalAmount = 0;
      if (orderItem.NetPriceAmount && orderItem.OrderQuantity) {
        openTotalAmount = orderItem.NetPriceAmount * orderItem.OrderQuantity - totalInvoiceAmount;
      }

      let openTotalAmountEditable = 0;
      if (orderItem.NetPriceAmount && orderItem.OrderQuantity) {
        openTotalAmountEditable = orderItem.NetPriceAmount * orderItem.OrderQuantity - totalInvoiceAmount;
      }

      orderItems.push({
        PurchaseOrder: orderItem.PurchaseOrder,
        PurchaseOrderItem: orderItem.PurchaseOrderItem,
        ID: ID,
        Supplier: orderItem.to_PurchaseOrder?.Supplier,
        SupplierText: orderItem.to_PurchaseOrder?.AddressName,
        PurchaseOrderItemText: orderItem.PurchaseOrderItemText,
        AccountAssignmentCategory: orderItem.AccountAssignmentCategory,
        OrderID: orderID,
        CostCenterID: costCenterID,
        OpenTotalAmount: openTotalAmount,
        OpenTotalAmountEditable: openTotalAmountEditable,
        NodeID: null,
        HierarchyLevel: null,
        ParentNodeID: null,
        DrillState: null,
        ProcessingState_code: constants.PROCESSING_STATE.USER,
        ApprovedByCCR: false,
        ApprovedByCON: false,
        ApprovedByACC: false,
        Requester: orderItem.RequisitionerName,
        Editable: true,
        IsOrderItem: true,
        NetPriceAmount: orderItem.NetPriceAmount,
        OrderQuantity: orderItem.OrderQuantity,
        TotalInvoiceAmount: totalInvoiceAmount,
        to_Orders_PurchaseOrder: orderItem.PurchaseOrder,
      });
    }
    return orderItems;
  }

  /**
   * Retrieves cost center data based on the given purchase order item.
   *
   * @param item - The purchase order item to retrieve cost center data for.
   * @returns A promise resolving to the cost center data, or `undefined` if not available.
   */
  private async getCostCenterData(item: A_PurchaseOrderItem): Promise<CostCenterData | undefined> {
    let orderID: string | null | undefined = '';
    let costCenterID: string | null | undefined = '';

    switch (item.AccountAssignmentCategory) {
      case constants.ACCOUNT_ASSIGNMENT_CATEGORY.ORDER: {
        if (!item.to_AccountAssignment) {
          break;
        }

        orderID = item.to_AccountAssignment[0].OrderID;
        if (!orderID) {
          break;
        }

        const costCenter = await this.internalOrderRepository.findOne({
          InternalOrder: orderID.toLowerCase(),
        });

        if (!costCenter) {
          break;
        }

        costCenterID = costCenter.ResponsibleCostCenter;
        break;
      }

      case constants.ACCOUNT_ASSIGNMENT_CATEGORY.COST_CENTER: {
        costCenterID = item.to_AccountAssignment![0].CostCenter;
        break;
      }
    }

    if (orderID !== null && orderID !== undefined && costCenterID !== null && costCenterID !== undefined) {
      return { orderID, costCenterID };
    }
  }

  /**
   * Updates an existing order item by fetching the latest data and adding it to the repository.
   *
   * @param item - The `OrderItem` to be updated. It should include `PurchaseOrder` and `PurchaseOrderItem`.
   * @returns A promise that resolves once the order item is updated or if no update is performed.
   */
  public async updateOrderItem(item: OrderItem): Promise<boolean> {
    if (item.PurchaseOrder && item.PurchaseOrderItem) {
      const newItem = await this.fetchPurchaseOrderItemByKey(item.PurchaseOrder, item.PurchaseOrderItem);

      if (newItem?.IsFinallyInvoiced) {
        this.removeOrderItem(item);
        return false;
      }

      if (newItem) {
        const costCenterData = await this.getCostCenterData(newItem);
        const orderItemHistory = await this.fetchOrderItemHistory(newItem);

        let orderID = '';
        let costCenterID = '';

        if (costCenterData) {
          orderID = costCenterData.orderID;
          costCenterID = costCenterData.costCenterID;
        }

        let openTotalAmount = 0;
        if (newItem.NetPriceAmount && newItem.OrderQuantity) {
          openTotalAmount = newItem.NetPriceAmount * newItem.OrderQuantity - orderItemHistory.totalInvoiceAmount;
        }

        this.orderItemsRepository.update(
          {
            PurchaseOrder: item.PurchaseOrder,
            PurchaseOrderItem: item.PurchaseOrderItem,
          },
          {
            Supplier: newItem.to_PurchaseOrder?.Supplier,
            SupplierText: newItem.to_PurchaseOrder?.AddressName,
            PurchaseOrderItemText: newItem.PurchaseOrderItemText,
            AccountAssignmentCategory: newItem.AccountAssignmentCategory,
            OrderID: orderID,
            CostCenterID: costCenterID,
            TotalInvoiceAmount: orderItemHistory.totalInvoiceAmount,
            OpenTotalAmount: openTotalAmount,
            NetPriceAmount: newItem.NetPriceAmount,
            OrderQuantity: newItem.OrderQuantity,
          },
        );
      }
    }
    return true;
  }

  /**
   * Removes an order item from the repository.
   *
   * @param item - The order item to remove.
   * @returns A promise that resolves once the order item is deleted.
   */
  private async removeOrderItem(item: OrderItem): Promise<void> {
    await this.orderItemsRepository.delete({
      PurchaseOrder: item.PurchaseOrder,
      PurchaseOrderItem: item.PurchaseOrderItem,
    });
  }

  /**
   * Filters purchase order items by removing those not matching the year or investment criteria.
   *
   * @param orderItems - The list of purchase order items to be filtered.
   * @returns A promise resolving to the filtered list of purchase order items.
   */
  public async filterPurchaseOrderItems(orderItems: A_PurchaseOrderItem[]): Promise<A_PurchaseOrderItem[]> {
    const filteredOrderItemsByYear: A_PurchaseOrderItem[] = await util.filterOrderItemsByYear(orderItems);
    const filteredOrderItemsNoInvest: A_PurchaseOrderItem[] = await util.removeInvestOrders(filteredOrderItemsByYear);
    const filteredOrderItems: A_PurchaseOrderItem[] = await util.removeInvestOrders(filteredOrderItemsNoInvest);

    return filteredOrderItems;
  }

  /**
   * Checks for outdated order items and updates them if necessary.
   *
   * @param filteredOrderItems - Array of filtered purchase order items to compare against.
   * @param requester - The ID of the user who requested the order items.
   * @returns A promise that resolves when all outdated items are updated.
   */
  public async checkForOutdatedOrderItems(filteredOrderItems: A_PurchaseOrderItem[], requester: string): Promise<void> {
    const myPurchaseOrderItems = await this.orderItemsRepository.find({ Requester: requester });

    if (myPurchaseOrderItems) {
      for (const myOrderItem of myPurchaseOrderItems) {
        if (!filteredOrderItems?.find((item) => item.PurchaseOrder === myOrderItem.PurchaseOrder)) {
          await this.updateOrderItem(myOrderItem);
        }
      }
    }
  }

  /**
   * Updates the highlight status of an order item based on its processing state and total amounts.
   * HANA driver typing is broken for decimals (hence toString on strings), refer:
   * https://community.sap.com/t5/technology-q-a/cap-nodejs-different-representation-of-decimal-with-sqlite-and-hana/qaq-p/12461752
   *
   * @param orderItem - The order item to update the highlight status for.
   */
  public updateHighlightOnOrderItem(orderItem: OrderItem): void {
    if (!orderItem.OpenTotalAmountEditable || !orderItem.OpenTotalAmount) {
      return;
    }

    const finalProcessingStateAndAmountChanged =
      orderItem.ProcessingState_code != constants.PROCESSING_STATE.FINAL &&
      parseFloat(orderItem.OpenTotalAmount.toString()) !== parseFloat(orderItem.OpenTotalAmountEditable.toString());

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
   * Retrieves filtered order items based on user context and role.
   *
   * @param params - An object containing the parameters for retrieving filtered order items.
   *
   * @returns A promise that resolves to an array of filtered order items or undefined if no items are found.
   */
  public async getFilteredOrderItems(params: RolesAndUserContext): Promise<OrderItem[] | undefined> {
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
      value: 'undefined',
    });

    // ! for testing
    // userContext.to_CostCenters.push({ CostCenter: '1018040191', to_Contexts_UserId: userContext.UserId });

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
}
