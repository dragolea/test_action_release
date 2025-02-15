import { Repository } from '@dxfrontier/cds-ts-dispatcher';
import { BaseRepository, ExternalService } from '@dxfrontier/cds-ts-repository';

import { A_PurchaseOrderItem } from '../../@cds-models/API_PURCHASEORDER_PROCESS_SRV';
import constants from '../util/constants/constants';

@Repository()
@ExternalService(constants.API.PURCHASE_ORDER)
export class A_PurchaseOrderItemRepository extends BaseRepository<A_PurchaseOrderItem> {
  constructor() {
    super(A_PurchaseOrderItem);
  }
  // ... define custom CDS-QL actions if BaseRepository ones are not satisfying your needs !
}
