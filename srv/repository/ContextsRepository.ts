import { Contexts } from '#cds-models/ServiceAccruals';
import { Repository } from '@dxfrontier/cds-ts-dispatcher';
import { BaseRepository } from '@dxfrontier/cds-ts-repository';

@Repository()
export class ContextsRepository extends BaseRepository<Contexts> {
  constructor() {
    super(Contexts);
  }
  // ... define custom CDS-QL actions if BaseRepository ones are not satisfying your needs !
}
