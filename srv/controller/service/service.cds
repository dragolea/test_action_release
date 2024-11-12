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

  //
  @cds.persistence.skip
  entity CostCenters as projection on base.CostCenters;

  entity ChangeView  as projection on changeView;
  entity ChangeLog   as projection on changeLog;
}
