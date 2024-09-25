import { CDSDispatcher } from '@dxfrontier/cds-ts-dispatcher';

import { OrdersHandler } from './handler/OrdersHandler';
import { UnboundActionsHandler } from './handler/UnboundActionsHandler';

export = new CDSDispatcher([OrdersHandler, UnboundActionsHandler]).initialize();
