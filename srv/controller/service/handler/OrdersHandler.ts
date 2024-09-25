import {
  AfterRead,
  EntityHandler,
  Inject,
  Req,
  Results,
  Service,
  CDS_DISPATCHER,
  type TypedRequest,
} from '@dxfrontier/cds-ts-dispatcher';

import { Orders } from '../../../../@cds-models/ServiceAccruals';

@EntityHandler(Orders)
// @Use(MiddlewareAccruals)
export class OrdersHandler {
  @Inject(CDS_DISPATCHER.SRV) private readonly srv: Service;
  // @OnRead, @BeforeRead, @AfterRead, @OnUpdate ...

  @AfterRead()
  // @Use(MiddlewareMethodAfterRead1)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async afterRead(@Results() results: Orders, @Req() req: TypedRequest<Orders>): Promise<Orders> {
    // console.log(req);
    return results;
  }
}
