import cds, { Request, Service, TypedRequest } from '@sap/cds';
import { SortOrder, UserContext } from '../types/types';
import { OrderItems, Orders } from '#cds-models/ServiceAccruals';
import constants from '../constants/constants';
import { A_PurchaseOrderItem } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';

const util = {
  /**
   * Sorts an array of A_PurchaseOrderItem objects by a specified property in a given order.
   *
   * @param {A_PurchaseOrderItem[]} array - The array of items to sort.
   * @param {keyof A_PurchaseOrderItem} property - The property to sort the items by.
   * @param {SortOrder} [order='asc'] - The sort order, either 'asc' for ascending or 'desc' for descending.
   * @returns {A_PurchaseOrderItem[]} The sorted array of items.
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

  /**
   * Asynchronously retrieves the user context from the HR master service based on the user's email.
   *
   * @param {Request} req - The request object containing user information.
   * @returns {Promise<UserContext>} A promise that resolves to the user context containing user details.
   */
  async getUserContext(req: Request): Promise<UserContext> {
    const externalServiceHrMaster = await cds.connect.to(constants.API.HR_MASTER);
    const { ZC_HR_MASTER } = externalServiceHrMaster.entities;

    const user = req.user.id;

    // ! enable for local testing
    // let user = req.user.id;
    // user = 'christoph.doeringer@abs-gmbh.de';

    try {
      const masterData = await externalServiceHrMaster.run(
        SELECT.from(ZC_HR_MASTER).where({ EmailLower: user.toLowerCase() }),
      );

      if (masterData?.length == 1) {
        return {
          UserId: user,
          SapUser: masterData[0].Bname,
          CostCenter: masterData[0].Kostl,
          CostCenterName: masterData[0].Ktext,
        };
      }
    } catch (error) {
      console.log(error);
    }

    return {
      UserId: user,
      SapUser: '',
      CostCenter: '',
      CostCenterName: '',
    };
  },

  /**
   * Asynchronously fetches purchase order items from the S4 Purchase Order API
   * based on the requisitioner's name from the user context.
   *
   * @param {Service} s4PurchaseOrderApi - The S4 Purchase Order API service instance.
   * @param {UserContext} context - The user context containing user details.
   * @returns {Promise<A_PurchaseOrderItem[]>} A promise that resolves to an array of purchase order items.
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

    // TODO: check repository with external services
    // const purchaseOrderItems = await this.a_PurchaseOrderItemRepository
    //   .builder()
    //   .find({ RequisitionerName: context.SapUser })
    //   .orderDesc('PurchaseOrder')
    //   .getExpand('to_PurchaseOrder', 'to_AccountAssignment')
    //   .execute();

    // if (purchaseOrderItems) {
    //   return purchaseOrderItems;
    // } else {
    //   return [];
    // }
  },

  /**
   * Asynchronously retrieves purchase order items by connecting to the S4 Purchase Order API
   * and using the user's context to filter the results.
   *
   * @param {TypedRequest<OrderItems | Orders>} req - The request object containing criteria for fetching order items.
   * @returns {Promise<A_PurchaseOrderItem[]>} A promise that resolves to an array of purchase order items.
   */
  async getPurchaseOrderItems(req: TypedRequest<OrderItems | Orders>) {
    const s4PurchaseOrderApi: Service = await cds.connect.to(constants.API.PURCHASEORDER);
    const context: UserContext = await util.getUserContext(req);
    return await util.fetchPurchaseOrderItems(s4PurchaseOrderApi, context);
  },

  /**
   * Asynchronously filters the provided purchase order items to return only those created in the current year.
   *
   * @param {A_PurchaseOrderItem[]} purchaseOrderItemsAll - An array of all purchase order items to filter.
   * @returns {Promise<A_PurchaseOrderItem[]>} A promise that resolves to an array of purchase order items created in the current year.
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
   * @param {TypedRequest<OrderItems | Orders>} req - The request object containing criteria for fetching order items.
   * @returns {Promise<A_PurchaseOrderItem[]>} A promise that resolves to an array of purchase order items from the current year.
   */
  async getPurchaseOrderItemsForCurrentYear(req: TypedRequest<OrderItems | Orders>) {
    const purchaseOrderItemsAll: A_PurchaseOrderItem[] = await util.getPurchaseOrderItems(req);

    const purchaseOrderItemsCurrentYear: A_PurchaseOrderItem[] =
      await util.filterOrderItemsByCurrentYear(purchaseOrderItemsAll);

    return purchaseOrderItemsCurrentYear;
  },
};

export default util;
