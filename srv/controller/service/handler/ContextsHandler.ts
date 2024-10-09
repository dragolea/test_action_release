import {
  EntityHandler,
  Inject,
  Req,
  Service,
  CDS_DISPATCHER,
  type TypedRequest,
  OnRead,
} from '@dxfrontier/cds-ts-dispatcher';
import cds from '@sap/cds';
import { Contexts } from '../../../../@cds-models/ServiceAccruals';
import constants from '../../../util/constants/constants';

@EntityHandler(Contexts)
export class ContextsHandler {
  @Inject(CDS_DISPATCHER.SRV) private readonly srv: Service;

  @OnRead()
  public async afterRead(@Req() req: TypedRequest<Contexts>) {
    const results = await this.handleContexts(req);

    return results;
  }

  /**
   * Retrieves context information for the current user by querying the SAP HR Master API.
   * It fetches user details such as SAP user ID, cost center, and cost center name based on the user's email.
   * If no matching data is found, a default object with null values is returned.
   *
   * @private
   * @async
   * @param {TypedRequest<Contexts>} req - The request object containing user information, such as the user ID.
   * @returns {Promise<Array<{ UserId: string, SapUser: string | null, CostCenter: string | null, CostCenterName: string | null }>>}
   * A promise that resolves to an array containing user context information (SAP user, cost center, etc.).
   */
  private async handleContexts(req: TypedRequest<Contexts>) {
    const s4HrMasterApi = await cds.connect.to(constants.API.HR_MASTER);
    const { ZC_HR_MASTER } = s4HrMasterApi.entities;

    let user = req.user.id;

    // ! just for testing purposes
    user = 'christoph.doeringer@abs-gmbh.de';

    try {
      const oDataMasterData = await s4HrMasterApi.run(
        SELECT.from(ZC_HR_MASTER).where({ EmailLower: user.toLowerCase() }),
      );

      if (oDataMasterData?.length > 0) {
        return [
          {
            UserId: user,
            SapUser: oDataMasterData[0].Bname,
            CostCenter: oDataMasterData[0].Kostl,
            CostCenterName: oDataMasterData[0].Ktext,
          },
        ];
      }
    } catch (error) {
      console.log(error);
    }

    return [
      {
        UserId: user,
        SapUser: null,
        CostCenter: null,
        CostCenterName: null,
      },
    ];
  }
}
