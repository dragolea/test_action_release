import { CDSDispatcher } from '@dxfrontier/cds-ts-dispatcher';

import { OrdersHandler } from './handler/OrdersHandler';
import { ContextsHandler } from './handler/ContextsHandler';
import { UnboundActionsHandler } from './handler/UnboundActionsHandler';

export = new CDSDispatcher([OrdersHandler, ContextsHandler, UnboundActionsHandler]).initialize();
