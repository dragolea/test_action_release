/* eslint-disable @typescript-eslint/consistent-type-definitions */

import { Order, Orders } from '#cds-models/ServiceAccruals';
import { TypedRequest } from '@sap/cds';

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

export type RolesAndResult = {
  results: Order[];
  req: TypedRequest<Orders>;
} & Roles;

export type RolesAndUserContext = {
  userContext: UserContext;
  order: Order;
} & Roles;

export type Roles = {
  isGeneralUser: boolean;
  isCCR: boolean;
  isControlling: boolean;
  isAccounting: boolean;
};
