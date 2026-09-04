// ============================================
// RMS - Salaries Module Controller
// ============================================

window.SalariesModule = {
    modalInstance: null,
    staffList: [],
    currentMonth: null,

    async init() {
        console.log('Initializing Salaries Module...');
        const now = new Date();
        this.currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const filterInput = document.getElementById('salaryMonthFilter');
        if (filterInput) {
            filterInput.value = this.currentMonth;
            filterInput.addEventListener('change', (e) => {
                this.currentMonth = e.target.value;
                this.loadSalariesList();
            });
        }

        const statusFilter = document.getElementById('salaryStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.loadSalariesList());
        }

        this.bindEvents();
        await this.loadDependencies();
        await this.loadSalariesList();
    },

    bindEvents() {
        const btnProcess = document.getElementById('btnProcessPayroll');
        if (btnProcess) {
            btnProcess.addEventListener('click', () => this.openPayrollModal());
        }

        const btnAuto = document.getElementById('btnAutoCalculateSalary');
        if (btnAuto) {
            btnAuto.addEventListener('click', () => this.autoCalculate());
        }

        const form = document.getElementById('payrollForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSaveSalary(e));
        }

        // Live calculation inputs
        const inputs = ['payBasicSalary', 'payAllowance', 'payOvertime', 'payBonus', 'payDeduction', 'payAdvanceDeduction'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.recalcNet());
        });
    },

    async loadDependencies() {
        try {
            this.staffList = await window.electronAPI.staff.getAll({ status: 'active' });
            const select = document.getElementById('payrollStaffSelect');
            if (select) {
                select.innerHTML = '<option value="">Select Employee</option>' + 
                    this.staffList.map(s => `<option value="${s.id}">${Utils.escapeHtml(s.full_name)} (${s.employee_code})</option>`).join('');
                select.addEventListener('change', () => this.onStaffSelectChange());
            }
        } catch (err) {
            console.error('Error loading staff for salaries:', err);
        }
    },

    onStaffSelectChange() {
        const staffId = document.getElementById('payrollStaffSelect').value;
        const staff = this.staffList.find(s => s.id == staffId);
        if (staff) {
            document.getElementById('payBasicSalary').value = staff.basic_salary || 0;
            document.getElementById('payAllowance').value = staff.allowance || 0;
            this.recalcNet();
        }
    },

    async autoCalculate() {
        const staffId = document.getElementById('payrollStaffSelect').value;
        const month = document.getElementById('payrollMonthInput').value;
        if (!staffId || !month) {
            UI.showToast('Please select an employee and salary month first.', 'warning');
            return;
        }

        try {
            const calc = await window.electronAPI.salary.calculateSalary(parseInt(staffId), month);
            document.getElementById('payBasicSalary').value = calc.basic_salary;
            document.getElementById('payAllowance').value = calc.allowances;
            document.getElementById('payOvertime').value = calc.overtime;
            document.getElementById('payBonus').value = calc.bonus;
            document.getElementById('payDeduction').value = calc.deduction;
            document.getElementById('payAdvanceDeduction').value = calc.advance_deduction;
            document.getElementById('payNetSalary').value = calc.net_salary;
            UI.showToast(`Auto-calculated: ${calc.overtime_hours} hrs OT, ${calc.absent_days} absent days.`, 'info');
        } catch (err) {
            console.error('Error auto-calculating salary:', err);
            UI.showToast('Failed to auto-calculate salary.', 'error');
        }
    },

    recalcNet() {
        const basic = parseFloat(document.getElementById('payBasicSalary').value) || 0;
        const allowance = parseFloat(document.getElementById('payAllowance').value) || 0;
        const ot = parseFloat(document.getElementById('payOvertime').value) || 0;
        const bonus = parseFloat(document.getElementById('payBonus').value) || 0;
        const ded = parseFloat(document.getElementById('payDeduction').value) || 0;
        const advDed = parseFloat(document.getElementById('payAdvanceDeduction').value) || 0;

        const net = Math.max(0, basic + allowance + ot + bonus - ded - advDed);
        document.getElementById('payNetSalary').value = net.toFixed(2);
    },

    async loadSalariesList() {
        const tbody = document.getElementById('salariesTableBody');
        if (!tbody) return;

        const filters = {
            salary_month: this.currentMonth,
            payment_status: document.getElementById('salaryStatusFilter')?.value || ''
        };

        try {
            const rows = await window.electronAPI.salary.getAll(filters);
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="text-center py-5 text-muted"><p>No payroll records for this month.</p><button class="btn btn-sm btn-primary" onclick="SalariesModule.openPayrollModal()">Process First Employee</button></td></tr>';
                this.updateStats([]);
                return;
            }

            tbody.innerHTML = rows.map(r => `
                <tr>
                    <td><strong class="text-primary">${Utils.escapeHtml(r.salary_number)}</strong></td>
                    <td><div class="fw-bold">${Utils.escapeHtml(r.staff_name)}</div><small class="text-muted">${r.employee_code}</small></td>
                    <td><span class="badge bg-light text-dark">${r.salary_month}</span></td>
                    <td>${Utils.formatCurrency(r.basic_salary)}</td>
                    <td>${Utils.formatCurrency(r.allowances)}</td>
                    <td><small class="text-success">+${Utils.formatCurrency(r.overtime + r.bonus)}</small></td>
                    <td><small class="text-danger">-${Utils.formatCurrency(r.deduction + r.advance_deduction)}</small></td>
                    <td class="fw-bold text-success">${Utils.formatCurrency(r.net_salary)}</td>
                    <td><span class="badge ${r.payment_status === 'paid' ? 'bg-success' : 'bg-warning text-dark'}">${r.payment_status.toUpperCase()}</span></td>
                    <td class="text-end">
                        ${r.payment_status !== 'paid' ? 
                            `<button class="btn btn-sm btn-success me-1" onclick="SalariesModule.markAsPaid(${r.id})" title="Disburse & Pay"><i class="fas fa-check"></i> Pay</button>` : ''}
                        <button class="btn btn-sm btn-outline" onclick="SalariesModule.printPayslip(${r.id})" title="Print Payslip"><i class="fas fa-print"></i></button>
                    </td>
                </tr>
            `).join('');

            this.updateStats(rows);
        } catch (err) {
            console.error('Error loading salaries list:', err);
            tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-danger">Failed to load payroll list.</td></tr>';
        }
    },

    updateStats(rows) {
        let total = 0, paid = 0, pending = 0;
        rows.forEach(r => {
            const net = parseFloat(r.net_salary) || 0;
            total += net;
            if (r.payment_status === 'paid') paid += net;
            else pending += net;
        });

        document.getElementById('statTotalPayroll').textContent = Utils.formatCurrency(total);
        document.getElementById('statPaidPayroll').textContent = Utils.formatCurrency(paid);
        document.getElementById('statPendingPayroll').textContent = Utils.formatCurrency(pending);
    },

    openPayrollModal() {
        document.getElementById('payrollForm').reset();
        document.getElementById('payrollMonthInput').value = this.currentMonth;
        this.recalcNet();

        const modalEl = document.getElementById('payrollModal');
        this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.modalInstance.show();
    },

    async handleSaveSalary(e) {
        e.preventDefault();
        const payload = {
            staff_id: parseInt(document.getElementById('payrollStaffSelect').value),
            salary_month: document.getElementById('payrollMonthInput').value,
            basic_salary: parseFloat(document.getElementById('payBasicSalary').value) || 0,
            allowances: parseFloat(document.getElementById('payAllowance').value) || 0,
            overtime: parseFloat(document.getElementById('payOvertime').value) || 0,
            bonus: parseFloat(document.getElementById('payBonus').value) || 0,
            deduction: parseFloat(document.getElementById('payDeduction').value) || 0,
            advance_deduction: parseFloat(document.getElementById('payAdvanceDeduction').value) || 0,
            payment_status: document.getElementById('payPaymentStatus').value,
            payment_date: document.getElementById('payPaymentStatus').value === 'paid' ? new Date().toISOString().split('T')[0] : null
        };

        try {
            await window.electronAPI.salary.create(payload);
            UI.showToast('Salary processed successfully.', 'success');
            if (this.modalInstance) this.modalInstance.hide();
            await this.loadSalariesList();
        } catch (err) {
            console.error('Error creating salary record:', err);
            UI.showToast(err.message || 'Failed to process salary.', 'error');
        }
    },

    async markAsPaid(id) {
        if (!confirm('Disburse payment for this salary record? This will automatically create an operational expense record.')) return;
        try {
            await window.electronAPI.salary.processPayment(id, {
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: 'Bank Transfer'
            });
            UI.showToast('Salary marked as PAID and expense created.', 'success');
            await this.loadSalariesList();
        } catch (err) {
            console.error('Error disbursing salary:', err);
            UI.showToast('Failed to disburse salary.', 'error');
        }
    },

    async printPayslip(id) {
        const rows = await window.electronAPI.salary.getAll({});
        const sal = rows.find(r => r.id === id);
        if (!sal) return;
        const company = await window.electronAPI.company.getCompany();

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payslip - ${sal.salary_number}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
                    .company-name { font-size: 22px; font-weight: bold; }
                    .title { font-size: 16px; margin-top: 4px; color: #555; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
                    th { background: #f8f9fa; }
                    .text-end { text-align: right; }
                    .total-row { font-size: 16px; font-weight: bold; background: #e9ecef; }
                    .signatures { margin-top: 50px; display: flex; justify-content: space-between; padding: 0 40px; }
                    .sig-line { border-top: 1px solid #333; width: 180px; text-align: center; padding-top: 5px; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-name">${Utils.escapeHtml(company?.company_name || 'RMS Business')}</div>
                    <div class="title">SALARY PAYSLIP — ${sal.salary_month}</div>
                    <div style="font-size: 12px; color: #777; margin-top: 4px;">Payslip No: ${sal.salary_number} | Status: ${sal.payment_status.toUpperCase()}</div>
                </div>

                <table>
                    <tr>
                        <td><strong>Employee Name:</strong> ${Utils.escapeHtml(sal.staff_name)}</td>
                        <td><strong>Employee Code:</strong> ${sal.employee_code}</td>
                    </tr>
                    <tr>
                        <td><strong>Department:</strong> ${Utils.escapeHtml(sal.department_name || '—')}</td>
                        <td><strong>Payment Method:</strong> ${sal.payment_method || 'Bank Transfer'}</td>
                    </tr>
                </table>

                <table style="margin-top: 20px;">
                    <thead>
                        <tr>
                            <th>Earnings</th>
                            <th class="text-end">Amount</th>
                            <th>Deductions</th>
                            <th class="text-end">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Basic Salary</td>
                            <td class="text-end">${Utils.formatCurrency(sal.basic_salary)}</td>
                            <td>Absence / Late</td>
                            <td class="text-end">${Utils.formatCurrency(sal.deduction)}</td>
                        </tr>
                        <tr>
                            <td>Allowances</td>
                            <td class="text-end">${Utils.formatCurrency(sal.allowances)}</td>
                            <td>Advance Loan Recovery</td>
                            <td class="text-end">${Utils.formatCurrency(sal.advance_deduction)}</td>
                        </tr>
                        <tr>
                            <td>Overtime Pay</td>
                            <td class="text-end">${Utils.formatCurrency(sal.overtime)}</td>
                            <td>Other Deductions</td>
                            <td class="text-end">${Utils.formatCurrency(sal.other_deduction || 0)}</td>
                        </tr>
                        <tr>
                            <td>Bonus / Incentives</td>
                            <td class="text-end">${Utils.formatCurrency(sal.bonus)}</td>
                            <td></td>
                            <td></td>
                        </tr>
                        <tr class="total-row">
                            <td>Total Gross Earnings</td>
                            <td class="text-end">${Utils.formatCurrency(sal.basic_salary + sal.allowances + sal.overtime + sal.bonus)}</td>
                            <td>Total Deductions</td>
                            <td class="text-end">${Utils.formatCurrency(sal.deduction + sal.advance_deduction + (sal.other_deduction || 0))}</td>
                        </tr>
                        <tr class="total-row" style="background: #d1e7dd;">
                            <td colspan="3" style="text-align: right; font-size: 18px;">NET SALARY PAYABLE:</td>
                            <td class="text-end" style="font-size: 18px; color: #0f5132;">${Utils.formatCurrency(sal.net_salary)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="signatures">
                    <div class="sig-line">Prepared By (HR)</div>
                    <div class="sig-line">Employee Signature</div>
                </div>
            </body>
            </html>
        `;

        await window.electronAPI.print.printContent(html, { silent: false });
    }
};
