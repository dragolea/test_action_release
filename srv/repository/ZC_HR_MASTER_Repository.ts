import { Repository } from '@dxfrontier/cds-ts-dispatcher';
import { BaseRepository, ExternalService } from '@dxfrontier/cds-ts-repository';

import { ZC_HR_MASTER } from '../../@cds-models/ZC_HR_MASTER_CDS';
import constants from '../util/constants/constants';

@Repository()
@ExternalService(constants.API.HR_MASTER)
export class ZC_HR_MASTER_Repository extends BaseRepository<ZC_HR_MASTER> {
  constructor() {
    super(ZC_HR_MASTER);
  }
  // ... define custom CDS-QL actions if BaseRepository ones are not satisfying your needs !
}
