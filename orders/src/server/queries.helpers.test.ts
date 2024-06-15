import { getFinancialYearDates } from "./queries.helpers";

describe("getFinancialYearDates", () => {
  const realDate = Date;
  const mockDate = (date: string) => {
    global.Date = class extends realDate {
      constructor() {
        super();
        return new realDate(date);
      }
    } as unknown as DateConstructor;
  };
  afterAll(() => {
    global.Date = realDate;
  });

  it("should return Jan-Dec financial year for current year", () => {
    process.env.FINANCIAL_YEAR_PERIOD = "Jan-Dec";
    mockDate("2024-05-15T00:00:00Z");
    const { startOfYear, endOfYear } = getFinancialYearDates();
    expect(startOfYear).toEqual(new Date(2024, 0, 1));
    expect(endOfYear).toEqual(new Date(2024, 11, 31));
  });
  it("should return July-June financial year for current year starting in July", () => {
    process.env.FINANCIAL_YEAR_PERIOD = "July-June";
    mockDate("2024-08-15T00:00:00Z");
    const { startOfYear, endOfYear } = getFinancialYearDates();
    expect(startOfYear).toEqual(new Date(2024, 6, 1));
    expect(endOfYear).toEqual(new Date(2025, 5, 30));
  });
  it("should return July-June financial year for current year starting before July", () => {
    process.env.FINANCIAL_YEAR_PERIOD = "July-June";
    mockDate("2024-03-15T00:00:00Z");
    const { startOfYear, endOfYear } = getFinancialYearDates();
    expect(startOfYear).toEqual(new Date(2023, 6, 1));
    expect(endOfYear).toEqual(new Date(2024, 5, 30));
  });
  it("should default to Jan-Dec financial year if environment variable is not set", () => {
    delete process.env.FINANCIAL_YEAR_PERIOD;
    mockDate("2024-05-15T00:00:00Z");
    const { startOfYear, endOfYear } = getFinancialYearDates();
    expect(startOfYear).toEqual(new Date(2024, 0, 1));
    expect(endOfYear).toEqual(new Date(2024, 11, 31));
  });
});
