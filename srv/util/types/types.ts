/* eslint-disable @typescript-eslint/consistent-type-definitions */

export type SortOrder = 'asc' | 'desc';
export type DrillState = 'expanded' | 'leaf';

export type UserContext = {
  UserId: string;
  SapUser: string;
  CostCenter: string;
  CostCenterName: string;
};
