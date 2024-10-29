import { EntityHandler, Inject, Req, type TypedRequest, BeforeRead, IsRole } from '@dxfrontier/cds-ts-dispatcher';
import { OrderItems, Orders } from '../../../../@cds-models/ServiceAccruals';
import { OrderItemsService } from '../../../service/OrderItemsService';

@EntityHandler(OrderItems)
export class OrderItemsHandler {
  @Inject(OrderItemsService) private orderItemsService: OrderItemsService;

  @BeforeRead()
  public async beforeRead(
    @Req() req: TypedRequest<OrderItems | Orders>,
    @IsRole('fcoaccrualsGeneralUser') isGeneralUser: boolean,
  ) {
    if (isGeneralUser) {
      await this.orderItemsService.writeOrderItems(req);
    }
  }
}
