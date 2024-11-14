import BaseController from './BaseController';
import JSONModel from 'sap/ui/model/json/JSONModel';
import Event from 'sap/ui/base/Event';
import View from 'sap/ui/core/mvc/View';
import { Order, OrderItem } from '../../../../@cds-models/ServiceAccruals';
import ContextBinding from 'sap/ui/model/ContextBinding';
import Context from 'sap/ui/model/odata/v4/Context';
import ODataListBinding from 'sap/ui/model/odata/v4/ODataListBinding';
import UI5Element from 'sap/ui/core/Element';
import constants from '../util/constants/constants';
// @ts-expect-error ts(2307) Cannot find module FIXME: check import
import Spreadsheet from 'sap/ui/export/Spreadsheet';
import MessageToast from 'sap/m/MessageToast';
// @ts-expect-error ts(2307) Cannot find module FIXME: check import
import exportLibrary from 'sap/ui/export/library';
import ResourceModel from 'sap/ui/model/resource/ResourceModel';
import ResourceBundle from 'sap/base/i18n/ResourceBundle';
import Fragment from 'sap/ui/core/Fragment';
import Dialog from 'sap/m/Dialog';
import Table from 'sap/ui/table/Table';
import Filter from 'sap/ui/model/Filter';
import FilterOperator from 'sap/ui/model/FilterOperator';
import Sorter from 'sap/ui/model/Sorter';
import Button from 'sap/m/Button';
import Model from 'sap/ui/model/Model';

/**
 * @namespace de.freudenberg.fco.accruals.controller
 */
export default class PurchaseOrdersOverview extends BaseController {
  private ordersModel: JSONModel;
  private view: View;
  private purchaseOrders: Order[] = [];
  private EdmType = exportLibrary.EdmType;
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
  public dataReceivedControl(event: Event): void {
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
    const model = this.view.getModel() as Model;
    const binding = model.bindList('/Contexts') as ODataListBinding;
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

    this.setBusyState(true);

    const changedOrderItem: Order | undefined = (event.getSource() as UI5Element)
      .getBindingContext('orders')
      ?.getObject();

    this.updateProperty(
      `/OrderItems(PurchaseOrder='${changedOrderItem?.PurchaseOrder}',PurchaseOrderItem='${changedOrderItem?.PurchaseOrderItem}')`,
      'OpenTotalAmountEditable',
      newValue,
    ).then(function () {
      shadowTable?.getBinding('items')?.refresh();
    });
  }

  /**
   * Handles the confirmation checkbox event, updating the 'ApprovedByACC' property
   * for the selected order item and refreshing the shadow table binding.
   *
   * @param event - The event triggered by selecting the confirmation checkbox.
   */
  public onConfirmChecked(event: Event) {
    const shadowTable = this.byId('shadowTable');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parameters: any = event.getParameters();
    const toggleStatus: string = parameters.selected;

    const changedOrderItem: Order | undefined = (event.getSource() as UI5Element)
      .getBindingContext('orders')
      ?.getObject();

    this.updateProperty(
      `/OrderItems(PurchaseOrder='${changedOrderItem?.PurchaseOrder}',PurchaseOrderItem='${changedOrderItem?.PurchaseOrderItem}')`,
      'ApprovedByACC',
      toggleStatus,
    );

    shadowTable?.getBinding('items')?.refresh();
  }

  /**
   * Updates the processing state of orders and their items from User to CostCenterResponsible,
   * then refreshes the shadow table binding.
   *
   * @returns This function does not return a value.
   */
  public async updateProcessingState(): Promise<void> {
    const shadowTable = this.byId('shadowTable');
    const orders: Order[] = this.ordersModel.getData();
    const promises: Promise<void>[] = [];

    this.setBusyState(true);

    const updateProcessingState = (order: Order) => {
      const hasOrderItems = order.to_OrderItems !== null;

      if (hasOrderItems) {
        order.to_OrderItems!.forEach(updateProcessingStateOnOrderItem);
      }
    };

    const updateProcessingStateOnOrderItem = (orderItem: OrderItem) => {
      const needsToBeUpdated =
        orderItem.ProcessingState_code === constants.PROCESSING_STATE.ACCOUNTING && orderItem.ApprovedByACC === true;

      if (needsToBeUpdated) {
        const update = this.updateProperty(
          `/OrderItems(PurchaseOrder='${orderItem.PurchaseOrder}',PurchaseOrderItem='${orderItem.PurchaseOrderItem}')`,
          'ProcessingState_code',
          constants.PROCESSING_STATE.FINAL,
        );

        promises.push(update);
      }
    };

    orders.forEach(updateProcessingState);

    Promise.all(promises).then(function () {
      shadowTable?.getBinding('items')?.refresh();
    });
  }

  /**
   * Build column descriptor for excel file
   * see: https://sapui5.hana.ondemand.com/sdk/#/api/sap.ui.export.Spreadsheet%23constructor
   * @returns - Returns an array of objects describing the structure of the excel file to be generated
   */
  async createColumnConfig() {
    const i18nModel: ResourceModel = this.view.getModel('i18n') as ResourceModel;
    const resourceBundle: ResourceBundle = await i18nModel?.getResourceBundle();
    return [
      {
        label: resourceBundle.getText('TABLE.COLUMN.PURCHASE_ORDER'),
        property: 'PurchaseOrder',
        type: this.EdmType.Number,
        scale: 0,
      },
      {
        label: resourceBundle.getText('TABLE.COLUMN.PURCHASE_ORDER_ITEM'),
        property: 'PurchaseOrderItem',
        type: this.EdmType.Number,
        scale: 0,
      },
      {
        label: resourceBundle.getText('TABLE.COLUMN.SUPPLIER'),
        property: 'Supplier',
        type: this.EdmType.Number,
        scale: 0,
      },
      {
        label: resourceBundle.getText('TABLE.COLUMN.SUPPLIER_TEXT'),
        property: 'SupplierText',
        type: this.EdmType.String,
        scale: 0,
      },
      {
        label: resourceBundle.getText('TABLE.COLUMN.PURCHASE_ORDER_ITEM_TEXT'),
        property: 'PurchaseOrderItemText',
        type: this.EdmType.String,
        scale: 0,
      },
      {
        label: resourceBundle.getText('TABLE.COLUMN.REQUESTER'),
        property: 'Requester',
        type: this.EdmType.String,
        scale: 0,
      },
      {
        label: resourceBundle.getText('TABLE.COLUMN.ORDER_ID'),
        property: 'OrderID',
        type: this.EdmType.Number,
        scale: 0,
      },
      {
        label: resourceBundle.getText('TABLE.COLUMN.COST_CENTER_ID'),
        property: 'CostCenterID',
        type: this.EdmType.Number,
        scale: 0,
      },
      {
        label: resourceBundle.getText('TABLE.COLUMN.OPEN_TOTAL_AMOUNT'),
        property: 'OpenTotalAmount',
        type: this.EdmType.Number,
        scale: 0,
      },
      {
        label: resourceBundle.getText('TABLE.COLUMN.OPEN_TOTAL_AMOUNT_EDITABLE'),
        property: 'OpenTotalAmountEditable',
        type: this.EdmType.Number,
        scale: 0,
      },
    ];
  }

  /**
   * Creates an excel export based on the current JSON model.
   * @param event - The event containing the source (= button) to set busy indicator
   */
  async onExportPress(event: Event) {
    const source: Button = event.getSource();
    const orderItems: OrderItem[] = [];

    source.setBusy(true);

    const columns = await this.createColumnConfig();

    this.ordersModel.getData().forEach((order: Order) => {
      order.to_OrderItems?.forEach((orderItem: OrderItem) => {
        orderItems.push(orderItem);
      });
    });

    const settings = {
      workbook: { columns: columns },
      dataSource: orderItems,
    };

    const sheet = new Spreadsheet(settings);

    sheet
      .build()
      .then(function () {
        MessageToast.show('Spreadsheet export has finished');
        // TODO: prettify
      })
      .finally(function () {
        sheet.destroy();
        source.setBusy(false);
      });
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source: any = event.getSource();
    const bindingContext: Context = source.getBindingContext('orders');
    const bindingObject = bindingContext.getObject();
    const keys = `PurchaseOrder=${bindingObject.PurchaseOrder}, PurchaseOrderItem=${bindingObject.PurchaseOrderItem}`;

    const promise = Fragment.load({
      id: view.getId(),
      name: 'de.freudenberg.fco.accruals.accounting.view.fragment.ChangeHistory',
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
