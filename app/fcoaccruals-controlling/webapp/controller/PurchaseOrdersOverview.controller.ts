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
import ResourceModel from 'sap/ui/model/resource/ResourceModel';
import ResourceBundle from 'sap/base/i18n/ResourceBundle';
import Fragment from 'sap/ui/core/Fragment';
import Dialog from 'sap/m/Dialog';
import Table from 'sap/ui/table/Table';
import Filter from 'sap/ui/model/Filter';
import FilterOperator from 'sap/ui/model/FilterOperator';
import Sorter from 'sap/ui/model/Sorter';
import ListBinding from 'sap/ui/model/ListBinding';

/**
 * @namespace de.freudenberg.fco.accruals.controller
 */
export default class PurchaseOrdersOverview extends BaseController {
  private jsonModel: JSONModel;
  private view: View;
  private purchaseOrders: Order[] = [];
  private dialog: Dialog;
  private viewModel: JSONModel;

  /**
   * Update the busy state of the view model as central point of busyness
   *
   * @param busy - The busy state
   */
  private changeBusyState(busy: boolean) {
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
    this.jsonModel.setData(this.purchaseOrders);
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
    this.jsonModel = new JSONModel();
    this.viewModel = new JSONModel({ busy: true });
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
  public dataReceivedControl(event: Event): void {
    this.createJSONModel(event);
    this.view.setModel(this.jsonModel, 'orders');
    this.changeBusyState(false);
  }

  /**
   * Retrieves and sets the user context data in the view model if only one context is available.
   *
   * This function binds to the `/Contexts` endpoint in the model and requests all contexts.
   * If a single context is retrieved, it updates the view model with the user's full name.
   */
  private async setContexts() {
    const model = this.view.getModel();
    const binding: ListBinding | undefined = model?.bindList('/Contexts');
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;

    binding?.requestContexts().then((contexts) => {
      if (contexts.length === 1) {
        that.viewModel.setProperty(
          '/name',
          contexts[0].getObject().GivenName + ' ' + contexts[0].getObject().FamilyName,
        );
      }
    });
  }

  /**
   * Updates the 'OpenTotalAmountEditable' property based on user input and refreshes the shadow table binding.
   *
   * @param event - The event containing the new value for 'OpenTotalAmountEditable'.
   */
  public onOpenTotalAmountEditableChange(event: Event): void {
    const shadowTable = this.byId('shadowTable');
    const newValue = event.getParameters()['newValue'];

    this.view.setBusy(true);

    const changedOrderItem: Order | undefined = (event.getSource() as UI5Element)
      .getBindingContext('orders')
      ?.getObject();

    this.updateProperty(
      `/OrderItems(PurchaseOrder='${changedOrderItem?.PurchaseOrder}',PurchaseOrderItem='${changedOrderItem?.PurchaseOrderItem}')`,
      'OpenTotalAmountEditable',
      newValue,
    ).then(
      function () {
        shadowTable?.getBinding('items')?.refresh();
        this.view.setBusy(false);
      }.bind(this),
    );
  }

  /**
   * Updates the processing state of orders and their items from Controlling to Accounting,
   * then refreshes the shadow table binding.
   *
   * @returns This function does not return a value.
   */
  public updateProcessingState(): void {
    const shadowTable = this.byId('shadowTable');
    const orders = this.jsonModel.getData();
    const promises: Promise<void>[] = [];

    this.view.setBusy(true);

    orders.forEach((order) => {
      if (order.to_OrderItems !== null) {
        order.to_OrderItems.forEach((orderItem) => {
          if (
            orderItem.ProcessingState_code === constants.ProcessingState.CONTROLLING &&
            orderItem.ApprovedByCON === true
          ) {
            promises.push(
              this.updateProperty(
                `/OrderItems(PurchaseOrder='${orderItem.PurchaseOrder}',PurchaseOrderItem='${orderItem.PurchaseOrderItem}')`,
                'ProcessingState_code',
                constants.ProcessingState.ACCOUNTING,
              ),
            );
          }
        });
      }
    });

    Promise.all(promises).then(
      function () {
        shadowTable?.getBinding('items')?.refresh();
        this.view.setBusy(false);
      }.bind(this),
    );
  }

  /**
   * Handles the confirmation checkbox event, updating the 'ApprovedByCON' property
   * for the selected order item and refreshing the shadow table binding.
   *
   * @param event - The event triggered by selecting the confirmation checkbox.
   */
  public onConfirmChecked(event: Event) {
    const shadowTable = this.byId('shadowTable');
    const toggleStatus = event.getParameters().selected;

    this.view.setBusy(true);

    const changedOrderItem: Order | undefined = (event.getSource() as UI5Element)
      .getBindingContext('orders')
      ?.getObject();

    this.updateProperty(
      `/OrderItems(PurchaseOrder='${changedOrderItem?.PurchaseOrder}',PurchaseOrderItem='${changedOrderItem?.PurchaseOrderItem}')`,
      'ApprovedByCON',
      toggleStatus,
    ).then(
      function () {
        shadowTable?.getBinding('items')?.refresh();
        this.view.setBusy(false);
      }.bind(this),
    );
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
    const source = event.getSource();
    const bindingContext: Context = source.getBindingContext('orders');
    const bindingObject = bindingContext.getObject();
    const keys = `PurchaseOrder=${bindingObject.PurchaseOrder}, PurchaseOrderItem=${bindingObject.PurchaseOrderItem}`;

    const promise = Fragment.load({
      id: view.getId(),
      name: 'de.freudenberg.fco.accruals.controlling.view.fragment.ChangeHistory',
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
}
