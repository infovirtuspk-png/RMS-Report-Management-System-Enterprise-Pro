// ============================================
// RMS - User Management Controller
// ============================================

window.UsersModule = {
    modalInstance: null,

    async init() {
        console.log('Initializing Users Module...');
        this.bindEvents();
        await this.loadUsers();
    },

    bindEvents() {
        const btnAdd = document.getElementById('btnAddUser');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.openAddModal());
        }

        const form = document.getElementById('userForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSaveUser(e));
        }
    },

    async loadUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        try {
            const rows = await window.electronAPI.database.query(`
                SELECT u.id, u.username, u.full_name, u.email, u.status, u.last_login, r.role_name
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                ORDER BY u.id ASC
            `);

            if (!rows || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No users found.</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(u => `
                <tr>
                    <td><strong class="text-primary"><i class="fas fa-user me-2"></i>${Utils.escapeHtml(u.username)}</strong></td>
                    <td>${Utils.escapeHtml(u.full_name)}</td>
                    <td>${Utils.escapeHtml(u.email || '—')}</td>
                    <td><span class="badge bg-primary">${Utils.escapeHtml(u.role_name || 'User')}</span></td>
                    <td><span class="badge bg-success">${u.status.toUpperCase()}</span></td>
                    <td>${u.last_login ? Utils.formatDate(u.last_login) : '<span class="text-muted">Never</span>'}</td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Error loading users:', err);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Failed to load users.</td></tr>';
        }
    },

    openAddModal() {
        document.getElementById('userForm').reset();
        const modalEl = document.getElementById('userModal');
        this.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.modalInstance.show();
    },

    async handleSaveUser(e) {
        e.preventDefault();
        const payload = {
            username: document.getElementById('userUsername').value.trim(),
            full_name: document.getElementById('userFullName').value.trim(),
            email: document.getElementById('userEmail').value.trim(),
            role_id: parseInt(document.getElementById('userRoleSelect').value),
            password: document.getElementById('userPassword').value
        };

        try {
            await window.electronAPI.auth.registerAdmin(payload);
            UI.showToast(`User account '${payload.username}' created.`, 'success');
            if (this.modalInstance) this.modalInstance.hide();
            await this.loadUsers();
        } catch (err) {
            console.error('Error creating user account:', err);
            UI.showToast(err.message || 'Failed to create user.', 'error');
        }
    }
};
