/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request } from '@sap/cds';
import { CostCenter, UserContext } from '../types/types';
import { A_PurchaseOrderItem } from '#cds-models/API_PURCHASEORDER_PROCESS_SRV';
import { A_CostCenter } from '#cds-models/API_COSTCENTER_SRV';

const util = {
  /**
   * Retrieves the current date in ISO format (`YYYY-MM-DD`).
   *
   * @returns The current date as a string in `YYYY-MM-DD` format.
   */
  getCurrentDate(): string {
    return new Date().toISOString().substring(0, 10);
  },

  /**
   * Retrieves the current year as a string.
   *
   * @returns The current year as a string (e.g., "2024").
   */
  getCurrentYear(): string {
    return new Date().getFullYear().toString();
  },

  /**
   * Retrieves the last year as a string.
   *
   * @returns The current year as a string (e.g., "2023").
   */
  getLastYear(): string {
    const lastYear: number = new Date().getFullYear() - 1;
    return lastYear.toString();
  },

  /**
   * Maps an array of cost centers to a format compatible with the `CostCenter` model.
   *
   * @param costCenter - An array of cost center objects to be mapped to the `CostCenter` model format.
   * @param sapUser - The SAP user ID to associate with each cost center.
   * @returns An array of `CostCenter` objects, each containing a `CostCenter` and the linked `to_Contexts`.
   */
  mapCostCenters(costCenter: A_CostCenter[], sapUser: string): CostCenter[] {
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
   * Maps user and request details into a user context object.
   *
   * @param req - The request object containing user data and additional attributes.
   * @param sapUser - The SAP user ID associated with the current user.
   * @param costCenters - An array of `CostCenter` objects to link to the user context.
   * @returns A user context object with mapped user details and associated cost centers.
   */
  mapUserContext(req: Request, sapUser: string, costCenters: CostCenter[]): UserContext[] {
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

    return [
      {
        UserId: userId,
        FamilyName: familyName,
        GivenName: givenName,
        SapUser: sapUser,
        to_CostCenters: costCenters,
      },
    ];
  },

  /**
   * Asynchronously filters the provided purchase order items to return only those created in the current and in the last year.
   *
   * @param  purchaseOrderItemsAll - An array of all purchase order items to filter.
   * @returns A promise that resolves to an array of purchase order items created in the current year.
   */
  async filterOrderItemsByYear(purchaseOrderItemsAll: A_PurchaseOrderItem[]): Promise<A_PurchaseOrderItem[]> {
    const purchaseOrderItems: A_PurchaseOrderItem[] = [];
    const currentYear = this.getCurrentYear();
    const lastYear = this.getLastYear();

    for await (const purchaseOrderItem of purchaseOrderItemsAll) {
      if (
        purchaseOrderItem.to_PurchaseOrder?.CreationDate?.includes(currentYear) ||
        purchaseOrderItem.to_PurchaseOrder?.CreationDate?.includes(lastYear)
      ) {
        purchaseOrderItems.push(purchaseOrderItem);
      }
    }

    return purchaseOrderItems;
  },

  /**
   * Creates a shallow copy of the provided array and clears the original array.
   *
   * @param array - The array to be copied and cleared.
   * @returns A shallow copy of the input array.
   */
  deepCopyArray(array: any[]): any[] {
    const copyArray: any[] = [...array];
    array.length = 0;
    return copyArray;
  },
};

export default util;
