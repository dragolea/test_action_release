import { EntityHandler, Req, type TypedRequest, OnRead, Inject } from '@dxfrontier/cds-ts-dispatcher';
import { Contexts } from '../../../../@cds-models/ServiceAccruals';
import { ContextsService } from '../../../service/ContextsService';

@EntityHandler(Contexts)
export class ContextsHandler {
  @Inject(ContextsService) private contextsService: ContextsService;

  @OnRead()
  public async onRead(@Req() req: TypedRequest<Contexts>) {
    return await this.contextsService.writeContexts(req);
  }
}
