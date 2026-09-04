// ============================================
// RMS - Salary Advances Module Controller
// ============================================

window.AdvancesModule = {
    modalInstance: null,
    staffList: [],

    async init() {
        console.log('Initializing Salary Advances Module...');
        this.bindEvents();
        await this.loadDependencies();
        await this.loadAdvancesList();
    },

    bindEvents() {
        const btnAdd = document.getElementById('btnAddAdvance');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.openAddModal());
        }

        const filter = document.getElementById('advanceStatusFilter');
        if (filter) {
            filter.addEventListener('change', () => this.loadAdvancesList());
        }

        const form = document.getElementById('advanceForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSaveAdvance(e));
        }

        const advAmount = document.getElementById('advAmount');
        if (advAmount) {
            advAmount.addEventListener('input', (e) => {
                const ded = document.getElementById('advDeductionAmount');
                if (ded && !ded.value) ded.value = e.target.value;
            });
        }
    },

    async loadDependencies() {
        try {
            this.staffList = await window.electronAPI.staff.getAll({ status: 'active' });
            const select = document.getElementById('advStaffSelect');
            if (select) {
                select.innerHTML = '<option value="">Select Employee</option>' + 
                    this.staffList.map(s => `<option value="${s.id}">${Utils.escapeHtml(s.full_name)} (${s.employee_code})</option>`).join('');
            }
        } catch (err) {
            console.error('Error loading staff for advances:', err);
        }
    },

    async loadAdvancesList() {
        const tbody = document.getElementById('advancesTableBody');
        if (!tbody) return;

        const filters = {
            status: document.getElementById('advanceStatusFilter')?.value || ''
        };

        try {
            const rows = await window.electronAPI.advance.getAll(filters);
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">No salary advances recorded.</td></tr>';
                document.getElementById('totalOutstandingAdvances').textContent = Utils.formatCurrency(0);
                return;
            }

            let outstanding = 0;
            tbody.innerHTML = rows.map(r => {
                const rem = parseFloat(r.remaining_balance) || 0;
                outstanding += rem;
                const statusBadge = rem === 0 ? '<span class="badge bg-success">FULLY RECOVERED</span>' : 
                    (r.status === 'partially_recovered' ? '<span class="badge bg-info text-dark">PARTIALLY RECOVERED</span>' : '<span class="badge bg-warning text-dark">ACTIVE / OUTSTANDING</span>');

                return `
                    <tr>
                        <td><strong class="text-primary">${Utils.escapeHtml(r.advance_number)}</strong></td>
                        <td>${Utils.formatDate(r.date)}</td>
                        <td><div class="fw-bold">${Utils.escapeHtml(r.staff_name)}</div><small class="text-muted">${r.employee_code || ''}</small></td>
                        <td class="fw-bold">${Utils.formatCurrency(r.advance_amount)}</td>
                        <td><span class="badge bg-light text-dark">${r.deduction_month || '—'}</span></td>
                        <td class="fw-bold text-danger">${Utils.formatCurrency(r.remaining_balance)}</td>
                        <td>${statusBadge}</td>
                        <td>${Utils.escapeHtml(r.reason || '—')}</td>
                    </tr>
                `;
            }).join('');

            document.getElementById('totalOutstandingAdvances').textContent = Utils.formatCurrency(outstanding);
        } catch (err) {
            console.error('Error loading advances list:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Failed to load advances.</td></tr>';
        }
    },

    openAddModal() {
        document.getElementById('advanceForm').reset();
        document.getElementById('advDate').value = new Date().toISOString().split('T')[0];
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        document.getElementById('advDeductionMonth').value = `${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1).toString().padStart(2, '0')}`;

        const modalEl = document.getElementById('advanceModal');
        this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.modalInstance.show();
    },

    async handleSaveAdvance(e) {
        e.preventDefault();
        const payload = {
            staff_id: parseInt(document.getElementById('advStaffSelect').value),
            date: document.getElementById('advDate').value,
            advance_amount: parseFloat(document.getElementById('advAmount').value),
            deduction_month: document.getElementById('advDeductionMonth').value,
            deduction_amount: parseFloat(document.getElementById('advDeductionAmount').value),
            reason: document.getElementById('advReason').value.trim()
        };

        try {
            await window.electronAPI.advance.create(payload);
            UI.showToast('Salary advance registered.', 'success');
            if (this.modalInstance) this.modalInstance.hide();
            await this.loadAdvancesList();
        } catch (err) {
            console.error('Error creating advance:', err);
            UI.showToast(err.message || 'Failed to issue advance.', 'error');
        }
    }
};
