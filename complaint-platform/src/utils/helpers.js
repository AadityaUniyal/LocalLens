function validateCoordinates(lat, lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
        return { valid: false, error: 'Coordinates must be valid numbers' };
    }
    
    if (latitude < -90 || latitude > 90) {
        return { valid: false, error: 'Latitude must be between -90 and 90' };
    }
    
    if (longitude < -180 || longitude > 180) {
        return { valid: false, error: 'Longitude must be between -180 and 180' };
    }
    
    return { valid: true, lat: latitude, lng: longitude };
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function generateComplaintId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `CMP${timestamp}${randomStr}`.toUpperCase();
}

function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return input;
    }
    
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 2000); // Limit length
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePhoneNumber(phone) {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Check if it's a valid length (10-15 digits)
    if (cleaned.length < 10 || cleaned.length > 15) {
        return { valid: false, error: 'Phone number must be 10-15 digits' };
    }
    
    return { valid: true, phone: cleaned };
}

function formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone; // Return original if can't format
}

function validateComplaintCategory(category) {
    const validCategories = [
        'infrastructure', 'sanitation', 'traffic', 'noise', 
        'water', 'electricity', 'public_safety', 'environment', 'other'
    ];
    
    return validCategories.includes(category);
}

function validateComplaintPriority(priority) {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    return validPriorities.includes(priority);
}

function validateComplaintStatus(status) {
    const validStatuses = ['filed', 'acknowledged', 'in_progress', 'resolved', 'closed', 'rejected'];
    return validStatuses.includes(status);
}

function getCategoryDisplayName(category) {
    const categoryNames = {
        'infrastructure': 'Infrastructure',
        'sanitation': 'Sanitation',
        'traffic': 'Traffic',
        'noise': 'Noise Pollution',
        'water': 'Water Supply',
        'electricity': 'Electricity',
        'public_safety': 'Public Safety',
        'environment': 'Environment',
        'other': 'Other'
    };
    
    return categoryNames[category] || category;
}

function getPriorityInfo(priority) {
    const priorityInfo = {
        'urgent': { name: 'Urgent', color: '#dc3545', weight: 4 },
        'high': { name: 'High', color: '#fd7e14', weight: 3 },
        'medium': { name: 'Medium', color: '#ffc107', weight: 2 },
        'low': { name: 'Low', color: '#28a745', weight: 1 }
    };
    
    return priorityInfo[priority] || { name: priority, color: '#6c757d', weight: 0 };
}

function getStatusInfo(status) {
    const statusInfo = {
        'filed': { name: 'Filed', color: '#17a2b8', icon: 'file-text' },
        'acknowledged': { name: 'Acknowledged', color: '#6f42c1', icon: 'check-circle' },
        'in_progress': { name: 'In Progress', color: '#fd7e14', icon: 'clock' },
        'resolved': { name: 'Resolved', color: '#28a745', icon: 'check' },
        'closed': { name: 'Closed', color: '#6c757d', icon: 'x-circle' },
        'rejected': { name: 'Rejected', color: '#dc3545', icon: 'x' }
    };
    
    return statusInfo[status] || { name: status, color: '#6c757d', icon: 'help-circle' };
}

function calculateEstimatedResolutionTime(category, priority) {
    const baseDays = {
        'infrastructure': 14,
        'sanitation': 7,
        'traffic': 3,
        'noise': 5,
        'water': 2,
        'electricity': 1,
        'public_safety': 1,
        'environment': 10,
        'other': 7
    };
    
    const priorityMultipliers = {
        'urgent': 0.5,
        'high': 0.7,
        'medium': 1.0,
        'low': 1.5
    };
    
    const base = baseDays[category] || 7;
    const multiplier = priorityMultipliers[priority] || 1.0;
    
    return Math.ceil(base * multiplier);
}

function formatDate(date, format = 'YYYY-MM-DD') {
    const d = new Date(date);
    
    if (format === 'YYYY-MM-DD') {
        return d.toISOString().split('T')[0];
    }
    
    if (format === 'DD/MM/YYYY') {
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    }
    
    if (format === 'readable') {
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    if (format === 'relative') {
        return getRelativeTime(d);
    }
    
    return d.toISOString();
}

function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return formatDate(date, 'readable');
}

function isComplaintOverdue(complaint) {
    if (!complaint.estimated_resolution_date) return false;
    
    const now = new Date();
    const dueDate = new Date(complaint.estimated_resolution_date);
    
    return now > dueDate && !['resolved', 'closed'].includes(complaint.status);
}

function getDaysOverdue(complaint) {
    if (!isComplaintOverdue(complaint)) return 0;
    
    const now = new Date();
    const dueDate = new Date(complaint.estimated_resolution_date);
    const diffTime = now - dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

function generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
}

function validateFileUpload(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedTypes.includes(file.mimetype)) {
        return { valid: false, error: 'Invalid file type. Only images and documents are allowed.' };
    }
    
    if (file.size > maxSize) {
        return { valid: false, error: 'File too large. Maximum size is 10MB.' };
    }
    
    return { valid: true };
}

function getFileTypeIcon(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype === 'application/pdf') return 'file-pdf';
    if (mimetype.includes('word')) return 'file-word';
    if (mimetype.includes('excel')) return 'file-excel';
    return 'file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function isWithinBusinessHours(date = new Date()) {
    const hour = date.getHours();
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Monday to Friday, 9 AM to 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
}

function getNextBusinessDay(date = new Date()) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Skip weekends
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return nextDay;
}

function calculateBusinessDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let businessDays = 0;
    
    while (start <= end) {
        const dayOfWeek = start.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
            businessDays++;
        }
        start.setDate(start.getDate() + 1);
    }
    
    return businessDays;
}

function generateHash(data) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function maskSensitiveInfo(text, type = 'email') {
    if (!text) return text;
    
    if (type === 'email') {
        const [username, domain] = text.split('@');
        if (username.length <= 2) return text;
        return `${username.substring(0, 2)}***@${domain}`;
    }
    
    if (type === 'phone') {
        if (text.length <= 4) return text;
        return `***-***-${text.slice(-4)}`;
    }
    
    return text;
}

function parseQueryParams(queryString) {
    const params = {};
    const pairs = queryString.split('&');
    
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
            params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
    }
    
    return params;
}

module.exports = {
    validateCoordinates,
    calculateDistance,
    generateComplaintId,
    sanitizeInput,
    validateEmail,
    validatePhoneNumber,
    formatPhoneNumber,
    validateComplaintCategory,
    validateComplaintPriority,
    validateComplaintStatus,
    getCategoryDisplayName,
    getPriorityInfo,
    getStatusInfo,
    calculateEstimatedResolutionTime,
    formatDate,
    getRelativeTime,
    isComplaintOverdue,
    getDaysOverdue,
    generateRandomPassword,
    validateFileUpload,
    getFileTypeIcon,
    formatFileSize,
    truncateText,
    isWithinBusinessHours,
    getNextBusinessDay,
    calculateBusinessDays,
    generateHash,
    maskSensitiveInfo,
    parseQueryParams
};

function validateCoordinates(lat, lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
        return { valid: false, error: 'Coordinates must be valid numbers' };
    }
    
    if (latitude < -90 || latitude > 90) {
        return { valid: false, error: 'Latitude must be between -90 and 90' };
    }
    
    if (longitude < -180 || longitude > 180) {
        return { valid: false, error: 'Longitude must be between -180 and 180' };
    }
    
    return { valid: true, lat: latitude, lng: longitude };
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function generateComplaintId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `CMP${timestamp}${randomStr}`.toUpperCase();
}

function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return input;
    }
    
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 2000); // Limit length
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePhoneNumber(phone) {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Check if it's a valid length (10-15 digits)
    if (cleaned.length < 10 || cleaned.length > 15) {
        return { valid: false, error: 'Phone number must be 10-15 digits' };
    }
    
    return { valid: true, phone: cleaned };
}

function formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone; // Return original if can't format
}

function validateComplaintCategory(category) {
    const validCategories = [
        'infrastructure', 'sanitation', 'traffic', 'noise', 
        'water', 'electricity', 'public_safety', 'environment', 'other'
    ];
    
    return validCategories.includes(category);
}

function validateComplaintPriority(priority) {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    return validPriorities.includes(priority);
}

function validateComplaintStatus(status) {
    const validStatuses = ['filed', 'acknowledged', 'in_progress', 'resolved', 'closed', 'rejected'];
    return validStatuses.includes(status);
}

function getCategoryDisplayName(category) {
    const categoryNames = {
        'infrastructure': 'Infrastructure',
        'sanitation': 'Sanitation',
        'traffic': 'Traffic',
        'noise': 'Noise Pollution',
        'water': 'Water Supply',
        'electricity': 'Electricity',
        'public_safety': 'Public Safety',
        'environment': 'Environment',
        'other': 'Other'
    };
    
    return categoryNames[category] || category;
}

function getPriorityInfo(priority) {
    const priorityInfo = {
        'urgent': { name: 'Urgent', color: '#dc3545', weight: 4 },
        'high': { name: 'High', color: '#fd7e14', weight: 3 },
        'medium': { name: 'Medium', color: '#ffc107', weight: 2 },
        'low': { name: 'Low', color: '#28a745', weight: 1 }
    };
    
    return priorityInfo[priority] || { name: priority, color: '#6c757d', weight: 0 };
}

function getStatusInfo(status) {
    const statusInfo = {
        'filed': { name: 'Filed', color: '#17a2b8', icon: 'file-text' },
        'acknowledged': { name: 'Acknowledged', color: '#6f42c1', icon: 'check-circle' },
        'in_progress': { name: 'In Progress', color: '#fd7e14', icon: 'clock' },
        'resolved': { name: 'Resolved', color: '#28a745', icon: 'check' },
        'closed': { name: 'Closed', color: '#6c757d', icon: 'x-circle' },
        'rejected': { name: 'Rejected', color: '#dc3545', icon: 'x' }
    };
    
    return statusInfo[status] || { name: status, color: '#6c757d', icon: 'help-circle' };
}

function calculateEstimatedResolutionTime(category, priority) {
    const baseDays = {
        'infrastructure': 14,
        'sanitation': 7,
        'traffic': 3,
        'noise': 5,
        'water': 2,
        'electricity': 1,
        'public_safety': 1,
        'environment': 10,
        'other': 7
    };
    
    const priorityMultipliers = {
        'urgent': 0.5,
        'high': 0.7,
        'medium': 1.0,
        'low': 1.5
    };
    
    const base = baseDays[category] || 7;
    const multiplier = priorityMultipliers[priority] || 1.0;
    
    return Math.ceil(base * multiplier);
}

function formatDate(date, format = 'YYYY-MM-DD') {
    const d = new Date(date);
    
    if (format === 'YYYY-MM-DD') {
        return d.toISOString().split('T')[0];
    }
    
    if (format === 'DD/MM/YYYY') {
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    }
    
    if (format === 'readable') {
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    if (format === 'relative') {
        return getRelativeTime(d);
    }
    
    return d.toISOString();
}

function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return formatDate(date, 'readable');
}

function isComplaintOverdue(complaint) {
    if (!complaint.estimated_resolution_date) return false;
    
    const now = new Date();
    const dueDate = new Date(complaint.estimated_resolution_date);
    
    return now > dueDate && !['resolved', 'closed'].includes(complaint.status);
}

/**
 * Calculate days overdue
 */
function getDaysOverdue(complaint) {
    if (!isComplaintOverdue(complaint)) return 0;
    
    const now = new Date();
    const dueDate = new Date(complaint.estimated_resolution_date);
    const diffTime = now - dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

/**
 * Generate random password
 */
function generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
}

/**
 * Validate file upload
 */
function validateFileUpload(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedTypes.includes(file.mimetype)) {
        return { valid: false, error: 'Invalid file type. Only images and documents are allowed.' };
    }
    
    if (file.size > maxSize) {
        return { valid: false, error: 'File too large. Maximum size is 10MB.' };
    }
    
    return { valid: true };
}

/**
 * Get file type icon
 */
function getFileTypeIcon(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype === 'application/pdf') return 'file-pdf';
    if (mimetype.includes('word')) return 'file-word';
    if (mimetype.includes('excel')) return 'file-excel';
    return 'file';
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Check if time is within business hours
 */
function isWithinBusinessHours(date = new Date()) {
    const hour = date.getHours();
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Monday to Friday, 9 AM to 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
}

/**
 * Get next business day
 */
function getNextBusinessDay(date = new Date()) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Skip weekends
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return nextDay;
}

/**
 * Calculate business days between two dates
 */
function calculateBusinessDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let businessDays = 0;
    
    while (start <= end) {
        const dayOfWeek = start.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
            businessDays++;
        }
        start.setDate(start.getDate() + 1);
    }
    
    return businessDays;
}

/**
 * Generate hash for data integrity
 */
function generateHash(data) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

/**
 * Mask sensitive information
 */
function maskSensitiveInfo(text, type = 'email') {
    if (!text) return text;
    
    if (type === 'email') {
        const [username, domain] = text.split('@');
        if (username.length <= 2) return text;
        return `${username.substring(0, 2)}***@${domain}`;
    }
    
    if (type === 'phone') {
        if (text.length <= 4) return text;
        return `***-***-${text.slice(-4)}`;
    }
    
    return text;
}

/**
 * Parse query string parameters
 */
function parseQueryParams(queryString) {
    const params = {};
    const pairs = queryString.split('&');
    
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
            params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
    }
    
    return params;
}

module.exports = {
    validateCoordinates,
    calculateDistance,
    generateComplaintId,
    sanitizeInput,
    validateEmail,
    validatePhoneNumber,
    formatPhoneNumber,
    validateComplaintCategory,
    validateComplaintPriority,
    validateComplaintStatus,
    getCategoryDisplayName,
    getPriorityInfo,
    getStatusInfo,
    calculateEstimatedResolutionTime,
    formatDate,
    getRelativeTime,
    isComplaintOverdue,
    getDaysOverdue,
    generateRandomPassword,
    validateFileUpload,
    getFileTypeIcon,
    formatFileSize,
    truncateText,
    isWithinBusinessHours,
    getNextBusinessDay,
    calculateBusinessDays,
    generateHash,
    maskSensitiveInfo,
    parseQueryParams
};
