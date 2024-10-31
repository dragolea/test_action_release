import { Repository } from '@dxfrontier/cds-ts-dispatcher';
import { BaseRepository, ExternalService } from '@dxfrontier/cds-ts-repository';

import { A_InternalOrder } from '../../@cds-models/API_INTERNALORDER_SRV';
import constants from '../util/constants/constants';

@Repository()
@ExternalService(constants.API.INTERNAL_ORDER)
export class A_InternalOrderRepository extends BaseRepository<A_InternalOrder> {
  constructor() {
    super(A_InternalOrder);
  }
  // ... define custom CDS-QL actions if BaseRepository ones are not satisfying your needs !
}
