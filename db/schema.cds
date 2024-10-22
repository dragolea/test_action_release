using {
  managed,
  sap.common.CodeList as CodeList
} from '@sap/cds/common';

namespace de.freudenberg.fco.accruals;

type DrillState      : String enum {
  expanded;
  leaf;
}

type ProcessingState : Association to ProcessingStateValues;

aspect SharedFields {
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
}

entity Orders : managed, SharedFields {
  key PurchaseOrder                   : String(10);
      PurchaseOrderItem               : String(5);
      virtual OpenTotalAmount         : Decimal(12, 3);
      virtual OpenTotalAmountEditable : Decimal(12, 3);
      HierarchyLevel                  : Integer default 0;
      ParentNodeID                    : String(10) default null;
      DrillState                      : DrillState default 'expanded';
      to_OrderItems                   : Composition of many OrderItems
                                          on to_OrderItems.to_Orders = $self;
}

entity OrderItems : managed, SharedFields {
  key PurchaseOrder           : String(10);
  key PurchaseOrderItem       : String(5);
      OpenTotalAmount         : Decimal(12, 3);
      OpenTotalAmountEditable : Decimal(12, 3);
      HierarchyLevel          : Integer default 1;
      ParentNodeID            : String(10);
      DrillState              : DrillState default 'leaf';
      to_Orders               : Association to Orders;
}

@cds.persistence.skip
entity Contexts {
  key UserId         : String;
      SapUser        : String(12);
      CostCenter     : String(10);
      CostCenterName : String(40);
}

entity ProcessingStateValues : CodeList {
  key code : String(1);
}
