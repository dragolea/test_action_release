import {
  EntityHandler,
  Inject,
  Req,
  type TypedRequest,
  AfterRead,
  Results,
  BeforeRead,
  IsRole,
} from '@dxfrontier/cds-ts-dispatcher';
import { Order, Orders } from '../../../../@cds-models/ServiceAccruals';
import { OrdersService } from '../../../service/OrdersService';
import constants from '../../../util/constants/constants';

@EntityHandler(Orders)
export class OrdersHandler {
  @Inject(OrdersService) private ordersService: OrdersService;

  @BeforeRead()
  public async beforeRead(
    @Req() req: TypedRequest<Orders>,
    @IsRole(constants.ROLES.GENERAL) isGeneralUser: boolean,
  ): Promise<void> {
    if (isGeneralUser) {
      await this.ordersService.writeOrders(req);
    }
  }

  @AfterRead()
  public async afterRead(
    @Results() results: Order[],
    @Req() req: TypedRequest<Orders>,
    @IsRole(constants.ROLES.GENERAL) isGeneralUser: boolean,
    @IsRole(constants.ROLES.COST_CENTER) isCCR: boolean,
    @IsRole(constants.ROLES.CONTROLLING) isControlling: boolean,
    @IsRole(constants.ROLES.ACCOUNTING) isAccounting: boolean,
  ): Promise<void> {
    await this.ordersService.filterAndSumResults({ results, req, isGeneralUser, isCCR, isControlling, isAccounting });
  }
}
