import cds, { Request, Service, TypedRequest } from '@sap/cds';
import { CostCenter, SortOrder, UserContext } from '../types/types';
import { OrderItems, Orders } from '#cds-models/ServiceAccruals';
import constants from '../constants/constants';
import { A_PurchaseOrderItem } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import { A_CostCenter } from '#cds-models/API_COSTCENTER_SRV';

const util = {
  /**
   * Sorts an array of A_PurchaseOrderItem objects by a specified property in a given order.
   *
   * @param  array - The array of items to sort.
   * @param property - The property to sort the items by.
   * @param [order='asc'] - The sort order, either 'asc' for ascending or 'desc' for descending.
   * @returns  The sorted array of items.
   */
  sortArrayByProperty<A_PurchaseOrderItem>(
    array: A_PurchaseOrderItem[],
    property: keyof A_PurchaseOrderItem,
    order: SortOrder = 'asc',
  ): A_PurchaseOrderItem[] {
    return array.sort((a, b) => {
      const propA = a[property];
      const propB = b[property];

      if (propA < propB) {
        return order === 'asc' ? -1 : 1;
      } else if (propA > propB) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  },

  async getCostCenters(user: string) {
    const externalServiceCostCenter = await cds.connect.to(constants.API.COSTCENTER);
    const { A_CostCenter } = externalServiceCostCenter.entities;
    const today: string = new Date().toISOString().substring(0, 10);

    try {
      const masterData: A_CostCenter[] = await externalServiceCostCenter.run(
        SELECT.from(A_CostCenter)
          .where({ CostCtrResponsibleUser: user })
          .and({ ValidityStartDate: { le: today } })
          .and({ ValidityEndDate: { ge: today } }),
      );

      return this.mapCostCenters(masterData, user);
    } catch (error) {
      console.log(error);
    }
  },

  mapCostCenters(costCenter: A_CostCenter[], userID: string) {
    const mappedCostCenters: CostCenter[] = [];

    costCenter.forEach((costCenter) => {
      if (costCenter.CostCenter) {
        mappedCostCenters.push({
          CostCenter: costCenter.CostCenter,
          to_Contexts: userID,
        });
      }
    });

    return mappedCostCenters;
  },

  /**
   * Asynchronously retrieves the user context from the HR master service based on the user's email.
   *
   * @param req - The request object containing user information.
   * @returns A promise that resolves to the user context containing user details.
   */
  async getUserContext(req: Request): Promise<UserContext> {
    const externalServiceHrMaster = await cds.connect.to(constants.API.HR_MASTER);
    const { ZC_HR_MASTER } = externalServiceHrMaster.entities;

    // let UserId = '';
    // if (req.user.id) {
    //   UserId = req.user.id;
    // }

    // let FamilyName = '';
    // if (req.user.attr.familyName) {
    //   FamilyName = req.user.attr.familyName;
    // }

    // let GivenName = '';
    // if (req.user.attr.givenName) {
    //   GivenName = req.user.attr.givenName;
    // }

    // ! enable for local testing
    // to prevent @typescript-eslint/no-unused-vars
    console.log(req);
    const UserId = 'christoph.doeringer@abs-gmbh.de';
    const FamilyName = 'Döringer';
    const GivenName = 'Christoph';

    try {
      const masterData = await externalServiceHrMaster.run(
        SELECT.from(ZC_HR_MASTER).where({ EmailLower: UserId.toLowerCase() }),
      );

      if (masterData?.length == 1) {
        // const costCenters = await this.getCostCenters(masterData[0].Bname);

        // ! enable for local testing
        const costCenters = await this.getCostCenters('BERGER.HAR');

        if (costCenters) {
          return {
            UserId: UserId,
            FamilyName: FamilyName,
            GivenName: GivenName,
            SapUser: masterData[0].Bname,
            to_CostCenters: costCenters,
          };
        }
      }
    } catch (error) {
      console.log(error);
    }

    return {
      UserId: UserId,
      FamilyName: '',
      GivenName: '',
      SapUser: '',
      to_CostCenters: [],
    };
  },

  /**
   * Asynchronously fetches purchase order items from the S4 Purchase Order API
   * based on the requisitioner's name from the user context.
   *
   * @param s4PurchaseOrderApi - The S4 Purchase Order API service instance.
   * @param context - The user context containing user details.
   * @returns A promise that resolves to an array of purchase order items.
   */
  async fetchPurchaseOrderItems(s4PurchaseOrderApi: Service, context: UserContext) {
    const { A_PurchaseOrderItem } = s4PurchaseOrderApi.entities;

    const oDataPurchaseOrderItems: A_PurchaseOrderItem[] = await s4PurchaseOrderApi.run(
      SELECT.from(A_PurchaseOrderItem)
        .columns((item) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          item('*'), item.to_PurchaseOrder('*'), item.to_AccountAssignment('*');
        })
        .where({ RequisitionerName: context.SapUser }),
    );

    return Array.from(util.sortArrayByProperty(oDataPurchaseOrderItems, 'PurchaseOrder', 'desc'));
  },

  /**
   * Asynchronously retrieves purchase order items by connecting to the S4 Purchase Order API
   * and using the user's context to filter the results.
   *
   * @param req - The request object containing criteria for fetching order items.
   * @returns A promise that resolves to an array of purchase order items.
   */
  async getPurchaseOrderItems(req: TypedRequest<OrderItems | Orders>) {
    const s4PurchaseOrderApi: Service = await cds.connect.to(constants.API.PURCHASEORDER);
    const context: UserContext = await util.getUserContext(req);
    return await util.fetchPurchaseOrderItems(s4PurchaseOrderApi, context);
  },

  /**
   * Asynchronously filters the provided purchase order items to return only those created in the current year.
   *
   * @param  purchaseOrderItemsAll - An array of all purchase order items to filter.
   * @returns A promise that resolves to an array of purchase order items created in the current year.
   */
  async filterOrderItemsByCurrentYear(purchaseOrderItemsAll: A_PurchaseOrderItem[]) {
    const currentYear: string = new Date().getFullYear().toString();

    const purchaseOrderItems: A_PurchaseOrderItem[] = [];

    for await (const purchaseOrderItem of purchaseOrderItemsAll) {
      if (purchaseOrderItem.to_PurchaseOrder?.CreationDate?.includes(currentYear)) {
        purchaseOrderItems.push(purchaseOrderItem);
      }
    }

    return purchaseOrderItems;
  },

  /**
   * Asynchronously retrieves purchase order items and filters them to return only those created in the current year.
   *
   * @param req - The request object containing criteria for fetching order items.
   * @returns A promise that resolves to an array of purchase order items from the current year.
   */
  async getPurchaseOrderItemsForCurrentYear(req: TypedRequest<OrderItems | Orders>) {
    const purchaseOrderItemsAll: A_PurchaseOrderItem[] = await util.getPurchaseOrderItems(req);

    const purchaseOrderItemsCurrentYear: A_PurchaseOrderItem[] =
      await util.filterOrderItemsByCurrentYear(purchaseOrderItemsAll);

    return purchaseOrderItemsCurrentYear;
  },

  /**
   * Asynchronously retrieves the responsible cost center for a given internal order from the external service.
   *
   * @param orderID - The internal order ID to look up.
   * @returns A promise that resolves to the responsible cost center, or an empty string if not found.
   */
  async getInternalOrder(orderID: string): Promise<string> {
    const externalServiceInternalOrder = await cds.connect.to(constants.API.INTERNALORDER);

    const { A_InternalOrder } = externalServiceInternalOrder.entities;

    try {
      const internalOrder = await externalServiceInternalOrder.run(
        SELECT.from(A_InternalOrder).where({ InternalOrder: orderID.toLowerCase() }),
      );

      if (internalOrder?.length == 1) {
        return internalOrder[0].ResponsibleCostCenter;
      }
    } catch (error) {
      console.log(error);
    }

    return '';
  },
};

export default util;
