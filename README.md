# Local Lens Multi-Platform System

A unified web application providing four specialized platforms through a single authentication gateway.

## Platforms

### 🔐 Authentication Service (`auth-service/`)
Centralized JWT-based authentication with role-based access control.

### 🩸 Blood Donation Platform (`blood-platform/`)
Real-time blood donor-recipient matching with emergency response capabilities.

### 📋 Complaint Management Platform (`complaint-platform/`)
Government complaint filing, tracking, and resolution system.

### 🏗️ Architecture Platform (`architecture-platform/`)
Generic production-ready web application framework with DevOps integration.

### 🚦 Traffic Management Platform (`traffic-platform/`)
AI-powered traffic control with emergency vehicle detection and routing.

### 🌐 Web Frontend (`web-frontend/`)
Unified Next.js web application providing access to all platforms.

## Quick Start

### Option 1: Run All Services with Docker
```bash
docker-compose up -d
```

### Option 2: Run Individual Platforms
```bash
# Authentication Service
cd auth-service && npm install && npm run dev

# Blood Platform
cd blood-platform && npm install && npm run dev

# Complaint Platform  
cd complaint-platform && npm install && npm run dev

# Architecture Platform
cd architecture-platform && npm install && npm run dev

# Traffic Platform
cd traffic-platform && pip install -r requirements.txt && python src/main.py

# Web Frontend
cd web-frontend && npm install && npm run dev
```

## Architecture

Each platform is a complete, independent application with:
- ✅ Own package.json and dependencies
- ✅ Individual Docker configuration
- ✅ Dedicated database and Redis setup
- ✅ Comprehensive README and documentation
- ✅ Environment configuration
- ✅ Testing setup

## Service Ports

- **Auth Service**: http://localhost:3001
- **Blood Platform**: http://localhost:3002  
- **Complaint Platform**: http://localhost:3003
- **Architecture Platform**: http://localhost:3004
- **Traffic Platform**: http://localhost:3005
- **Web Frontend**: http://localhost:3000

## Technology Stack

- **Backend**: Node.js, Express.js, Python Flask
- **Frontend**: Next.js, React, TypeScript
- **Database**: PostgreSQL (separate DB per platform)
- **Cache**: Redis
- **AI/ML**: YOLOv8, OpenCV (Traffic Platform)
- **Real-time**: Socket.io
- **Containerization**: Docker & Docker Compose