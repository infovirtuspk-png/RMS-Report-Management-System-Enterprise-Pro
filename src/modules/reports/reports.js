// ============================================
// RMS - Executive Reports Center Controller
// ============================================

window.ReportsModule = {
    staffList: [],
    currentRows: [],
    currentHeaders: [],
    reportType: 'income_register',

    async init() {
        console.log('Initializing Reports Center...');
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const today = now.toISOString().split('T')[0];

        document.getElementById('reportDateFrom').value = firstDay;
        document.getElementById('reportDateTo').value = today;

        this.bindEvents();
        await this.loadDependencies();
        await this.generateActiveReport();
    },

    bindEvents() {
        const typeSelect = document.getElementById('reportTypeSelect');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                this.reportType = e.target.value;
                const staffWrapper = document.getElementById('staffPickerWrapper');
                if (staffWrapper) {
                    staffWrapper.style.display = this.reportType === 'staff_360' ? 'block' : 'none';
                }
                this.generateActiveReport();
            });
        }

        const btnGen = document.getElementById('btnGenerateReport');
        if (btnGen) {
            btnGen.addEventListener('click', () => this.generateActiveReport());
        }

        const btnPrint = document.getElementById('btnPrintActiveReport');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => this.printCurrentReport());
        }

        const btnCSV = document.getElementById('btnExportCSV');
        if (btnCSV) {
            btnCSV.addEventListener('click', () => this.exportCSV());
        }
    },

    async loadDependencies() {
        try {
            this.staffList = await window.electronAPI.staff.getAll({ status: 'active' });
            const select = document.getElementById('reportStaffSelect');
            if (select) {
                select.innerHTML = '<option value="">Select Employee</option>' + 
                    this.staffList.map(s => `<option value="${s.id}">${Utils.escapeHtml(s.full_name)} (${s.employee_code})</option>`).join('');
            }
        } catch (err) {
            console.error('Error loading report dependencies:', err);
        }
    },

    async generateActiveReport() {
        const from = document.getElementById('reportDateFrom').value;
        const to = document.getElementById('reportDateTo').value;
        const thead = document.getElementById('reportTableHead');
        const tbody = document.getElementById('reportTableBody');
        const titleEl = document.getElementById('reportResultTitle');
        const badgeEl = document.getElementById('reportRowCountBadge');

        try {
            if (this.reportType === 'income_register') {
                titleEl.textContent = `Income Register (${from} to ${to})`;
                const rows = await window.electronAPI.income.getAll({ date_from: from, date_to: to });
                this.currentRows = rows;
                this.currentHeaders = ['Number', 'Date', 'Category', 'Description', 'Customer', 'Method', 'Amount'];
                
                thead.innerHTML = `<tr><th>${this.currentHeaders.join('</th><th>')}</th></tr>`;
                tbody.innerHTML = rows.map(r => `
                    <tr>
                        <td><strong>${r.income_number}</strong></td>
                        <td>${r.date}</td>
                        <td>${Utils.escapeHtml(r.category_name || '—')}</td>
                        <td>${Utils.escapeHtml(r.description)}</td>
                        <td>${Utils.escapeHtml(r.customer_name || '—')}</td>
                        <td>${r.payment_method}</td>
                        <td class="fw-bold text-success">${Utils.formatCurrency(r.amount, r.currency)}</td>
                    </tr>
                `).join('') || '<tr><td colspan="7" class="text-center py-4 text-muted">No income found.</td></tr>';

                badgeEl.textContent = `${rows.length} Records`;
            } else if (this.reportType === 'expense_register') {
                titleEl.textContent = `Expense Register (${from} to ${to})`;
                const rows = await window.electronAPI.expense.getAll({ date_from: from, date_to: to });
                this.currentRows = rows;
                this.currentHeaders = ['Number', 'Date', 'Category', 'Description', 'Vendor', 'Method', 'Amount'];
                
                thead.innerHTML = `<tr><th>${this.currentHeaders.join('</th><th>')}</th></tr>`;
                tbody.innerHTML = rows.map(r => `
                    <tr>
                        <td><strong class="text-danger">${r.expense_number}</strong></td>
                        <td>${r.date}</td>
                        <td>${Utils.escapeHtml(r.category_name || '—')}</td>
                        <td>${Utils.escapeHtml(r.description)}</td>
                        <td>${Utils.escapeHtml(r.vendor_name || '—')}</td>
                        <td>${r.payment_method}</td>
                        <td class="fw-bold text-danger">${Utils.formatCurrency(r.amount, r.currency)}</td>
                    </tr>
                `).join('') || '<tr><td colspan="7" class="text-center py-4 text-muted">No expenses found.</td></tr>';

                badgeEl.textContent = `${rows.length} Records`;
            } else if (this.reportType === 'invoice_register') {
                titleEl.textContent = `Invoice & Sales Register (${from} to ${to})`;
                const rows = await window.electronAPI.invoice.getAll({});
                this.currentRows = rows;
                this.currentHeaders = ['Invoice #', 'Date', 'Customer', 'Total', 'Paid', 'Balance', 'Status'];

                thead.innerHTML = `<tr><th>${this.currentHeaders.join('</th><th>')}</th></tr>`;
                tbody.innerHTML = rows.map(r => `
                    <tr>
                        <td><strong>${r.invoice_number}</strong></td>
                        <td>${r.date}</td>
                        <td>${Utils.escapeHtml(r.customer_name)}</td>
                        <td class="fw-bold">${Utils.formatCurrency(r.total_amount, r.currency)}</td>
                        <td class="text-success">${Utils.formatCurrency(r.paid_amount, r.currency)}</td>
                        <td class="text-danger fw-bold">${Utils.formatCurrency(r.balance_amount, r.currency)}</td>
                        <td><span class="badge ${r.payment_status === 'paid' ? 'bg-success' : 'bg-warning text-dark'}">${r.payment_status.toUpperCase()}</span></td>
                    </tr>
                `).join('') || '<tr><td colspan="7" class="text-center py-4 text-muted">No invoices found.</td></tr>';

                badgeEl.textContent = `${rows.length} Records`;
            } else if (this.reportType === 'staff_register') {
                titleEl.textContent = 'Complete Staff Register';
                const rows = await window.electronAPI.staff.getAll({});
                this.currentRows = rows;
                this.currentHeaders = ['Code', 'Full Name', 'Department', 'Designation', 'Phone', 'Basic Salary', 'Status'];

                thead.innerHTML = `<tr><th>${this.currentHeaders.join('</th><th>')}</th></tr>`;
                tbody.innerHTML = rows.map(r => `
                    <tr>
                        <td><strong>${r.employee_code}</strong></td>
                        <td>${Utils.escapeHtml(r.full_name)}</td>
                        <td>${Utils.escapeHtml(r.department_name || '—')}</td>
                        <td>${Utils.escapeHtml(r.designation_name || '—')}</td>
                        <td>${Utils.escapeHtml(r.calling_number || '—')}</td>
                        <td class="fw-bold text-success">${Utils.formatCurrency(r.basic_salary)}</td>
                        <td><span class="badge ${r.status === 'active' ? 'bg-success' : 'bg-secondary'}">${r.status.toUpperCase()}</span></td>
                    </tr>
                `).join('') || '<tr><td colspan="7" class="text-center py-4 text-muted">No staff found.</td></tr>';

                badgeEl.textContent = `${rows.length} Records`;
            } else if (this.reportType === 'salary_register') {
                titleEl.textContent = 'Salary Disbursement Register';
                const rows = await window.electronAPI.salary.getAll({});
                this.currentRows = rows;
                this.currentHeaders = ['Salary #', 'Employee', 'Month', 'Basic', 'Allowances', 'Net Salary', 'Status'];

                thead.innerHTML = `<tr><th>${this.currentHeaders.join('</th><th>')}</th></tr>`;
                tbody.innerHTML = rows.map(r => `
                    <tr>
                        <td><strong>${r.salary_number}</strong></td>
                        <td>${Utils.escapeHtml(r.staff_name)}</td>
                        <td>${r.salary_month}</td>
                        <td>${Utils.formatCurrency(r.basic_salary)}</td>
                        <td>${Utils.formatCurrency(r.allowances)}</td>
                        <td class="fw-bold text-success">${Utils.formatCurrency(r.net_salary)}</td>
                        <td><span class="badge ${r.payment_status === 'paid' ? 'bg-success' : 'bg-warning text-dark'}">${r.payment_status.toUpperCase()}</span></td>
                    </tr>
                `).join('') || '<tr><td colspan="7" class="text-center py-4 text-muted">No salary records found.</td></tr>';

                badgeEl.textContent = `${rows.length} Records`;
            } else if (this.reportType === 'advances_register') {
                titleEl.textContent = 'Salary Advances Register';
                const rows = await window.electronAPI.advance.getAll({});
                this.currentRows = rows;
                this.currentHeaders = ['Advance #', 'Date', 'Employee', 'Amount', 'Deduction Month', 'Balance', 'Status'];

                thead.innerHTML = `<tr><th>${this.currentHeaders.join('</th><th>')}</th></tr>`;
                tbody.innerHTML = rows.map(r => `
                    <tr>
                        <td><strong>${r.advance_number}</strong></td>
                        <td>${r.date}</td>
                        <td>${Utils.escapeHtml(r.staff_name)}</td>
                        <td class="fw-bold">${Utils.formatCurrency(r.advance_amount)}</td>
                        <td>${r.deduction_month || '—'}</td>
                        <td class="fw-bold text-danger">${Utils.formatCurrency(r.remaining_balance)}</td>
                        <td><span class="badge ${r.remaining_balance === 0 ? 'bg-success' : 'bg-warning text-dark'}">${r.status.toUpperCase()}</span></td>
                    </tr>
                `).join('') || '<tr><td colspan="7" class="text-center py-4 text-muted">No advances found.</td></tr>';

                badgeEl.textContent = `${rows.length} Records`;
            } else if (this.reportType === 'staff_360') {
                const staffId = document.getElementById('reportStaffSelect')?.value;
                if (!staffId) {
                    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-warning">Please select an employee above.</td></tr>';
                    return;
                }
                const dossier = await window.electronAPI.report.getStaffReport(parseInt(staffId), { from, to });
                const s = dossier.staff;
                titleEl.textContent = `Staff 360 Dossier: ${s.full_name} (${s.employee_code})`;

                thead.innerHTML = '<tr><th>Employee Profile</th><th>Information Details</th></tr>';
                tbody.innerHTML = `
                    <tr><td><strong>Department & Role</strong></td><td>${Utils.escapeHtml(s.department_name || '—')} / ${Utils.escapeHtml(s.designation_name || '—')}</td></tr>
                    <tr><td><strong>Contact Info</strong></td><td>Phone: ${s.calling_number || '—'} | Email: ${s.email || '—'}</td></tr>
                    <tr><td><strong>Identification & Passport</strong></td><td>National ID: ${s.national_id_number || '—'} (Exp: ${s.national_id_expiry_date || '—'})<br>Passport: ${s.passport_number || '—'} (Exp: ${s.passport_expiry_date || '—'})</td></tr>
                    <tr><td><strong>Visa & Work Permit</strong></td><td>Visa #: ${s.visa_number || '—'} (Exp: ${s.visa_expiry_date || '—'})<br>Labour Card: ${s.labour_card_number || '—'}</td></tr>
                    <tr><td><strong>Basic Salary</strong></td><td class="fw-bold text-success">${Utils.formatCurrency(s.basic_salary)}</td></tr>
                    <tr><td><strong>Total Advances History</strong></td><td>${dossier.advances.length} Loans recorded</td></tr>
                    <tr><td><strong>Total Payroll History</strong></td><td>${dossier.salaries.length} Salary disbursements recorded</td></tr>
                `;
                badgeEl.textContent = 'Full Profile Loaded';
            }
        } catch (err) {
            console.error('Error generating report:', err);
            UI.showToast('Failed to generate report.', 'error');
        }
    },

    async printCurrentReport() {
        const comp = await window.electronAPI.company.getCompany();
        const tableHtml = document.getElementById('reportContainer').innerHTML;
        const title = document.getElementById('reportResultTitle').textContent;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; color: #333; line-height: 1.4; font-size: 12px; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
                    .company-name { font-size: 22px; font-weight: bold; color: #0d6efd; }
                    .title { font-size: 16px; font-weight: bold; margin-top: 4px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { padding: 8px 10px; border: 1px solid #ddd; text-align: left; }
                    th { background: #f8f9fa; font-weight: bold; }
                    .text-end { text-align: right; }
                    .badge { font-size: 10px; font-weight: bold; }
                    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-name">${Utils.escapeHtml(comp?.company_name || 'RMS Business')}</div>
                    <div class="title">${title}</div>
                    <div style="font-size: 11px; color: #777;">Generated on: ${new Date().toLocaleString()}</div>
                </div>

                ${tableHtml}

                <div class="footer">
                    ${Utils.escapeHtml(comp?.report_footer || 'Confidential Business Intelligence Report - RMS')}
                </div>
            </body>
            </html>
        `;

        await window.electronAPI.print.printContent(html, { silent: false });
    },

    exportCSV() {
        if (!this.currentRows || this.currentRows.length === 0) {
            UI.showToast('No records available to export.', 'warning');
            return;
        }

        let csv = this.currentHeaders.join(',') + '\n';
        this.currentRows.forEach(row => {
            const values = Object.values(row).map(v => `"${(v || '').toString().replace(/"/g, '""')}"`);
            csv += values.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${this.reportType}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        UI.showToast('CSV Exported successfully.', 'success');
    }
};
