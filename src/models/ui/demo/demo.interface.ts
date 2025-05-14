
export interface DemoIncomeAndExpenditure {
  monthlySalary: string;
  commissionOrOvertime: string;
  governmentSubsidy: string;
  maintenance: string;
  dividends: string;
  rentReceived: string;
  netIncome: string;
  monthlyDeductions: string;
  totalExpenses: string;
  disposableIncome: string;
  /**
   * Initial deposit amount for the application.
   * Optional for the main applicant only.
   */
  initialDeposit?: string;
}