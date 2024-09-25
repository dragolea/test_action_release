import { Inject, Service, ServiceLogic, CDS_DISPATCHER } from '@dxfrontier/cds-ts-dispatcher';

import { OrdersRepository } from '../repository/OrdersRepository';

@ServiceLogic()
export class OrdersService {
  @Inject(CDS_DISPATCHER.SRV) private readonly srv: Service;
  @Inject(OrdersRepository) private readonly ordersRepository: OrdersRepository;
}
