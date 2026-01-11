#!/usr/bin/env node

/**
 * Local Lens Blood Donation Platform
 * Real-time blood donor-recipient matching with emergency response capabilities
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Import custom modules
const DatabaseManager = require('./config/database');
const MatchingService = require('./services/matchingService');
const NotificationService = require('./services/notificationService');
const InventoryService = require('./services/inventoryService');
const EmergencyService = require('./services/emergencyService');
const AnalyticsController = require('./controllers/analyticsController');
const { setupLogger, logWithExtra } = require('./utils/logger');
const { validateCoordinates, calculateDistance } = require('./utils/helpers');

// Import middleware
const { verifyToken, requireRole, optionalAuth } = require('./middleware/authMiddleware');
const { sanitizeInput } = require('./middleware/validationMiddleware');

// Import route modules
const donorRoutes = require('./routes/donors');
const requestRoutes = require('./routes/requests');
const analyticsRoutes = require('./routes/analytics');

// Initialize Express app and Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const logger = setupLogger('blood-platform');

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInput); // Sanitize all input data

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Initialize services
const dbManager = new DatabaseManager();
const matchingService = new MatchingService(dbManager);
const notificationService = new NotificationService(io);
const inventoryService = new InventoryService(dbManager);
const emergencyService = new EmergencyService(dbManager, matchingService, notificationService);
const analyticsController = new AnalyticsController(dbManager, inventoryService, matchingService);

// Initialize route services
const services = { dbManager, matchingService, notificationService, inventoryService, emergencyService, analyticsController };
donorRoutes.initializeServices(services);
requestRoutes.initializeServices(services);
analyticsRoutes.initializeServices(services);

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbHealth = await dbManager.healthCheck();
        
        res.json({
            status: 'healthy',
            service: 'blood-platform',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: process.uptime(),
            database: dbHealth
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            service: 'blood-platform',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// API Routes
app.use('/api/donors', donorRoutes.router);
app.use('/api/requests', requestRoutes.router);
app.use('/api/analytics', analyticsRoutes.router);

// Legacy endpoints for backward compatibility
app.post('/api/recipients/request', [
    body('name').isLength({ min: 2, max: 100 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('phone').isMobilePhone(),
    body('blood_type').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    body('urgency').isIn(['low', 'medium', 'high', 'critical']),
    body('units_needed').isInt({ min: 1, max: 10 }),
    body('hospital_id').isUUID(),
    body('location.lat').isFloat({ min: -90, max: 90 }),
    body('location.lng').isFloat({ min: -180, max: 180 }),
    body('medical_condition').optional().isString(),
    body('needed_by').isISO8601()
], async (req, res) => {
    // Redirect to new endpoint
    req.url = '/api/requests';
    requestRoutes.router.handle(req, res);
});

app.get('/api/recipients/requests', async (req, res) => {
    // Redirect to new endpoint
    req.url = '/api/requests';
    requestRoutes.router.handle(req, res);
});

// Matching endpoints
app.post('/api/matching/find-donors', [
    body('blood_type').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    body('location.lat').isFloat({ min: -90, max: 90 }),
    body('location.lng').isFloat({ min: -180, max: 180 }),
    body('radius').optional().isInt({ min: 1, max: 200 }),
    body('urgency').optional().isIn(['low', 'medium', 'high', 'critical'])
], async (req, res) => {
    try {
        const { blood_type, location, radius = 50, urgency = 'medium' } = req.body;

        const donors = await matchingService.findDonorsByBloodType(blood_type, {
            location,
            radius,
            urgency,
            availability: true
        });

        res.json({
            success: true,
            donors,
            total_found: donors.length,
            search_radius: radius,
            blood_type
        });

    } catch (error) {
        logger.error('Donor search error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.post('/api/matching/confirm', [
    body('request_id').isUUID(),
    body('donor_id').isUUID(),
    body('donation_date').isISO8601(),
    body('hospital_id').isUUID()
], async (req, res) => {
    try {
        const { request_id, donor_id, donation_date, hospital_id } = req.body;

        // Create donation record
        const donation = await dbManager.createDonation({
            request_id,
            donor_id,
            hospital_id,
            donation_date: new Date(donation_date),
            status: 'scheduled'
        });

        // Update request status
        await dbManager.updateBloodRequestStatus(request_id, 'matched');

        // Update donor availability
        await dbManager.updateDonorAvailability(donor_id, {
            availability: false,
            last_donation_scheduled: new Date(donation_date)
        });

        // Send confirmation notifications
        await notificationService.notifyDonationConfirmed(donation);

        // Emit real-time event
        io.emit('donation_confirmed', {
            donation,
            request_id,
            donor_id
        });

        logWithExtra(logger, 'info', 'Donation confirmed', {
            donationId: donation.id,
            requestId: request_id,
            donorId: donor_id,
            donationDate: donation_date
        });

        res.json({
            success: true,
            message: 'Donation confirmed successfully',
            donation
        });

    } catch (error) {
        logger.error('Donation confirmation error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Blood bank endpoints
app.get('/api/blood-banks', async (req, res) => {
    try {
        const { location, radius = 50 } = req.query;
        
        let bloodBanks;
        if (location) {
            const [lat, lng] = location.split(',').map(parseFloat);
            bloodBanks = await dbManager.getNearbyBloodBanks({ lat, lng }, radius);
        } else {
            bloodBanks = await dbManager.getAllBloodBanks();
        }

        res.json({
            success: true,
            blood_banks: bloodBanks
        });

    } catch (error) {
        logger.error('Blood banks fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

app.get('/api/blood-banks/:bankId/inventory', async (req, res) => {
    try {
        const { bankId } = req.params;
        
        const inventory = await inventoryService.getBloodBankInventory(bankId);

        res.json({
            success: true,
            inventory,
            last_updated: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Inventory fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    logger.info('Client connected to blood platform', { socketId: socket.id });

    socket.on('join_donor_room', (donorId) => {
        socket.join(`donor_${donorId}`);
        logger.info('Donor joined room', { donorId, socketId: socket.id });
    });

    socket.on('join_recipient_room', (recipientId) => {
        socket.join(`recipient_${recipientId}`);
        logger.info('Recipient joined room', { recipientId, socketId: socket.id });
    });

    socket.on('join_hospital_room', (hospitalId) => {
        socket.join(`hospital_${hospitalId}`);
        logger.info('Hospital joined room', { hospitalId, socketId: socket.id });
    });

    socket.on('disconnect', () => {
        logger.info('Client disconnected from blood platform', { socketId: socket.id });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        await dbManager.initialize();
        logger.info('Database initialized successfully');

        // Initialize services
        await matchingService.initialize();
        await notificationService.initialize();
        await inventoryService.initialize();
        await emergencyService.initialize();

        // Start server
        const port = process.env.PORT || 3002;
        server.listen(port, () => {
            logger.info(`🩸 Blood platform started on port ${port}`);
            logger.info(`Health check: http://localhost:${port}/health`);
            logger.info(`API Documentation: http://localhost:${port}/api/docs`);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await dbManager.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await dbManager.close();
    process.exit(0);
});

// Start the server
startServer();