import BaseController from './BaseController';
import JSONModel from 'sap/ui/model/json/JSONModel';
import Event from 'sap/ui/base/Event';
import View from 'sap/ui/core/mvc/View';
import { Order } from '../../../../@cds-models/ServiceAccruals';
import ContextBinding from 'sap/ui/model/ContextBinding';
import Context from 'sap/ui/model/odata/v4/Context';
import ODataListBinding from 'sap/ui/model/odata/v4/ODataListBinding';
import UI5Element from 'sap/ui/core/Element';

/**
 * @namespace de.freudenberg.fco.accruals.controller.costcenter
 */
export default class PurchaseOrdersOverview extends BaseController {
  private jsonModel: JSONModel;
  private view: View;
  private purchaseOrders: Order[] = [];

  /**
   * Retrieves the binding context for a specific purchase order item based on the event source.
   *
   * @param {Event} event - The event triggering the context retrieval.
   * @returns {Context} The binding context of the corresponding purchase order item.
   */
  private getPurchaseOrderItemContext(event: Event) {
    const changedOrderItem: Order | undefined = (event.getSource() as UI5Element)
      .getBindingContext('orders')
      ?.getObject();

    const path = `/OrderItems(PurchaseOrder='${changedOrderItem?.PurchaseOrder}',PurchaseOrderItem='${changedOrderItem?.PurchaseOrderItem}')`;

    const contextBinding: ContextBinding = this.getModel()?.bindContext(path) as ContextBinding;
    return contextBinding.getBoundContext() as Context;
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
  private setupPurchaseOrdersForJSON(contexts: Context[]) {
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
  onInit(): void | undefined {
    this.jsonModel = new JSONModel();
    this.view = this.getView() as View;
  }

  /**
   * Handles the event when data is received, creates a JSON model,
   * and sets it to the view with the name 'orders'.
   *
   * @param {Event} event - The event triggering data reception.
   */
  public dataReceivedControl(event: Event) {
    this.createJSONModel(event);
    this.view.setModel(this.jsonModel, 'orders');
  }

  /**
   * Updates the 'OpenTotalAmountEditable' property based on user input and refreshes the shadow table binding.
   *
   * @param {Event} event - The event containing the new value for 'OpenTotalAmountEditable'.
   */
  public onOpenTotalAmountEditableChange(event: Event) {
    const shadowTable = this.byId('shadowTable');
    const newValue = event.getParameters()['newValue'];
    const context = this.getPurchaseOrderItemContext(event);

    context.setProperty('OpenTotalAmountEditable', newValue);
    shadowTable?.getBinding('items')?.refresh();
  }
}
