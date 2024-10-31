import { Request } from '@sap/cds';
import { CostCenter } from '../types/types';
import { A_PurchaseOrderItem } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import { A_CostCenter } from '#cds-models/API_COSTCENTER_SRV';
import { CdsDate } from '#cds-models/_';

const util = {
  /**
   * The current date in `YYYY-MM-DD` format.
   */
  currentDate: new Date().toISOString().substring(0, 10),

  /**
   * The current year as a string.
   */
  currentYear: new Date().getFullYear().toString(),

  /**
   * Maps an array of cost centers to a format compatible with the `CostCenter` model.
   *
   * @param costCenter - An array of cost center objects to be mapped to the `CostCenter` model format.
   * @param sapUser - The SAP user ID to associate with each cost center.
   * @returns An array of `CostCenter` objects, each containing a `CostCenter` and the linked `to_Contexts`.
   */
  mapCostCenters(costCenter: A_CostCenter[], sapUser: string) {
    const mappedCostCenters: CostCenter[] = [];

    costCenter.forEach((costCenter) => {
      if (costCenter.CostCenter) {
        mappedCostCenters.push({
          CostCenter: costCenter.CostCenter,
          to_Contexts: sapUser,
        });
      }
    });

    return mappedCostCenters;
  },

  /**
   * Converts the current date to a string formatted as 'YYYY-MM-DD'.
   *
   * @returns The date as a string in the format 'YYYY-MM-DD'.
   */
  getDateAsCDSDate(): CdsDate {
    return `${parseInt(this.currentDate.charAt(0))}${parseInt(this.currentDate.charAt(1))}${parseInt(this.currentDate.charAt(2))}${parseInt(this.currentDate.charAt(3))}-${parseInt(this.currentDate.charAt(5))}${parseInt(this.currentDate.charAt(6))}-${parseInt(this.currentDate.charAt(8))}${parseInt(this.currentDate.charAt(9))}`;
  },

  /**
   * Maps user and request details into a user context object.
   *
   * @param req - The request object containing user data and additional attributes.
   * @param sapUser - The SAP user ID associated with the current user.
   * @param costCenters - An array of `CostCenter` objects to link to the user context.
   * @returns A user context object with mapped user details and associated cost centers.
   */
  mapUserContext(req: Request, sapUser: string, costCenters: CostCenter[]) {
    let userId = '';
    if (req.user.id) {
      userId = req.user.id;
    }

    let familyName = '';
    if (req.user.attr.familyName) {
      familyName = req.user.attr.familyName;
    }

    let givenName = '';
    if (req.user.attr.givenName) {
      givenName = req.user.attr.givenName;
    }

    // ! for local testing
    // console.log(req);
    // const userId = 'christoph.doeringer@abs-gmbh.de';
    // const familyName = 'Döringer';
    // const givenName = 'Christoph';

    return {
      UserId: userId,
      FamilyName: familyName,
      GivenName: givenName,
      SapUser: sapUser,
      to_CostCenters: costCenters,
    };
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
};

export default util;
