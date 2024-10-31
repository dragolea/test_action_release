import { Repository } from '@dxfrontier/cds-ts-dispatcher';
import { BaseRepository, ExternalService } from '@dxfrontier/cds-ts-repository';

import { A_CostCenter } from '../../@cds-models/API_COSTCENTER_SRV';
import constants from '../util/constants/constants';

@Repository()
@ExternalService(constants.API.COST_CENTER)
export class A_CostCenterRepository extends BaseRepository<A_CostCenter> {
  constructor() {
    super(A_CostCenter);
  }
  // ... define custom CDS-QL actions if BaseRepository ones are not satisfying your needs !
}
