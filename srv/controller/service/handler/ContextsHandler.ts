import { EntityHandler, Req, type TypedRequest, OnRead, Inject } from '@dxfrontier/cds-ts-dispatcher';
import { Contexts } from '../../../../@cds-models/ServiceAccruals';
import { ContextsService } from '../../../service/ContextsService';
import { UserContext } from '../../../util/types/types';

@EntityHandler(Contexts)
export class ContextsHandler {
  @Inject(ContextsService) private contextsService: ContextsService;

  @OnRead()
  public async onRead(@Req() req: TypedRequest<Contexts>): Promise<UserContext[] | undefined> {
    return await this.contextsService.writeContexts(req);
  }
}
