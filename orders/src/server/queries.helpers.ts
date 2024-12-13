import dayjs from "dayjs";

export const getFinancialYearDates = (): {
  startOfYear: Date;
  endOfYear: Date;
} => {
  const now = dayjs();
  const currentYear = now.year();
  const financialYearPeriod = process.env.FINANCIAL_YEAR_PERIOD ?? "Jan-Dec";

  let startOfYear: Date;
  let endOfYear: Date;

  if (financialYearPeriod === "July-June") {
    if (now.month() >= 6) {
      // Financial year from July 1 (current year) to June 30 (next year)
      startOfYear = dayjs().year(currentYear).month(6).date(1).toDate();
      endOfYear = dayjs()
        .year(currentYear + 1)
        .month(5)
        .date(30)
        .toDate();
    } else {
      // Financial year from July 1 (previous year) to June 30 (current year)
      startOfYear = dayjs()
        .year(currentYear - 1)
        .month(6)
        .date(1)
        .toDate();
      endOfYear = dayjs().year(currentYear).month(5).date(30).toDate();
    }
  } else {
    // Default to Jan-Dec financial year
    startOfYear = dayjs().year(currentYear).month(0).date(1).toDate();
    endOfYear = dayjs().year(currentYear).month(11).date(31).toDate();
  }

  return { startOfYear, endOfYear };
};
