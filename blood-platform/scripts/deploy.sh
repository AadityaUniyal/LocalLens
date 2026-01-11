#!/bin/bash

# Blood Platform Deployment Script
# Automates the deployment process for the blood donation platform

set -e  # Exit on any error

echo "🩸 Starting Blood Platform Deployment..."

# Configuration
PLATFORM_NAME="blood-platform"
DOCKER_IMAGE="local-lens-blood"
CONTAINER_NAME="blood-platform-container"
PORT=3002

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker is installed"
}

# Check if environment file exists
check_environment() {
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            print_warning ".env file not found. Copying from .env.example"
            cp .env.example .env
            print_warning "Please update .env file with your actual configuration"
        else
            print_error ".env.example file not found. Cannot create environment configuration."
            exit 1
        fi
    fi
    print_success "Environment configuration found"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    if npm test; then
        print_success "All tests passed"
    else
        print_error "Tests failed. Deployment aborted."
        exit 1
    fi
}

# Build Docker image
build_docker_image() {
    print_status "Building Docker image..."
    docker build -t $DOCKER_IMAGE .
    print_success "Docker image built successfully"
}

# Stop existing container
stop_existing_container() {
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        print_status "Stopping existing container..."
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
        print_success "Existing container stopped and removed"
    fi
}

# Start new container
start_container() {
    print_status "Starting new container..."
    docker run -d \
        --name $CONTAINER_NAME \
        --env-file .env \
        -p $PORT:$PORT \
        --restart unless-stopped \
        $DOCKER_IMAGE
    
    print_success "Container started successfully"
}

# Health check
health_check() {
    print_status "Performing health check..."
    sleep 10  # Wait for container to start
    
    for i in {1..30}; do
        if curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
            print_success "Health check passed"
            return 0
        fi
        print_status "Waiting for service to be ready... ($i/30)"
        sleep 2
    done
    
    print_error "Health check failed. Service may not be running properly."
    docker logs $CONTAINER_NAME
    exit 1
}

# Show deployment info
show_deployment_info() {
    echo ""
    echo "🩸 Blood Platform Deployment Complete!"
    echo "=================================="
    echo "Service URL: http://localhost:$PORT"
    echo "Health Check: http://localhost:$PORT/health"
    echo "API Documentation: http://localhost:$PORT/api/docs"
    echo "Container Name: $CONTAINER_NAME"
    echo "Docker Image: $DOCKER_IMAGE"
    echo ""
    echo "Useful Commands:"
    echo "  View logs: docker logs $CONTAINER_NAME"
    echo "  Stop service: docker stop $CONTAINER_NAME"
    echo "  Restart service: docker restart $CONTAINER_NAME"
    echo "  Remove container: docker rm $CONTAINER_NAME"
    echo ""
}

# Main deployment process
main() {
    print_status "Starting deployment process..."
    
    # Check prerequisites
    check_docker
    check_environment
    
    # Development deployment (skip tests for faster deployment)
    if [ "$1" = "--dev" ]; then
        print_warning "Development deployment mode - skipping tests"
    else
        install_dependencies
        run_tests
    fi
    
    # Docker deployment
    build_docker_image
    stop_existing_container
    start_container
    health_check
    
    show_deployment_info
    print_success "Deployment completed successfully!"
}

# Handle script arguments
case "$1" in
    --help|-h)
        echo "Blood Platform Deployment Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --dev     Skip tests for faster development deployment"
        echo "  --help    Show this help message"
        echo ""
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac