import BaseComponent from 'sap/ui/core/UIComponent';
import { createDeviceModel } from './model/models';
import Model from 'sap/ui/model/Model';
import ODataListBinding from 'sap/ui/model/odata/v4/ODataListBinding';

/**
 * @namespace de.freudenberg.fco.accruals.costcenter
 */
export default class Component extends BaseComponent {
  public static metadata: {
    interfaces: string[];
    manifest: string;
  } = {
    interfaces: ['sap.ui.core.IAsyncContentCreation'],
    manifest: 'json',
  };

  /**
   * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
   * @public
   * @override
   */
  public async init() {
    // call the base component's init function
    super.init();

    // enable routing
    this.getRouter().initialize();

    // set the device model
    this.setModel(createDeviceModel(), 'device');

    // set the context model
    await this.getUserContext();
  }

  /**
   * Fetches and binds the user context from the `/Contexts` entity set.
   *
   * @returns A promise that resolves when the contexts are successfully retrieved.
   */
  private async getUserContext() {
    const model = this.getModel() as Model;
    const listBinding = model.bindList('/Contexts') as ODataListBinding;

    await listBinding.requestContexts();
  }
}
