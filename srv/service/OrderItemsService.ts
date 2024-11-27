import { A_PurchaseOrderItem } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import { Context, OrderItem } from '#cds-models/ServiceAccruals';
import { Inject, ServiceLogic } from '@dxfrontier/cds-ts-dispatcher';
import { OrderItemsRepository } from '../repository/OrderItemsRepository';
import constants from '../util/constants/constants';
import { A_InternalOrderRepository } from '../repository/A_InternalOrderRepository';
import { A_PurchaseOrderItemRepository } from '../repository/A_PurchaseOrderItemRepository';
import { ZI_PURCHASEORDERHISTORY } from '#cds-models/ZAPI_PURCHASE_ORDER_HISTORY_SRV';
import { ZI_PURCHASEORDERHISTORY_Repository } from '../repository/ZI_PURCHASEORDERHISTORY_Repository';
import { CostCenterData, OrderItemHistory } from '../util/types/types';

@ServiceLogic()
export class OrderItemsService {
  @Inject(OrderItemsRepository) private orderItemsRepository: OrderItemsRepository;
  @Inject(A_InternalOrderRepository) private internalOrderRepository: A_InternalOrderRepository;
  @Inject(A_PurchaseOrderItemRepository) private purchaseOrderItemRepository: A_PurchaseOrderItemRepository;
  @Inject(ZI_PURCHASEORDERHISTORY_Repository)
  private purchaseOrderHistoryRepository: ZI_PURCHASEORDERHISTORY_Repository;

  /**
   * Maps a purchase order item to an `OrderItem` object, retrieving additional data if necessary.
   *
   * @param orderItem - The purchase order item to be mapped to the `OrderItem` format.
   * @returns A promise that resolves to an `OrderItem` object with relevant fields populated.
   */
  private async mapOrderItem(orderItem: A_PurchaseOrderItem): Promise<OrderItem | undefined> {
    const costCenterData = (await this.getCostCenterData(orderItem)) as CostCenterData;
    const orderItemHistory = await this.fetchOrderItemHistory(orderItem);

    if (orderItemHistory.isFinallyInvoiced) {
      return;
    }

    let ID = '';
    if (orderItem.PurchaseOrder && orderItem.PurchaseOrderItem) {
      ID = orderItem.PurchaseOrder + orderItem.PurchaseOrderItem;
    }

    let openTotalAmount = 0;
    if (orderItem.NetPriceAmount && orderItem.OrderQuantity) {
      openTotalAmount = orderItem.NetPriceAmount * orderItem.OrderQuantity - orderItemHistory.totalInvoiceAmount;
    }

    let openTotalAmountEditable = 0;
    if (orderItem.NetPriceAmount && orderItem.OrderQuantity) {
      openTotalAmountEditable =
        orderItem.NetPriceAmount * orderItem.OrderQuantity - orderItemHistory.totalInvoiceAmount;
    }

    return {
      PurchaseOrder: orderItem.PurchaseOrder,
      PurchaseOrderItem: orderItem.PurchaseOrderItem,
      ID: ID,
      Supplier: orderItem.to_PurchaseOrder?.Supplier,
      SupplierText: orderItem.to_PurchaseOrder?.AddressName,
      PurchaseOrderItemText: orderItem.PurchaseOrderItemText,
      AccountAssignmentCategory: orderItem.AccountAssignmentCategory,
      OrderID: costCenterData.orderID,
      CostCenterID: costCenterData.costCenterID,
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
      TotalInvoiceAmount: orderItemHistory.totalInvoiceAmount,
      to_Orders_PurchaseOrder: orderItem.PurchaseOrder,
    };
  }

  /**
   * Fetches the history of the specified purchase order item.
   *
   * @param item - The purchase order item for which to fetch the history.
   * @returns A promise resolving to the order item history containing the total invoice amount and final invoicing status.
   */
  public async fetchOrderItemHistory(item: OrderItem | A_PurchaseOrderItem): Promise<OrderItemHistory> {
    let totalInvoiceAmount = 0;
    let isFinallyInvoiced = false;

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
        const i_PurchaseOrderItem = purchaseOrderHistory.to_PurchaseOrderItem;

        if (i_PurchaseOrderItem) {
          if (i_PurchaseOrderItem.IsFinallyInvoiced !== null && i_PurchaseOrderItem.IsFinallyInvoiced !== undefined) {
            isFinallyInvoiced = i_PurchaseOrderItem.IsFinallyInvoiced;
          }
        }

        if (purchaseOrderHistory.InvoiceAmtInCoCodeCrcy) {
          totalInvoiceAmount += parseFloat(purchaseOrderHistory.InvoiceAmtInCoCodeCrcy.toString());
        }
      });
    }

    console.log(isFinallyInvoiced);

    return { totalInvoiceAmount, isFinallyInvoiced };
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
      .getExpand('to_PurchaseOrder', 'to_AccountAssignment')
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
   * Writes or updates order items in the repository based on the given purchase order item.
   *
   * @param item - The purchase order item to be written or updated in the repository.
   * @returns A promise that resolves when the operation is complete.
   */
  public async writeOrderItem(item: A_PurchaseOrderItem): Promise<void> {
    const isNoInvestOrder =
      item.AccountAssignmentCategory !== constants.ACCOUNT_ASSIGNMENT_CATEGORY.INVEST_TYPE_1 &&
      item.AccountAssignmentCategory !== constants.ACCOUNT_ASSIGNMENT_CATEGORY.INVEST_TYPE_A;

    const existingOrderItem = await this.orderItemsRepository.findOne({
      PurchaseOrder: item.PurchaseOrder,
      PurchaseOrderItem: item.PurchaseOrderItem,
    });

    if (isNoInvestOrder) {
      if (existingOrderItem) {
        await this.updateOrderItem(existingOrderItem);
      } else {
        await this.addOrderItem(item);
      }
    }
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
  public async updateOrderItem(item: OrderItem) {
    if (item.PurchaseOrder && item.PurchaseOrderItem) {
      const newItem = await this.fetchPurchaseOrderItemByKey(item.PurchaseOrder, item.PurchaseOrderItem);

      if (newItem) {
        const costCenterData = (await this.getCostCenterData(newItem)) as CostCenterData;
        const orderItemHistory = await this.fetchOrderItemHistory(newItem);

        if (orderItemHistory.isFinallyInvoiced) {
          await this.removeOrderItem(item);
          return;
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
            OrderID: costCenterData.orderID,
            CostCenterID: costCenterData.costCenterID,
            TotalInvoiceAmount: orderItemHistory.totalInvoiceAmount,
            OpenTotalAmount: openTotalAmount,
            NetPriceAmount: newItem.NetPriceAmount,
            OrderQuantity: newItem.OrderQuantity,
          },
        );
      }
    }
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
   * Adds a new order item to the repository or updates it if it already exists.
   *
   * @param item - The order item entity fetched from the external repository.
   */
  public async addOrderItem(item: A_PurchaseOrderItem): Promise<void> {
    const mappedOrderItem = await this.mapOrderItem(item);

    if (mappedOrderItem) {
      await this.orderItemsRepository.updateOrCreate(mappedOrderItem);
    }
  }
}
