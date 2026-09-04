// ============================================
// RMS - Multi-Currency Controller
// ============================================

window.CurrenciesModule = {
    modalInstance: null,

    async init() {
        console.log('Initializing Currencies Module...');
        this.bindEvents();
        await this.loadCurrencies();
    },

    bindEvents() {
        const btnAdd = document.getElementById('btnAddCurrency');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.openAddModal());
        }

        const form = document.getElementById('currencyForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSaveCurrency(e));
        }
    },

    async loadCurrencies() {
        const tbody = document.getElementById('currenciesTableBody');
        if (!tbody) return;

        try {
            const rows = await window.electronAPI.currency.getAll();
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No currencies found.</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(c => `
                <tr>
                    <td><strong class="fs-5 text-primary">${Utils.escapeHtml(c.currency_code)}</strong></td>
                    <td><div class="fw-bold">${Utils.escapeHtml(c.currency_name)}</div></td>
                    <td><span class="badge bg-light text-dark fs-6">${Utils.escapeHtml(c.currency_symbol)}</span></td>
                    <td>
                        <div class="input-group input-group-sm" style="max-width: 140px;">
                            <input type="number" step="0.0001" class="form-control" value="${c.exchange_rate}" onchange="CurrenciesModule.updateRate(${c.id}, this.value)">
                        </div>
                    </td>
                    <td>${c.decimal_places}</td>
                    <td>
                        ${c.is_base_currency ? 
                            '<span class="badge bg-success"><i class="fas fa-check me-1"></i> BASE CURRENCY</span>' : 
                            `<button class="btn btn-sm btn-outline-secondary" onclick="CurrenciesModule.setBaseCurrency(${c.id})">Set as Base</button>`}
                    </td>
                    <td class="text-end">
                        <span class="text-muted"><i class="fas fa-lock"></i> Protected</span>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Error loading currencies:', err);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load currencies.</td></tr>';
        }
    },

    openAddModal() {
        document.getElementById('currencyForm').reset();
        const modalEl = document.getElementById('currencyModal');
        this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.modalInstance.show();
    },

    async handleSaveCurrency(e) {
        e.preventDefault();
        const payload = {
            currency_code: document.getElementById('currCode').value.trim().toUpperCase(),
            currency_name: document.getElementById('currName').value.trim(),
            currency_symbol: document.getElementById('currSymbol').value.trim(),
            exchange_rate: parseFloat(document.getElementById('currRate').value),
            decimal_places: parseInt(document.getElementById('currDecimals').value)
        };

        try {
            await window.electronAPI.currency.create(payload);
            UI.showToast(`Currency ${payload.currency_code} added.`, 'success');
            if (this.modalInstance) this.modalInstance.hide();
            await this.loadCurrencies();
        } catch (err) {
            console.error('Error adding currency:', err);
            UI.showToast(err.message || 'Failed to add currency.', 'error');
        }
    },

    async setBaseCurrency(id) {
        if (!confirm('Set this as the primary business base currency? Financial base conversions will update.')) return;
        try {
            await window.electronAPI.currency.setBaseCurrency(id);
            UI.showToast('Base currency updated.', 'success');
            await this.loadCurrencies();
            if (window.RMSAppInstance) window.RMSAppInstance.loadCompanyInfo();
        } catch (err) {
            console.error('Error setting base currency:', err);
            UI.showToast('Failed to set base currency.', 'error');
        }
    },

    async updateRate(id, rate) {
        try {
            await window.electronAPI.currency.updateExchangeRate(id, parseFloat(rate));
            UI.showToast('Exchange rate updated.', 'info');
        } catch (err) {
            console.error('Error updating exchange rate:', err);
            UI.showToast('Failed to update rate.', 'error');
        }
    }
};
