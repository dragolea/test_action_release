import { A_PurchaseOrderItem } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import { OrderItem } from '#cds-models/ServiceAccruals';
import { Inject, Request, ServiceLogic } from '@dxfrontier/cds-ts-dispatcher';
import util from '../util/helpers/util';
import { OrderItemsRepository } from '../repository/OrderItemsRepository';
import constants from '../util/constants/constants';
import { A_InternalOrderRepository } from '../repository/A_InternalOrderRepository';
import { CostCenter, UserContext } from '../util/types/types';
import { A_PurchaseOrderItemRepository } from '../repository/A_PurchaseOrderItemRepository';
import { ZC_HR_MASTER_Repository } from '../repository/ZC_HR_MASTER_Repository';
import { A_CostCenterRepository } from '../repository/A_CostCenterRepository';
import { Filter } from '@dxfrontier/cds-ts-repository';
import { A_CostCenter } from '#cds-models/API_COSTCENTER_SRV';
import { ZC_HR_MASTER } from '#cds-models/ZC_HR_MASTER_CDS';
import { ZI_PURCHASEORDERHISTORY } from '#cds-models/ZAPI_PURCHASE_ORDER_HISTORY_SRV';
import { ZI_PURCHASEORDERHISTORY_Repository } from '../repository/ZI_PURCHASEORDERHISTORY_Repository';

@ServiceLogic()
export class OrderItemsService {
  @Inject(OrderItemsRepository) private orderItemsRepository: OrderItemsRepository;
  @Inject(A_InternalOrderRepository) private internalOrderRepository: A_InternalOrderRepository;
  @Inject(A_PurchaseOrderItemRepository) private purchaseOrderItemRepository: A_PurchaseOrderItemRepository;
  @Inject(ZC_HR_MASTER_Repository) private ZC_HR_MASTER_Repository: ZC_HR_MASTER_Repository;
  @Inject(A_CostCenterRepository) private costCenterRepository: A_CostCenterRepository;
  @Inject(ZI_PURCHASEORDERHISTORY_Repository)
  private purchaseOrderHistoryRepository: ZI_PURCHASEORDERHISTORY_Repository;

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
      CreationDate: util.getDateAsCDSDate(),
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
  public async fetchPurchaseOrderItems(context: UserContext): Promise<A_PurchaseOrderItem[] | undefined> {
    return await this.purchaseOrderItemRepository
      .builder()
      .find({ RequisitionerName: context.SapUser })
      .getExpand('to_PurchaseOrder', 'to_AccountAssignment')
      .orderDesc('PurchaseOrder')
      .execute();
  }

  /**
   * Retrieves user context information based on the provided user ID.
   *
   * @param userId - The user ID (email) used to retrieve the user context.
   * @returns A promise that resolves to the user context if found; otherwise, returns undefined.
   */
  public async fetchUserContext(userId: string): Promise<ZC_HR_MASTER | undefined> {
    return await this.ZC_HR_MASTER_Repository.findOne({ EmailLower: userId.toLowerCase() });
  }

  /**
   * Retrieves cost centers for a given user, filtered by validity dates.
   *
   * @param userName - The username used to filter cost centers by responsible person.
   * @returns A promise that resolves to an array of cost centers satisfying the filter criteria.
   */
  public async fetchCostCenters(userName: string): Promise<A_CostCenter[] | undefined> {
    const filterByValidityStartDate = new Filter<A_CostCenter>({
      field: 'ValidityStartDate',
      operator: 'LESS THAN OR EQUALS',
      value: util.getCurrentDate(),
    });

    const filterByValidityEndDate = new Filter<A_CostCenter>({
      field: 'ValidityEndDate',
      operator: 'GREATER THAN OR EQUALS',
      value: util.getCurrentDate(),
    });

    const filterByCostCtrResponsibleUser = new Filter<A_CostCenter>({
      field: 'CostCtrResponsibleUser',
      operator: 'EQUALS',
      value: userName,
    });

    const filters = new Filter(
      'AND',
      filterByValidityStartDate,
      filterByValidityEndDate,
      filterByCostCtrResponsibleUser,
    );

    return this.costCenterRepository.find(filters);
  }

  /**
   * Retrieves and maps the user context, including cost center information, based on the request data.
   *
   * @param req - The request object containing user data for retrieving the context.
   * @returns The mapped user context, or rejects the request if data is not found.
   */
  public async fetchContext(req: Request): Promise<UserContext[] | undefined> {
    const masterData = await this.fetchUserContext(req.user.id);

    if (!masterData || !masterData.Bname) {
      req.reject(400, 'masterData not found');
      return;
    }

    const costCentersData = await this.fetchCostCenters(masterData.Bname);

    if (!costCentersData) {
      req.reject(400, 'costCentersData not found');
      return;
    }

    const mappedCostCenters: CostCenter[] = util.mapCostCenters(costCentersData, masterData.Bname);

    return util.mapUserContext(req, masterData.Bname, mappedCostCenters);
  }

  /**
   * Processes and writes purchase order items to the repository if they are not already present.
   *
   * @param req - The request object containing the data and user information for processing.
   */
  public async writeOrderItems(req: Request): Promise<void> {
    const context: UserContext[] | undefined = await this.fetchContext(req);

    if (!context || context.length === 0) {
      req.reject(400, 'Context not found');
      return;
    }

    const orderItems: A_PurchaseOrderItem[] | undefined = await this.fetchPurchaseOrderItems(context[0]);

    if (orderItems) {
      const filteredOrderItems: A_PurchaseOrderItem[] = await util.filterOrderItemsByCurrentYear(orderItems);

      for (const item of filteredOrderItems) {
        const found = await this.orderItemsRepository.exists({
          PurchaseOrder: item.PurchaseOrder,
          PurchaseOrderItem: item.PurchaseOrderItem,
        });

        if (!found) {
          const mappedOrderItem: OrderItem = await this.mapOrderItem(item);
          await this.orderItemsRepository.updateOrCreate(mappedOrderItem);
        }
      }
    }
  }
}
