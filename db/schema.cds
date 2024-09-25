using {
  managed,
  sap.common.CodeList
} from '@sap/cds/common';

namespace de.freudenberg.fco.accruals;

entity Orders : managed {
  key ID                  : Integer;
      order               : String;
      number              : String;
      text                : String;
      openAmount          : String;
      ProvisioningType    : Association to ProvisioningType;
      provisioningAmmount : String;
}

entity ProvisioningType : CodeList {
  key ID : Integer;
}
