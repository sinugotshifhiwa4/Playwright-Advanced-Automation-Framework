import ErrorHandler from '../../errors/errorHandler';

export default class FinanceManager {
  /**
   * Retrieves an element from the end of an array by its reversed index.
   *
   * @param arr - The source array
   * @param reverseIndex - Index from the end of the array (0 = last element)
   * @returns The element at the specified reversed position
   * @throws {Error} If the index is out of bounds or parameters are invalid
   */
  public static getLastElementByIndex(arr: string[], reverseIndex: number): string {
    try {
      if (!arr) {
        throw new Error('Array cannot be null or undefined');
      }

      if (!Number.isInteger(reverseIndex) || reverseIndex < 0 || reverseIndex >= arr.length) {
        throw new Error(
          `Reverse index ${reverseIndex} is out of bounds for array with length ${arr.length}`,
        );
      }

      return arr[arr.length - 1 - reverseIndex];
    } catch (error) {
      ErrorHandler.captureError(
        error,
        'getLastElementByIndex',
        'Failed to get last element by index',
      );
      throw error;
    }
  }

  /**
   * Removes 'R ' prefix and all whitespace from a string.
   * If input is null or undefined, returns "0".
   *
   * @param value - The input string that might contain currency formatting
   * @returns A cleaned string with 'R ' and whitespace removed
   */
  public static cleanCurrencyString(value: string | null | undefined): string {
    return (value ?? '0').replace(/R\s/g, '').replace(/\s/g, '');
  }

  /**
   * Safely converts a string or number value to a number, defaulting to 0 for invalid inputs.
   *
   * @param value - Input value to parse
   * @returns Parsed number or 0 if invalid
   */
  private static parseToNumber(value: string | number): number {
    if (typeof value === 'string') {
      const cleaned = this.cleanCurrencyString(value);
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return isNaN(value) ? 0 : value;
  }
}
