// ============================================
// RMS - Audit Logs Controller
// ============================================

window.AuditLogsModule = {
    async init() {
        console.log('Initializing Audit Logs Module...');
        this.bindEvents();
        await this.loadAuditLogs();
    },

    bindEvents() {
        const btnRefresh = document.getElementById('btnRefreshAuditLogs');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => this.loadAuditLogs());
        }

        const searchInput = document.getElementById('auditSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.debounce(() => this.loadAuditLogs(), 300));
        }

        const moduleFilter = document.getElementById('auditModuleFilter');
        if (moduleFilter) {
            moduleFilter.addEventListener('change', () => this.loadAuditLogs());
        }

        const btnReset = document.getElementById('btnResetAuditFilter');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (searchInput) searchInput.value = '';
                if (moduleFilter) moduleFilter.value = '';
                this.loadAuditLogs();
            });
        }
    },

    async loadAuditLogs() {
        const tbody = document.getElementById('auditTableBody');
        if (!tbody) return;

        const filters = {
            search: document.getElementById('auditSearchInput')?.value || '',
            module: document.getElementById('auditModuleFilter')?.value || ''
        };

        try {
            const rows = await window.electronAPI.audit.getAll(filters);
            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No audit logs recorded yet.</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(a => {
                let actionBadge = 'bg-secondary';
                if (a.action === 'CREATE' || a.action === 'REGISTER') actionBadge = 'bg-success';
                else if (a.action === 'UPDATE' || a.action === 'CHANGE_PASSWORD') actionBadge = 'bg-primary';
                else if (a.action === 'DELETE') actionBadge = 'bg-danger';
                else if (a.action === 'LOGIN') actionBadge = 'bg-info text-dark';
                else if (a.action === 'RESTORE') actionBadge = 'bg-warning text-dark';

                return `
                    <tr>
                        <td><small class="text-muted">${a.created_at}</small></td>
                        <td><strong>${Utils.escapeHtml(a.username || a.user_name || 'System')}</strong></td>
                        <td><span class="badge ${actionBadge}">${a.action}</span></td>
                        <td><span class="badge bg-light text-dark">${a.module}</span></td>
                        <td>${Utils.escapeHtml(a.description || '—')}</td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error('Error loading audit logs:', err);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Failed to load audit logs.</td></tr>';
        }
    },

    debounceTimer: null,
    debounce(fn, delay) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(fn, delay);
    }
};
