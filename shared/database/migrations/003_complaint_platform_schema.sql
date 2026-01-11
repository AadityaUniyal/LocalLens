-- Migration: 003_complaint_platform_schema.sql
-- Branch: complaint-management
-- Description: Initialize complaint management platform schema with complaints, authorities, and tracking

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Complaint categories and status enums
CREATE TYPE complaint_category_enum AS ENUM (
    'infrastructure', 'sanitation', 'traffic', 'noise', 'water', 
    'electricity', 'public_safety', 'environment', 'healthcare', 
    'education', 'corruption', 'other'
);

CREATE TYPE complaint_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE complaint_status_enum AS ENUM (
    'filed', 'acknowledged', 'assigned', 'in_progress', 'pending_info', 
    'resolved', 'closed', 'rejected', 'escalated'
);

CREATE TYPE authority_type_enum AS ENUM (
    'municipal_corporation', 'police_department', 'traffic_police', 
    'electricity_board', 'water_board', 'sanitation_department', 
    'health_department', 'education_department', 'transport_department',
    'environment_department', 'district_administration', 'other'
);

-- Complaints table
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id VARCHAR(20) UNIQUE NOT NULL, -- Human-readable ID like CMP-2024-001
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category complaint_category_enum NOT NULL,
    subcategory VARCHAR(100),
    priority complaint_priority_enum NOT NULL,
    status complaint_status_enum DEFAULT 'filed',
    location JSONB NOT NULL,
    landmark VARCHAR(200),
    ward_number INTEGER,
    citizen_name VARCHAR(100) NOT NULL,
    citizen_email VARCHAR(255) NOT NULL,
    citizen_phone VARCHAR(20) NOT NULL,
    citizen_address TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    attachments JSONB DEFAULT '[]',
    assigned_authority_id UUID,
    assigned_officer_id UUID,
    estimated_resolution_date DATE,
    actual_resolution_date DATE,
    resolution_notes TEXT,
    citizen_satisfaction_rating INTEGER CHECK (citizen_satisfaction_rating >= 1 AND citizen_satisfaction_rating <= 5),
    citizen_feedback TEXT,
    escalation_level INTEGER DEFAULT 0,
    escalation_reason TEXT,
    escalated_to UUID,
    escalated_at TIMESTAMP,
    public_visibility BOOLEAN DEFAULT TRUE,
    urgency_score INTEGER DEFAULT 0, -- Calculated urgency for prioritization
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(20) DEFAULT 'web' CHECK (source IN ('web', 'mobile', 'phone', 'email', 'walk_in')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- Authorities table
CREATE TABLE IF NOT EXISTS authorities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL, -- Authority code like MCD-001
    type authority_type_enum NOT NULL,
    department VARCHAR(100),
    jurisdiction JSONB, -- Geographic boundaries
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    office_address TEXT,
    working_hours JSONB DEFAULT '{"monday": "09:00-17:00", "tuesday": "09:00-17:00", "wednesday": "09:00-17:00", "thursday": "09:00-17:00", "friday": "09:00-17:00", "saturday": "09:00-13:00", "sunday": "closed"}',
    categories complaint_category_enum[] NOT NULL,
    subcategories TEXT[] DEFAULT '{}',
    current_workload INTEGER DEFAULT 0,
    max_capacity INTEGER DEFAULT 50,
    average_resolution_time INTEGER DEFAULT 7, -- in days
    performance_rating DECIMAL(3,2) DEFAULT 0.0,
    supervisor_id UUID REFERENCES authorities(id),
    head_officer_name VARCHAR(100),
    head_officer_contact VARCHAR(20),
    escalation_matrix JSONB,
    sla_targets JSONB DEFAULT '{"acknowledgment_hours": 24, "resolution_days": 7}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Authority officers table
CREATE TABLE IF NOT EXISTS authority_officers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    authority_id UUID REFERENCES authorities(id) NOT NULL,
    user_id UUID, -- Reference to auth service user
    name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    designation VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    specializations complaint_category_enum[] DEFAULT '{}',
    current_assignments INTEGER DEFAULT 0,
    max_assignments INTEGER DEFAULT 10,
    performance_rating DECIMAL(3,2) DEFAULT 0.0,
    is_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaint comments table
CREATE TABLE IF NOT EXISTS complaint_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    author_type VARCHAR(20) NOT NULL CHECK (author_type IN ('citizen', 'authority', 'officer', 'system')),
    author_id UUID NOT NULL,
    author_name VARCHAR(100),
    attachments JSONB DEFAULT '[]',
    is_public BOOLEAN DEFAULT TRUE,
    is_internal BOOLEAN DEFAULT FALSE,
    parent_comment_id UUID REFERENCES complaint_comments(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaint feedback table
CREATE TABLE IF NOT EXISTS complaint_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    citizen_email VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    feedback_categories TEXT[] DEFAULT '{}', -- e.g., ['response_time', 'communication', 'resolution_quality']
    would_recommend BOOLEAN,
    additional_suggestions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaint assignments table
CREATE TABLE IF NOT EXISTS complaint_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    authority_id UUID REFERENCES authorities(id),
    officer_id UUID REFERENCES authority_officers(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID,
    assignment_reason TEXT,
    is_current BOOLEAN DEFAULT TRUE,
    reassignment_reason TEXT,
    unassigned_at TIMESTAMP,
    workload_at_assignment INTEGER DEFAULT 0
);

-- Complaint status history table
CREATE TABLE IF NOT EXISTS complaint_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    old_status complaint_status_enum,
    new_status complaint_status_enum NOT NULL,
    changed_by UUID,
    change_reason TEXT,
    additional_notes TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaint escalations table
CREATE TABLE IF NOT EXISTS complaint_escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    escalated_from UUID REFERENCES authorities(id),
    escalated_to UUID REFERENCES authorities(id),
    escalation_level INTEGER NOT NULL,
    escalation_reason TEXT NOT NULL,
    escalation_type VARCHAR(20) DEFAULT 'manual' CHECK (escalation_type IN ('manual', 'automatic', 'citizen_request')),
    escalated_by UUID,
    escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_notes TEXT
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('citizen', 'authority', 'officer', 'admin')),
    recipient_id VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    channels TEXT[] DEFAULT '{"email"}', -- email, sms, push, in_app
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
    delivery_attempts INTEGER DEFAULT 0,
    error_message TEXT,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaint analytics cache table
CREATE TABLE IF NOT EXISTS complaint_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(50) NOT NULL,
    metric_date DATE NOT NULL,
    category complaint_category_enum,
    authority_id UUID,
    region VARCHAR(100),
    value DECIMAL(10,2) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_type, metric_date, category, authority_id, region)
);

-- File attachments table
CREATE TABLE IF NOT EXISTS file_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES complaint_comments(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64),
    uploaded_by UUID,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_attachment_reference CHECK (
        (complaint_id IS NOT NULL AND comment_id IS NULL) OR 
        (complaint_id IS NULL AND comment_id IS NOT NULL)
    )
);

-- Create comprehensive indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_citizen_email ON complaints(citizen_email);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_authority ON complaints(assigned_authority_id);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_officer ON complaints(assigned_officer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON complaints USING GIN(location);
CREATE INDEX IF NOT EXISTS idx_complaints_tags ON complaints USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_complaints_ward ON complaints(ward_number);
CREATE INDEX IF NOT EXISTS idx_complaints_escalation ON complaints(escalation_level);

CREATE INDEX IF NOT EXISTS idx_authorities_type ON authorities(type);
CREATE INDEX IF NOT EXISTS idx_authorities_active ON authorities(is_active);
CREATE INDEX IF NOT EXISTS idx_authorities_categories ON authorities USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_authorities_jurisdiction ON authorities USING GIN(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_authorities_workload ON authorities(current_workload);

CREATE INDEX IF NOT EXISTS idx_authority_officers_authority ON authority_officers(authority_id);
CREATE INDEX IF NOT EXISTS idx_authority_officers_email ON authority_officers(email);
CREATE INDEX IF NOT EXISTS idx_authority_officers_available ON authority_officers(is_available);
CREATE INDEX IF NOT EXISTS idx_authority_officers_specializations ON authority_officers USING GIN(specializations);

CREATE INDEX IF NOT EXISTS idx_complaint_comments_complaint_id ON complaint_comments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_comments_author ON complaint_comments(author_type, author_id);
CREATE INDEX IF NOT EXISTS idx_complaint_comments_public ON complaint_comments(is_public);
CREATE INDEX IF NOT EXISTS idx_complaint_comments_created_at ON complaint_comments(created_at);

CREATE INDEX IF NOT EXISTS idx_complaint_assignments_complaint_id ON complaint_assignments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_authority_id ON complaint_assignments(authority_id);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_officer_id ON complaint_assignments(officer_id);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_current ON complaint_assignments(is_current);

CREATE INDEX IF NOT EXISTS idx_complaint_status_history_complaint ON complaint_status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_status_history_status ON complaint_status_history(new_status);
CREATE INDEX IF NOT EXISTS idx_complaint_status_history_changed_at ON complaint_status_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

CREATE INDEX IF NOT EXISTS idx_complaint_analytics_type_date ON complaint_analytics(metric_type, metric_date);
CREATE INDEX IF NOT EXISTS idx_complaint_analytics_category ON complaint_analytics(category);
CREATE INDEX IF NOT EXISTS idx_complaint_analytics_authority ON complaint_analytics(authority_id);

CREATE INDEX IF NOT EXISTS idx_file_attachments_complaint ON file_attachments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_comment ON file_attachments(comment_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_complaints_updated_at ON complaints;
CREATE TRIGGER update_complaints_updated_at
    BEFORE UPDATE ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_authorities_updated_at ON authorities;
CREATE TRIGGER update_authorities_updated_at
    BEFORE UPDATE ON authorities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_authority_officers_updated_at ON authority_officers;
CREATE TRIGGER update_authority_officers_updated_at
    BEFORE UPDATE ON authority_officers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample authorities
INSERT INTO authorities (name, code, type, department, contact_email, contact_phone, categories, office_address) VALUES
    (
        'Dehradun Municipal Corporation',
        'DMC-001',
        'municipal_corporation',
        'Public Works Department',
        'pwd@dmc.gov.in',
        '+91-135-2715001',
        ARRAY['infrastructure', 'sanitation', 'water']::complaint_category_enum[],
        'Municipal Corporation Building, Rajpur Road, Dehradun'
    ),
    (
        'Dehradun Traffic Police',
        'DTP-001',
        'traffic_police',
        'Traffic Management',
        'traffic@uttarakhandpolice.gov.in',
        '+91-135-2740100',
        ARRAY['traffic', 'public_safety']::complaint_category_enum[],
        'Traffic Police Headquarters, Clock Tower, Dehradun'
    ),
    (
        'Uttarakhand Power Corporation Limited',
        'UPCL-001',
        'electricity_board',
        'Electricity Distribution',
        'complaints@upcl.org',
        '+91-135-2766000',
        ARRAY['electricity']::complaint_category_enum[],
        'UPCL Office, Vidyut Bhawan, Dehradun'
    ),
    (
        'Dehradun Jal Sansthan',
        'DJS-001',
        'water_board',
        'Water Supply',
        'complaints@dehradunjal.gov.in',
        '+91-135-2715500',
        ARRAY['water', 'sanitation']::complaint_category_enum[],
        'Jal Sansthan Office, Rispana, Dehradun'
    ),
    (
        'District Health Department',
        'DHD-001',
        'health_department',
        'Public Health',
        'health@dehradun.gov.in',
        '+91-135-2528800',
        ARRAY['healthcare', 'sanitation', 'environment']::complaint_category_enum[],
        'District Hospital, Patel Nagar, Dehradun'
    )
ON CONFLICT (code) DO NOTHING;

-- Insert sample officers
INSERT INTO authority_officers (authority_id, name, employee_id, designation, email, phone, specializations) VALUES
    (
        (SELECT id FROM authorities WHERE code = 'DMC-001'),
        'Rajesh Kumar',
        'DMC-PWD-001',
        'Assistant Engineer',
        'rajesh.kumar@dmc.gov.in',
        '+91-9876543210',
        ARRAY['infrastructure', 'water']::complaint_category_enum[]
    ),
    (
        (SELECT id FROM authorities WHERE code = 'DTP-001'),
        'Priya Sharma',
        'DTP-TM-001',
        'Traffic Inspector',
        'priya.sharma@uttarakhandpolice.gov.in',
        '+91-9876543211',
        ARRAY['traffic']::complaint_category_enum[]
    ),
    (
        (SELECT id FROM authorities WHERE code = 'UPCL-001'),
        'Amit Singh',
        'UPCL-ED-001',
        'Junior Engineer',
        'amit.singh@upcl.org',
        '+91-9876543212',
        ARRAY['electricity']::complaint_category_enum[]
    )
ON CONFLICT (employee_id) DO NOTHING;