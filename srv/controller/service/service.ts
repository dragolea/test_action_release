import { CDSDispatcher } from '@dxfrontier/cds-ts-dispatcher';

import { OrdersHandler } from './handler/OrdersHandler';
import { OrderItemsHandler } from './handler/OrderItemsHandler';
import { ContextsHandler } from './handler/ContextsHandler';

export = new CDSDispatcher([OrderItemsHandler, OrdersHandler, ContextsHandler]).initialize();
