import { EntityHandler, Req, type TypedRequest, Inject, BeforeRead } from '@dxfrontier/cds-ts-dispatcher';
import { Contexts } from '../../../../@cds-models/ServiceAccruals';
import { ContextsService } from '../../../service/ContextsService';

@EntityHandler(Contexts)
export class ContextsHandler {
  @Inject(ContextsService) private contextsService: ContextsService;

  @BeforeRead()
  public async beforeRead(@Req() req: TypedRequest<Contexts>): Promise<void> {
    await this.contextsService.writeContexts(req);
  }
}
