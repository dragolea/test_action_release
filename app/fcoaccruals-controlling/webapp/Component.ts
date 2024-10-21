import BaseComponent from 'sap/ui/core/UIComponent';
import { createDeviceModel } from './model/models';

/**
 * @namespace de.freudenberg.fco.accruals.controlling
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
  public init(): void {
    // call the base component's init function
    super.init();

    // enable routing
    this.getRouter().initialize();

    // set the device model
    this.setModel(createDeviceModel(), 'device');
  }
}
