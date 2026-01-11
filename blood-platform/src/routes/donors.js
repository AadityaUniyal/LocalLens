/**
 * Donor Routes
 * API endpoints for donor management
 */

const express = require('express');
const { body, validationResult, param } = require('express-validator');
const router = express.Router();

// Import services (will be injected by main app)
let dbManager, matchingService, notificationService;

// Initialize services
function initializeServices(services) {
    dbManager = services.dbManager;
    matchingService = services.matchingService;
    notificationService = services.notificationService;
}

// Validation middleware
const validateDonorRegistration = [
    body('name').isLength({ min: 2, max: 100 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('phone').isMobilePhone(),
    body('blood_type').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    body('date_of_birth').isISO8601(),
    body('location.lat').isFloat({ min: -90, max: 90 }),
    body('location.lng').isFloat({ min: -180, max: 180 }),
    body('medical_conditions').optional().isArray(),
    body('address').optional().isString(),
    body('emergency_contact.name').optional().isString(),
    body('emergency_contact.phone').optional().isMobilePhone(),
    body('emergency_contact.relationship').optional().isString()
];

const validateAvailabilityUpdate = [
    body('availability').isBoolean(),
    body('available_until').optional().isISO8601()
];

// Register new donor
router.post('/register', validateDonorRegistration, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const donorData = req.body;
        
        // Check if donor already exists
        const existingDonor = await dbManager.getDonorByEmail(donorData.email);
        if (existingDonor) {
            return res.status(409).json({
                success: false,
                error: 'Donor already registered with this email'
            });
        }

        // Register donor
        const donor = await dbManager.createDonor(donorData);

        res.status(201).json({
            success: true,
            message: 'Donor registered successfully',
            donor: {
                id: donor.id,
                name: donor.name,
                blood_type: donor.blood_type,
                availability: donor.availability,
                created_at: donor.created_at
            }
        });

    } catch (error) {
        console.error('Donor registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get donor profile
router.get('/profile/:donorId', [
    param('donorId').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid donor ID'
            });
        }

        const { donorId } = req.params;
        const donor = await dbManager.getDonorById(donorId);

        if (!donor) {
            return res.status(404).json({
                success: false,
                error: 'Donor not found'
            });
        }

        // Get donation history
        const donations = await dbManager.getDonationsByDonor(donorId, 10);

        res.json({
            success: true,
            donor: {
                ...donor,
                location: typeof donor.location === 'string' ? JSON.parse(donor.location) : donor.location,
                medical_conditions: typeof donor.medical_conditions === 'string' ? 
                    JSON.parse(donor.medical_conditions) : donor.medical_conditions,
                emergency_contact: typeof donor.emergency_contact === 'string' ? 
                    JSON.parse(donor.emergency_contact) : donor.emergency_contact
            },
            donation_history: donations
        });

    } catch (error) {
        console.error('Get donor profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Update donor availability
router.put('/:donorId/availability', [
    param('donorId').isUUID(),
    ...validateAvailabilityUpdate
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

        const { donorId } = req.params;
        const { availability, available_until } = req.body;

        const updatedDonor = await dbManager.updateDonorAvailability(donorId, {
            availability,
            available_until: available_until ? new Date(available_until) : null,
            last_availability_update: new Date()
        });

        if (!updatedDonor) {
            return res.status(404).json({
                success: false,
                error: 'Donor not found'
            });
        }

        // If donor became available, check for pending matches
        if (availability) {
            const pendingRequests = await matchingService.findPendingRequestsForDonor(donorId);
            
            for (const request of pendingRequests) {
                const matches = await matchingService.findCompatibleDonors(request);
                if (matches.length > 0) {
                    await notificationService.notifyEmergencyMatch(request, matches);
                }
            }
        }

        res.json({
            success: true,
            message: 'Availability updated successfully',
            donor: updatedDonor
        });

    } catch (error) {
        console.error('Donor availability update error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get compatible requests for donor
router.get('/:donorId/compatible-requests', [
    param('donorId').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid donor ID'
            });
        }

        const { donorId } = req.params;
        const requests = await matchingService.findPendingRequestsForDonor(donorId);

        res.json({
            success: true,
            compatible_requests: requests,
            total_found: requests.length
        });

    } catch (error) {
        console.error('Get compatible requests error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Respond to blood request match
router.post('/:donorId/respond/:matchId', [
    param('donorId').isUUID(),
    param('matchId').isUUID(),
    body('response').isIn(['accepted', 'declined']),
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

        const { donorId, matchId } = req.params;
        const { response, notes } = req.body;

        // Update match response
        const updatedMatch = await dbManager.updateDonorMatchResponse(matchId, response);

        if (!updatedMatch) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }

        // If accepted, create donation record
        if (response === 'accepted') {
            const bloodRequest = await dbManager.getBloodRequestById(updatedMatch.request_id);
            
            if (bloodRequest && bloodRequest.status === 'pending') {
                const donation = await dbManager.createDonation({
                    request_id: bloodRequest.id,
                    donor_id: donorId,
                    hospital_id: bloodRequest.hospital_id,
                    donation_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
                    status: 'scheduled',
                    units: bloodRequest.units_needed
                });

                // Update request status
                await dbManager.updateBloodRequestStatus(bloodRequest.id, 'matched');

                // Send confirmation notifications
                await notificationService.notifyDonationConfirmed(donation);

                return res.json({
                    success: true,
                    message: 'Match accepted and donation scheduled',
                    donation
                });
            }
        }

        res.json({
            success: true,
            message: `Match ${response} successfully`,
            match: updatedMatch
        });

    } catch (error) {
        console.error('Donor response error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get donor statistics
router.get('/:donorId/statistics', [
    param('donorId').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid donor ID'
            });
        }

        const { donorId } = req.params;
        const donor = await dbManager.getDonorById(donorId);

        if (!donor) {
            return res.status(404).json({
                success: false,
                error: 'Donor not found'
            });
        }

        const donations = await dbManager.getDonationsByDonor(donorId, 100);
        const completedDonations = donations.filter(d => d.status === 'completed');
        
        const statistics = {
            total_donations: donor.total_donations || 0,
            completed_donations: completedDonations.length,
            last_donation_date: donor.last_donation_date,
            eligibility_status: donor.eligibility_status,
            blood_type: donor.blood_type,
            member_since: donor.created_at,
            lives_potentially_saved: completedDonations.length * 3, // Each donation can save up to 3 lives
            next_eligible_date: donor.last_donation_date ? 
                new Date(new Date(donor.last_donation_date).getTime() + 56 * 24 * 60 * 60 * 1000) : 
                new Date()
        };

        res.json({
            success: true,
            statistics
        });

    } catch (error) {
        console.error('Get donor statistics error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = { router, initializeServices };