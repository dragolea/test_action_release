/* eslint-disable @typescript-eslint/consistent-type-definitions */

export type SortOrder = 'asc' | 'desc';
export type DrillState = 'expanded' | 'leaf';

export type UserContext = {
  UserId: string;
  FamilyName: string;
  GivenName: string;
  SapUser: string;
  to_CostCenters: CostCenter[];
};

export type CostCenter = {
  CostCenter: string;
  to_Contexts: string;
};
