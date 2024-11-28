using {ProcessingState} from './types';

aspect SharedFields {
  OpenTotalAmount           : Decimal(12, 2);
  OpenTotalAmountEditable   : Decimal(12, 2);
  Supplier                  : String(10);
  SupplierText              : String;
  PurchaseOrderItemText     : String(40);
  AccountAssignmentCategory : String(1);
  OrderID                   : String;
  CostCenterID              : String;
  ApprovedByCCR             : Boolean default false;
  ApprovedByCON             : Boolean default false;
  ApprovedByACC             : Boolean default false;
  NodeID                    : String(15);
  Requester                 : String;
  ProcessingState           : ProcessingState;
  CreationDate              : Date;
  Editable                  : Boolean default true;
  Highlight                 : String;
  IsOrderItem               : Boolean;
  NetPriceAmount            : Decimal(12, 3);
  OrderQuantity             : Decimal(13, 3);
  TotalInvoiceAmount        : Decimal(14, 3);
}
