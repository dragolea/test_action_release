import BaseController from './BaseController';
import JSONModel from 'sap/ui/model/json/JSONModel';
import Filter from 'sap/ui/model/Filter';
import FilterOperator from 'sap/ui/model/FilterOperator';
import Event from 'sap/ui/base/Event';
import Table from 'sap/m/Table';
import ODataListBinding from 'sap/ui/model/odata/v4/ODataListBinding';
import ResourceBundle from 'sap/base/i18n/ResourceBundle';

/**
 * @namespace de.freudenberg.fco.accruals.controller
 */
export default class ListReport extends BaseController {
  private tableSearchState: Filter[] = [];

  /**
   * Called when the ListReport controller is instantiated.
   * @public
   */
  public onInit(): void {
    const table: Table = this.byId('table') as Table;
    const originalBusyDelay: number = table?.getBusyIndicatorDelay();

    // Model used to manipulate control states
    const viewModel = new JSONModel({
      tableBusyDelay: 0,
    });
    this.setModel(viewModel, 'listReportView');

    // Attach event once to restore original busy indicator delay for the table
    table.attachEventOnce('updateFinished', (): void => {
      viewModel.setProperty('/tableBusyDelay', originalBusyDelay);
    });
  }

  /**
   * Triggered by the table's 'updateFinished' event: after new table
   * data is available, this handler method updates the table counter.
   * @param {Event} event - the update finished event
   * @public
   */
  public onUpdateFinished(event: Event): void {
    const table: Table = event.getSource();
    const tableBinding: ODataListBinding | undefined = table?.getBinding('items') as ODataListBinding;
    const viewModel: JSONModel | undefined = this.getModel('listReportView') as JSONModel;
    const totalItems: string = event.getParameter('total' as never);
    const resourceBundle: ResourceBundle | Promise<ResourceBundle> = this.getResourceBundle() as ResourceBundle;
    const title: string | undefined =
      totalItems && tableBinding?.isLengthFinal()
        ? resourceBundle.getText('LIST_REPORT.TABLE.COUNT', [totalItems])
        : resourceBundle.getText('LIST_REPORT.TABLE.TITLE');

    viewModel?.setProperty('/LIST_REPORT.TABLE.TITLE', title);
  }

  /**
   * Event handler when a table item gets pressed
   * @param {Event} event - the table selectionChange event
   * @public
   */
  // public onPress(event: Event): void {
  //   this.showObject(event.getSource());
  // }

  /**
   * Event handler for navigating back.
   * We navigate back in the browser history
   * @public
   */
  public onNavBack(): void {
    history.go(-1);
  }

  /**
   * Event handler for the search event.
   * Applies the search query to the table's filter.
   * @param {Event} event - The search event.
   * @public
   */
  public onSearch(event: Event): void {
    const refreshButtonPressed: string = event.getParameter('refreshButtonPressed' as never);
    if (refreshButtonPressed.length > 0) {
      this.onRefresh();
    } else {
      const query: string = event.getParameter('query' as never);
      this.tableSearchState = query && query.length > 0 ? [new Filter('descr', FilterOperator.Contains, query)] : [];
      this.applySearch(this.tableSearchState);
    }
  }

  /**
   * Event handler for refresh event. Keeps filter, sort
   * and group settings and refreshes the list binding.
   * @public
   */
  public onRefresh(): void {
    const table: Table | undefined = this.byId('table') as Table | undefined;
    table?.getBinding('items')?.refresh();
  }

  /**
   * Shows the selected item on the object page
   * On phones, an additional history entry is created
   * @param {ObjectListItem} item - selected Item
   * @private
   */
  // private showObject(item: ObjectListItem): void {
  //   const context: Context | null | undefined = item?.getBindingContext();
  //   this.getRouter().navTo('ObjectPage', {
  //     id: context?.getProperty('ID'),
  //   });
  // }

  /**
   * Internal helper method to apply both filter and search state together on the list binding
   * @param {Filter[]} tableSearchState - An array of filters for the search
   * @private
   */
  private applySearch(tableSearchState: Filter[]): void {
    const table: Table | undefined = this.byId('table') as Table;
    const viewModel: JSONModel | undefined = this.getModel('listReportView') as JSONModel;
    const binding: ODataListBinding | undefined = table.getBinding('items') as ODataListBinding;

    binding?.filter(tableSearchState, 'Application');

    // changes the noDataText of the list in case there are no filter results
    if (tableSearchState.length !== 0) {
      const resourceBundle: ResourceBundle | Promise<ResourceBundle> = this.getResourceBundle() as ResourceBundle;
      viewModel.setProperty('/tableNoDataText', resourceBundle.getText('LIST_REPORT.TABLE.NO_DATA.TEXT'));
    }
  }
}
