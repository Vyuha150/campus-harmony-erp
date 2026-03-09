import { FinancialSnapshot, FinanceAlert, FinanceTask, FeePayment, JournalEntry, PurchaseOrder, PayrollRecord, BudgetAllocation, Vendor, FeeStructure } from '@/types/finance';

export const financialSnapshot: FinancialSnapshot = {
  budgetAllocated: 450000000,
  budgetSpent: 287500000,
  revenueCollected: 380000000,
  outstandingDues: 45000000,
  cashFlow: [
    { month: 'Apr', income: 85000000, expenses: 32000000, balance: 53000000 },
    { month: 'May', income: 42000000, expenses: 35000000, balance: 7000000 },
    { month: 'Jun', income: 38000000, expenses: 33000000, balance: 5000000 },
    { month: 'Jul', income: 95000000, expenses: 40000000, balance: 55000000 },
    { month: 'Aug', income: 25000000, expenses: 38000000, balance: -13000000 },
    { month: 'Sep', income: 30000000, expenses: 35000000, balance: -5000000 },
    { month: 'Oct', income: 35000000, expenses: 37000000, balance: -2000000 },
    { month: 'Nov', income: 30000000, expenses: 37500000, balance: -7500000 },
  ],
  salaryPercentage: 62.4,
  lastUpdated: new Date('2026-03-09'),
};

export const financeAlerts: FinanceAlert[] = [
  { id: 'FA001', type: 'budget_variance', title: 'Computer Science Dept Budget Alert', description: 'CS Dept has spent 82% of annual budget in first two quarters', severity: 'high', department: 'Computer Science', amount: 8200000, threshold: 50, createdAt: new Date('2026-03-08'), acknowledged: false },
  { id: 'FA002', type: 'large_payment', title: 'Vendor Payment Pending Approval', description: 'Lab equipment invoice from Agilent Technologies awaiting approval', severity: 'medium', amount: 4500000, createdAt: new Date('2026-03-07'), acknowledged: false },
  { id: 'FA003', type: 'fee_default', title: 'Fee Default Threshold Exceeded', description: '156 students have outstanding dues beyond 60-day threshold', severity: 'high', amount: 12400000, threshold: 100, createdAt: new Date('2026-03-06'), acknowledged: false },
  { id: 'FA004', type: 'anomaly', title: 'Duplicate Invoice Detected', description: 'Possible duplicate invoice #INV-2026-4421 from vendor Delta Supplies', severity: 'critical', amount: 225000, createdAt: new Date('2026-03-09'), acknowledged: false },
  { id: 'FA005', type: 'budget_variance', title: 'Library Budget Under-utilized', description: 'Library has only utilized 18% of budget – review allocation', severity: 'low', department: 'Library', amount: 1800000, threshold: 40, createdAt: new Date('2026-03-05'), acknowledged: true },
];

export const financeTasks: FinanceTask[] = [
  { id: 'FT001', type: 'purchase_approval', title: 'Purchase Request – Network Equipment', description: 'IT Dept requests procurement of 50 managed switches and 200 CAT6 cables. Dean approved.', requestedBy: 'Dr. Ramesh Kumar (IT HOD)', requestedAt: new Date('2026-03-07'), amount: 1850000, department: 'IT Department', priority: 'high', status: 'pending', documents: ['PO-2026-0045.pdf', 'QuotationComparison.xlsx'] },
  { id: 'FT002', type: 'scholarship_approval', title: 'Merit Scholarship – Batch 2025', description: '23 students qualify for merit-based fee waiver (50% tuition). Registrar has verified eligibility.', requestedBy: 'Dr. Priya Singh (Registrar)', requestedAt: new Date('2026-03-06'), amount: 2300000, department: 'Academic Affairs', priority: 'high', status: 'pending', documents: ['MeritList2025.pdf'] },
  { id: 'FT003', type: 'fee_waiver', title: 'Fee Waiver – Economic Hardship', description: 'Student Rahul Verma (EE-3rd Year) requests full fee waiver due to family emergency.', requestedBy: 'Dean of Student Welfare', requestedAt: new Date('2026-03-05'), amount: 185000, department: 'Student Affairs', priority: 'medium', status: 'pending', documents: ['ApplicationForm.pdf', 'IncomeCertificate.pdf'] },
  { id: 'FT004', type: 'budget_override', title: 'Budget Override – Research Lab', description: 'Physics Dept requests ₹15L additional budget for SERB-funded research equipment', requestedBy: 'Dr. Anand Patel (Physics HOD)', requestedAt: new Date('2026-03-04'), amount: 1500000, department: 'Physics', priority: 'medium', status: 'pending', documents: ['SERB_Grant_Letter.pdf', 'EquipmentList.pdf'] },
];

export const feePayments: FeePayment[] = [
  { id: 'FP001', studentId: 'STU2024001', studentName: 'Aisha Sharma', program: 'B.Tech CSE', amount: 185000, paymentMethod: 'online', transactionId: 'TXN20260308001', paymentDate: new Date('2026-03-08'), status: 'successful', feeComponents: ['Tuition', 'Lab', 'Library'] },
  { id: 'FP002', studentId: 'STU2024015', studentName: 'Vikram Patel', program: 'MBA', amount: 275000, paymentMethod: 'bank_transfer', transactionId: 'NEFT20260307042', paymentDate: new Date('2026-03-07'), status: 'successful', feeComponents: ['Tuition', 'Development'] },
  { id: 'FP003', studentId: 'STU2023088', studentName: 'Priya Nair', program: 'B.Tech ECE', amount: 92500, paymentMethod: 'cash', paymentDate: new Date('2026-03-08'), status: 'successful', feeComponents: ['Tuition (Partial)'], receivedBy: 'Mr. Suresh (Cashier)' },
  { id: 'FP004', studentId: 'STU2024102', studentName: 'Rahul Gupta', program: 'M.Sc Physics', amount: 125000, paymentMethod: 'online', transactionId: 'TXN20260308005', paymentDate: new Date('2026-03-08'), status: 'failed', feeComponents: ['Tuition', 'Lab'], remarks: 'Payment gateway timeout' },
  { id: 'FP005', studentId: 'STU2025033', studentName: 'Deepika Reddy', program: 'B.Tech IT', amount: 185000, paymentMethod: 'dd', transactionId: 'DD-SBI-004521', paymentDate: new Date('2026-03-06'), status: 'successful', feeComponents: ['Tuition', 'Lab', 'Library'], receivedBy: 'Mr. Suresh (Cashier)' },
];

export const feeStructures: FeeStructure[] = [
  { id: 'FS001', academicYear: '2025-26', semester: 'Even', program: 'B.Tech', feeComponents: [
    { id: 'FC01', name: 'Tuition Fee', amount: 125000, category: 'tuition', mandatory: true },
    { id: 'FC02', name: 'Lab Fee', amount: 25000, category: 'lab', mandatory: true },
    { id: 'FC03', name: 'Library Fee', amount: 10000, category: 'library', mandatory: true },
    { id: 'FC04', name: 'Development Fee', amount: 15000, category: 'development', mandatory: true },
    { id: 'FC05', name: 'Examination Fee', amount: 10000, category: 'examination', mandatory: true },
  ], totalAmount: 185000, dueDate: new Date('2026-01-15'), lateFeePenalty: 100, active: true },
  { id: 'FS002', academicYear: '2025-26', semester: 'Even', program: 'MBA', feeComponents: [
    { id: 'FC06', name: 'Tuition Fee', amount: 225000, category: 'tuition', mandatory: true },
    { id: 'FC07', name: 'Library Fee', amount: 15000, category: 'library', mandatory: true },
    { id: 'FC08', name: 'Development Fee', amount: 25000, category: 'development', mandatory: true },
    { id: 'FC09', name: 'Examination Fee', amount: 10000, category: 'examination', mandatory: true },
  ], totalAmount: 275000, dueDate: new Date('2026-01-15'), lateFeePenalty: 150, active: true },
];

export const journalEntries: JournalEntry[] = [
  { id: 'JE001', entryNumber: 'JV-2026-0089', date: new Date('2026-03-05'), description: 'Interest income on FD – Q3 FY2025-26', reference: 'FD-SBI-2024-001', totalDebit: 450000, totalCredit: 450000, status: 'posted', createdBy: 'Accounts Team', approvedBy: 'CFO', accounts: [
    { accountCode: '1001', accountName: 'Bank – SBI Current A/c', debitAmount: 450000, creditAmount: 0 },
    { accountCode: '4002', accountName: 'Interest Income – FD', debitAmount: 0, creditAmount: 450000 },
  ]},
  { id: 'JE002', entryNumber: 'JV-2026-0090', date: new Date('2026-03-07'), description: 'Depreciation – Computer Equipment (Monthly)', reference: 'DEP-MAR-2026', totalDebit: 280000, totalCredit: 280000, status: 'draft', createdBy: 'Accounts Team', accounts: [
    { accountCode: '5005', accountName: 'Depreciation Expense', debitAmount: 280000, creditAmount: 0 },
    { accountCode: '2003', accountName: 'Accumulated Depreciation – Equipment', debitAmount: 0, creditAmount: 280000 },
  ]},
];

export const purchaseOrders: PurchaseOrder[] = [
  { id: 'PO001', poNumber: 'PO-2026-0041', department: 'Computer Science', vendor: { id: 'V001', name: 'Dell Technologies India', contactPerson: 'Rajesh Mehta', email: 'rajesh@dell.com', phone: '9876543210', address: 'Bangalore, Karnataka', gstNumber: '29AABC1234R1Z5', panNumber: 'AABC1234R', paymentTerms: 'Net 30', status: 'active' }, orderDate: new Date('2026-02-15'), expectedDelivery: new Date('2026-03-15'), totalAmount: 3200000, status: 'delivered', items: [
    { id: 'POI1', description: 'Dell OptiPlex 7000 Desktop', quantity: 40, unitPrice: 65000, totalPrice: 2600000 },
    { id: 'POI2', description: 'Dell 24" Monitor P2422H', quantity: 40, unitPrice: 15000, totalPrice: 600000 },
  ], approvedBy: 'Finance Officer', deliveredDate: new Date('2026-03-08') },
  { id: 'PO002', poNumber: 'PO-2026-0045', department: 'IT Department', vendor: { id: 'V002', name: 'Cisco Systems India', contactPerson: 'Priya Sharma', email: 'priya@cisco.com', phone: '9876543220', address: 'Mumbai, Maharashtra', gstNumber: '27AABCC4321R1Z3', panNumber: 'AABCC4321R', paymentTerms: 'Net 45', status: 'active' }, orderDate: new Date('2026-03-07'), expectedDelivery: new Date('2026-04-07'), totalAmount: 1850000, status: 'pending', items: [
    { id: 'POI3', description: 'Cisco Catalyst 2960-X 48-port Switch', quantity: 50, unitPrice: 35000, totalPrice: 1750000 },
    { id: 'POI4', description: 'CAT6 Cable Box (305m)', quantity: 20, unitPrice: 5000, totalPrice: 100000 },
  ]},
];

export const vendors: Vendor[] = [
  { id: 'V001', name: 'Dell Technologies India', contactPerson: 'Rajesh Mehta', email: 'rajesh@dell.com', phone: '9876543210', address: 'Bangalore, Karnataka', gstNumber: '29AABC1234R1Z5', panNumber: 'AABC1234R', paymentTerms: 'Net 30', status: 'active' },
  { id: 'V002', name: 'Cisco Systems India', contactPerson: 'Priya Sharma', email: 'priya@cisco.com', phone: '9876543220', address: 'Mumbai, Maharashtra', gstNumber: '27AABCC4321R1Z3', panNumber: 'AABCC4321R', paymentTerms: 'Net 45', status: 'active' },
  { id: 'V003', name: 'Agilent Technologies', contactPerson: 'Dr. Suresh Iyer', email: 'suresh@agilent.com', phone: '9876543230', address: 'Hyderabad, Telangana', gstNumber: '36AABCA5678R1Z1', panNumber: 'AABCA5678R', paymentTerms: 'Net 60', status: 'active' },
  { id: 'V004', name: 'Delta Supplies Pvt Ltd', contactPerson: 'Mahesh Kumar', email: 'mahesh@deltasupplies.in', phone: '9876543240', address: 'Chennai, Tamil Nadu', gstNumber: '33AABCD1234R1Z7', panNumber: 'AABCD1234R', paymentTerms: 'Net 15', status: 'active' },
  { id: 'V005', name: 'National Instruments India', contactPerson: 'Kavitha Rao', email: 'kavitha@ni.com', phone: '9876543250', address: 'Bangalore, Karnataka', gstNumber: '29AABCN5678R1Z2', panNumber: 'AABCN5678R', paymentTerms: 'Net 30', status: 'active' },
];

export const payrollRecords: PayrollRecord[] = [
  { id: 'PR001', employeeId: 'EMP001', employeeName: 'Dr. Rajesh Kumar', department: 'Computer Science', designation: 'Professor & HOD', month: 'March', year: 2026, basicSalary: 120000, allowances: [
    { name: 'HRA', amount: 48000, type: 'allowance', taxable: true },
    { name: 'DA', amount: 36000, type: 'allowance', taxable: true },
    { name: 'Research Allowance', amount: 15000, type: 'allowance', taxable: true },
    { name: 'Medical Allowance', amount: 5000, type: 'allowance', taxable: false },
  ], deductions: [
    { name: 'PF', amount: 14400, type: 'deduction', taxable: false },
    { name: 'Professional Tax', amount: 2500, type: 'deduction', taxable: false },
    { name: 'TDS', amount: 18500, type: 'deduction', taxable: false },
  ], grossSalary: 224000, netSalary: 188600, status: 'approved', paymentMethod: 'bank_transfer' },
  { id: 'PR002', employeeId: 'EMP015', employeeName: 'Dr. Priya Nair', department: 'Electronics', designation: 'Associate Professor', month: 'March', year: 2026, basicSalary: 95000, allowances: [
    { name: 'HRA', amount: 38000, type: 'allowance', taxable: true },
    { name: 'DA', amount: 28500, type: 'allowance', taxable: true },
    { name: 'Medical Allowance', amount: 5000, type: 'allowance', taxable: false },
  ], deductions: [
    { name: 'PF', amount: 11400, type: 'deduction', taxable: false },
    { name: 'Professional Tax', amount: 2500, type: 'deduction', taxable: false },
    { name: 'TDS', amount: 12000, type: 'deduction', taxable: false },
  ], grossSalary: 166500, netSalary: 140600, status: 'draft', paymentMethod: 'bank_transfer' },
];

export const budgetAllocations: BudgetAllocation[] = [
  { id: 'BA001', department: 'Computer Science', category: 'Overall', budgetYear: '2025-26', allocatedAmount: 10000000, spentAmount: 8200000, availableAmount: 1800000, utilizationPercentage: 82, lastUpdated: new Date('2026-03-08') },
  { id: 'BA002', department: 'Electronics', category: 'Overall', budgetYear: '2025-26', allocatedAmount: 8500000, spentAmount: 4250000, availableAmount: 4250000, utilizationPercentage: 50, lastUpdated: new Date('2026-03-08') },
  { id: 'BA003', department: 'Mechanical', category: 'Overall', budgetYear: '2025-26', allocatedAmount: 9000000, spentAmount: 5400000, availableAmount: 3600000, utilizationPercentage: 60, lastUpdated: new Date('2026-03-08') },
  { id: 'BA004', department: 'Physics', category: 'Overall', budgetYear: '2025-26', allocatedAmount: 5000000, spentAmount: 3000000, availableAmount: 2000000, utilizationPercentage: 60, lastUpdated: new Date('2026-03-08') },
  { id: 'BA005', department: 'Library', category: 'Overall', budgetYear: '2025-26', allocatedAmount: 10000000, spentAmount: 1800000, availableAmount: 8200000, utilizationPercentage: 18, lastUpdated: new Date('2026-03-08') },
  { id: 'BA006', department: 'Administration', category: 'Overall', budgetYear: '2025-26', allocatedAmount: 15000000, spentAmount: 9750000, availableAmount: 5250000, utilizationPercentage: 65, lastUpdated: new Date('2026-03-08') },
  { id: 'BA007', department: 'Sports', category: 'Overall', budgetYear: '2025-26', allocatedAmount: 3000000, spentAmount: 1650000, availableAmount: 1350000, utilizationPercentage: 55, lastUpdated: new Date('2026-03-08') },
  { id: 'BA008', department: 'IT Infrastructure', category: 'Overall', budgetYear: '2025-26', allocatedAmount: 12000000, spentAmount: 7800000, availableAmount: 4200000, utilizationPercentage: 65, lastUpdated: new Date('2026-03-08') },
];