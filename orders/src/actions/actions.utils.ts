/**
 * Pauses execution for a specified duration.
 *
 * @param milliseconds - Duration to wait in milliseconds.
 *
 * @returns - A promise that resolves after the delay.
 */
export const wait = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};
