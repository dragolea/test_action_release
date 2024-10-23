import ResourceBundle from 'sap/base/i18n/ResourceBundle';
import Router from 'sap/ui/core/routing/Router';
import UIComponent from 'sap/ui/core/UIComponent';
import Controller from 'sap/ui/core/mvc/Controller';
import View from 'sap/ui/core/mvc/View';
import Model from 'sap/ui/model/Model';
import ResourceModel from 'sap/ui/model/resource/ResourceModel';
import Component from 'sap/ui/core/Component';

/**
 * @namespace de.freudenberg.fco.accruals.controller.accounting
 */
export default class BaseController extends Controller {
  /**
   * Convenience method for accessing the router.
   * @returns {Router} - the router for this component
   * @public
   */
  public getRouter(): Router {
    return UIComponent.getRouterFor(this);
  }

  /**
   * Convenience method for accessing the component of the controller's view.
   * @returns {Component} - The component of the controller's view
   * @public
   */
  public getOwnerComponent(): Component | undefined {
    return super.getOwnerComponent();
  }

  /**
   * Convenience method for getting the i18n resource bundle of the component.
   * @returns {ResourceBundle} - The i18n resource bundle of the component
   * @public
   */
  public getResourceBundle(): ResourceBundle | Promise<ResourceBundle> {
    const component: Component | undefined = this.getOwnerComponent();
    const i18nModel: ResourceModel | undefined = component?.getModel('i18n') as ResourceModel;
    return i18nModel?.getResourceBundle();
  }

  /**
   * Convenience method for getting the view model by name in every controller of the application.
   * @param {string} name - The model name
   * @returns {Model} - The model instance
   * @public
   */
  public getModel(name?: string): Model | undefined {
    const view: View | undefined = this.getView() as View;
    return view.getModel(name);
  }

  /**
   * Convenience method for setting the view model in every controller of the application.
   * @param {Model} model - The model instance
   * @param {string} name - The model name
   * @returns {Controller} - The current base controller instance
   * @public
   */
  public setModel(model: Model, name?: string): this {
    const view: View | undefined = this.getView() as View;
    view.setModel(model, name);
    return this;
  }
}
