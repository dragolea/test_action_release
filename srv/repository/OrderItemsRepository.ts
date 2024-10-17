import { Repository } from '@dxfrontier/cds-ts-dispatcher';
import { BaseRepository } from '@dxfrontier/cds-ts-repository';

import { OrderItem } from '../../@cds-models/ServiceAccruals';

@Repository()
export class OrderItemsRepository extends BaseRepository<OrderItem> {
  constructor() {
    super(OrderItem);
  }
  // ... define custom CDS-QL actions if BaseRepository ones are not satisfying your needs !
}
