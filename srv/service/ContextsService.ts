import { Contexts } from '#cds-models/ServiceAccruals';
import { ServiceLogic, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import util from '../util/helpers/util';

@ServiceLogic()
export class ContextsService {
  public async writeContexts(req: TypedRequest<Contexts>) {
    return [await util.getUserContext(req)];
  }
}
