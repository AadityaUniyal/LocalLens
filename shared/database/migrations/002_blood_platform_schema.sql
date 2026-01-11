-- Migration: 002_blood_platform_schema.sql
-- Branch: blood-donation
-- Description: Initialize blood donation platform schema with donors, requests, and inventory

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Blood types enum for consistency
CREATE TYPE blood_type_enum AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
CREATE TYPE urgency_level_enum AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE request_status_enum AS ENUM ('pending', 'matched', 'fulfilled', 'expired', 'cancelled');
CREATE TYPE donation_status_enum AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE inventory_status_enum AS ENUM ('available', 'reserved', 'used', 'expired');

-- Donors table
CREATE TABLE IF NOT EXISTS donors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- Reference to auth service user (cross-branch reference)
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    blood_type blood_type_enum NOT NULL,
    date_of_birth DATE NOT NULL,
    location JSONB NOT NULL,
    address TEXT,
    medical_conditions JSONB DEFAULT '[]',
    availability BOOLEAN DEFAULT TRUE,
    available_until TIMESTAMP,
    last_donation_date DATE,
    total_donations INTEGER DEFAULT 0,
    eligibility_status VARCHAR(20) DEFAULT 'eligible' CHECK (eligibility_status IN ('eligible', 'temporarily_ineligible', 'permanently_ineligible')),
    eligibility_reason TEXT,
    emergency_contact JSONB,
    preferred_hospitals JSONB DEFAULT '[]',
    notification_preferences JSONB DEFAULT '{"email": true, "sms": true, "push": true}',
    last_availability_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blood requests table
CREATE TABLE IF NOT EXISTS blood_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(20) UNIQUE NOT NULL, -- Human-readable ID like BR-2024-001
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    blood_type blood_type_enum NOT NULL,
    urgency urgency_level_enum NOT NULL,
    units_needed INTEGER NOT NULL CHECK (units_needed > 0 AND units_needed <= 10),
    hospital_id UUID NOT NULL,
    hospital_name VARCHAR(200) NOT NULL,
    location JSONB NOT NULL,
    medical_condition TEXT,
    doctor_name VARCHAR(100),
    doctor_contact VARCHAR(20),
    patient_age INTEGER,
    patient_weight DECIMAL(5,2),
    needed_by TIMESTAMP NOT NULL,
    status request_status_enum DEFAULT 'pending',
    priority_score INTEGER DEFAULT 0, -- Calculated priority for matching
    matched_donors JSONB DEFAULT '[]',
    fulfillment_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id VARCHAR(20) UNIQUE NOT NULL, -- Human-readable ID like DN-2024-001
    request_id UUID REFERENCES blood_requests(id),
    donor_id UUID REFERENCES donors(id) NOT NULL,
    hospital_id UUID NOT NULL,
    donation_date TIMESTAMP NOT NULL,
    scheduled_time TIMESTAMP,
    actual_time TIMESTAMP,
    status donation_status_enum DEFAULT 'scheduled',
    units INTEGER DEFAULT 1 CHECK (units > 0 AND units <= 4),
    blood_pressure VARCHAR(20),
    hemoglobin_level DECIMAL(4,2),
    pre_donation_checks JSONB,
    post_donation_notes TEXT,
    staff_id UUID, -- Hospital staff who handled donation
    collection_center VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blood banks table
CREATE TABLE IF NOT EXISTS blood_banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL, -- Bank code like BB-DUN-001
    address TEXT NOT NULL,
    location JSONB NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    license_number VARCHAR(50),
    operating_hours JSONB DEFAULT '{"monday": "09:00-17:00", "tuesday": "09:00-17:00", "wednesday": "09:00-17:00", "thursday": "09:00-17:00", "friday": "09:00-17:00", "saturday": "09:00-13:00", "sunday": "closed"}',
    capacity INTEGER DEFAULT 1000,
    current_stock INTEGER DEFAULT 0,
    emergency_contact JSONB,
    facilities JSONB DEFAULT '[]', -- Available facilities like plasma separation, etc.
    certifications JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blood inventory table
CREATE TABLE IF NOT EXISTS blood_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_id UUID REFERENCES blood_banks(id) NOT NULL,
    blood_type blood_type_enum NOT NULL,
    units INTEGER NOT NULL DEFAULT 0 CHECK (units >= 0),
    reserved_units INTEGER DEFAULT 0 CHECK (reserved_units >= 0),
    expiration_date DATE NOT NULL,
    donation_date DATE NOT NULL,
    donor_id UUID REFERENCES donors(id),
    donation_id UUID REFERENCES donations(id),
    batch_number VARCHAR(50),
    component_type VARCHAR(20) DEFAULT 'whole_blood' CHECK (component_type IN ('whole_blood', 'red_cells', 'plasma', 'platelets')),
    status inventory_status_enum DEFAULT 'available',
    quality_checks JSONB,
    storage_temperature DECIMAL(4,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Donor matches table (for tracking matching algorithm results)
CREATE TABLE IF NOT EXISTS donor_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES blood_requests(id) NOT NULL,
    donor_id UUID REFERENCES donors(id) NOT NULL,
    compatibility_score DECIMAL(5,2) NOT NULL, -- 0-100 score
    distance_km DECIMAL(8,2),
    availability_match BOOLEAN DEFAULT FALSE,
    urgency_match BOOLEAN DEFAULT FALSE,
    blood_type_match BOOLEAN DEFAULT FALSE,
    match_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notification_sent BOOLEAN DEFAULT FALSE,
    donor_response VARCHAR(20), -- accepted, declined, no_response
    response_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency notifications table
CREATE TABLE IF NOT EXISTS emergency_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES blood_requests(id) NOT NULL,
    notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('sms', 'email', 'push', 'call')),
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('donor', 'hospital', 'blood_bank', 'authority')),
    recipient_id UUID NOT NULL,
    recipient_contact VARCHAR(255) NOT NULL,
    message_template VARCHAR(50),
    message_content TEXT NOT NULL,
    sent_at TIMESTAMP,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
    delivery_attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blood analytics cache table
CREATE TABLE IF NOT EXISTS blood_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(50) NOT NULL,
    metric_date DATE NOT NULL,
    blood_type blood_type_enum,
    region VARCHAR(100),
    value DECIMAL(10,2) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_type, metric_date, blood_type, region)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_donors_blood_type ON donors(blood_type);
CREATE INDEX IF NOT EXISTS idx_donors_availability ON donors(availability);
CREATE INDEX IF NOT EXISTS idx_donors_location ON donors USING GIN(location);
CREATE INDEX IF NOT EXISTS idx_donors_email ON donors(email);
CREATE INDEX IF NOT EXISTS idx_donors_eligibility ON donors(eligibility_status);

CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_urgency ON blood_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_blood_requests_blood_type ON blood_requests(blood_type);
CREATE INDEX IF NOT EXISTS idx_blood_requests_hospital ON blood_requests(hospital_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_needed_by ON blood_requests(needed_by);
CREATE INDEX IF NOT EXISTS idx_blood_requests_created_at ON blood_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_request_id ON donations(request_id);
CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(donation_date);
CREATE INDEX IF NOT EXISTS idx_donations_hospital ON donations(hospital_id);

CREATE INDEX IF NOT EXISTS idx_blood_inventory_bank_type ON blood_inventory(bank_id, blood_type);
CREATE INDEX IF NOT EXISTS idx_blood_inventory_expiration ON blood_inventory(expiration_date);
CREATE INDEX IF NOT EXISTS idx_blood_inventory_status ON blood_inventory(status);
CREATE INDEX IF NOT EXISTS idx_blood_inventory_donor ON blood_inventory(donor_id);

CREATE INDEX IF NOT EXISTS idx_donor_matches_request ON donor_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_donor_matches_donor ON donor_matches(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_matches_score ON donor_matches(compatibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_donor_matches_timestamp ON donor_matches(match_timestamp);

CREATE INDEX IF NOT EXISTS idx_emergency_notifications_request ON emergency_notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_recipient ON emergency_notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_status ON emergency_notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_sent_at ON emergency_notifications(sent_at);

CREATE INDEX IF NOT EXISTS idx_blood_analytics_type_date ON blood_analytics(metric_type, metric_date);
CREATE INDEX IF NOT EXISTS idx_blood_analytics_blood_type ON blood_analytics(blood_type);

-- Create triggers for updated_at timestamps
DROP TRIGGER IF EXISTS update_donors_updated_at ON donors;
CREATE TRIGGER update_donors_updated_at
    BEFORE UPDATE ON donors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_blood_requests_updated_at ON blood_requests;
CREATE TRIGGER update_blood_requests_updated_at
    BEFORE UPDATE ON blood_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
CREATE TRIGGER update_donations_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_blood_banks_updated_at ON blood_banks;
CREATE TRIGGER update_blood_banks_updated_at
    BEFORE UPDATE ON blood_banks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_blood_inventory_updated_at ON blood_inventory;
CREATE TRIGGER update_blood_inventory_updated_at
    BEFORE UPDATE ON blood_inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample blood banks
INSERT INTO blood_banks (name, code, address, location, phone, email, license_number) VALUES
    (
        'Doon Hospital Blood Bank',
        'BB-DUN-001',
        'Doon Hospital, Patel Nagar, Dehradun',
        '{"latitude": 30.3165, "longitude": 78.0322, "address": "Patel Nagar, Dehradun"}',
        '+91-135-2715001',
        'bloodbank@doonhospital.com',
        'UTTBB001'
    ),
    (
        'Max Hospital Blood Bank',
        'BB-MAX-001',
        'Max Super Speciality Hospital, Mussoorie Road, Dehradun',
        '{"latitude": 30.3293, "longitude": 78.0428, "address": "Mussoorie Road, Dehradun"}',
        '+91-135-6712000',
        'bloodbank@maxhealthcare.com',
        'UTTBB002'
    ),
    (
        'Government Medical College Blood Bank',
        'BB-GMC-001',
        'Government Doon Medical College, Patel Nagar, Dehradun',
        '{"latitude": 30.3203, "longitude": 78.0389, "address": "Patel Nagar, Dehradun"}',
        '+91-135-2528888',
        'bloodbank@gmcddun.ac.in',
        'UTTBB003'
    )
ON CONFLICT (code) DO NOTHING;