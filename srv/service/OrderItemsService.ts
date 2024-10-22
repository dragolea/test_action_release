import { A_PurchaseOrderItem } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import { OrderItem, OrderItems, Orders } from '#cds-models/ServiceAccruals';
import { Inject, ServiceLogic, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import util from '../util/helpers/util';
import { OrderItemsRepository } from '../repository/OrderItemsRepository';
import constants from '../util/constants/constants';

@ServiceLogic()
export class OrderItemsService {
  @Inject(OrderItemsRepository) private orderItemsRepository: OrderItemsRepository;

  /**
   * Maps an A_PurchaseOrderItem to a corresponding OrderItem object,
   * setting various properties including account assignment details.
   *
   * @param {A_PurchaseOrderItem} orderItem - The purchase order item to map.
   * @returns {OrderItem} The mapped order item with relevant properties.
   */
  private async mapOrderItem(orderItem: A_PurchaseOrderItem): Promise<OrderItem> {
    let orderID: string | null | undefined = '';
    let costCenterID: string | null | undefined = '';

    if (orderItem.AccountAssignmentCategory === 'F') {
      orderID = orderItem.to_AccountAssignment![0].OrderID;

      if (orderID) {
        costCenterID = await util.getInternalOrder(orderID);
      }
    } else if (orderItem.AccountAssignmentCategory === 'K') {
      costCenterID = orderItem.to_AccountAssignment![0].CostCenter;
    }

    return {
      PurchaseOrder: orderItem.PurchaseOrder,
      PurchaseOrderItem: orderItem.PurchaseOrderItem,
      Supplier: orderItem.to_PurchaseOrder?.Supplier,
      SupplierText: orderItem.to_PurchaseOrder?.AddressName,
      PurchaseOrderItemText: orderItem.PurchaseOrderItemText,
      AccountAssignmentCategory: orderItem.AccountAssignmentCategory,
      OrderID: orderID,
      CostCenterID: costCenterID,
      OpenTotalAmount: orderItem.NetPriceAmount,
      OpenTotalAmountEditable: orderItem.NetPriceAmount,
      NodeID: null,
      HierarchyLevel: null,
      ParentNodeID: null,
      DrillState: null,
      ProcessingState_code: constants.ProcessingState.USER,
      // Checked: false,
      ApprovedByCCR: false,
      ApprovedByCON: false,
      ApprovedByACC: false,
      Requester: orderItem.RequisitionerName,
      to_Orders_PurchaseOrder: orderItem.PurchaseOrder,
    };
  }

  /**
   * Asynchronously writes order items to the repository,
   * mapping each item from the current year and creating it if it does not already exist.
   *
   * @param {TypedRequest<OrderItems | Orders>} req - The request containing the order items to process.
   */
  public async writeOrderItems(req: TypedRequest<OrderItems | Orders>) {
    const orderItems: A_PurchaseOrderItem[] = (await util.getPurchaseOrderItemsForCurrentYear(
      req,
    )) as A_PurchaseOrderItem[];

    for (const orderItem of orderItems) {
      const foundOrderItem = await this.orderItemsRepository.exists({
        PurchaseOrder: orderItem.PurchaseOrder,
        PurchaseOrderItem: orderItem.PurchaseOrderItem,
      });

      if (!foundOrderItem) {
        const mappedOrderItem: OrderItem = await this.mapOrderItem(orderItem);
        await this.orderItemsRepository.updateOrCreate(mappedOrderItem);
      }
    }
  }
}
