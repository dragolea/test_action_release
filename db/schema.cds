using {
  managed,
  sap.common.CodeList as CodeList
} from '@sap/cds/common';

namespace de.freudenberg.fco.accruals;

type DrillState      : String enum {
  expanded;
  leaf;
}

type Highlight       : String enum {
  None;
  Information;
  Success;
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
  // change type to date
  CreationDate              : String;
  Editable                  : Boolean default true;
  virtual Highlight         : String;
  IsOrderItem               : Boolean;
}

entity Orders : managed, SharedFields {
  key PurchaseOrder                   : String(10);
      ID                              : String(10); //this ID is necessary for change tracking
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
      ID                      : String(15); //this ID is necessary for change tracking
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
      FamilyName     : String;
      GivenName      : String;
      SapUser        : String(12);
      to_CostCenters : Composition of many CostCenters
                         on to_CostCenters.to_Contexts = $self;
}

@cds.persistence.skip
entity CostCenters {
  key CostCenter  : String(10);
      to_Contexts : Association to Contexts;
}

entity ProcessingStateValues : CodeList {
  key code : String(1);
}
