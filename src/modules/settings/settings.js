// ============================================
// RMS - Settings Center Controller
// ============================================

window.SettingsModule = {
    company: null,
    themes: [
        { key: 'professional-light', name: 'Professional Light', desc: 'Clean, crisp white ERP theme with modern blue accents.', bg: '#ffffff', color: '#0d6efd' },
        { key: 'professional-dark', name: 'Professional Dark', desc: 'Ultra-modern deep dark mode with coral/red highlights.', bg: '#1a1a2e', color: '#e94560' },
        { key: 'ocean-blue', name: 'Ocean Blue', desc: 'Serene executive blue styling with refreshing azure tones.', bg: '#1a365d', color: '#3182ce' },
        { key: 'emerald', name: 'Emerald', desc: 'Vibrant green financial theme optimized for prosperity & accounts.', bg: '#1a202c', color: '#38a169' },
        { key: 'royal-purple', name: 'Royal Purple', desc: 'Luxurious violet executive aesthetic with elegant styling.', bg: '#1a1a2e', color: '#805ad5' },
        { key: 'midnight', name: 'Midnight', desc: 'True deep black contrast mode with electric neon cyan highlights.', bg: '#0b0f19', color: '#00f2fe' },
        { key: 'graphite', name: 'Graphite', desc: 'Minimalist industrial charcoal theme with sleek steel tones.', bg: '#212529', color: '#adb5bd' }
    ],

    async init() {
        console.log('Initializing Settings Module...');
        this.bindEvents();
        this.renderThemes();
        await this.loadSettings();
    },

    bindEvents() {
        const btnSave = document.getElementById('btnSaveAllSettings');
        if (btnSave) {
            btnSave.addEventListener('click', () => this.saveAllSettings());
        }

        const btnOpenReset = document.getElementById('btnOpenHardResetModal');
        if (btnOpenReset) {
            btnOpenReset.addEventListener('click', () => this.openHardResetModal());
        }

        const resetForm = document.getElementById('hardResetForm');
        if (resetForm) {
            resetForm.addEventListener('submit', (e) => this.handleExecuteHardReset(e));
        }
    },

    openHardResetModal() {
        const form = document.getElementById('hardResetForm');
        if (form) form.reset();
        const modalEl = document.getElementById('hardResetModal');
        this.resetModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.resetModalInstance.show();
    },

    async handleExecuteHardReset(e) {
        e.preventDefault();
        const pass1 = document.getElementById('resetPass1').value;
        const pass2 = document.getElementById('resetPass2').value;
        const consent = document.getElementById('resetConsentCheckbox').checked;

        if (!pass1 || !pass2) {
            UI.showToast('Please enter your administrator password in both fields.', 'warning');
            return;
        }

        if (pass1 !== pass2) {
            UI.showToast('The two passwords do not match. Please verify and try again.', 'error');
            return;
        }

        if (!consent) {
            UI.showToast('You must confirm consent to format and hard reset the application.', 'warning');
            return;
        }

        const finalConfirm = confirm('FINAL WARNING: This will permanently delete and format ALL business records, company details, staff, invoices, and users.\n\nAre you absolutely sure you want to proceed with Factory Hard Reset?');
        if (!finalConfirm) return;

        try {
            UI.showLoading();
            const res = await window.electronAPI.settings.hardReset({
                password: pass1,
                confirmPassword: pass2
            });

            UI.hideLoading();
            if (this.resetModalInstance) this.resetModalInstance.hide();

            alert('APPLICATION HARD RESET COMPLETE!\n\nAll data has been completely formatted.\nThe application will now restart and take you to the initial setup screen.');
            
            // Clear local cached themes/tokens
            localStorage.clear();
            sessionStorage.clear();

            // Redirect back to initial setup
            window.location.href = 'setup.html';
        } catch (err) {
            UI.hideLoading();
            console.error('Hard reset error:', err);
            alert(`Hard Reset Failed: ${err.message || 'Invalid administrator password or system error.'}`);
        }
    },

    renderThemes() {
        const grid = document.getElementById('themesGrid');
        if (!grid) return;

        const currentTheme = localStorage.getItem('rms_theme') || 'professional-light';

        grid.innerHTML = this.themes.map(t => {
            const isActive = t.key === currentTheme;
            return `
                <div class="col-md-4 col-sm-6">
                    <div class="card h-100 p-3 ${isActive ? 'border-primary border-2 shadow' : ''}" style="cursor: pointer;" onclick="SettingsModule.selectTheme('${t.key}')">
                        <div class="d-flex align-items-center mb-2">
                            <div style="width: 24px; height: 24px; border-radius: 50%; background: ${t.color}; margin-right: 10px; border: 2px solid #fff; box-shadow: 0 0 4px rgba(0,0,0,0.2);"></div>
                            <strong class="fs-6">${Utils.escapeHtml(t.name)}</strong>
                            ${isActive ? '<span class="badge bg-primary ms-auto">ACTIVE</span>' : ''}
                        </div>
                        <p class="text-muted small mb-0">${Utils.escapeHtml(t.desc)}</p>
                    </div>
                </div>
            `;
        }).join('');
    },

    selectTheme(themeKey) {
        if (window.RMSAppInstance) {
            window.RMSAppInstance.setTheme(themeKey);
            this.renderThemes();
            UI.showToast(`Theme switched to '${themeKey}'.`, 'success');
        }
    },

    async loadSettings() {
        try {
            this.company = await window.electronAPI.company.getCompany();
            if (this.company) {
                document.getElementById('setCompanyName').value = this.company.company_name || '';
                document.getElementById('setCompanyLegalName').value = this.company.legal_company_name || '';
                document.getElementById('setTradeLicense').value = this.company.trade_license_number || '';
                document.getElementById('setTaxVatNumber').value = this.company.tax_vat_number || '';
                document.getElementById('setBusinessActivity').value = this.company.business_activity || '';
                document.getElementById('setPhone').value = this.company.phone || '';
                document.getElementById('setWhatsapp').value = this.company.whatsapp || '';
                document.getElementById('setEmail').value = this.company.email || '';
                document.getElementById('setAddress').value = this.company.address || '';
                document.getElementById('setCityCountry').value = `${this.company.city || ''}, ${this.company.country || ''}`.replace(/^, |, $/g, '');
                document.getElementById('setInvoiceFooter').value = this.company.invoice_footer || '';
                document.getElementById('setTermsConditions').value = this.company.terms_conditions || '';
                document.getElementById('setInvoicePrefix').value = this.company.invoice_prefix || 'RMS-INV';
                document.getElementById('setReportPrefix').value = this.company.report_prefix || 'RMS-REP';
            }

            const appSettings = await window.electronAPI.settings.getAll();
            appSettings.forEach(s => {
                if (s.setting_key === 'auto_lock_timeout') {
                    const el = document.getElementById('setAutoLockMinutes');
                    if (el) el.value = s.setting_value;
                }
                if (s.setting_key === 'thermal_printer_width') {
                    const el = document.getElementById('setThermalWidth');
                    if (el) el.value = s.setting_value;
                }
                if (s.setting_key === 'auto_backup_on_exit') {
                    const el = document.getElementById('setAutoBackupExit');
                    if (el) el.value = s.setting_value;
                }
                if (s.setting_key === 'app_lock_pin') {
                    const el = document.getElementById('setLockPin');
                    const elConf = document.getElementById('setLockPinConfirm');
                    if (el && s.setting_value) {
                        el.value = s.setting_value;
                        if (elConf) elConf.value = s.setting_value;
                    }
                }
                if (s.setting_key === 'app_auto_unlock_instant') {
                    const el = document.getElementById('setAutoUnlockInstant');
                    if (el) el.value = s.setting_value;
                }
                if (s.setting_key === 'close_to_tray') {
                    const el = document.getElementById('setCloseToTray');
                    if (el) el.value = s.setting_value;
                }
                if (s.setting_key === 'minimize_to_tray') {
                    const el = document.getElementById('setMinimizeToTray');
                    if (el) el.value = s.setting_value;
                }
                if (s.setting_key === 'start_with_windows') {
                    const el = document.getElementById('setStartWithWindows');
                    if (el) el.value = s.setting_value;
                }
                if (s.setting_key === 'start_minimized_to_tray') {
                    const el = document.getElementById('setStartMinimized');
                    if (el) el.value = s.setting_value;
                }
                if (s.setting_key === 'show_tray_notifications') {
                    const el = document.getElementById('setShowTrayNotifications');
                    if (el) el.value = s.setting_value;
                }
            });

            // Also check Windows OS login item settings if available
            try {
                if (window.electronAPI && window.electronAPI.app && window.electronAPI.app.getStartupSettings) {
                    const startup = await window.electronAPI.app.getStartupSettings();
                    if (startup) {
                        const winStartEl = document.getElementById('setStartWithWindows');
                        if (winStartEl) winStartEl.value = startup.openAtLogin ? '1' : '0';
                    }
                }
            } catch (_) {}
        } catch (err) {
            console.error('Error loading settings:', err);
        }
    },

    async saveAllSettings() {
        try {
            const pin1 = document.getElementById('setLockPin')?.value || '';
            const pin2 = document.getElementById('setLockPinConfirm')?.value || '';

            if (pin1 && pin2 && pin1 !== pin2) {
                UI.showToast('Lock PIN confirmation does not match. Please verify your PIN.', 'warning');
                return;
            }

            const companyPayload = {
                company_name: document.getElementById('setCompanyName').value.trim(),
                legal_company_name: document.getElementById('setCompanyLegalName').value.trim(),
                trade_license_number: document.getElementById('setTradeLicense').value.trim(),
                tax_vat_number: document.getElementById('setTaxVatNumber').value.trim(),
                business_activity: document.getElementById('setBusinessActivity').value.trim(),
                phone: document.getElementById('setPhone').value.trim(),
                whatsapp: document.getElementById('setWhatsapp').value.trim(),
                email: document.getElementById('setEmail').value.trim(),
                address: document.getElementById('setAddress').value.trim(),
                invoice_footer: document.getElementById('setInvoiceFooter').value.trim(),
                terms_conditions: document.getElementById('setTermsConditions').value.trim(),
                invoice_prefix: document.getElementById('setInvoicePrefix').value.trim(),
                report_prefix: document.getElementById('setReportPrefix').value.trim()
            };

            await window.electronAPI.company.updateCompany(companyPayload);

            const startWithWin = document.getElementById('setStartWithWindows')?.value === '1';
            const startMin = document.getElementById('setStartMinimized')?.value === '1';

            const appSettingsPayload = {
                auto_lock_timeout: document.getElementById('setAutoLockMinutes')?.value || '0',
                thermal_printer_width: document.getElementById('setThermalWidth')?.value || '80',
                auto_backup_on_exit: document.getElementById('setAutoBackupExit')?.value || '1',
                app_lock_pin: pin1 ? pin1.trim() : '',
                app_auto_unlock_instant: document.getElementById('setAutoUnlockInstant')?.value || '1',
                close_to_tray: document.getElementById('setCloseToTray')?.value || 'hide_to_tray',
                minimize_to_tray: document.getElementById('setMinimizeToTray')?.value || '1',
                start_with_windows: startWithWin ? '1' : '0',
                start_minimized_to_tray: startMin ? '1' : '0',
                show_tray_notifications: document.getElementById('setShowTrayNotifications')?.value || '1'
            };

            await window.electronAPI.settings.update(appSettingsPayload);

            // Sync with Windows OS auto-launch
            try {
                if (window.electronAPI && window.electronAPI.app && window.electronAPI.app.setStartupSettings) {
                    await window.electronAPI.app.setStartupSettings({
                        openAtLogin: startWithWin,
                        openAsHidden: startMin
                    });
                }
            } catch (_) {}

            UI.showToast('All settings and System Tray preferences saved successfully.', 'success');
            if (window.RMSAppInstance) {
                window.RMSAppInstance.loadCompanyInfo();
                window.RMSAppInstance.initInactivityTimer();
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            UI.showToast(err.message || 'Failed to save settings.', 'error');
        }
    }
};
