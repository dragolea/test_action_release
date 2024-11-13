import { Context, Contexts, CostCenter, Orders } from '#cds-models/ServiceAccruals';
import { Inject, ServiceLogic, TypedRequest } from '@dxfrontier/cds-ts-dispatcher';
import util from '../util/helpers/util';
import { ZC_HR_MASTER } from '#cds-models/ZC_HR_MASTER_CDS';
import { ContextsRepository } from '../repository/ContextsRepository';
import { ZC_HR_MASTER_Repository } from '../repository/ZC_HR_MASTER_Repository';
import { A_CostCenter } from '#cds-models/API_COSTCENTER_SRV';
import { Filter } from '@dxfrontier/cds-ts-repository';
import { A_CostCenterRepository } from '../repository/A_CostCenterRepository';
import { CostCentersRepository } from '../repository/CostCentersRepository';

@ServiceLogic()
export class ContextsService {
  @Inject(ContextsRepository) private contextsRepository: ContextsRepository;
  @Inject(ZC_HR_MASTER_Repository) private ZC_HR_MASTER_Repository: ZC_HR_MASTER_Repository;
  @Inject(A_CostCenterRepository) private costCenterRepository: A_CostCenterRepository;
  @Inject(CostCentersRepository) private costCentersRepository: CostCentersRepository;

  /**
   * Retrieves and maps the user context, including cost center information, based on the request data.
   *
   * @param req - The request object containing user data for retrieving the context.
   * @returns The mapped user context, or rejects the request if data is not found.
   */
  public async writeContexts(req: TypedRequest<Orders | Contexts>): Promise<void> {
    const masterData = await this.fetchUserContext(req.user.id);

    if (!masterData || !masterData.Bname) {
      req.reject(400, 'masterData not found');
      return;
    }

    const costCentersData = await this.fetchCostCenters(masterData.Bname);

    if (!costCentersData) {
      req.reject(400, 'costCentersData not found');
      return;
    }

    const mappedCostCenters: CostCenter[] = util.mapCostCenters(costCentersData, req.user.id);

    if (mappedCostCenters.length > 0) {
      for (const costCenter of mappedCostCenters) {
        await this.costCentersRepository.updateOrCreate(costCenter);
      }
    }

    const mappedContext: Context = util.mapUserContext(req, masterData.Bname, mappedCostCenters);

    await this.contextsRepository.updateOrCreate(mappedContext);
  }

  /**
   * Retrieves user context information based on the provided user ID.
   *
   * @param userId - The user ID (email) used to retrieve the user context.
   * @returns A promise that resolves to the user context if found; otherwise, returns undefined.
   */
  public async fetchUserContext(userId: string): Promise<ZC_HR_MASTER | undefined> {
    return await this.ZC_HR_MASTER_Repository.findOne({ EmailLower: userId.toLowerCase() });
  }

  /**
   * Retrieves cost centers for a given user, filtered by validity dates.
   *
   * @param userName - The username used to filter cost centers by responsible person.
   * @returns A promise that resolves to an array of cost centers satisfying the filter criteria.
   */
  public async fetchCostCenters(userName: string): Promise<A_CostCenter[] | undefined> {
    const filterByValidityStartDate = new Filter<A_CostCenter>({
      field: 'ValidityStartDate',
      operator: 'LESS THAN OR EQUALS',
      value: util.getCurrentDate(),
    });

    const filterByValidityEndDate = new Filter<A_CostCenter>({
      field: 'ValidityEndDate',
      operator: 'GREATER THAN OR EQUALS',
      value: util.getCurrentDate(),
    });

    const filterByCostCtrResponsibleUser = new Filter<A_CostCenter>({
      field: 'CostCtrResponsibleUser',
      operator: 'EQUALS',
      value: userName,
    });

    const filters = new Filter(
      'AND',
      filterByValidityStartDate,
      filterByValidityEndDate,
      filterByCostCtrResponsibleUser,
    );

    return this.costCenterRepository.find(filters);
  }
}
