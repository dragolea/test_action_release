/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  EntityHandler,
  Inject,
  Req,
  Results,
  Service,
  CDS_DISPATCHER,
  type TypedRequest,
  AfterRead,
} from '@dxfrontier/cds-ts-dispatcher';
import cds from '@sap/cds';
import { Order, Orders } from '../../../../@cds-models/ServiceAccruals';
import constants from '../../../util/constants/constants';
import util from '../../../util/helpers/util';

@EntityHandler(Orders)
export class OrdersHandler {
  @Inject(CDS_DISPATCHER.SRV) private readonly srv: Service;

  @AfterRead()
  public async afterRead(@Results() results: Orders, @Req() req: TypedRequest<Orders>) {
    results = await this.handleOrders(results, req);

    return results;
  }

  private async handleOrders(results: Orders, @Req() req: TypedRequest<Orders>) {
    const oDataPurchaseOrderItems: any = await this.getPurchaseOrderItems(req);

    const currentYear = new Date().getFullYear();

    for await (const oDataOrderPurchaseItem of oDataPurchaseOrderItems) {
      if (oDataOrderPurchaseItem.to_PurchaseOrder.CreationDate.includes(currentYear)) {
        const existingPurchaseOrder = results.find(
          (result) => result.PurchaseOrder === oDataOrderPurchaseItem.PurchaseOrder && result.PurchaseOrderItem === '',
        );

        if (existingPurchaseOrder) {
          this.updatePurchaseOrderInJSONData(existingPurchaseOrder, oDataOrderPurchaseItem);
        } else {
          this.addPurchaseOrderToJSONData(results, oDataOrderPurchaseItem);
        }
      }
    }

    return results;
  }

  private async getContexts(@Req() req: TypedRequest<Orders>) {
    const s4HrMasterApi = await cds.connect.to(constants.API.HR_MASTER);
    const { ZC_HR_MASTER } = s4HrMasterApi.entities;

    let user = req.user.id;

    // ! just for testing purposes
    user = 'alexa.ferrenberg@freudenberg.com';

    try {
      const oDataMasterData = await s4HrMasterApi.run(
        SELECT.from(ZC_HR_MASTER).where({ EmailLower: user.toLowerCase() }),
      );

      if (oDataMasterData?.length == 1) {
        return {
          UserId: user,
          SapUser: oDataMasterData[0].Bname,
          CostCenter: oDataMasterData[0].Kostl,
          CostCenterName: oDataMasterData[0].Ktext,
        };
      }
    } catch (error) {
      console.log(error);
    }

    return {
      UserId: user,
      SapUser: null,
      CostCenter: null,
      CostCenterName: null,
    };
  }

  private async getPurchaseOrderItems(req: TypedRequest<Orders>) {
    const s4PurchaseOrderApi: Service = await cds.connect.to(constants.API.PURCHASEORDER);

    const { A_PurchaseOrderItem } = s4PurchaseOrderApi.entities;

    const context = await this.getContexts(req);

    const oDataPurchaseOrderItems = await s4PurchaseOrderApi.run(
      SELECT.from(A_PurchaseOrderItem)
        .columns((item) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          item('*'), item.to_PurchaseOrder('*'), item.to_AccountAssignment('*');
        })
        .where({ RequisitionerName: context.SapUser }),
    );

    return Array.from(util.sortArrayByProperty(oDataPurchaseOrderItems, 'PurchaseOrder', 'desc'));
  }

  private addPurchaseOrderToJSONData(results: Orders, oDataOrderPurchaseItem: any) {
    results.push({
      PurchaseOrder: oDataOrderPurchaseItem.PurchaseOrder,
      PurchaseOrderItem: '',
      Supplier: oDataOrderPurchaseItem.to_PurchaseOrder.Supplier,
      SupplierText: oDataOrderPurchaseItem.to_PurchaseOrder.AddressName,
      PurchaseOrderItemText: '',
      AccountAssignmentCategory: '',
      AccountAssignmentCategoryText: '',
      OpenTotalAmount: null,
      OpenTotalAmountEditable: null,
      NodeID: oDataOrderPurchaseItem.PurchaseOrder,
      HierarchyLevel: 0,
      ParentNodeID: null,
      DrillState: 'expanded',
      IsOrder: true,
      to_PurchaseOrderItems: [
        {
          PurchaseOrder: oDataOrderPurchaseItem.PurchaseOrder,
          PurchaseOrderItem: oDataOrderPurchaseItem.PurchaseOrderItem,
          Supplier: oDataOrderPurchaseItem.to_PurchaseOrder.Supplier,
          SupplierText: oDataOrderPurchaseItem.to_PurchaseOrder.AddressName,
          PurchaseOrderItemText: oDataOrderPurchaseItem.PurchaseOrderItemText,
          AccountAssignmentCategory: oDataOrderPurchaseItem.AccountAssignmentCategory,
          AccountAssignmentCategoryText:
            oDataOrderPurchaseItem.AccountAssignmentCategory === 'F'
              ? oDataOrderPurchaseItem.to_AccountAssignment[0].OrderID
              : oDataOrderPurchaseItem.AccountAssignmentCategory === 'K'
                ? oDataOrderPurchaseItem.to_AccountAssignment[0].CostCenter
                : '',
          OpenTotalAmount: oDataOrderPurchaseItem.NetPriceAmount,
          OpenTotalAmountEditable: oDataOrderPurchaseItem.NetPriceAmount,
          NodeID: `${oDataOrderPurchaseItem.PurchaseOrder}${oDataOrderPurchaseItem.PurchaseOrderItem}`,
          HierarchyLevel: 1,
          ParentNodeID: oDataOrderPurchaseItem.PurchaseOrder,
          DrillState: 'leaf',
          IsOrder: false,
        },
      ],
    });
  }

  private updatePurchaseOrderInJSONData(existingPurchaseOrder: Order, oDataOrderPurchaseItem: any) {
    existingPurchaseOrder.to_PurchaseOrderItems?.push({
      PurchaseOrder: oDataOrderPurchaseItem.PurchaseOrder,
      PurchaseOrderItem: oDataOrderPurchaseItem.PurchaseOrderItem,
      Supplier: oDataOrderPurchaseItem.to_PurchaseOrder.Supplier,
      SupplierText: oDataOrderPurchaseItem.to_PurchaseOrder.AddressName,
      PurchaseOrderItemText: oDataOrderPurchaseItem.PurchaseOrderItemText,
      AccountAssignmentCategory: oDataOrderPurchaseItem.AccountAssignmentCategory,
      AccountAssignmentCategoryText:
        oDataOrderPurchaseItem.AccountAssignmentCategory === 'F'
          ? oDataOrderPurchaseItem.to_AccountAssignment[0].OrderID
          : oDataOrderPurchaseItem.AccountAssignmentCategory === 'K'
            ? oDataOrderPurchaseItem.to_AccountAssignment[0].CostCenter
            : '',
      OpenTotalAmount: oDataOrderPurchaseItem.NetPriceAmount,
      OpenTotalAmountEditable: oDataOrderPurchaseItem.NetPriceAmount,
      NodeID: `${oDataOrderPurchaseItem.PurchaseOrder}${oDataOrderPurchaseItem.PurchaseOrderItem}`,
      HierarchyLevel: 1,
      ParentNodeID: oDataOrderPurchaseItem.PurchaseOrder,
      DrillState: 'leaf',
      IsOrder: false,
    });
  }
}
