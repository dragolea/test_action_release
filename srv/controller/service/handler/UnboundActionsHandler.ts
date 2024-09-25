import { Inject, Service, CDS_DISPATCHER, UnboundActions } from '@dxfrontier/cds-ts-dispatcher';

@UnboundActions()
export class UnboundActionsHandler {
  @Inject(CDS_DISPATCHER.SRV) private readonly service: Service;
  // @OnError, @OnEvent, @OnAction, @OnFunction
}
