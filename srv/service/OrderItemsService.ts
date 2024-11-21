import { A_PurchaseOrderItem } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import { Context, OrderItem } from '#cds-models/ServiceAccruals';
import { Inject, ServiceLogic } from '@dxfrontier/cds-ts-dispatcher';
import { OrderItemsRepository } from '../repository/OrderItemsRepository';
import constants from '../util/constants/constants';
import { A_InternalOrderRepository } from '../repository/A_InternalOrderRepository';
import { A_PurchaseOrderItemRepository } from '../repository/A_PurchaseOrderItemRepository';
import { ZI_PURCHASEORDERHISTORY } from '#cds-models/ZAPI_PURCHASE_ORDER_HISTORY_SRV';
import { ZI_PURCHASEORDERHISTORY_Repository } from '../repository/ZI_PURCHASEORDERHISTORY_Repository';
import { ContextsRepository } from '../repository/ContextsRepository';

@ServiceLogic()
export class OrderItemsService {
  @Inject(OrderItemsRepository) private orderItemsRepository: OrderItemsRepository;
  @Inject(A_InternalOrderRepository) private internalOrderRepository: A_InternalOrderRepository;
  @Inject(A_PurchaseOrderItemRepository) private purchaseOrderItemRepository: A_PurchaseOrderItemRepository;
  @Inject(ZI_PURCHASEORDERHISTORY_Repository)
  private purchaseOrderHistoryRepository: ZI_PURCHASEORDERHISTORY_Repository;
  @Inject(ContextsRepository) private contextsRepository: ContextsRepository;

  /**
   * Maps a purchase order item to an `OrderItem` object, retrieving additional data if necessary.
   *
   * @param orderItem - The purchase order item to be mapped to the `OrderItem` format.
   * @returns A promise that resolves to an `OrderItem` object with relevant fields populated.
   */
  private async mapOrderItem(orderItem: A_PurchaseOrderItem): Promise<OrderItem> {
    let orderID: string | null | undefined = '';
    let costCenterID: string | null | undefined = '';

    switch (orderItem.AccountAssignmentCategory) {
      case constants.ACCOUNT_ASSIGNMENT_CATEGORY.ORDER: {
        if (!orderItem.to_AccountAssignment) {
          break;
        }

        orderID = orderItem.to_AccountAssignment[0].OrderID;
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
        costCenterID = orderItem.to_AccountAssignment![0].CostCenter;
        break;
      }
    }

    let ID = '';
    if (orderItem.PurchaseOrder && orderItem.PurchaseOrderItem) {
      ID = orderItem.PurchaseOrder + orderItem.PurchaseOrderItem;
    }

    const totalInvoiceAmount = await this.fetchTotalInvoiceAmount(orderItem);

    let openTotalAmount = 0;
    if (orderItem.NetPriceAmount && orderItem.OrderQuantity) {
      openTotalAmount = orderItem.NetPriceAmount * orderItem.OrderQuantity - totalInvoiceAmount;
    }

    let openTotalAmountEditable = 0;
    if (orderItem.NetPriceAmount && orderItem.OrderQuantity) {
      openTotalAmountEditable = orderItem.NetPriceAmount * orderItem.OrderQuantity;
    }

    return {
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
    };
  }

  /**
   * Fetches and calculates the total invoice amount for a given order item.
   *
   * @param item - The order item for which to fetch the total invoice amount.
   * @returns A promise that resolves to the total invoice amount as a number.
   */
  public async fetchTotalInvoiceAmount(item: OrderItem) {
    let totalInvoiceAmount = 0;

    const purchaseOrderHistories: ZI_PURCHASEORDERHISTORY[] | undefined =
      await this.purchaseOrderHistoryRepository.find({
        PurchaseOrder: item.PurchaseOrder,
        PurchaseOrderItem: item.PurchaseOrderItem,
        PurchasingHistoryCategory: 'Q',
      });

    if (purchaseOrderHistories?.length !== 0 && purchaseOrderHistories) {
      purchaseOrderHistories.forEach((purchaseOrderHistory) => {
        if (purchaseOrderHistory.InvoiceAmtInCoCodeCrcy) {
          totalInvoiceAmount += parseFloat(purchaseOrderHistory.InvoiceAmtInCoCodeCrcy.toString());
        }
      });
    }

    return totalInvoiceAmount;
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
   * Updates an existing order item by fetching the latest data and adding it to the repository.
   *
   * @param item - The `OrderItem` to be updated. It should include `PurchaseOrder` and `PurchaseOrderItem`.
   * @returns A promise that resolves once the order item is updated or if no update is performed.
   */
  public async updateOrderItem(item: OrderItem): Promise<void> {
    if (item.PurchaseOrder && item.PurchaseOrderItem) {
      const newItem = await this.fetchPurchaseOrderItemByKey(item.PurchaseOrder, item.PurchaseOrderItem);

      if (newItem) {
        let orderID: string | null | undefined = '';
        let costCenterID: string | null | undefined = '';

        switch (newItem.AccountAssignmentCategory) {
          case constants.ACCOUNT_ASSIGNMENT_CATEGORY.ORDER: {
            if (!newItem.to_AccountAssignment) {
              break;
            }

            orderID = newItem.to_AccountAssignment[0].OrderID;
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
            costCenterID = newItem.to_AccountAssignment![0].CostCenter;
            break;
          }
        }

        const totalInvoiceAmount = await this.fetchTotalInvoiceAmount(newItem);

        let openTotalAmount = 0;
        if (newItem.NetPriceAmount && newItem.OrderQuantity) {
          openTotalAmount = newItem.NetPriceAmount * newItem.OrderQuantity - totalInvoiceAmount;
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
            TotalInvoiceAmount: totalInvoiceAmount,
            OpenTotalAmount: openTotalAmount,
            NetPriceAmount: newItem.NetPriceAmount,
            OrderQuantity: newItem.OrderQuantity,
          },
        );
      }
    }
  }

  /**
   * Adds a new order item to the repository or updates it if it already exists.
   *
   * @param item - The order item entity fetched from the external repository.
   */
  public async addOrderItem(item: A_PurchaseOrderItem): Promise<void> {
    const mappedOrderItem: OrderItem = await this.mapOrderItem(item);

    await this.orderItemsRepository.updateOrCreate(mappedOrderItem);
  }
}
