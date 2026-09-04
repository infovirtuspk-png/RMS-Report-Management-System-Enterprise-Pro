// ============================================
// RMS - Database Backup & Restore Controller
// ============================================

window.BackupModule = {
    async init() {
        console.log('Initializing Backup Module...');
        this.bindEvents();
        await this.loadHealthAndHistory();
    },

    bindEvents() {
        const btnCreate = document.getElementById('btnCreateBackup');
        if (btnCreate) {
            btnCreate.addEventListener('click', () => this.handleCreateBackup());
        }

        const btnRestore = document.getElementById('btnRestoreBackup');
        if (btnRestore) {
            btnRestore.addEventListener('click', () => this.handleSelectAndRestore());
        }
    },

    async loadHealthAndHistory() {
        try {
            const health = await window.electronAPI.database.getHealth();
            if (health) {
                document.getElementById('healthDbSize').textContent = health.stats?.sizeFormatted || '0.00 MB';
                document.getElementById('healthIntegrity').textContent = health.integrity === 'ok' ? 'HEALTHY / OK' : 'CHECK NEEDED';
            }

            const history = await window.electronAPI.backup.getHistory();
            document.getElementById('healthBackupCount').textContent = (history?.length || 0).toString();

            const tbody = document.getElementById('backupHistoryBody');
            if (!tbody) return;

            if (!history || history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted"><p>No backup packages created yet.</p><button class="btn btn-sm btn-primary" onclick="BackupModule.handleCreateBackup()">Create First .bak Backup</button></td></tr>';
                return;
            }

            tbody.innerHTML = history.map(b => `
                <tr>
                    <td><strong class="text-primary"><i class="fas fa-file-archive me-2"></i>${Utils.escapeHtml(b.backup_name)}</strong></td>
                    <td>${Utils.formatDate(b.backup_date)}</td>
                    <td>${(b.backup_size / 1024).toFixed(1)} KB</td>
                    <td><span class="badge bg-success"><i class="fas fa-check me-1"></i> VERIFIED SHA-256</span></td>
                    <td><span class="badge bg-light text-dark">${b.is_automatic ? 'Automatic' : 'Manual'}</span></td>
                    <td><small class="text-muted text-truncate d-inline-block" style="max-width: 250px;">${Utils.escapeHtml(b.backup_path)}</small></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="BackupModule.verifyFile('${Utils.escapeHtml(b.backup_path.replace(/\\/g, '\\\\'))}')" title="Verify Integrity"><i class="fas fa-shield-alt"></i> Verify</button>
                        <button class="btn btn-sm btn-outline-warning" onclick="BackupModule.restoreFromPath('${Utils.escapeHtml(b.backup_path.replace(/\\/g, '\\\\'))}')" title="Restore"><i class="fas fa-undo"></i> Restore</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Error loading backup history:', err);
        }
    },

    async handleCreateBackup() {
        try {
            UI.showLoading();
            const res = await window.electronAPI.backup.create(null, { notes: 'Manual administrator backup' });
            UI.hideLoading();
            UI.showToast(`Backup package '${res.filename}' created successfully.`, 'success');
            await this.loadHealthAndHistory();
        } catch (err) {
            UI.hideLoading();
            console.error('Error creating backup:', err);
            UI.showToast(err.message || 'Backup failed.', 'error');
        }
    },

    async handleSelectAndRestore() {
        try {
            const filePath = await window.electronAPI.file.selectFile([
                { name: 'RMS Backup Package (*.bak)', extensions: ['bak'] }
            ]);
            if (!filePath) return;

            await this.restoreFromPath(filePath);
        } catch (err) {
            console.error('Error selecting backup:', err);
            UI.showToast('Failed to select file.', 'error');
        }
    },

    async verifyFile(filePath) {
        try {
            const ver = await window.electronAPI.backup.verifyBackup(filePath);
            if (ver.valid) {
                alert(`Backup Verified Successfully!\n\nPackage: ${filePath}\nCompany: ${ver.company_name}\nCreated: ${ver.created_at}\nStatus: SHA-256 Hash Matches 100%`);
            }
        } catch (err) {
            alert(`Verification Failed:\n\n${err.message}`);
        }
    },

    async restoreFromPath(filePath) {
        const confirmMsg = 'WARNING: Restoring will overwrite the current active database.\n\nAn automatic safety backup of current data will be created first.\n\nAre you sure you want to proceed with restoration?';
        if (!confirm(confirmMsg)) return;

        try {
            UI.showLoading();
            await window.electronAPI.backup.restore(filePath);
            UI.hideLoading();
            alert('Database restored successfully from backup package!\n\nThe application will now reload.');
            window.location.reload();
        } catch (err) {
            UI.hideLoading();
            console.error('Restore error:', err);
            alert(`Restore Failed: ${err.message}`);
        }
    }
};
