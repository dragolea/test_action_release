import { Repository } from '@dxfrontier/cds-ts-dispatcher';
import { BaseRepository, ExternalService } from '@dxfrontier/cds-ts-repository';

import { ZI_PURCHASEORDERHISTORY } from '../../@cds-models/ZAPI_PURCHASE_ORDER_HISTORY_SRV';
import constants from '../util/constants/constants';

@Repository()
@ExternalService(constants.API.PURCHASE_ORDER_HISTORY)
export class ZI_PURCHASEORDERHISTORY_Repository extends BaseRepository<ZI_PURCHASEORDERHISTORY> {
  constructor() {
    super(ZI_PURCHASEORDERHISTORY);
  }
  // ... define custom CDS-QL actions if BaseRepository ones are not satisfying your needs !
}
