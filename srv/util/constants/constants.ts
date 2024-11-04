const constants = {
  API: {
    PURCHASE_ORDER: 'API_PURCHASEORDER_PROCESS_SRV',
    HR_MASTER: 'ZC_HR_MASTER_CDS',
    INTERNAL_ORDER: 'API_INTERNALORDER_SRV',
    COST_CENTER: 'API_COSTCENTER_SRV',
    PURCHASE_ORDER_HISTORY: 'ZAPI_PURCHASE_ORDER_HISTORY_SRV',
  },

  PROCESSING_STATE: {
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

  ACCOUNT_ASSIGNMENT_CATEGORY: {
    ORDER: 'F',
    COST_CENTER: 'K',
  },

  ROLES: {
    GENERAL: 'fcoaccrualsGeneralUser',
    COST_CENTER: 'fcoaccrualsCostCenterResponsible',
    CONTROLLING: 'fcoaccrualsControlling',
    ACCOUNTING: 'fcoaccrualsAccounting',
  },
};

export default constants;
