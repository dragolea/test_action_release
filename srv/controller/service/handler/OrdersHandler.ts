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

@EntityHandler(Orders)
export class OrdersHandler {
  @Inject(OrdersService) private ordersService: OrdersService;

  @BeforeRead()
  public async beforeRead(@Req() req: TypedRequest<Orders>, @IsRole('fcoaccrualsGeneralUser') isGeneralUser: boolean) {
    if (isGeneralUser) {
      await this.ordersService.writeOrders(req);
    }
  }

  @AfterRead()
  public async afterRead(
    @Results() results: Order[],
    @Req() req: TypedRequest<Orders>,
    @IsRole('fcoaccrualsGeneralUser') isGeneralUser: boolean,
    @IsRole('fcoaccrualsCostCenterResponsible') isCCR: boolean,
    @IsRole('fcoaccrualsControlling') isControlling: boolean,
    @IsRole('fcoaccrualsAccounting') isAccounting: boolean,
  ) {
    await this.ordersService.filterAndSumResults({ results, req, isGeneralUser, isCCR, isControlling, isAccounting });
  }
}
