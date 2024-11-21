using {de.freudenberg.fco.accruals as base} from '../../../db/schema';
using {
  sap.changelog.ChangeLog as changeLog,
  sap.changelog.ChangeView as changeView
} from '@cap-js/change-tracking';

@requires: 'authenticated-user'
service ServiceAccruals @(path: '/accruals') {
  entity Orders      as projection on base.Orders;
  entity OrderItems  as projection on base.OrderItems;
  entity Contexts    as projection on base.Contexts;
  entity CostCenters as projection on base.CostCenters;
  entity ChangeView  as projection on changeView;
  entity ChangeLog   as projection on changeLog;
  action sum(orderItem : OrderItems, newValue : Decimal(12, 3))                                                                                 returns Orders;
  action updateProcessingState(orders : many Orders, isGeneralUser : Boolean, isCCR : Boolean, isControlling : Boolean, isAccounting : Boolean) returns many Orders;
  action toggleApprove(orderItem : OrderItems, newValue : Boolean, isCCR : Boolean, isControlling : Boolean, isAccounting : Boolean)            returns Orders
}
