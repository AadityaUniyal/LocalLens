/**
 * Blood Request Routes
 * API endpoints for blood request management
 */

const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const router = express.Router();

// Import services (will be injected by main app)
let dbManager, matchingService, notificationService, inventoryService;

// Initialize services
function initializeServices(services) {
    dbManager = services.dbManager;
    matchingService = services.matchingService;
    notificationService = services.notificationService;
    inventoryService = services.inventoryService;
}

// Validation middleware
const validateBloodRequest = [
    body('name').isLength({ min: 2, max: 100 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('phone').isMobilePhone(),
    body('blood_type').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    body('urgency').isIn(['low', 'medium', 'high', 'critical']),
    body('units_needed').isInt({ min: 1, max: 10 }),
    body('hospital_id').isUUID(),
    body('hospital_name').isLength({ min: 2, max: 200 }),
    body('location.lat').isFloat({ min: -90, max: 90 }),
    body('location.lng').isFloat({ min: -180, max: 180 }),
    body('medical_condition').optional().isString(),
    body('needed_by').isISO8601(),
    body('doctor_name').optional().isString(),
    body('doctor_contact').optional().isMobilePhone(),
    body('patient_age').optional().isInt({ min: 0, max: 120 }),
    body('patient_weight').optional().isFloat({ min: 1, max: 300 })
];

// Create new blood request
router.post('/', validateBloodRequest, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const requestData = req.body;
        
        // Validate needed_by date is in the future
        const neededBy = new Date(requestData.needed_by);
        if (neededBy <= new Date()) {
            return res.status(400).json({
                success: false,
                error: 'needed_by date must be in the future'
            });
        }

        // Create blood request
        const bloodRequest = await dbManager.createBloodRequest(requestData);

        // Find compatible donors immediately
        const compatibleDonors = await matchingService.findCompatibleDonors(bloodRequest);

        // Send notifications to compatible donors
        if (compatibleDonors.length > 0) {
            await notificationService.notifyDonorsOfRequest(bloodRequest, compatibleDonors);
            
            // For critical requests, also send emergency notifications
            if (requestData.urgency === 'critical') {
                await notificationService.notifyEmergencyMatch(bloodRequest, compatibleDonors);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Blood request created successfully',
            request: bloodRequest,
            compatible_donors_found: compatibleDonors.length,
            estimated_response_time: matchingService.calculateEstimatedResponseTime(
                requestData.urgency, 
                compatibleDonors.length
            )
        });

    } catch (error) {
        console.error('Blood request creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get blood requests with filters
router.get('/', [
    query('status').optional().isIn(['pending', 'matched', 'fulfilled', 'expired', 'cancelled']),
    query('urgency').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('blood_type').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid query parameters',
                details: errors.array()
            });
        }

        const { status, urgency, blood_type, page = 1, limit = 20 } = req.query;
        
        const requests = await dbManager.getBloodRequests({
            status,
            urgency,
            blood_type,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            requests: requests.data,
            pagination: requests.pagination
        });

    } catch (error) {
        console.error('Blood requests fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get specific blood request
router.get('/:requestId', [
    param('requestId').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        const { requestId } = req.params;
        const bloodRequest = await dbManager.getBloodRequestById(requestId);

        if (!bloodRequest) {
            return res.status(404).json({
                success: false,
                error: 'Blood request not found'
            });
        }

        // Get donor matches for this request
        const matches = await dbManager.getDonorMatches(requestId);

        res.json({
            success: true,
            request: {
                ...bloodRequest,
                location: typeof bloodRequest.location === 'string' ? 
                    JSON.parse(bloodRequest.location) : bloodRequest.location
            },
            matches
        });

    } catch (error) {
        console.error('Get blood request error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Update blood request status
router.put('/:requestId/status', [
    param('requestId').isUUID(),
    body('status').isIn(['pending', 'matched', 'fulfilled', 'expired', 'cancelled']),
    body('notes').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { requestId } = req.params;
        const { status, notes } = req.body;

        const updatedRequest = await dbManager.updateBloodRequestStatus(requestId, status, notes);

        if (!updatedRequest) {
            return res.status(404).json({
                success: false,
                error: 'Blood request not found'
            });
        }

        res.json({
            success: true,
            message: 'Request status updated successfully',
            request: updatedRequest
        });

    } catch (error) {
        console.error('Update request status error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Find compatible donors for a request
router.post('/:requestId/find-donors', [
    param('requestId').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        const { requestId } = req.params;
        const bloodRequest = await dbManager.getBloodRequestById(requestId);

        if (!bloodRequest) {
            return res.status(404).json({
                success: false,
                error: 'Blood request not found'
            });
        }

        const compatibleDonors = await matchingService.findCompatibleDonors(bloodRequest);

        res.json({
            success: true,
            compatible_donors: compatibleDonors,
            total_found: compatibleDonors.length,
            estimated_response_time: matchingService.calculateEstimatedResponseTime(
                bloodRequest.urgency,
                compatibleDonors.length
            )
        });

    } catch (error) {
        console.error('Find donors error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get urgent requests (for dashboard)
router.get('/urgent/list', async (req, res) => {
    try {
        const urgentRequests = await dbManager.getBloodRequests({
            status: 'pending',
            urgency: 'critical',
            limit: 10
        });

        const highPriorityRequests = await dbManager.getBloodRequests({
            status: 'pending',
            urgency: 'high',
            limit: 10
        });

        res.json({
            success: true,
            critical_requests: urgentRequests.data,
            high_priority_requests: highPriorityRequests.data,
            total_urgent: urgentRequests.data.length + highPriorityRequests.data.length
        });

    } catch (error) {
        console.error('Get urgent requests error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get requests by blood type (for inventory planning)
router.get('/by-blood-type/:bloodType', [
    param('bloodType').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid blood type'
            });
        }

        const { bloodType } = req.params;
        const requests = await dbManager.getBloodRequests({
            blood_type: bloodType,
            status: 'pending',
            limit: 50
        });

        // Get current inventory for this blood type
        const inventory = await inventoryService.getBloodInventory(null, bloodType);
        const totalUnits = inventory.reduce((sum, item) => sum + item.units, 0);

        res.json({
            success: true,
            blood_type: bloodType,
            pending_requests: requests.data,
            total_requests: requests.data.length,
            total_units_needed: requests.data.reduce((sum, req) => sum + req.units_needed, 0),
            current_inventory_units: totalUnits,
            supply_demand_ratio: requests.data.length > 0 ? 
                (totalUnits / requests.data.reduce((sum, req) => sum + req.units_needed, 0)).toFixed(2) : 
                'N/A'
        });

    } catch (error) {
        console.error('Get requests by blood type error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Cancel blood request
router.delete('/:requestId', [
    param('requestId').isUUID(),
    body('reason').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID'
            });
        }

        const { requestId } = req.params;
        const { reason } = req.body;

        const updatedRequest = await dbManager.updateBloodRequestStatus(
            requestId, 
            'cancelled', 
            reason || 'Request cancelled by user'
        );

        if (!updatedRequest) {
            return res.status(404).json({
                success: false,
                error: 'Blood request not found'
            });
        }

        res.json({
            success: true,
            message: 'Blood request cancelled successfully',
            request: updatedRequest
        });

    } catch (error) {
        console.error('Cancel request error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = { router, initializeServices };