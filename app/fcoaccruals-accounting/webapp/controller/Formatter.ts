import NumberFormat from 'sap/ui/core/format/NumberFormat';

export default class Formatter {
  public static formatFloat(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    const numberFormat = NumberFormat.getFloatInstance({
      decimals: 2,
      decimalSeparator: ',',
      groupingSeparator: '.',
      groupingEnabled: true,
    });

    return numberFormat.format(value);
  }
}
