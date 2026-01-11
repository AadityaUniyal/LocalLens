# Blood Donation Platform API Documentation

## Overview

The Blood Donation Platform provides a comprehensive REST API for managing blood donors, recipients, requests, and inventory. The platform supports real-time matching, emergency notifications, and comprehensive analytics.

**Base URL:** `http://localhost:3002`
**API Version:** v1
**Authentication:** JWT Bearer Token (when integrated with auth service)

## Table of Contents

1. [Health Check](#health-check)
2. [Donor Management](#donor-management)
3. [Blood Requests](#blood-requests)
4. [Matching & Donations](#matching--donations)
5. [Blood Banks & Inventory](#blood-banks--inventory)
6. [Analytics & Reporting](#analytics--reporting)
7. [WebSocket Events](#websocket-events)
8. [Error Handling](#error-handling)

## Health Check

### GET /health

Check the health status of the blood platform service.

**Response:**
```json
{
  "status": "healthy",
  "service": "blood-platform",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600.5,
  "database": {
    "healthy": true,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Donor Management

### POST /api/donors/register

Register a new blood donor.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@email.com",
  "phone": "+1234567890",
  "blood_type": "O+",
  "date_of_birth": "1990-05-15",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "address": "123 Main St, New York, NY",
  "medical_conditions": ["None"],
  "emergency_contact": {
    "name": "Jane Doe",
    "phone": "+1234567891",
    "relationship": "spouse"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Donor registered successfully",
  "donor": {
    "id": "uuid-here",
    "name": "John Doe",
    "blood_type": "O+",
    "availability": true,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### GET /api/donors/profile/:donorId

Get donor profile and donation history.

**Response:**
```json
{
  "success": true,
  "donor": {
    "id": "uuid-here",
    "name": "John Doe",
    "email": "john.doe@email.com",
    "blood_type": "O+",
    "availability": true,
    "total_donations": 3,
    "last_donation_date": "2023-12-01",
    "eligibility_status": "eligible"
  },
  "donation_history": [
    {
      "id": "donation-uuid",
      "donation_date": "2023-12-01",
      "status": "completed",
      "hospital_name": "City Hospital"
    }
  ]
}
```

### PUT /api/donors/:donorId/availability

Update donor availability status.

**Request Body:**
```json
{
  "availability": true,
  "available_until": "2024-01-20T18:00:00.000Z"
}
```

### GET /api/donors/:donorId/compatible-requests

Get blood requests compatible with the donor's blood type.

**Response:**
```json
{
  "success": true,
  "compatible_requests": [
    {
      "id": "request-uuid",
      "blood_type": "A+",
      "urgency": "high",
      "units_needed": 2,
      "hospital_name": "Emergency Hospital",
      "needed_by": "2024-01-16T12:00:00.000Z"
    }
  ],
  "total_found": 1
}
```

### POST /api/donors/:donorId/respond/:matchId

Respond to a blood request match.

**Request Body:**
```json
{
  "response": "accepted",
  "notes": "Available tomorrow morning"
}
```

### GET /api/donors/:donorId/statistics

Get donor statistics and achievements.

**Response:**
```json
{
  "success": true,
  "statistics": {
    "total_donations": 5,
    "completed_donations": 4,
    "last_donation_date": "2023-12-01",
    "eligibility_status": "eligible",
    "blood_type": "O+",
    "member_since": "2022-01-15T10:30:00.000Z",
    "lives_potentially_saved": 12,
    "next_eligible_date": "2024-01-26T00:00:00.000Z"
  }
}
```

## Blood Requests

### POST /api/requests

Create a new blood request.

**Request Body:**
```json
{
  "name": "Patient Name",
  "email": "patient@email.com",
  "phone": "+1234567890",
  "blood_type": "A+",
  "urgency": "critical",
  "units_needed": 2,
  "hospital_id": "hospital-uuid",
  "hospital_name": "Emergency Hospital",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "medical_condition": "Surgery required",
  "needed_by": "2024-01-16T12:00:00.000Z",
  "doctor_name": "Dr. Smith",
  "doctor_contact": "+1234567892",
  "patient_age": 35,
  "patient_weight": 70.5
}
```

**Response:**
```json
{
  "success": true,
  "message": "Blood request created successfully",
  "request": {
    "id": "request-uuid",
    "request_id": "BR-2024-123456",
    "blood_type": "A+",
    "urgency": "critical",
    "status": "pending",
    "created_at": "2024-01-15T10:30:00.000Z"
  },
  "compatible_donors_found": 5,
  "estimated_response_time": 30
}
```

### GET /api/requests

Get blood requests with optional filters.

**Query Parameters:**
- `status`: pending, matched, fulfilled, expired, cancelled
- `urgency`: low, medium, high, critical
- `blood_type`: A+, A-, B+, B-, AB+, AB-, O+, O-
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "id": "request-uuid",
      "request_id": "BR-2024-123456",
      "name": "Patient Name",
      "blood_type": "A+",
      "urgency": "critical",
      "units_needed": 2,
      "hospital_name": "Emergency Hospital",
      "status": "pending",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

### GET /api/requests/:requestId

Get specific blood request details with matches.

**Response:**
```json
{
  "success": true,
  "request": {
    "id": "request-uuid",
    "request_id": "BR-2024-123456",
    "blood_type": "A+",
    "urgency": "critical",
    "status": "pending",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060
    }
  },
  "matches": [
    {
      "id": "match-uuid",
      "donor_name": "John Doe",
      "donor_phone": "+1234567890",
      "compatibility_score": 95.5,
      "distance_km": 2.3
    }
  ]
}
```

### PUT /api/requests/:requestId/status

Update blood request status.

**Request Body:**
```json
{
  "status": "fulfilled",
  "notes": "Blood received successfully"
}
```

### POST /api/requests/:requestId/find-donors

Find compatible donors for a specific request.

**Response:**
```json
{
  "success": true,
  "compatible_donors": [
    {
      "id": "donor-uuid",
      "name": "John Doe",
      "blood_type": "O+",
      "compatibility_score": 95.5,
      "distance_km": 2.3,
      "availability": true
    }
  ],
  "total_found": 1,
  "estimated_response_time": 30
}
```

### GET /api/requests/urgent/list

Get urgent blood requests for dashboard.

**Response:**
```json
{
  "success": true,
  "critical_requests": [],
  "high_priority_requests": [],
  "total_urgent": 0
}
```

### GET /api/requests/by-blood-type/:bloodType

Get requests by blood type with inventory comparison.

**Response:**
```json
{
  "success": true,
  "blood_type": "A+",
  "pending_requests": [],
  "total_requests": 0,
  "total_units_needed": 0,
  "current_inventory_units": 15,
  "supply_demand_ratio": "N/A"
}
```

### DELETE /api/requests/:requestId

Cancel a blood request.

**Request Body:**
```json
{
  "reason": "Patient condition improved"
}
```

## Matching & Donations

### POST /api/matching/find-donors

Find compatible donors by blood type and location.

**Request Body:**
```json
{
  "blood_type": "A+",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "radius": 50,
  "urgency": "high"
}
```

**Response:**
```json
{
  "success": true,
  "donors": [
    {
      "id": "donor-uuid",
      "name": "John Doe",
      "blood_type": "O+",
      "availability": true,
      "distance_km": 2.3
    }
  ],
  "total_found": 1,
  "search_radius": 50,
  "blood_type": "A+"
}
```

### POST /api/matching/confirm

Confirm a donation match.

**Request Body:**
```json
{
  "request_id": "request-uuid",
  "donor_id": "donor-uuid",
  "donation_date": "2024-01-16T10:00:00.000Z",
  "hospital_id": "hospital-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Donation confirmed successfully",
  "donation": {
    "id": "donation-uuid",
    "donation_id": "DN-2024-123456",
    "status": "scheduled",
    "donation_date": "2024-01-16T10:00:00.000Z"
  }
}
```

## Blood Banks & Inventory

### GET /api/blood-banks

Get all active blood banks.

**Query Parameters:**
- `location`: "lat,lng" for nearby search
- `radius`: Search radius in km (default: 50)

**Response:**
```json
{
  "success": true,
  "blood_banks": [
    {
      "id": "bank-uuid",
      "name": "City Blood Bank",
      "code": "BB-CITY-001",
      "address": "123 Hospital St",
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "phone": "+1234567890",
      "operating_hours": {
        "monday": "09:00-17:00",
        "tuesday": "09:00-17:00"
      }
    }
  ]
}
```

### GET /api/blood-banks/:bankId/inventory

Get blood bank inventory details.

**Response:**
```json
{
  "success": true,
  "inventory": {
    "bank_id": "bank-uuid",
    "inventory": {
      "A+": {
        "total_units": 25,
        "available_units": 20,
        "reserved_units": 3,
        "expired_units": 2,
        "expiring_soon": 1,
        "stock_status": "good"
      }
    },
    "total_units": 150,
    "alerts": [
      {
        "type": "low_stock",
        "blood_type": "O-",
        "message": "Low stock: 3 units of O- remaining",
        "priority": "medium"
      }
    ]
  },
  "last_updated": "2024-01-15T10:30:00.000Z"
}
```

## Analytics & Reporting

### GET /api/analytics/dashboard

Get comprehensive dashboard analytics.

**Query Parameters:**
- `start_date`: ISO 8601 date string
- `end_date`: ISO 8601 date string

**Response:**
```json
{
  "success": true,
  "analytics": {
    "totalDonors": 150,
    "activeDonors": 120,
    "totalRequests": 45,
    "pendingRequests": 12,
    "completedDonations": 38,
    "response_rate": 84.44,
    "donor_utilization_rate": 25.33,
    "bloodTypeDistribution": [
      {
        "blood_type": "O+",
        "count": 15
      }
    ],
    "matching_statistics": {
      "total_matches": 85,
      "successful_donations": 38,
      "average_compatibility_score": 87.5,
      "compatibility_rate": "44.71"
    },
    "total_blood_banks": 3,
    "date_range": {
      "start_date": "2023-12-16T10:30:00.000Z",
      "end_date": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### GET /api/analytics/blood-type-distribution

Get blood type distribution analytics.

**Query Parameters:**
- `timeframe`: 7d, 30d, 90d, 1y (default: 30d)
- `type`: requests, donations, donors (default: requests)

**Response:**
```json
{
  "success": true,
  "distribution": [
    {
      "blood_type": "O+",
      "count": "15",
      "critical_percentage": "20.00"
    }
  ],
  "timeframe": "30d",
  "type": "requests",
  "total_records": 45
}
```

### GET /api/analytics/inventory

Get inventory analytics.

**Query Parameters:**
- `bank_id`: Specific bank UUID (optional)

**Response:**
```json
{
  "success": true,
  "inventory_summary": [
    {
      "bank_id": "bank-uuid",
      "bank_name": "City Blood Bank",
      "inventory": {
        "A+": {
          "available_units": 20,
          "stock_status": "good"
        }
      },
      "total_units": 150,
      "alerts": []
    }
  ],
  "total_banks": 3
}
```

### GET /api/analytics/donation-trends

Get donation trends over time.

**Query Parameters:**
- `timeframe`: 7d, 30d, 90d, 1y (default: 30d)
- `granularity`: daily, weekly, monthly (default: daily)

**Response:**
```json
{
  "success": true,
  "trends": [
    {
      "period": "2024-01-15",
      "total_donations": "5",
      "completed_donations": "4",
      "cancelled_donations": "1",
      "no_show_donations": "0"
    }
  ],
  "timeframe": "30d",
  "granularity": "daily",
  "total_periods": 30
}
```

### GET /api/analytics/response-times

Get response time analytics by urgency.

**Query Parameters:**
- `timeframe`: 7d, 30d, 90d (default: 30d)
- `urgency`: low, medium, high, critical (optional)

**Response:**
```json
{
  "success": true,
  "response_times": [
    {
      "urgency": "critical",
      "total_requests": "8",
      "avg_response_hours": "2.50",
      "min_response_hours": "0.50",
      "max_response_hours": "6.00",
      "median_response_hours": "2.00"
    }
  ],
  "timeframe": "30d",
  "urgency_filter": "all"
}
```

### GET /api/analytics/geographic-distribution

Get geographic distribution of requests/donors/donations.

**Query Parameters:**
- `timeframe`: 7d, 30d, 90d, 1y (default: 30d)
- `type`: requests, donors, donations (default: requests)

**Response:**
```json
{
  "success": true,
  "geographic_distribution": [
    {
      "lat_group": "40.7",
      "lng_group": "-74.0",
      "count": "15"
    }
  ],
  "timeframe": "30d",
  "type": "requests",
  "total_locations": 5
}
```

### GET /api/analytics/performance

Get overall platform performance metrics.

**Response:**
```json
{
  "success": true,
  "performance": {
    "success_rate": "84.44",
    "average_matching_time_minutes": "15.30",
    "donor_response_rate": "75.50",
    "active_donors_count": 25,
    "total_donations_count": 38,
    "timeframe": "30 days"
  }
}
```

## WebSocket Events

The platform supports real-time communication via WebSocket connections.

### Connection

Connect to: `ws://localhost:3002`

### Events to Listen For

#### new_blood_request
Emitted when a new blood request is created.
```json
{
  "request": {
    "id": "request-uuid",
    "blood_type": "A+",
    "urgency": "critical"
  },
  "compatible_donors_count": 5
}
```

#### donation_confirmed
Emitted when a donation is confirmed.
```json
{
  "donation": {
    "id": "donation-uuid",
    "status": "scheduled"
  },
  "request_id": "request-uuid",
  "donor_id": "donor-uuid"
}
```

#### emergency_alert
Emitted for critical blood requests.
```json
{
  "request_id": "request-uuid",
  "blood_type": "O-",
  "donors_alerted": 10
}
```

### Events to Emit

#### join_donor_room
Join donor-specific room for notifications.
```json
{
  "donor_id": "donor-uuid"
}
```

#### join_recipient_room
Join recipient-specific room for updates.
```json
{
  "recipient_id": "recipient-uuid"
}
```

#### join_hospital_room
Join hospital-specific room for notifications.
```json
{
  "hospital_id": "hospital-uuid"
}
```

## Error Handling

### Error Response Format

All API errors follow this format:
```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable

### Common Error Messages

- `Validation failed` - Request body validation errors
- `Donor already registered with this email` - Duplicate donor registration
- `Blood request not found` - Invalid request ID
- `Donor not found` - Invalid donor ID
- `Internal server error` - Server-side error
- `Too many requests from this IP` - Rate limit exceeded

## Rate Limiting

The API implements rate limiting:
- **Window:** 15 minutes
- **Limit:** 100 requests per IP
- **Headers:** Rate limit info in response headers

## Data Validation

### Blood Types
Valid values: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`

### Urgency Levels
Valid values: `low`, `medium`, `high`, `critical`

### Request Status
Valid values: `pending`, `matched`, `fulfilled`, `expired`, `cancelled`

### Donation Status
Valid values: `scheduled`, `completed`, `cancelled`, `no_show`

### Location Format
```json
{
  "lat": 40.7128,
  "lng": -74.0060
}
```

### Date Format
All dates use ISO 8601 format: `2024-01-15T10:30:00.000Z`

## Authentication Integration

When integrated with the auth service, include JWT token in headers:
```
Authorization: Bearer <jwt-token>
```

The platform will validate tokens and enforce role-based access control:
- **Citizens:** Can register as donors, submit blood requests
- **Hospital Staff:** Can manage requests, view inventory
- **Administrators:** Full access to all endpoints and analytics

## Environment Variables

Required environment variables:
```env
PORT=3002
NODE_ENV=production
CORS_ORIGIN=http://localhost:3000
NEON_BLOOD_DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
```

## Support

For API support or questions:
- Check the health endpoint: `/health`
- Review error messages and status codes
- Ensure proper request formatting and validation
- Verify authentication tokens (when applicable)