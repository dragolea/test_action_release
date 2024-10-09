import { SortOrder } from '../types/types';

const util = {
  sortArrayByProperty<T>(array: T[], property: keyof T, order: SortOrder = 'asc'): T[] {
    return array.sort((a, b) => {
      const propA = a[property];
      const propB = b[property];

      if (propA < propB) {
        return order === 'asc' ? -1 : 1;
      } else if (propA > propB) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  },
};

export default util;
