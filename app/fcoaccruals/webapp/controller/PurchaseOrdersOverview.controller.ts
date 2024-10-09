/* eslint-disable @typescript-eslint/no-explicit-any */
import View from 'sap/ui/core/mvc/View';
import BaseController from './BaseController';
import ODataModel from 'sap/ui/model/odata/v4/ODataModel';
import ODataListBinding from 'sap/ui/model/odata/v4/ODataListBinding';
import V4Context from 'sap/ui/model/odata/v4/Context';
import JSONModel from 'sap/ui/model/json/JSONModel';
import TreeTable from 'sap/ui/table/TreeTable';
import CountMode from 'sap/ui/model/odata/CountMode';
import Event from 'sap/ui/base/Event';
import Input from 'sap/m/Input';
import Context from 'sap/ui/model/Context';

/**
 * @namespace de.freudenberg.fco.accruals.controller
 */
export default class PurchaseOrdersOverview extends BaseController {
  onAfterRendering(): void | undefined {
    const view: View = this.getView() as View;
    const oDataModel: ODataModel = view.getModel() as ODataModel;
    const treeTableOrders = view.byId('TreeTableOrders') as TreeTable;

    oDataModel.setSizeLimit(100000);

    const orderListBinding: ODataListBinding = oDataModel.bindList('/Orders');
    const orderContext = orderListBinding.requestContexts();
    const jsonModel = new JSONModel();

    const data: any[] = [];

    treeTableOrders.setEnableBusyIndicator(true);

    orderContext.then((contexts: V4Context[]) => {
      contexts.forEach((context: V4Context) => {
        data.push(context.getObject());
      });
      jsonModel.setData(data);

      treeTableOrders?.setModel(jsonModel);

      treeTableOrders?.bindRows({
        path: '/',
        parameters: {
          countMode: CountMode.Inline,
          arrayName: ['to_PurchaseOrderItems'],
        },
      });

      treeTableOrders.setEnableBusyIndicator(false);
    });
  }
}
