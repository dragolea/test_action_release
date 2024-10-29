using {de.freudenberg.fco.accruals as my} from '../../../db/schema';
using {
  sap.changelog.ChangeLog as changeLog,
  sap.changelog.ChangeView as changeView
} from '@cap-js/change-tracking';

@requires: 'authenticated-user'
service ServiceAccruals @(path: '/accruals') {
  entity Orders      as projection on my.Orders;
  entity OrderItems  as projection on my.OrderItems;
  entity Contexts    as projection on my.Contexts;
  entity CostCenters as projection on my.CostCenters;
  entity ChangeView  as projection on changeView;
  entity ChangeLog   as projection on changeLog;
}
