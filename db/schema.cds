using {managed} from '@sap/cds/common';

namespace de.freudenberg.fco.accruals;

aspect VirtualFields {
  virtual Supplier                      : String(10);
  virtual SupplierText                  : String;
  virtual PurchaseOrderItemText         : String(40);
  virtual AccountAssignmentCategory     : String(1);
  virtual AccountAssignmentCategoryText : String;
  virtual OpenTotalAmount               : Decimal(12, 3);
  virtual OpenTotalAmountEditable       : Decimal(12, 3);
  virtual NodeID                        : String;
  virtual HierarchyLevel                : Integer;
  virtual ParentNodeID                  : String;
  virtual DrillState                    : String;
  virtual IsOrder                       : Boolean;
}

entity Orders : managed, VirtualFields {
  key PurchaseOrder           : String(10);
  key PurchaseOrderItem       : String(10);
      OpenTotalAmountEditable : Integer;
      to_PurchaseOrderItems   : Composition of many PurchaseOrderItem
}

entity PurchaseOrderItem : managed, VirtualFields {
  key PurchaseOrder           : String(10);
  key PurchaseOrderItem       : String(10);
      OpenTotalAmountEditable : Decimal(12, 3);
}

@cds.persistence.skip
entity Contexts {
  key UserId         : String;
      SapUser        : String(12);
      CostCenter     : String(10);
      CostCenterName : String(40);
}
