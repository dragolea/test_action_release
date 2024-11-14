import { CDSDispatcher } from '@dxfrontier/cds-ts-dispatcher';

import { OrdersHandler } from './handler/OrdersHandler';
import { ContextsHandler } from './handler/ContextsHandler';

export = new CDSDispatcher([OrdersHandler, ContextsHandler]).initialize();
