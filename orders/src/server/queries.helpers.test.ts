import dayjs from "dayjs";
import { getFinancialYearDates } from "./queries.helpers";

describe("queries.helpers.ts", () => {
  describe("getFinancialYearDates", () => {
    let originalEnv: NodeJS.ProcessEnv;
    const realDate = Date;

    const mockDate = (isoDate: string) => {
      global.Date = class extends realDate {
        constructor() {
          super();
          return new realDate(isoDate);
        }
      } as unknown as DateConstructor;
    };

    beforeAll(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      global.Date = realDate;
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("should return Jan-Dec financial year for the current year", () => {
      process.env.FINANCIAL_YEAR_PERIOD = "Jan-Dec";
      mockDate("2024-05-15T00:00:00Z"); // May 15, 2024
      const { startOfYear, endOfYear } = getFinancialYearDates();
      expect(startOfYear).toEqual(dayjs("2024-01-01").toDate());
      expect(endOfYear).toEqual(dayjs("2024-12-31").toDate());
    });

    it("should return July-June financial year if current month is after June", () => {
      process.env.FINANCIAL_YEAR_PERIOD = "July-June";
      mockDate("2024-08-15T00:00:00Z"); // August 15, 2024
      const { startOfYear, endOfYear } = getFinancialYearDates();
      expect(startOfYear).toEqual(dayjs("2024-07-01").toDate());
      expect(endOfYear).toEqual(dayjs("2025-06-30").toDate());
    });

    it("should return July-June financial year if current month is before July", () => {
      process.env.FINANCIAL_YEAR_PERIOD = "July-June";
      mockDate("2024-03-15T00:00:00Z"); // March 15, 2024
      const { startOfYear, endOfYear } = getFinancialYearDates();
      expect(startOfYear).toEqual(dayjs("2023-07-01").toDate());
      expect(endOfYear).toEqual(dayjs("2024-06-30").toDate());
    });

    it("should default to Jan-Dec if FINANCIAL_YEAR_PERIOD is not set", () => {
      delete process.env.FINANCIAL_YEAR_PERIOD;
      mockDate("2024-05-15T00:00:00Z");
      const { startOfYear, endOfYear } = getFinancialYearDates();
      expect(startOfYear).toEqual(dayjs("2024-01-01").toDate());
      expect(endOfYear).toEqual(dayjs("2024-12-31").toDate());
    });

    it("should handle boundary date at the very start of July-June year", () => {
      process.env.FINANCIAL_YEAR_PERIOD = "July-June";
      mockDate("2024-07-01T00:00:00Z");
      const { startOfYear, endOfYear } = getFinancialYearDates();
      // Since now is exactly July 1st 2024, it should count as starting the new year
      expect(startOfYear).toEqual(dayjs("2024-07-01").toDate());
      expect(endOfYear).toEqual(dayjs("2025-06-30").toDate());
    });

    it("should handle boundary date at the very end of July-June year", () => {
      process.env.FINANCIAL_YEAR_PERIOD = "July-June";
      mockDate("2025-06-30T00:00:00Z");
      const { startOfYear, endOfYear } = getFinancialYearDates();
      // Now is exactly June 30th 2025, so we are at the end of the financial year that started in July 2024
      expect(startOfYear).toEqual(dayjs("2024-07-01").toDate());
      expect(endOfYear).toEqual(dayjs("2025-06-30").toDate());
    });

    it("should handle boundary date at the very start of Jan-Dec year", () => {
      process.env.FINANCIAL_YEAR_PERIOD = "Jan-Dec";
      mockDate("2024-01-01T00:00:00Z");
      const { startOfYear, endOfYear } = getFinancialYearDates();
      expect(startOfYear).toEqual(dayjs("2024-01-01").toDate());
      expect(endOfYear).toEqual(dayjs("2024-12-31").toDate());
    });

    it("should handle boundary date at the very end of Jan-Dec year", () => {
      process.env.FINANCIAL_YEAR_PERIOD = "Jan-Dec";
      mockDate("2024-12-31T00:00:00Z");
      const { startOfYear, endOfYear } = getFinancialYearDates();
      expect(startOfYear).toEqual(dayjs("2024-01-01").toDate());
      expect(endOfYear).toEqual(dayjs("2024-12-31").toDate());
    });
  });
});
