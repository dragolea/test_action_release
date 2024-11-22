/* eslint-disable @typescript-eslint/no-explicit-any */
import BaseController from './BaseController';
import JSONModel from 'sap/ui/model/json/JSONModel';
import Event from 'sap/ui/base/Event';
import View from 'sap/ui/core/mvc/View';
import { Order, OrderItem } from '../../../../@cds-models/ServiceAccruals';
import ContextBinding from 'sap/ui/model/ContextBinding';
import Context from 'sap/ui/model/odata/v4/Context';
import ODataListBinding from 'sap/ui/model/odata/v4/ODataListBinding';
import UI5Element from 'sap/ui/core/Element';
import ResourceModel from 'sap/ui/model/resource/ResourceModel';
import ResourceBundle from 'sap/base/i18n/ResourceBundle';
import Fragment from 'sap/ui/core/Fragment';
import Dialog from 'sap/m/Dialog';
import Table from 'sap/ui/table/Table';
import Filter from 'sap/ui/model/Filter';
import FilterOperator from 'sap/ui/model/FilterOperator';
import Sorter from 'sap/ui/model/Sorter';
import ODataContextBinding from 'sap/ui/model/odata/v4/ODataContextBinding';
import Input from 'sap/m/Input';

/**
 * @namespace de.freudenberg.fco.accruals.controller
 */
export default class PurchaseOrdersOverview extends BaseController {
  private ordersModel: JSONModel;
  private view: View;
  private purchaseOrders: Order[] = [];
  private dialog: Dialog;
  private viewModel: JSONModel;

  /**
   * Update the busy state of the view model as central point of busyness
   *
   * @param busy - The busy state
   */
  private setBusyState(busy: boolean) {
    this.viewModel.setProperty('/busy', busy);
  }

  /**
   * Updates a specific property of a bound context at the given path with a new value.
   *
   * @param path - The binding path to the context.
   * @param property - The property to update.
   * @param value - The new value to set for the property.
   * @returns This function does not return a value.
   */
  private updateProperty(path: string, property: string, value: string): Promise<void> {
    const contextBinding: ContextBinding = this.getModel()?.bindContext(path) as ContextBinding;
    const context = contextBinding.getBoundContext() as Context;
    return context.setProperty(property, value);
  }

  /**
   * Creates a JSON model from the current contexts of the event's data source and sets it with the purchase order data.
   *
   * @param event - The event providing the data source for the current contexts.
   */
  private createJSONModel(event: Event) {
    const contexts: Context[] = (event.getSource() as ODataListBinding).getCurrentContexts();

    this.setupPurchaseOrdersForJSON(contexts);
    this.ordersModel.setData(this.purchaseOrders);
  }

  /**
   * Prepares purchase order data by setting NodeID and ParentNodeID for each order and its items,
   * then stores them in the purchaseOrders array.
   *
   * @param contexts - An array of contexts containing purchase order data.
   */
  private setupPurchaseOrdersForJSON(contexts: Context[]): void {
    this.purchaseOrders = [];

    contexts.forEach((purchaseOrder) => {
      const purchaseOrderObject: Order = purchaseOrder.getObject();

      if (purchaseOrderObject.to_OrderItems) {
        this.sortByPurchaseOrderItem(purchaseOrderObject.to_OrderItems);
      }

      this.purchaseOrders.push(purchaseOrderObject);
    });
  }

  /**
   * Initializes the controller by setting up the JSON models and attaching the view.
   * A busy state is set to true in the `viewModel` to indicate loading.
   *
   * @returns
   */
  onInit(): void {
    this.ordersModel = new JSONModel();
    this.viewModel = new JSONModel({ busy: false, name: '' });
    this.view = this.getView() as View;
    this.view.setModel(this.viewModel, 'viewModel');
  }

  /**
   * Called after the view has been rendered to initialize additional data bindings.
   *
   * This method triggers `setContexts` to retrieve and set specific user context data in the view model.
   */
  onAfterRendering() {
    this.setContexts();
  }

  /**
   * Handles the event when data is received from the OData service.
   * It creates a JSON model from the received data, sets it to the view under the 'orders' model,
   * and changes the busy state to false to indicate data processing is complete.
   *
   * @param event - The event object containing the received data.
   * @returns
   */
  public async dataReceivedControl(event: Event) {
    this.createJSONModel(event);
    this.view.setModel(this.ordersModel, 'orders');
    this.setBusyState(false);
  }

  /**
   * Retrieves and sets the user context data in the view model if only one context is available.
   *
   * This function binds to the `/Contexts` endpoint in the model and requests all contexts.
   * If a single context is retrieved, it updates the view model with the user's full name.
   */
  private async setContexts() {
    // TODO: check typing
    const user = (sap as any).ushell.Container.getUser();

    this.viewModel.setProperty('/name', user.getFirstName() + ' ' + user.getLastName());
  }

  /**
   * Handles changes to the editable total amount of an order item and updates the corresponding order.
   *
   * @param event - The event containing the new value and source of the change.
   * @returns A promise that resolves when the operation is complete.
   */
  public async onOpenTotalAmountEditableChange(event: Event): Promise<void> {
    const input = event.getSource() as Input;
    let value = input.getValue();

    if (!value.trim()) {
      input.setValue('0');
      value = input.getValue();
    }

    this.setBusyState(true);

    const changedOrderItem: OrderItem | undefined = (event.getSource() as UI5Element)
      .getBindingContext('orders')
      ?.getObject();

    if (changedOrderItem) {
      const action = this.view.getModel()?.bindContext(`/sum(...)`) as ODataContextBinding | undefined;

      await action?.setParameter('orderItem', changedOrderItem).setParameter('newValue', value).invoke();

      const actionContext = action?.getBoundContext();
      const updatedOrder: Order = actionContext?.getObject();
      const orders: Order[] = this.ordersModel.getData();

      for (const order of orders) {
        if (order.PurchaseOrder === updatedOrder.PurchaseOrder) {
          order.Highlight = updatedOrder.Highlight;
          order.OpenTotalAmount = updatedOrder.OpenTotalAmount;
          order.OpenTotalAmountEditable = updatedOrder.OpenTotalAmountEditable;

          if (updatedOrder.to_OrderItems && order.to_OrderItems) {
            for (const updatedItem of updatedOrder.to_OrderItems) {
              for (const item of order.to_OrderItems) {
                if (updatedItem.PurchaseOrderItem === item.PurchaseOrderItem) {
                  item.Highlight = updatedItem.Highlight;
                }
              }
            }
          }
        }

        if (order.to_OrderItems) {
          this.sortByPurchaseOrderItem(order.to_OrderItems);
        }
      }

      this.purchaseOrders = orders;
      this.ordersModel.setData(this.purchaseOrders);
    }

    this.setBusyState(false);
  }

  /**
   * Sorts an array of objects by the property `PurchaseOrderItem` in ascending order.
   *
   * @param items - The array of objects to sort.
   */
  private sortByPurchaseOrderItem(orders: Order[]): void {
    orders.sort((a, b) => Number(a.PurchaseOrderItem) - Number(b.PurchaseOrderItem));
  }

  /**
   * Updates the processing state of orders and their items from User to CostCenterResponsible,
   * then refreshes the shadow table binding.
   *
   * @returns This function does not return a value.
   */
  public async updateProcessingState(): Promise<void> {
    const orders: Order[] = this.ordersModel.getData();

    this.setBusyState(true);

    const action = this.view.getModel()?.bindContext(`/updateProcessingState(...)`) as ODataContextBinding | undefined;

    await action?.setParameter('orders', orders).invoke();

    const actionContext = action?.getBoundContext();
    const updatedOrders = actionContext?.getObject();

    this.purchaseOrders = Array.from(updatedOrders.value);
    this.ordersModel.setData(this.purchaseOrders);

    this.setBusyState(false);
  }

  /**
   * Event handler triggered when the "Change History" button is pressed.
   * It loads the Change History dialog fragment, binds the change history data
   * to a table based on the selected order item, and opens the dialog.
   *
   * @param event - The event object triggered by the button press, containing the source of the press event.
   * @returns - A promise that resolves when the dialog is fully loaded and displayed.
   */
  async onChangeHistoryPress(event: Event) {
    const view = this.view;
    const i18nModel: ResourceModel = this.view.getModel('i18n') as ResourceModel;
    const resourceBundle: ResourceBundle = await i18nModel.getResourceBundle();

    const source: any = event.getSource();
    const bindingContext: Context = source.getBindingContext('orders');
    const bindingObject = bindingContext.getObject();
    const keys = `PurchaseOrder=${bindingObject.PurchaseOrder}, PurchaseOrderItem=${bindingObject.PurchaseOrderItem}`;

    const promise = Fragment.load({
      id: view.getId(),
      name: 'de.freudenberg.fco.accruals.view.fragment.ChangeHistory',
      controller: this,
    }).then(function (dialog) {
      return dialog;
    });

    promise.then(
      function (dialog: Dialog) {
        this.dialog = dialog;
        view.addDependent(dialog);

        const table: Table = this.view.byId('tableHistory');
        table.setModel(this.getModel());
        table.bindRows({
          path: '/ChangeView',
          filters: [
            new Filter({
              path: 'keys',
              operator: FilterOperator.EQ,
              value1: keys,
            }),
          ],
          sorter: new Sorter('createdAt', true),
        });

        dialog.setTitle(
          resourceBundle.getText('DIALOG.CHANGE.HISTORY.TITLE', [
            bindingObject.PurchaseOrder,
            bindingObject.PurchaseOrderItem,
          ]),
        );

        dialog.open();
      }.bind(this),
    );
  }

  /**
   * Event handler for the "Close" button press in the Change History dialog.
   * Closes and destroys the dialog to free up resources.
   */
  onCloseButtonPress() {
    this.dialog.close();
    this.dialog.destroy();
  }

  /**
   * Sets the view's busy indicator to true, signaling the start of an update or loading process.
   */
  public updateStartedControl() {
    this.setBusyState(true);
  }

  /**
   * Sets the view's busy indicator to false, signaling that the update process is complete.
   */
  public updateFinishedControl() {
    this.setBusyState(false);
  }
}
