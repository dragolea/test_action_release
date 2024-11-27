/* eslint-disable @typescript-eslint/consistent-type-definitions */

import { Order, Orders, Context } from '#cds-models/ServiceAccruals';
import { TypedRequest } from '@sap/cds';

export type SortOrder = 'asc' | 'desc';
export type DrillState = 'expanded' | 'leaf';

export type RolesAndResult = {
  results: Order[];
  req: TypedRequest<Orders>;
} & Roles;

export type RolesAndUserContext = {
  userContext: Context;
  order: Order;
} & Roles;

export type Roles = {
  isGeneralUser: boolean;
  isCCR: boolean;
  isControlling: boolean;
  isAccounting: boolean;
};

export type OrderItemHistory = {
  totalInvoiceAmount: number;
  isFinallyInvoiced: boolean;
};

export type CostCenterData = {
  orderID: string;
  costCenterID: string;
};
