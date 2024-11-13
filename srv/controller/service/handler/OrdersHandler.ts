import {
  EntityHandler,
  Inject,
  Req,
  type TypedRequest,
  AfterRead,
  Results,
  BeforeRead,
  IsRole,
  Env,
} from '@dxfrontier/cds-ts-dispatcher';
import { Order, Orders } from '../../../../@cds-models/ServiceAccruals';
import { OrdersService } from '../../../service/OrdersService';
import constants from '../../../util/constants/constants';
import { CDS_ENV } from '#dispatcher';

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
    // TODO: will be removed, only for testing purposes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Env<CDS_ENV>('requires.API_PURCHASEORDER_PROCESS_SRV') env: any,
  ): Promise<void> {
    await this.ordersService.filterAndSumResults({ results, req, isGeneralUser, isCCR, isControlling, isAccounting });
    console.log(env);
  }
}
