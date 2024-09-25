import { Repository } from '@dxfrontier/cds-ts-dispatcher';
import { BaseRepository } from '@dxfrontier/cds-ts-repository';

import { Order } from '../../@cds-models/ServiceAccruals';

@Repository()
export class OrdersRepository extends BaseRepository<Order> {
  constructor() {
    super(Order);
  }
  // ... define custom CDS-QL actions if BaseRepository ones are not satisfying your needs !
}
