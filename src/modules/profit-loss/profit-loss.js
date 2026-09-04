// ============================================
// RMS - Profit & Loss Module Controller
// ============================================

window.ProfitLossModule = {
    currentFrom: null,
    currentTo: null,
    data: null,

    async init() {
        console.log('Initializing Profit & Loss Module...');
        this.bindEvents();
        this.setPeriod('this_month');
    },

    bindEvents() {
        const periodBtns = document.querySelectorAll('[data-pl-period]');
        periodBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                periodBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setPeriod(btn.dataset.plPeriod);
            });
        });

        const btnApply = document.getElementById('btnApplyPLDates');
        if (btnApply) {
            btnApply.addEventListener('click', () => {
                this.currentFrom = document.getElementById('plDateFrom').value;
                this.currentTo = document.getElementById('plDateTo').value;
                this.calculatePL();
            });
        }

        const btnPrint = document.getElementById('btnPrintPL');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => this.printStatement());
        }
    },

    setPeriod(period) {
        const today = new Date();
        let fromDate, toDate;

        switch (period) {
            case 'today':
                fromDate = today.toISOString().split('T')[0];
                toDate = fromDate;
                break;
            case 'yesterday':
                const yest = new Date(today);
                yest.setDate(yest.getDate() - 1);
                fromDate = yest.toISOString().split('T')[0];
                toDate = fromDate;
                break;
            case 'this_week':
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay() + 1);
                fromDate = startOfWeek.toISOString().split('T')[0];
                toDate = today.toISOString().split('T')[0];
                break;
            case 'this_month':
                fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                toDate = today.toISOString().split('T')[0];
                break;
            case 'last_month':
                fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
                toDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
                break;
            case '3_months':
                fromDate = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().split('T')[0];
                toDate = today.toISOString().split('T')[0];
                break;
            case '6_months':
                fromDate = new Date(today.getFullYear(), today.getMonth() - 6, 1).toISOString().split('T')[0];
                toDate = today.toISOString().split('T')[0];
                break;
            case 'this_year':
                fromDate = `${today.getFullYear()}-01-01`;
                toDate = today.toISOString().split('T')[0];
                break;
            default:
                fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                toDate = today.toISOString().split('T')[0];
        }

        this.currentFrom = fromDate;
        this.currentTo = toDate;

        const elFrom = document.getElementById('plDateFrom');
        const elTo = document.getElementById('plDateTo');
        if (elFrom) elFrom.value = fromDate;
        if (elTo) elTo.value = toDate;

        this.calculatePL();
    },

    async calculatePL() {
        if (!this.currentFrom || !this.currentTo) return;

        try {
            this.data = await window.electronAPI.report.getProfitLoss({
                from: this.currentFrom,
                to: this.currentTo
            });

            this.renderStatement();
        } catch (err) {
            console.error('Error calculating P&L statement:', err);
            UI.showToast('Failed to calculate Profit & Loss statement.', 'error');
        }
    },

    renderStatement() {
        if (!this.data) return;

        const totalInc = this.data.total_income || 0;
        const totalExp = this.data.total_expenses || 0;
        const netProfit = this.data.net_profit || 0;
        const margin = this.data.profit_margin || 0;

        document.getElementById('plTotalIncome').textContent = Utils.formatCurrency(totalInc);
        document.getElementById('plTotalExpense').textContent = Utils.formatCurrency(totalExp);
        
        const netProfitEl = document.getElementById('plNetProfit');
        if (netProfitEl) {
            netProfitEl.textContent = Utils.formatCurrency(netProfit);
            netProfitEl.className = `stat-card-value ${netProfit >= 0 ? 'text-success' : 'text-danger'}`;
        }

        const marginEl = document.getElementById('plProfitMargin');
        if (marginEl) {
            marginEl.textContent = `${margin.toFixed(1)}%`;
            marginEl.className = `stat-card-value ${margin >= 0 ? 'text-success' : 'text-danger'}`;
        }

        document.getElementById('plIncomeSubtotal').textContent = Utils.formatCurrency(totalInc);
        document.getElementById('plExpenseSubtotal').textContent = Utils.formatCurrency(totalExp);

        // Render income categories
        const incBody = document.getElementById('plIncomeCategoriesBody');
        if (incBody) {
            if (this.data.income_by_category && this.data.income_by_category.length > 0) {
                incBody.innerHTML = this.data.income_by_category.map(c => `
                    <tr>
                        <td class="ps-3 fw-medium">${Utils.escapeHtml(c.category_name || 'Uncategorized')}</td>
                        <td class="text-end pe-3 fw-bold text-success">${Utils.formatCurrency(c.total)}</td>
                    </tr>
                `).join('');
            } else {
                incBody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-muted">No income recorded for this period.</td></tr>';
            }
        }

        // Render expense categories
        const expBody = document.getElementById('plExpenseCategoriesBody');
        if (expBody) {
            if (this.data.expense_by_category && this.data.expense_by_category.length > 0) {
                expBody.innerHTML = this.data.expense_by_category.map(c => `
                    <tr>
                        <td class="ps-3 fw-medium">${Utils.escapeHtml(c.category_name || 'Uncategorized')}</td>
                        <td class="text-end pe-3 fw-bold text-danger">${Utils.formatCurrency(c.total)}</td>
                    </tr>
                `).join('');
            } else {
                expBody.innerHTML = '<tr><td colspan="2" class="text-center py-4 text-muted">No expenses recorded for this period.</td></tr>';
            }
        }
    },

    async printStatement() {
        if (!this.data) return;
        const company = await window.electronAPI.company.getCompany();

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Profit & Loss Statement - ${company?.company_name || 'RMS'}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
                    .company-name { font-size: 24px; font-weight: bold; }
                    .statement-title { font-size: 18px; margin-top: 5px; color: #555; }
                    .date-range { font-size: 13px; color: #777; margin-top: 5px; }
                    .summary-box { display: flex; justify-content: space-between; margin: 20px 0; background: #f8f9fa; padding: 15px; border-radius: 6px; }
                    .summary-item { text-align: center; }
                    .summary-item .label { font-size: 12px; color: #666; text-transform: uppercase; }
                    .summary-item .val { font-size: 18px; font-weight: bold; margin-top: 4px; }
                    .val.success { color: #198754; }
                    .val.danger { color: #dc3545; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { padding: 8px 12px; border-bottom: 1px solid #ddd; text-align: left; }
                    th { background: #f1f3f5; font-size: 13px; }
                    .text-end { text-align: right; }
                    .section-header { margin-top: 30px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-name">${Utils.escapeHtml(company?.company_name || 'RMS Business')}</div>
                    <div class="statement-title">PROFIT & LOSS STATEMENT</div>
                    <div class="date-range">Period: ${this.currentFrom} to ${this.currentTo} | Generated: ${new Date().toLocaleString()}</div>
                </div>

                <div class="summary-box">
                    <div class="summary-item">
                        <div class="label">Gross Revenue</div>
                        <div class="val success">${Utils.formatCurrency(this.data.total_income)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Total Expenses</div>
                        <div class="val danger">${Utils.formatCurrency(this.data.total_expenses)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Net Profit / (Loss)</div>
                        <div class="val ${this.data.net_profit >= 0 ? 'success' : 'danger'}">${Utils.formatCurrency(this.data.net_profit)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">Net Margin</div>
                        <div class="val">${this.data.profit_margin.toFixed(1)}%</div>
                    </div>
                </div>

                <div class="section-header">Income Breakdown</div>
                <table>
                    <thead>
                        <tr><th>Category</th><th class="text-end">Amount</th></tr>
                    </thead>
                    <tbody>
                        ${this.data.income_by_category.map(c => `<tr><td>${Utils.escapeHtml(c.category_name || 'Uncategorized')}</td><td class="text-end">${Utils.formatCurrency(c.total)}</td></tr>`).join('')}
                    </tbody>
                </table>

                <div class="section-header">Expense Breakdown</div>
                <table>
                    <thead>
                        <tr><th>Category</th><th class="text-end">Amount</th></tr>
                    </thead>
                    <tbody>
                        ${this.data.expense_by_category.map(c => `<tr><td>${Utils.escapeHtml(c.category_name || 'Uncategorized')}</td><td class="text-end">${Utils.formatCurrency(c.total)}</td></tr>`).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    ${Utils.escapeHtml(company?.report_footer || 'Confidential Financial Report - RMS')}
                </div>
            </body>
            </html>
        `;

        await window.electronAPI.print.printContent(html, { silent: false });
    }
};
