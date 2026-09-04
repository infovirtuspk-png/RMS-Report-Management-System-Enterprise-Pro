// ============================================
// RMS - Daily Reports Controller
// ============================================

window.DailyReportsModule = {
    selectedDate: null,
    reportData: null,

    async init() {
        console.log('Initializing Daily Reports Module...');
        this.selectedDate = new Date().toISOString().split('T')[0];
        
        const dateInput = document.getElementById('dailyReportDateInput');
        if (dateInput) {
            dateInput.value = this.selectedDate;
            dateInput.addEventListener('change', (e) => {
                this.selectedDate = e.target.value;
                this.loadDailyReport();
            });
        }

        const btnPrint = document.getElementById('btnPrintDailyReport');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => this.printReport());
        }

        await this.loadDailyReport();
    },

    async loadDailyReport() {
        try {
            this.reportData = await window.electronAPI.report.getDailyReport(this.selectedDate);
            this.renderReport();
        } catch (err) {
            console.error('Error loading daily report:', err);
            UI.showToast('Failed to load daily report.', 'error');
        }
    },

    renderReport() {
        if (!this.reportData) return;

        const d = this.reportData;
        document.getElementById('drIncome').textContent = Utils.formatCurrency(d.total_income);
        document.getElementById('drExpenses').textContent = Utils.formatCurrency(d.total_expenses);
        
        const profitEl = document.getElementById('drProfit');
        if (profitEl) {
            profitEl.textContent = Utils.formatCurrency(d.net_profit);
            profitEl.className = `stat-card-value ${d.net_profit >= 0 ? 'text-success' : 'text-danger'}`;
        }

        document.getElementById('drInvoices').textContent = d.total_invoices.toString();
        document.getElementById('drTotalStaff').textContent = d.total_staff.toString();
        document.getElementById('drPresentStaff').textContent = d.present_staff.toString();
        document.getElementById('drAbsentStaff').textContent = d.absent_staff.toString();
        document.getElementById('drLeaveStaff').textContent = d.leave_staff.toString();
        document.getElementById('drAdvanceTotal').textContent = Utils.formatCurrency(d.total_salary_advance);

        document.getElementById('drTotalInvoices').textContent = d.total_invoices.toString();
        document.getElementById('drPaidInvoices').textContent = d.paid_invoices.toString();
        document.getElementById('drPendingInvoices').textContent = d.pending_invoices.toString();

        const numEl = document.getElementById('dailyReportNumberDisplay');
        if (numEl) {
            numEl.textContent = `RMS-REP-${this.selectedDate.replace(/-/g, '')}`;
        }
    },

    async printReport() {
        if (!this.reportData) return;
        const comp = await window.electronAPI.company.getCompany();
        const d = this.reportData;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Daily Business Report - ${this.selectedDate}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; color: #333; line-height: 1.4; font-size: 13px; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
                    .company-name { font-size: 22px; font-weight: bold; color: #0d6efd; }
                    .report-title { font-size: 16px; font-weight: bold; margin-top: 4px; }
                    .summary-grid { display: flex; justify-content: space-between; margin: 20px 0; background: #f8f9fa; padding: 15px; border-radius: 6px; }
                    .summary-item { text-align: center; }
                    .summary-item .label { font-size: 11px; color: #666; text-transform: uppercase; }
                    .summary-item .val { font-size: 16px; font-weight: bold; margin-top: 4px; }
                    .val.success { color: #198754; }
                    .val.danger { color: #dc3545; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { padding: 8px 12px; border: 1px solid #ddd; }
                    th { background: #f1f3f5; }
                    .text-end { text-align: right; }
                    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-name">${Utils.escapeHtml(comp?.company_name || 'RMS Business')}</div>
                    <div class="report-title">CONSOLIDATED DAILY BUSINESS REPORT</div>
                    <div style="font-size: 12px; color: #777;">Date: ${this.selectedDate} | Report No: RMS-REP-${this.selectedDate.replace(/-/g, '')}</div>
                </div>

                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="label">Daily Revenue</div>
                        <div class="val success">${Utils.formatCurrency(d.total_income)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Daily Expenses</div>
                        <div class="val danger">${Utils.formatCurrency(d.total_expenses)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Net Profit / (Loss)</div>
                        <div class="val ${d.net_profit >= 0 ? 'success' : 'danger'}">${Utils.formatCurrency(d.net_profit)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Invoices Issued</div>
                        <div class="val">${d.total_invoices}</div>
                    </div>
                </div>

                <h3>Workforce Operations</h3>
                <table>
                    <tr><th>Metric</th><th class="text-end">Value</th></tr>
                    <tr><td>Total Active Staff Registered</td><td class="text-end">${d.total_staff}</td></tr>
                    <tr><td>Present Staff on Duty</td><td class="text-end" style="color: green; font-weight: bold;">${d.present_staff}</td></tr>
                    <tr><td>Absent Staff</td><td class="text-end" style="color: red; font-weight: bold;">${d.absent_staff}</td></tr>
                    <tr><td>Staff on Leave</td><td class="text-end">${d.leave_staff}</td></tr>
                    <tr><td>Salary Advances Issued Today</td><td class="text-end">${Utils.formatCurrency(d.total_salary_advance)}</td></tr>
                </table>

                <h3 style="margin-top: 25px;">Sales & Billing</h3>
                <table>
                    <tr><th>Metric</th><th class="text-end">Count</th></tr>
                    <tr><td>Invoices Created Today</td><td class="text-end">${d.total_invoices}</td></tr>
                    <tr><td>Paid Invoices</td><td class="text-end" style="color: green;">${d.paid_invoices}</td></tr>
                    <tr><td>Pending / Unpaid Invoices</td><td class="text-end" style="color: red;">${d.pending_invoices}</td></tr>
                </table>

                <div class="footer">
                    ${Utils.escapeHtml(comp?.report_footer || 'Confidential Business Report - Generated by RMS')}
                </div>
            </body>
            </html>
        `;

        await window.electronAPI.print.printContent(html, { silent: false });
    }
};
