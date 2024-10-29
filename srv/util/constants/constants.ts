const constants = {
  API: {
    PURCHASEORDER: 'API_PURCHASEORDER_PROCESS_SRV',
    HR_MASTER: 'ZC_HR_MASTER_CDS',
    INTERNALORDER: 'API_INTERNALORDER_SRV',
    COSTCENTER: 'API_COSTCENTER_SRV',
  },

  ProcessingState: {
    INITIAL: '0',
    USER: '1',
    CCR: '2',
    CONTROLLING: '3',
    ACCOUNTING: '4',
    FINAL: '5',
  },

  HIGHLIGHT: {
    NONE: 'None',
    INFORMATION: 'Information',
    SUCCESS: 'Success',
  },
};

export default constants;
