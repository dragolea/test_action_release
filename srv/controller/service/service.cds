using {de.freudenberg.fco.accruals as Base} from '../../../db/schema';

service ServiceAccruals @(path: '/accruals') {
  entity Orders as projection on Base.Orders;
}
