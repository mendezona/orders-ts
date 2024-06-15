export const getFinancialYearDates = (): { startOfYear: Date, endOfYear: Date } => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const financialYearPeriod = process.env.FINANCIAL_YEAR_PERIOD ?? 'Jan-Dec';

  let startOfYear: Date;
  let endOfYear: Date;

  if (financialYearPeriod === 'July-June') {
    if (now.getMonth() >= 6) {
      startOfYear = new Date(currentYear, 6, 1);
      endOfYear = new Date(currentYear + 1, 5, 30);
    } else {
      startOfYear = new Date(currentYear - 1, 6, 1);
      endOfYear = new Date(currentYear, 5, 30);
    }
  } else {
    startOfYear = new Date(currentYear, 0, 1);
    endOfYear = new Date(currentYear, 11, 31);
  }

  return { startOfYear, endOfYear };
};