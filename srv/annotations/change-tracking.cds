using {ServiceAccruals} from '../controller/service/service';

annotate ServiceAccruals.OrderItems {
  OpenTotalAmountEditable @changelog;
  ProcessingState         @changelog;
  ApprovedByCCR           @changelog;
  ApprovedByCON           @changelog;
  ApprovedByACC           @changelog;
};
