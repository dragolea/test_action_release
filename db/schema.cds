using {
  managed,
  sap.common.CodeList as CodeList
} from '@sap/cds/common';

using {DrillState} from './cds-types/types';
using {SharedFields} from './cds-types/aspects';

namespace de.freudenberg.fco.accruals;

entity Orders : managed, SharedFields {
  key PurchaseOrder     : String(10);
      ID                : String(10); //this ID is necessary for change tracking
      PurchaseOrderItem : String(5);
      HierarchyLevel    : Integer default 0;
      ParentNodeID      : String(10) default null;
      DrillState        : DrillState default 'expanded';
      to_OrderItems     : Composition of many OrderItems
                            on to_OrderItems.to_Orders = $self;
}

entity OrderItems : managed, SharedFields {
  key PurchaseOrder     : String(10);
  key PurchaseOrderItem : String(5);
      ID                : String(15); //this ID is necessary for change tracking
      HierarchyLevel    : Integer default 1;
      ParentNodeID      : String(10);
      DrillState        : DrillState default 'leaf';
      to_Orders         : Association to Orders;
}

entity Contexts {
  key UserId         : String;
      FamilyName     : String;
      GivenName      : String;
      SapUser        : String(12);
      to_CostCenters : Composition of many CostCenters
                         on to_CostCenters.to_Contexts = $self;
}

entity CostCenters {
  key CostCenter  : String(10);
      to_Contexts : Association to Contexts;
}

entity ProcessingStateValues : CodeList {
  key code : String(1);
}
