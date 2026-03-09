// Finance Officer & Accounts Portal Type Definitions

export interface FinancialSnapshot {
  budgetAllocated: number;
  budgetSpent: number;
  revenueCollected: number;
  outstandingDues: number;
  cashFlow: CashFlowData[];
  salaryPercentage: number;
  lastUpdated: Date;
}

export interface CashFlowData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

export interface FinanceAlert {
  id: string;
  type: 'budget_variance' | 'large_payment' | 'fee_default' | 'anomaly';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  department?: string;
  amount?: number;
  threshold?: number;
  createdAt: Date;
  acknowledged: boolean;
}

export interface FinanceTask {
  id: string;
  type: 'purchase_approval' | 'scholarship_approval' | 'fee_waiver' | 'budget_override';
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: Date;
  amount: number;
  department: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected';
  documents: string[];
}

export interface FeeStructure {
  id: string;
  academicYear: string;
  semester: string;
  program: string;
  feeComponents: FeeComponent[];
  totalAmount: number;
  dueDate: Date;
  lateFeePenalty: number;
  active: boolean;
}

export interface FeeComponent {
  id: string;
  name: string;
  amount: number;
  category: 'tuition' | 'lab' | 'library' | 'development' | 'examination' | 'miscellaneous';
  mandatory: boolean;
}

export interface FeePayment {
  id: string;
  studentId: string;
  studentName: string;
  program: string;
  amount: number;
  paymentMethod: 'online' | 'cash' | 'check' | 'dd' | 'bank_transfer';
  transactionId?: string;
  paymentDate: Date;
  status: 'successful' | 'failed' | 'pending' | 'cancelled';
  feeComponents: string[];
  receivedBy?: string;
  remarks?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: Date;
  description: string;
  reference?: string;
  totalDebit: number;
  totalCredit: number;
  status: 'draft' | 'posted' | 'approved';
  createdBy: string;
  approvedBy?: string;
  accounts: AccountEntry[];
}

export interface AccountEntry {
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  department: string;
  vendor: Vendor;
  orderDate: Date;
  expectedDelivery: Date;
  totalAmount: number;
  status: 'pending' | 'approved' | 'delivered' | 'invoiced' | 'paid';
  items: POItem[];
  approvedBy?: string;
  deliveredDate?: Date;
  invoiceNumber?: string;
  paymentDate?: Date;
}

export interface POItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specifications?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  gstNumber?: string;
  panNumber?: string;
  paymentTerms: string;
  status: 'active' | 'inactive' | 'blocked';
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  month: string;
  year: number;
  basicSalary: number;
  allowances: PayrollComponent[];
  deductions: PayrollComponent[];
  grossSalary: number;
  netSalary: number;
  status: 'draft' | 'approved' | 'paid';
  paymentDate?: Date;
  paymentMethod: 'bank_transfer' | 'check' | 'cash';
}

export interface PayrollComponent {
  name: string;
  amount: number;
  type: 'allowance' | 'deduction';
  taxable: boolean;
}

export interface FinancialReport {
  id: string;
  name: string;
  type: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'budget_analysis' | 'audit_trail';
  period: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  generatedAt: Date;
  parameters: Record<string, any>;
  data: any;
}

export interface BudgetAllocation {
  id: string;
  department: string;
  category: string;
  budgetYear: string;
  allocatedAmount: number;
  spentAmount: number;
  availableAmount: number;
  utilizationPercentage: number;
  lastUpdated: Date;
}