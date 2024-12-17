import type { AxiosError } from "axios";

/**
 * Type guard to check if an error is an AxiosError.
 * @param error - The error to check.
 * @returns True if error is AxiosError, otherwise false.
 */
export const isAxiosError = (error: unknown): error is AxiosError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "isAxiosError" in error &&
    (error as AxiosError).isAxiosError === true
  );
};
