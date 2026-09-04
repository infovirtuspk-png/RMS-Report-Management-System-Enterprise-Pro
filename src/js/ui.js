// ============================================
// RMS - UI Components and Helpers
// ============================================

const UI = {
    // Create modal
    createModal(options = {}) {
        const {
            id = Utils.generateId('modal'),
            title = 'Modal',
            size = '',
            content = '',
            footer = '',
            show = false
        } = options;

        const sizeClass = size ? `modal-${size}` : '';

        const modalHTML = `
            <div class="modal" id="${id}" tabindex="-1">
                <div class="modal-dialog ${sizeClass}">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
                    </div>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Initialize Bootstrap modal
        const modalElement = document.getElementById(id);
        const modal = new bootstrap.Modal(modalElement);

        if (show) {
            modal.show();
        }

        // Remove from DOM when hidden
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
        });

        return modal;
    },

    // Show confirm dialog
    confirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            const modal = UI.createModal({
                title,
                content: `<p>${message}</p>`,
                footer: `
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="confirmOk">Confirm</button>
                `,
                show: true
            });

            const okButton = document.getElementById('confirmOk');
            okButton.addEventListener('click', () => {
                modal.hide();
                resolve(true);
            });

            modalElement.addEventListener('hidden.bs.modal', () => {
                resolve(false);
            });
        });
    },

    // Show alert dialog
    alert(message, title = 'Alert', type = 'info') {
        return new Promise((resolve) => {
            const iconMap = {
                success: 'fa-check-circle text-success',
                error: 'fa-exclamation-circle text-danger',
                warning: 'fa-exclamation-triangle text-warning',
                info: 'fa-info-circle text-info'
            };

            const modal = UI.createModal({
                title,
                content: `
                    <div class="text-center">
                        <i class="fas ${iconMap[type]} fa-3x mb-3"></i>
                        <p>${message}</p>
                    </div>
                `,
                footer: `
                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
                `,
                show: true
            });

            modalElement.addEventListener('hidden.bs.modal', () => {
                resolve();
            });
        });
    },

    // Create data table
    createDataTable(options = {}) {
        const {
            containerId,
            columns = [],
            data = [],
            pagination = true,
            pageSize = 10,
            searchable = true,
            sortable = true,
            actions = []
        } = options;

        const container = document.getElementById(containerId);
        if (!container) return null;

        let currentPage = 1;
        let sortColumn = null;
        let sortDirection = 'asc';
        let filteredData = [...data];

        const renderTable = () => {
            const start = (currentPage - 1) * pageSize;
            const end = start + pageSize;
            const pageData = filteredData.slice(start, end);

            const thead = columns.map(col => `
                <th ${sortable ? `data-column="${col.key}" class="sortable"` : ''}>
                    ${col.label}
                    ${sortColumn === col.key ? `<i class="fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'}"></i>` : ''}
                </th>
            `).join('');

            if (actions.length > 0) {
                thead += '<th>Actions</th>';
            }

            const tbody = pageData.map(row => {
                const cells = columns.map(col => `
                    <td>${col.render ? col.render(row[col.key], row) : row[col.key]}</td>
                `).join('');

                if (actions.length > 0) {
                    const actionButtons = actions.map(action => `
                        <button class="table-action-btn ${action.class}" data-action="${action.key}" data-id="${row.id}">
                            <i class="fas ${action.icon}"></i>
                        </button>
                    `).join('');

                    cells += `<td><div class="table-actions">${actionButtons}</div></td>`;
                }

                return `<tr>${cells.join('')}</tr>`;
            }).join('');

            let tableHTML = `
                <div class="table-container">
                    ${searchable ? `
                        <div class="table-search mb-3">
                            <input type="text" class="form-control" id="tableSearch" placeholder="Search...">
                        </div>
                    ` : ''}
                    <table class="table data-table">
                        <thead><tr>${thead}</tr></thead>
                        <tbody>${tbody || '<tr><td colspan="' + columns.length + (actions.length > 0 ? 1 : 0) + '" class="text-center">No data available</td></tr>'}</tbody>
                    </table>
                </div>
            `;

            if (pagination && filteredData.length > pageSize) {
                const totalPages = Math.ceil(filteredData.length / pageSize);
                const paginationHTML = `
                    <nav class="d-flex justify-content-center mt-3">
                        <ul class="pagination">
                            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                                <a class="page-link" href="#" data-page="1">First</a>
                            </li>
                            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                                <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>
                            </li>
                            ${Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const pageNum = Math.max(1, currentPage - 2) + i;
                                if (pageNum > totalPages) return '';
                                return `
                                    <li class="page-item ${pageNum === currentPage ? 'active' : ''}">
                                        <a class="page-link" href="#" data-page="${pageNum}">${pageNum}</a>
                                    </li>
                                `;
                            }).join('')}
                            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                                <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
                            </li>
                            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                                <a class="page-link" href="#" data-page="${totalPages}">Last</a>
                            </li>
                        </ul>
                    </nav>
                `;
                tableHTML += paginationHTML;
            }

            container.innerHTML = tableHTML;

            // Add event listeners
            if (searchable) {
                const searchInput = document.getElementById('tableSearch');
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    filteredData = data.filter(row => {
                        return columns.some(col => {
                            const value = row[col.key];
                            return String(value).toLowerCase().includes(query);
                        });
                    });
                    currentPage = 1;
                    renderTable();
                });
            }

            if (sortable) {
                container.querySelectorAll('th.sortable').forEach(th => {
                    th.addEventListener('click', () => {
                        const column = th.dataset.column;
                        if (sortColumn === column) {
                            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                        } else {
                            sortColumn = column;
                            sortDirection = 'asc';
                        }

                        filteredData.sort((a, b) => {
                            let aVal = a[column];
                            let bVal = b[column];

                            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                            return 0;
                        });

                        renderTable();
                    });
                });
            }

            // Pagination event listeners
            container.querySelectorAll('.page-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = parseInt(e.target.dataset.page);
                    if (page && page !== currentPage) {
                        currentPage = page;
                        renderTable();
                    }
                });
            });

            // Action button event listeners
            if (actions.length > 0) {
                container.querySelectorAll('.table-action-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const action = btn.dataset.action;
                        const id = btn.dataset.id;
                        const actionConfig = actions.find(a => a.key === action);
                        if (actionConfig && actionConfig.handler) {
                            actionConfig.handler(id);
                        }
                    });
                });
            }
        };

        renderTable();

        return {
            refresh: (newData) => {
                data = newData;
                filteredData = [...data];
                currentPage = 1;
                renderTable();
            },
            getCurrentData: () => filteredData,
            goToPage: (page) => {
                currentPage = page;
                renderTable();
            }
        };
    },

    // Create form
    createForm(options = {}) {
        const {
            containerId,
            fields = [],
            submitHandler = null,
            submitText = 'Submit',
            cancelHandler = null,
            cancelText = 'Cancel'
        } = options;

        const container = document.getElementById(containerId);
        if (!container) return null;

        const formHTML = `
            <form id="${containerId}Form">
                ${fields.map(field => UI.createFormField(field)).join('')}
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">${submitText}</button>
                    ${cancelHandler ? `<button type="button" class="btn btn-secondary" id="${containerId}Cancel">${cancelText}</button>` : ''}
                </div>
            </form>
        `;

        container.innerHTML = formHTML;

        const form = document.getElementById(`${containerId}Form`);

        if (submitHandler) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = UI.getFormData(form);
                submitHandler(formData);
            });
        }

        if (cancelHandler) {
            document.getElementById(`${containerId}Cancel`).addEventListener('click', cancelHandler);
        }

        return {
            getForm: () => form,
            getData: () => UI.getFormData(form),
            setData: (data) => UI.setFormData(form, data),
            reset: () => form.reset(),
            validate: () => UI.validateForm(form)
        };
    },

    // Create form field
    createFormField(field) {
        const {
            type = 'text',
            name,
            label,
            placeholder = '',
            required = false,
            options = [],
            multiple = false,
            accept = '',
            readonly = false,
            disabled = false,
            helpText = ''
        } = field;

        const requiredAttr = required ? 'required' : '';
        const readonlyAttr = readonly ? 'readonly' : '';
        const disabledAttr = disabled ? 'disabled' : '';

        let fieldHTML = `
            <div class="form-group">
                <label class="form-label" for="${name}">${label}${required ? ' *' : ''}</label>
        `;

        switch (type) {
            case 'text':
            case 'email':
            case 'tel':
            case 'number':
            case 'date':
            case 'time':
            case 'datetime-local':
            case 'password':
                fieldHTML += `
                    <input type="${type}" class="form-control" id="${name}" name="${name}" 
                           placeholder="${placeholder}" ${requiredAttr} ${readonlyAttr} ${disabledAttr}>
                `;
                break;

            case 'textarea':
                fieldHTML += `
                    <textarea class="form-control" id="${name}" name="${name}" rows="4"
                              placeholder="${placeholder}" ${requiredAttr} ${readonlyAttr} ${disabledAttr}></textarea>
                `;
                break;

            case 'select':
                fieldHTML += `
                    <select class="form-select" id="${name}" name="${name}" ${requiredAttr} ${disabledAttr}>
                        <option value="">Select ${label}</option>
                        ${options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                    </select>
                `;
                break;

            case 'multiselect':
                fieldHTML += `
                    <select class="form-select" id="${name}" name="${name}" multiple ${requiredAttr} ${disabledAttr}>
                        ${options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                    </select>
                `;
                break;

            case 'checkbox':
                fieldHTML += `
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="${name}" name="${name}" ${requiredAttr} ${disabledAttr}>
                        <label class="form-check-label" for="${name}">${label}</label>
                    </div>
                `;
                break;

            case 'radio':
                fieldHTML += `
                    ${options.map((opt, index) => `
                        <div class="form-check">
                            <input type="radio" class="form-check-input" id="${name}_${index}" name="${name}" 
                                   value="${opt.value}" ${requiredAttr} ${disabledAttr}>
                            <label class="form-check-label" for="${name}_${index}">${opt.label}</label>
                        </div>
                    `).join('')}
                `;
                break;

            case 'file':
                fieldHTML += `
                    <input type="file" class="form-control" id="${name}" name="${name}" 
                           accept="${accept}" ${requiredAttr} ${disabledAttr}>
                `;
                break;

            case 'hidden':
                fieldHTML += `<input type="hidden" id="${name}" name="${name}" value="${field.value || ''}">`;
                break;

            default:
                fieldHTML += `
                    <input type="${type}" class="form-control" id="${name}" name="${name}" 
                           placeholder="${placeholder}" ${requiredAttr} ${readonlyAttr} ${disabledAttr}>
                `;
        }

        if (helpText) {
            fieldHTML += `<small class="form-text text-muted">${helpText}</small>`;
        }

        fieldHTML += '</div>';

        return fieldHTML;
    },

    // Get form data
    getFormData(form) {
        const formData = new FormData(form);
        const data = {};

        formData.forEach((value, key) => {
            if (data[key]) {
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        });

        // Handle checkboxes
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (!checkbox.name) return;
            if (!data[checkbox.name]) {
                data[checkbox.name] = checkbox.checked;
            }
        });

        return data;
    },

    // Set form data
    setFormData(form, data) {
        Object.keys(data).forEach(key => {
            const field = form.querySelector(`[name="${key}"]`);
            if (!field) return;

            const value = data[key];

            switch (field.type) {
                case 'checkbox':
                    field.checked = Boolean(value);
                    break;
                case 'radio':
                    const radio = form.querySelector(`[name="${key}"][value="${value}"]`);
                    if (radio) radio.checked = true;
                    break;
                case 'select-multiple':
                    Array.from(field.options).forEach(option => {
                        option.selected = Array.isArray(value) ? value.includes(option.value) : value === option.value;
                    });
                    break;
                default:
                    field.value = value;
            }
        });
    },

    // Validate form
    validateForm(form) {
        let isValid = true;
        const errors = {};

        form.querySelectorAll('[required]').forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                errors[field.name] = `${field.name} is required`;
                field.classList.add('is-invalid');
            } else {
                field.classList.remove('is-invalid');
            }

            // Email validation
            if (field.type === 'email' && field.value) {
                if (!Utils.validateEmail(field.value)) {
                    isValid = false;
                    errors[field.name] = 'Please enter a valid email address';
                    field.classList.add('is-invalid');
                }
            }

            // Phone validation
            if (field.type === 'tel' && field.value) {
                if (!Utils.validatePhone(field.value)) {
                    isValid = false;
                    errors[field.name] = 'Please enter a valid phone number';
                    field.classList.add('is-invalid');
                }
            }
        });

        return { isValid, errors };
    },

    // Create chart
    createChart(options = {}) {
        const {
            containerId,
            type = 'bar',
            data = {},
            options: chartOptions = {}
        } = options;

        const container = document.getElementById(containerId);
        if (!container) return null;

        const ctx = container.getContext('2d');
        const chart = new Chart(ctx, {
            type,
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                ...chartOptions
            }
        });

        return chart;
    },

    // Create progress bar
    createProgressBar(options = {}) {
        const {
            containerId,
            value = 0,
            max = 100,
            showLabel = true,
            animated = true,
            striped = true,
            color = 'primary'
        } = options;

        const container = document.getElementById(containerId);
        if (!container) return null;

        const animatedClass = animated ? 'progress-bar-animated' : '';
        const stripedClass = striped ? 'progress-bar-striped' : '';
        const percentage = (value / max) * 100;

        const progressBarHTML = `
            <div class="progress" style="height: 25px;">
                <div class="progress-bar bg-${color} ${animatedClass} ${stripedClass}" 
                     role="progressbar" 
                     style="width: ${percentage}%;" 
                     aria-valuenow="${value}" 
                     aria-valuemin="0" 
                     aria-valuemax="${max}">
                    ${showLabel ? `${percentage.toFixed(1)}%` : ''}
                </div>
            </div>
        `;

        container.innerHTML = progressBarHTML;

        return {
            setValue: (newValue) => {
                const newPercentage = (newValue / max) * 100;
                const progressBar = container.querySelector('.progress-bar');
                progressBar.style.width = `${newPercentage}%`;
                progressBar.setAttribute('aria-valuenow', newValue);
                if (showLabel) {
                    progressBar.textContent = `${newPercentage.toFixed(1)}%`;
                }
            },
            getValue: () => {
                const progressBar = container.querySelector('.progress-bar');
                return parseInt(progressBar.getAttribute('aria-valuenow'));
            }
        };
    },

    // Create badge
    createBadge(text, type = 'primary') {
        return `<span class="badge bg-${type}">${text}</span>`;
    },

    // Create status badge
    createStatusBadge(status) {
        const statusConfig = {
            active: { class: 'success', icon: 'fa-check' },
            inactive: { class: 'secondary', icon: 'fa-minus' },
            pending: { class: 'warning', icon: 'fa-clock' },
            approved: { class: 'success', icon: 'fa-check' },
            rejected: { class: 'danger', icon: 'fa-times' },
            paid: { class: 'success', icon: 'fa-check' },
            unpaid: { class: 'danger', icon: 'fa-times' },
            draft: { class: 'secondary', icon: 'fa-file' },
            issued: { class: 'primary', icon: 'fa-file-alt' },
            overdue: { class: 'danger', icon: 'fa-exclamation-triangle' }
        };

        const config = statusConfig[status.toLowerCase()] || { class: 'secondary', icon: 'fa-question' };

        return `
            <span class="badge bg-${config.class}">
                <i class="fas ${config.icon}"></i> ${status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        `;
    },

    // Create empty state
    createEmptyState(options = {}) {
        const {
            icon = 'fa-inbox',
            title = 'No data found',
            message = 'There are no items to display.',
            actionText = null,
            actionHandler = null
        } = options;

        let actionHTML = '';
        if (actionText && actionHandler) {
            actionHTML = `<button class="btn btn-primary" id="emptyStateAction">${actionText}</button>`;
        }

        return `
            <div class="empty-state">
                <i class="fas ${icon}"></i>
                <h3>${title}</h3>
                <p>${message}</p>
                ${actionHTML}
            </div>
        `;
    },

    // Show loading spinner
    showLoading(containerId, message = 'Loading...') {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">${message}</p>
            </div>
        `;
    },

    // Hide loading spinner
    hideLoading(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const spinner = container.querySelector('.spinner-border');
        if (spinner) {
            spinner.closest('.text-center').remove();
        }
    },

    // Create tabs
    createTabs(options = {}) {
        const {
            containerId,
            tabs = [],
            activeTab = 0
        } = options;

        const container = document.getElementById(containerId);
        if (!container) return null;

        const tabsHTML = `
            <ul class="nav nav-tabs" role="tablist">
                ${tabs.map((tab, index) => `
                    <li class="nav-item" role="presentation">
                        <button class="nav-link ${index === activeTab ? 'active' : ''}" 
                                id="${tab.id}-tab" 
                                data-bs-toggle="tab" 
                                data-bs-target="#${tab.id}" 
                                type="button" 
                                role="tab">
                            ${tab.icon ? `<i class="fas ${tab.icon}"></i>` : ''}
                            ${tab.label}
                        </button>
                    </li>
                `).join('')}
            </ul>
            <div class="tab-content mt-3">
                ${tabs.map((tab, index) => `
                    <div class="tab-pane fade ${index === activeTab ? 'show active' : ''}" 
                         id="${tab.id}" 
                         role="tabpanel">
                        ${tab.content}
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = tabsHTML;

        return {
            setActiveTab: (index) => {
                const tabButton = container.querySelectorAll('.nav-link')[index];
                if (tabButton) {
                    tabButton.click();
                }
            }
        };
    },

    // Create card
    createCard(options = {}) {
        const {
            title = '',
            content = '',
            footer = '',
            headerActions = ''
        } = options;

        return `
            <div class="card">
                <div class="card-header">
                    <h5 class="card-title">${title}</h5>
                    ${headerActions}
                </div>
                <div class="card-body">
                    ${content}
                </div>
                ${footer ? `<div class="card-footer">${footer}</div>` : ''}
            </div>
        `;
    },

    // Create stat card
    createStatCard(options = {}) {
        const {
            title = '',
            value = 0,
            icon = 'fa-chart-line',
            color = 'primary',
            change = null,
            changeType = 'positive'
        } = options;

        const changeHTML = change !== null ? `
            <div class="stat-card-change ${changeType}">
                <i class="fas fa-arrow-${changeType === 'positive' ? 'up' : 'down'}"></i>
                ${change > 0 ? '+' : ''}${change}%
            </div>
        ` : '';

        return `
            <div class="stat-card">
                <div class="stat-card-icon ${color}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="stat-card-value">${value}</div>
                <div class="stat-card-label">${title}</div>
                ${changeHTML}
            </div>
        `;
    },

    // Show toast notification
    showToast(message, type = 'info', duration = 4000) {
        const toastContainer = document.getElementById('toastContainer') || (() => {
            const div = document.createElement('div');
            div.id = 'toastContainer';
            div.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;';
            document.body.appendChild(div);
            return div;
        })();

        const colorMap = {
            success: '#198754',
            error:   '#dc3545',
            warning: '#ffc107',
            info:    '#0d6efd'
        };
        const iconMap = {
            success: 'fa-check-circle',
            error:   'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info:    'fa-info-circle'
        };

        const id = 'toast_' + Date.now();
        const color = colorMap[type] || colorMap.info;
        const icon  = iconMap[type]  || iconMap.info;

        const toast = document.createElement('div');
        toast.id = id;
        toast.style.cssText = `
            background:#1e293b;
            color:#f1f5f9;
            border-left:4px solid ${color};
            padding:0.75rem 1rem;
            border-radius:8px;
            box-shadow:0 4px 20px rgba(0,0,0,.4);
            display:flex;
            align-items:center;
            gap:0.6rem;
            min-width:240px;
            max-width:360px;
            font-size:0.9rem;
            animation:toastIn .25s ease;
        `;
        toast.innerHTML = `<i class="fas ${icon}" style="color:${color}"></i><span>${message}</span>`;

        if (!document.getElementById('rmsToastStyle')) {
            const style = document.createElement('style');
            style.id = 'rmsToastStyle';
            style.textContent = `
                @keyframes toastIn  { from{opacity:0;transform:translateX(60px)} to{opacity:1;transform:translateX(0)} }
                @keyframes toastOut { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(60px)} }
            `;
            document.head.appendChild(style);
        }

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut .25s ease forwards';
            setTimeout(() => toast.remove(), 280);
        }, duration);
    }
};

// Export to global scope
window.UI = UI;
