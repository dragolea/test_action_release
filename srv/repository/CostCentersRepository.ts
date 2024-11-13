import { CostCenters } from '#cds-models/ServiceAccruals';
import { Repository } from '@dxfrontier/cds-ts-dispatcher';
import { BaseRepository } from '@dxfrontier/cds-ts-repository';

@Repository()
export class CostCentersRepository extends BaseRepository<CostCenters> {
  constructor() {
    super(CostCenters);
  }
  // ... define custom CDS-QL actions if BaseRepository ones are not satisfying your needs !
}
