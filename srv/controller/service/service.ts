import { CDSDispatcher } from '@dxfrontier/cds-ts-dispatcher';

import { OrdersHandler } from './handler/OrdersHandler';
import { OrderItemsHandler } from './handler/OrderItemsHandler';

export = new CDSDispatcher([OrderItemsHandler, OrdersHandler]).initialize();
