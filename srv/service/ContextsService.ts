import { Contexts } from '#cds-models/ServiceAccruals';
import { Inject, ServiceLogic, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import { OrderItemsService } from './OrderItemsService';
import { UserContext } from '../util/types/types';

@ServiceLogic()
export class ContextsService {
  @Inject(OrderItemsService) private orderItemsService: OrderItemsService;

  public async writeContexts(req: TypedRequest<Contexts>): Promise<UserContext[] | undefined> {
    return await this.orderItemsService.fetchContext(req);
  }
}
