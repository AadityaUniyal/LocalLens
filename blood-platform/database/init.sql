-- Blood platform database initialization
-- Create database (optional if handled by docker-compose)
CREATE DATABASE IF NOT EXISTS blood_platform;
USE blood_platform;

-- =========================
-- Donors Table
-- =========================
CREATE TABLE donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    blood_group ENUM(
        'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
    ) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(100),
    city VARCHAR(50),
    last_donation_date DATE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Recipients Table
-- =========================
CREATE TABLE recipients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    blood_group ENUM(
        'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
    ) NOT NULL,
    hospital_name VARCHAR(150),
    city VARCHAR(50),
    contact_number VARCHAR(15) NOT NULL,
    urgency_level ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'MEDIUM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Blood Inventory Table
-- =========================
CREATE TABLE blood_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blood_group ENUM(
        'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
    ) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

-- =========================
-- Matching Requests Table
-- =========================
CREATE TABLE blood_matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id INT,
    recipient_id INT,
    status ENUM('PENDING', 'MATCHED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_match_donor
        FOREIGN KEY (donor_id)
        REFERENCES donors(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_match_recipient
        FOREIGN KEY (recipient_id)
        REFERENCES recipients(id)
        ON DELETE SET NULL
);

-- =========================
-- Notifications Table
-- =========================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_type ENUM('DONOR', 'RECIPIENT') NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Seed Inventory Data
-- =========================
INSERT INTO blood_inventory (blood_group, quantity) VALUES
('A+', 10), ('A-', 5),
('B+', 8),  ('B-', 4),
('AB+', 6), ('AB-', 3),
('O+', 15), ('O-', 7);
