import {
  EntityHandler,
  Inject,
  Req,
  type TypedRequest,
  AfterRead,
  Results,
  BeforeRead,
} from '@dxfrontier/cds-ts-dispatcher';
import { Order, Orders } from '../../../../@cds-models/ServiceAccruals';
import { OrdersService } from '../../../service/OrdersService';

@EntityHandler(Orders)
export class OrdersHandler {
  @Inject(OrdersService) private ordersService: OrdersService;

  @BeforeRead()
  public async beforeRead(@Req() req: TypedRequest<Orders>) {
    await this.ordersService.writeOrders(req);
  }

  @AfterRead()
  public async afterRead(@Results() results: Order[]) {
    await this.ordersService.calculateSum(results);
  }
}
