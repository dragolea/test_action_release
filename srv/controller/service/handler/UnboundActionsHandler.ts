import { sum, toggleApprove, updateProcessingState } from '#cds-models/ServiceAccruals';
import { type ActionRequest, Inject, IsRole, OnAction, Req, UnboundActions } from '@dxfrontier/cds-ts-dispatcher';
import { UnboundActionsService } from '../../../service/UnboundActionService';
import constants from '../../../util/constants/constants';

@UnboundActions()
export class UnboundActionsHandler {
  @Inject(UnboundActionsService) private unboundActionsService: UnboundActionsService;

  @OnAction(sum)
  public async sum(
    @Req() req: ActionRequest<typeof sum>,
    @IsRole(constants.ROLES.GENERAL) isGeneralUser: boolean,
    @IsRole(constants.ROLES.COST_CENTER) isCCR: boolean,
    @IsRole(constants.ROLES.CONTROLLING) isControlling: boolean,
    @IsRole(constants.ROLES.ACCOUNTING) isAccounting: boolean,
  ) {
    return await this.unboundActionsService.sum({
      orderItem: req.data.orderItem,
      newValue: req.data.newValue,
      isGeneralUser,
      isCCR,
      isControlling,
      isAccounting,
    });
  }

  @OnAction(updateProcessingState)
  public async updateProcessingState(
    @Req() req: ActionRequest<typeof updateProcessingState>,
    @IsRole(constants.ROLES.GENERAL) isGeneralUser: boolean,
    @IsRole(constants.ROLES.COST_CENTER) isCCR: boolean,
    @IsRole(constants.ROLES.CONTROLLING) isControlling: boolean,
    @IsRole(constants.ROLES.ACCOUNTING) isAccounting: boolean,
  ) {
    return await this.unboundActionsService.updateProcessingState({
      orders: req.data.orders,
      isGeneralUser,
      isCCR,
      isControlling,
      isAccounting,
    });
  }

  @OnAction(toggleApprove)
  public async toggleApprove(
    @Req() req: ActionRequest<typeof toggleApprove>,
    @IsRole(constants.ROLES.COST_CENTER) isCCR: boolean,
    @IsRole(constants.ROLES.CONTROLLING) isControlling: boolean,
    @IsRole(constants.ROLES.ACCOUNTING) isAccounting: boolean,
  ) {
    return await this.unboundActionsService.toggleApprove({
      orderItem: req.data.orderItem,
      newValue: req.data.newValue,
      isCCR,
      isControlling,
      isAccounting,
    });
  }
}
