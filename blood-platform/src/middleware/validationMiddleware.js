/**
 * Validation Middleware
 * Custom validation functions for blood platform
 */

const { body, param, query, validationResult } = require('express-validator');
const { validateBloodType, validateCoordinates, validateEmail, formatPhoneNumber } = require('../utils/helpers');

/**
 * Handle validation errors
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
}

/**
 * Validate blood type
 */
function validateBloodTypeField(field) {
    return body(field).custom((value) => {
        if (!validateBloodType(value)) {
            throw new Error('Invalid blood type. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-');
        }
        return true;
    });
}

/**
 * Validate coordinates
 */
function validateLocationField(field) {
    return [
        body(`${field}.lat`).isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
        body(`${field}.lng`).isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
    ];
}

/**
 * Validate and format phone number
 */
function validatePhoneField(field) {
    return body(field).custom((value) => {
        const formatted = formatPhoneNumber(value);
        if (!formatted) {
            throw new Error('Invalid phone number format');
        }
        return true;
    });
}

/**
 * Validate email with custom rules
 */
function validateEmailField(field) {
    return body(field).custom((value) => {
        if (!validateEmail(value)) {
            throw new Error('Invalid email format');
        }
        return true;
    });
}

/**
 * Validate date is in future
 */
function validateFutureDate(field) {
    return body(field).custom((value) => {
        const date = new Date(value);
        if (date <= new Date()) {
            throw new Error('Date must be in the future');
        }
        return true;
    });
}

/**
 * Validate urgency level
 */
function validateUrgencyField(field) {
    return body(field).isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Urgency must be one of: low, medium, high, critical');
}

/**
 * Validate units needed
 */
function validateUnitsField(field) {
    return body(field).isInt({ min: 1, max: 10 })
        .withMessage('Units needed must be between 1 and 10');
}

/**
 * Validate UUID parameter
 */
function validateUUIDParam(paramName) {
    return param(paramName).isUUID().withMessage(`${paramName} must be a valid UUID`);
}

/**
 * Validate pagination parameters
 */
function validatePagination() {
    return [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    ];
}

/**
 * Validate date range
 */
function validateDateRange() {
    return [
        query('start_date').optional().isISO8601().withMessage('Start date must be in ISO 8601 format'),
        query('end_date').optional().isISO8601().withMessage('End date must be in ISO 8601 format'),
        query('start_date').optional().custom((value, { req }) => {
            if (req.query.end_date && new Date(value) > new Date(req.query.end_date)) {
                throw new Error('Start date must be before end date');
            }
            return true;
        })
    ];
}

/**
 * Validate timeframe parameter
 */
function validateTimeframe() {
    return query('timeframe').optional().isIn(['7d', '30d', '90d', '1y'])
        .withMessage('Timeframe must be one of: 7d, 30d, 90d, 1y');
}

/**
 * Validate donor registration data
 */
const validateDonorRegistration = [
    body('name').isLength({ min: 2, max: 100 }).trim().escape()
        .withMessage('Name must be between 2 and 100 characters'),
    validateEmailField('email'),
    validatePhoneField('phone'),
    validateBloodTypeField('blood_type'),
    body('date_of_birth').isISO8601().withMessage('Date of birth must be in ISO 8601 format'),
    body('date_of_birth').custom((value) => {
        const age = Math.floor((Date.now() - new Date(value)) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18 || age > 65) {
            throw new Error('Donor must be between 18 and 65 years old');
        }
        return true;
    }),
    ...validateLocationField('location'),
    body('address').optional().isString().isLength({ max: 500 })
        .withMessage('Address must be less than 500 characters'),
    body('medical_conditions').optional().isArray()
        .withMessage('Medical conditions must be an array'),
    body('emergency_contact.name').optional().isString().isLength({ min: 2, max: 100 })
        .withMessage('Emergency contact name must be between 2 and 100 characters'),
    body('emergency_contact.phone').optional().custom((value) => {
        if (value && !formatPhoneNumber(value)) {
            throw new Error('Invalid emergency contact phone number');
        }
        return true;
    }),
    body('emergency_contact.relationship').optional().isString().isLength({ max: 50 })
        .withMessage('Relationship must be less than 50 characters'),
    handleValidationErrors
];

/**
 * Validate blood request data
 */
const validateBloodRequest = [
    body('name').isLength({ min: 2, max: 100 }).trim().escape()
        .withMessage('Name must be between 2 and 100 characters'),
    validateEmailField('email'),
    validatePhoneField('phone'),
    validateBloodTypeField('blood_type'),
    validateUrgencyField('urgency'),
    validateUnitsField('units_needed'),
    body('hospital_id').isUUID().withMessage('Hospital ID must be a valid UUID'),
    body('hospital_name').isLength({ min: 2, max: 200 }).trim().escape()
        .withMessage('Hospital name must be between 2 and 200 characters'),
    ...validateLocationField('location'),
    body('medical_condition').optional().isString().isLength({ max: 1000 })
        .withMessage('Medical condition must be less than 1000 characters'),
    validateFutureDate('needed_by'),
    body('doctor_name').optional().isString().isLength({ min: 2, max: 100 })
        .withMessage('Doctor name must be between 2 and 100 characters'),
    body('doctor_contact').optional().custom((value) => {
        if (value && !formatPhoneNumber(value)) {
            throw new Error('Invalid doctor contact phone number');
        }
        return true;
    }),
    body('patient_age').optional().isInt({ min: 0, max: 120 })
        .withMessage('Patient age must be between 0 and 120'),
    body('patient_weight').optional().isFloat({ min: 1, max: 300 })
        .withMessage('Patient weight must be between 1 and 300 kg'),
    handleValidationErrors
];

/**
 * Validate availability update
 */
const validateAvailabilityUpdate = [
    body('availability').isBoolean().withMessage('Availability must be a boolean'),
    body('available_until').optional().isISO8601()
        .withMessage('Available until must be in ISO 8601 format'),
    body('available_until').optional().custom((value) => {
        if (value && new Date(value) <= new Date()) {
            throw new Error('Available until date must be in the future');
        }
        return true;
    }),
    handleValidationErrors
];

/**
 * Validate donor response
 */
const validateDonorResponse = [
    body('response').isIn(['accepted', 'declined'])
        .withMessage('Response must be either accepted or declined'),
    body('notes').optional().isString().isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters'),
    handleValidationErrors
];

/**
 * Validate status update
 */
const validateStatusUpdate = [
    body('status').isIn(['pending', 'matched', 'fulfilled', 'expired', 'cancelled'])
        .withMessage('Status must be one of: pending, matched, fulfilled, expired, cancelled'),
    body('notes').optional().isString().isLength({ max: 1000 })
        .withMessage('Notes must be less than 1000 characters'),
    handleValidationErrors
];

/**
 * Validate donation data
 */
const validateDonationData = [
    body('request_id').optional().isUUID().withMessage('Request ID must be a valid UUID'),
    body('donor_id').isUUID().withMessage('Donor ID must be a valid UUID'),
    body('hospital_id').isUUID().withMessage('Hospital ID must be a valid UUID'),
    body('donation_date').isISO8601().withMessage('Donation date must be in ISO 8601 format'),
    body('scheduled_time').optional().isISO8601()
        .withMessage('Scheduled time must be in ISO 8601 format'),
    body('units').optional().isInt({ min: 1, max: 4 })
        .withMessage('Units must be between 1 and 4'),
    body('blood_pressure').optional().isString().matches(/^\d{2,3}\/\d{2,3}$/)
        .withMessage('Blood pressure must be in format XXX/XX'),
    body('hemoglobin_level').optional().isFloat({ min: 5, max: 20 })
        .withMessage('Hemoglobin level must be between 5 and 20 g/dL'),
    handleValidationErrors
];

/**
 * Sanitize input data
 */
function sanitizeInput(req, res, next) {
    // Recursively sanitize all string values in req.body
    function sanitizeObject(obj) {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key].trim().substring(0, 1000); // Limit length and trim
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizeObject(obj[key]);
            }
        }
    }

    if (req.body && typeof req.body === 'object') {
        sanitizeObject(req.body);
    }

    next();
}

module.exports = {
    handleValidationErrors,
    validateBloodTypeField,
    validateLocationField,
    validatePhoneField,
    validateEmailField,
    validateFutureDate,
    validateUrgencyField,
    validateUnitsField,
    validateUUIDParam,
    validatePagination,
    validateDateRange,
    validateTimeframe,
    validateDonorRegistration,
    validateBloodRequest,
    validateAvailabilityUpdate,
    validateDonorResponse,
    validateStatusUpdate,
    validateDonationData,
    sanitizeInput
};