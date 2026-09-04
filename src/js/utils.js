// ============================================
// RMS - Utility Functions
// ============================================

const Utils = {
    // Generate unique ID
    generateId(prefix = 'ID') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}-${timestamp}-${random}`.toUpperCase();
    },

    // Format currency
    formatCurrency(amount, currency = null, symbol = null) {
        const num = parseFloat(amount);
        const formattedAmount = isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        if (symbol) {
            return `${symbol} ${formattedAmount}`;
        }

        const symbolMap = {
            'USD': '$',
            'AED': 'AED',
            'PKR': 'Rs.',
            'EUR': '€',
            'GBP': '£',
            'INR': '₹',
            'SAR': 'SAR',
            'QAR': 'QAR',
            'OMR': 'OMR',
            'KWD': 'KWD',
            'BHD': 'BHD',
            'CAD': 'CA$',
            'AUD': 'AU$'
        };

        if (currency && symbolMap[currency]) {
            return `${symbolMap[currency]} ${formattedAmount}`;
        }
        if (currency) {
            return `${currency} ${formattedAmount}`;
        }

        // Default to active business base currency
        const activeCode = (window.rmsApp && window.rmsApp.company && window.rmsApp.company.currency) ? window.rmsApp.company.currency : (document.getElementById('baseCurrency')?.textContent?.trim() || 'AED');
        const activeSymbol = (window.rmsApp && window.rmsApp.company && window.rmsApp.company.currency_symbol) ? window.rmsApp.company.currency_symbol : (symbolMap[activeCode] || activeCode);
        return `${activeSymbol} ${formattedAmount}`;
    },

    // Format number with thousands separator
    formatNumber(number) {
        return Number(number).toLocaleString();
    },

    // Format date
    formatDate(dateString, format = 'YYYY-MM-DD') {
        const date = new Date(dateString);
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        switch (format) {
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            case 'DD/MM/YYYY':
                return `${day}/${month}/${year}`;
            case 'MM/DD/YYYY':
                return `${month}/${day}/${year}`;
            default:
                return `${year}-${month}-${day}`;
        }
    },

    // Format date and time
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format time
    formatTime(timeString) {
        const [hours, minutes] = timeString.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Get relative time (e.g., "2 hours ago")
    getRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
        return `${years} year${years > 1 ? 's' : ''} ago`;
    },

    // Validate email
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Validate phone number
    validatePhone(phone) {
        const re = /^[\d\s\-\+\(\)]+$/;
        return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
    },

    // Validate URL
    validateURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Deep clone object
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Get nested object property safely
    getNestedProperty(obj, path) {
        return path.split('.').reduce((o, p) => o && o[p], obj);
    },

    // Set nested object property
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((o, k) => o[k] = o[k] || {}, obj);
        target[lastKey] = value;
    },

    // Convert object to query string
    toQueryString(obj) {
        return Object.keys(obj)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]))
            .join('&');
    },

    // Parse query string to object
    parseQueryString(queryString) {
        const params = new URLSearchParams(queryString);
        const obj = {};
        for (const [key, value] of params) {
            obj[key] = value;
        }
        return obj;
    },

    // Generate random color
    randomColor() {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    },

    // Lighten color
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (
            0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1);
    },

    // Darken color
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (
            0x1000000 +
            (R > 0 ? R : 0) * 0x10000 +
            (G > 0 ? G : 0) * 0x100 +
            (B > 0 ? B : 0)
        ).toString(16).slice(1);
    },

    // Calculate percentage
    calculatePercentage(value, total) {
        if (total === 0) return 0;
        return (value / total) * 100;
    },

    // Calculate percentage change
    calculatePercentageChange(oldValue, newValue) {
        if (oldValue === 0) return newValue > 0 ? 100 : 0;
        return ((newValue - oldValue) / oldValue) * 100;
    },

    // Round to decimal places
    roundTo(number, decimals = 2) {
        return Number(Math.round(number + 'e' + decimals) + 'e-' + decimals);
    },

    // Generate array of dates between two dates
    getDateRange(startDate, endDate) {
        const dates = [];
        const currentDate = new Date(startDate);
        const end = new Date(endDate);

        while (currentDate <= end) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return dates;
    },

    // Get month name
    getMonthName(monthIndex, format = 'long') {
        const date = new Date();
        date.setMonth(monthIndex);
        return date.toLocaleDateString('en-US', { month: format });
    },

    // Get week number
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },

    // Check if date is today
    isToday(date) {
        const today = new Date();
        const checkDate = new Date(date);
        return checkDate.getDate() === today.getDate() &&
            checkDate.getMonth() === today.getMonth() &&
            checkDate.getFullYear() === today.getFullYear();
    },

    // Check if date is in current week
    isThisWeek(date) {
        const today = new Date();
        const checkDate = new Date(date);
        const thisWeek = Utils.getWeekNumber(today);
        const checkWeek = Utils.getWeekNumber(checkDate);
        return thisWeek === checkWeek && today.getFullYear() === checkDate.getFullYear();
    },

    // Check if date is in current month
    isThisMonth(date) {
        const today = new Date();
        const checkDate = new Date(date);
        return today.getMonth() === checkDate.getMonth() &&
            today.getFullYear() === checkDate.getFullYear();
    },

    // Check if date is in current year
    isThisYear(date) {
        const today = new Date();
        const checkDate = new Date(date);
        return today.getFullYear() === checkDate.getFullYear();
    },

    // Parse CSV string to array
    parseCSV(csvString) {
        const lines = csvString.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',').map(v => v.trim());
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = values[index];
                });
                data.push(obj);
            }
        }

        return data;
    },

    // Convert array to CSV string
    toCSV(data) {
        if (!data || data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header];
                const escaped = ('' + value).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    },

    // Download file
    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            return false;
        }
    },

    // Get file extension
    getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    },

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Validate file type
    validateFileType(file, allowedTypes) {
        const fileExtension = Utils.getFileExtension(file.name).toLowerCase();
        return allowedTypes.includes(fileExtension);
    },

    // Sanitize HTML
    sanitizeHTML(html) {
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    },

    // Escape HTML
    escapeHTML(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    escapeHtml(str) {
        return this.escapeHTML(str);
    },

    // Generate slug from string
    generateSlug(str) {
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    // Truncate text
    truncateText(text, maxLength = 100, suffix = '...') {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + suffix;
    },

    // Capitalize first letter
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // Capitalize each word
    titleCase(str) {
        return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },

    // Check if object is empty
    isEmpty(obj) {
        return Object.keys(obj).length === 0;
    },

    // Merge objects
    mergeObjects(...objs) {
        return Object.assign({}, ...objs);
    },

    // Remove duplicates from array
    removeDuplicates(arr, key) {
        if (!key) return [...new Set(arr)];
        return [
            ...new Map(arr.map(item => [item[key], item])).values()
        ];
    },

    // Sort array by key
    sortBy(arr, key, order = 'asc') {
        return arr.sort((a, b) => {
            if (order === 'asc') {
                return a[key] > b[key] ? 1 : -1;
            } else {
                return a[key] < b[key] ? 1 : -1;
            }
        });
    },

    // Group array by key
    groupBy(arr, key) {
        return arr.reduce((result, item) => {
            (result[item[key]] = result[item[key]] || []).push(item);
            return result;
        }, {});
    },

    // Find object in array by key
    findBy(arr, key, value) {
        return arr.find(item => item[key] === value);
    },

    // Filter array by key
    filterBy(arr, key, value) {
        return arr.filter(item => item[key] === value);
    },

    // Get unique values from array
    getUniqueValues(arr, key) {
        if (!key) return [...new Set(arr)];
        return [...new Set(arr.map(item => item[key]))];
    },

    // Calculate sum of array
    sum(arr, key) {
        if (!key) return arr.reduce((a, b) => a + b, 0);
        return arr.reduce((a, b) => a + (b[key] || 0), 0);
    },

    // Calculate average of array
    average(arr, key) {
        if (!key) {
            return arr.reduce((a, b) => a + b, 0) / arr.length;
        }
        return arr.reduce((a, b) => a + (b[key] || 0), 0) / arr.length;
    },

    // Get min value from array
    min(arr, key) {
        if (!key) return Math.min(...arr);
        return Math.min(...arr.map(item => item[key]));
    },

    // Get max value from array
    max(arr, key) {
        if (!key) return Math.max(...arr);
        return Math.max(...arr.map(item => item[key]));
    },

    // Sleep function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // Retry function
    async retry(fn, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retries - 1) throw error;
                await Utils.sleep(delay);
            }
        }
    },

    // Check if running in Electron
    isElectron() {
        return typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
    },

    // Get platform information
    getPlatform() {
        return navigator.platform;
    },

    // Check if mobile device
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // Check if online
    isOnline() {
        return navigator.onLine;
    },

    // Escape HTML for XSS safety
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // Debounce: delay function execution until after `wait` ms have elapsed
    debounce(fn, wait = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
        };
    },

    // Today's date string (YYYY-MM-DD)
    today() {
        return new Date().toISOString().split('T')[0];
    },

    // Current month string (YYYY-MM)
    currentMonth() {
        return new Date().toISOString().slice(0, 7);
    },

    // Status badge HTML
    formatBadge(status, colorMap = {}) {
        const defaultColors = {
            active: 'success', inactive: 'secondary', pending: 'warning',
            paid: 'success', unpaid: 'danger', partial: 'warning',
            approved: 'success', rejected: 'danger', present: 'success',
            absent: 'danger', late: 'warning', leave: 'info', holiday: 'secondary'
        };
        const merged = { ...defaultColors, ...colorMap };
        const key = (status || '').toLowerCase();
        const color = merged[key] || 'secondary';
        return `<span class="badge bg-${color}">${Utils.escapeHtml(status)}</span>`;
    }
};

// Export to global scope
window.Utils = Utils;
