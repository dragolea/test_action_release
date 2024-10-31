using {de.freudenberg.fco.accruals.ProcessingStateValues} from '../schema';

type DrillState      : String enum {
  expanded;
  leaf;
}

type ProcessingState : Association to ProcessingStateValues;
