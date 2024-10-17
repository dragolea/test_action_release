using {managed} from '@sap/cds/common';

namespace de.freudenberg.fco.accruals;

type DrillState : String enum {
  expanded;
  leaf;
}

aspect VirtualFields {
  Supplier                      : String(10);
  SupplierText                  : String;
  PurchaseOrderItemText         : String(40);
  AccountAssignmentCategory     : String(1);
  AccountAssignmentCategoryText : String;
}

entity Orders : managed, VirtualFields {
  key PurchaseOrder                   : String(10);
      PurchaseOrderItem               : String(5);
      virtual OpenTotalAmount         : Decimal(12, 3);
      virtual OpenTotalAmountEditable : Decimal(12, 3);
      NodeID                          : String(15);
      HierarchyLevel                  : Integer default 0;
      ParentNodeID                    : String(10) default null;
      DrillState                      : DrillState default 'expanded';
      to_OrderItems                   : Composition of many OrderItems
                                          on to_OrderItems.to_Orders = $self;
}

entity OrderItems : managed, VirtualFields {
  key PurchaseOrder           : String(10);
  key PurchaseOrderItem       : String(5);
      OpenTotalAmount         : Decimal(12, 3);
      OpenTotalAmountEditable : Decimal(12, 3);
      NodeID                  : String(15);
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
