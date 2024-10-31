import { Contexts } from '#cds-models/ServiceAccruals';
import { Inject, ServiceLogic, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import { OrderItemsService } from './OrderItemsService';

@ServiceLogic()
export class ContextsService {
  @Inject(OrderItemsService) private orderItemsService: OrderItemsService;

  public async writeContexts(req: TypedRequest<Contexts>) {
    return [await this.orderItemsService.fetchContext(req)];
  }
}
