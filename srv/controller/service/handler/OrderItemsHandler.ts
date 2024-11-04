import { EntityHandler, Inject, Req, BeforeRead, IsRole, Request } from '@dxfrontier/cds-ts-dispatcher';
import { OrderItems } from '../../../../@cds-models/ServiceAccruals';
import { OrderItemsService } from '../../../service/OrderItemsService';
import constants from '../../../util/constants/constants';

@EntityHandler(OrderItems)
export class OrderItemsHandler {
  @Inject(OrderItemsService) private orderItemsService: OrderItemsService;

  @BeforeRead()
  public async beforeRead(@Req() req: Request, @IsRole(constants.ROLES.GENERAL) isGeneralUser: boolean): Promise<void> {
    if (isGeneralUser) {
      await this.orderItemsService.writeOrderItems(req);
    }
  }
}
