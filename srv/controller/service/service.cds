using {de.freudenberg.fco.accruals as my} from '../../../db/schema';

service ServiceAccruals @(path: '/accruals') {
  entity Orders     as projection on my.Orders;
  entity OrderItems as projection on my.OrderItems;
  entity Contexts   as projection on my.Contexts;
}
