import BaseController from './BaseController';
import JSONModel from 'sap/ui/model/json/JSONModel';
import Event from 'sap/ui/base/Event';
import View from 'sap/ui/core/mvc/View';
import { Order } from '../../../../@cds-models/ServiceAccruals';
import ContextBinding from 'sap/ui/model/ContextBinding';
import Context from 'sap/ui/model/odata/v4/Context';
import ODataListBinding from 'sap/ui/model/odata/v4/ODataListBinding';
import UI5Element from 'sap/ui/core/Element';
import constants from '../util/constants/constants';

/**
 * @namespace de.freudenberg.fco.accruals.controller
 */
export default class PurchaseOrdersOverview extends BaseController {
  private jsonModel: JSONModel;
  private view: View;
  private purchaseOrders: Order[] = [];

  /**
   * Updates a specific property of a bound context at the given path with a new value.
   *
   * @param {string} path - The binding path to the context.
   * @param {string} property - The property to update.
   * @param {string} value - The new value to set for the property.
   * @returns {void} This function does not return a value.
   */
  private updateProperty(path: string, property: string, value: string): void {
    const contextBinding: ContextBinding = this.getModel()?.bindContext(path) as ContextBinding;
    const context = contextBinding.getBoundContext() as Context;
    context.setProperty(property, value);
  }

  /**
   * Creates a JSON model from the current contexts of the event's data source and sets it with the purchase order data.
   *
   * @param {Event} event - The event providing the data source for the current contexts.
   */
  private createJSONModel(event: Event) {
    const contexts: Context[] = (event.getSource() as ODataListBinding).getCurrentContexts();

    this.setupPurchaseOrdersForJSON(contexts);
    this.jsonModel.setData(this.purchaseOrders);
  }

  /**
   * Prepares purchase order data by setting NodeID and ParentNodeID for each order and its items,
   * then stores them in the purchaseOrders array.
   *
   * @param {Context[]} contexts - An array of contexts containing purchase order data.
   */
  private setupPurchaseOrdersForJSON(contexts: Context[]): void {
    this.purchaseOrders = [];

    contexts.forEach((purchaseOrder) => {
      const purchaseOrderObject: Order = purchaseOrder.getObject();

      purchaseOrderObject.to_OrderItems?.forEach((item) => {
        if (item.PurchaseOrder && item.PurchaseOrderItem) {
          item.NodeID = item.PurchaseOrder + item.PurchaseOrderItem;
          item.ParentNodeID = item.PurchaseOrder;
        }
      });

      if (purchaseOrderObject.PurchaseOrder) {
        purchaseOrderObject.NodeID = purchaseOrderObject.PurchaseOrder;
      }

      this.purchaseOrders.push(purchaseOrderObject);
    });
  }

  /**
   * Initializes the component by creating a new JSON model
   * and setting the view reference.
   *
   * @returns {void} This function does not return a value.
   */
  onInit(): void {
    this.jsonModel = new JSONModel();
    this.view = this.getView() as View;
  }

  /**
   * Handles the event when data is received, creates a JSON model,
   * and sets it to the view with the name 'orders'.
   *
   * @param {Event} event - The event triggering data reception.
   */
  public dataReceivedControl(event: Event): void {
    this.createJSONModel(event);
    this.view.setModel(this.jsonModel, 'orders');
  }

  /**
   * Updates the 'OpenTotalAmountEditable' property based on user input and refreshes the shadow table binding.
   *
   * @param {Event} event - The event containing the new value for 'OpenTotalAmountEditable'.
   */
  public onOpenTotalAmountEditableChange(event: Event): void {
    const shadowTable = this.byId('shadowTable');
    const newValue = event.getParameters()['newValue'];

    const changedOrderItem: Order | undefined = (event.getSource() as UI5Element)
      .getBindingContext('orders')
      ?.getObject();

    this.updateProperty(
      `/OrderItems(PurchaseOrder='${changedOrderItem?.PurchaseOrder}',PurchaseOrderItem='${changedOrderItem?.PurchaseOrderItem}')`,
      'OpenTotalAmountEditable',
      newValue,
    );

    shadowTable?.getBinding('items')?.refresh();
  }

  /**
   * Updates the processing state of orders and their items from Controlling to Accounting,
   * then refreshes the shadow table binding.
   *
   * @returns {void} This function does not return a value.
   */
  public updateProcessingState(): void {
    const shadowTable = this.byId('shadowTable');
    const orders = this.jsonModel.getData();

    orders.forEach((order) => {
      if (order.to_OrderItems !== null) {
        order.to_OrderItems.forEach((orderItem) => {
          if (
            orderItem.ProcessingState_code === constants.ProcessingState.CONTROLLING &&
            orderItem.ApprovedByCON === true
          ) {
            this.updateProperty(
              `/OrderItems(PurchaseOrder='${orderItem.PurchaseOrder}',PurchaseOrderItem='${orderItem.PurchaseOrderItem}')`,
              'ProcessingState_code',
              constants.ProcessingState.ACCOUNTING,
            );
          }
        });
      }
    });
    shadowTable?.getBinding('items')?.refresh();
  }

  /**
   * Handles the confirmation checkbox event, updating the 'ApprovedByCON' property
   * for the selected order item and refreshing the shadow table binding.
   *
   * @param {Event} event - The event triggered by selecting the confirmation checkbox.
   */
  public onConfirmChecked(event: Event) {
    const shadowTable = this.byId('shadowTable');
    const toggleStatus = event.getParameters().selected;

    const changedOrderItem: Order | undefined = (event.getSource() as UI5Element)
      .getBindingContext('orders')
      ?.getObject();

    this.updateProperty(
      `/OrderItems(PurchaseOrder='${changedOrderItem?.PurchaseOrder}',PurchaseOrderItem='${changedOrderItem?.PurchaseOrderItem}')`,
      'ApprovedByCON',
      toggleStatus,
    );

    shadowTable?.getBinding('items')?.refresh();
  }
}
