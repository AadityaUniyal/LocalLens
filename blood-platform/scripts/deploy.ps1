# Blood Platform Deployment Script (PowerShell)
# Automates the deployment process for the blood donation platform

param(
    [switch]$Dev,
    [switch]$Help
)

# Configuration
$PLATFORM_NAME = "blood-platform"
$DOCKER_IMAGE = "local-lens-blood"
$CONTAINER_NAME = "blood-platform-container"
$PORT = 3002

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Show help
if ($Help) {
    Write-Host "Blood Platform Deployment Script"
    Write-Host ""
    Write-Host "Usage: .\deploy.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Dev      Skip tests for faster development deployment"
    Write-Host "  -Help     Show this help message"
    Write-Host ""
    exit 0
}

Write-Host "🩸 Starting Blood Platform Deployment..." -ForegroundColor Magenta

# Check if Docker is installed
function Test-Docker {
    try {
        docker --version | Out-Null
        Write-Success "Docker is installed"
        return $true
    }
    catch {
        Write-Error "Docker is not installed. Please install Docker first."
        return $false
    }
}

# Check if environment file exists
function Test-Environment {
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Write-Warning ".env file not found. Copying from .env.example"
            Copy-Item ".env.example" ".env"
            Write-Warning "Please update .env file with your actual configuration"
        }
        else {
            Write-Error ".env.example file not found. Cannot create environment configuration."
            return $false
        }
    }
    Write-Success "Environment configuration found"
    return $true
}

# Install dependencies
function Install-Dependencies {
    Write-Status "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencies installed"
        return $true
    }
    else {
        Write-Error "Failed to install dependencies"
        return $false
    }
}

# Run tests
function Invoke-Tests {
    Write-Status "Running tests..."
    npm test
    if ($LASTEXITCODE -eq 0) {
        Write-Success "All tests passed"
        return $true
    }
    else {
        Write-Error "Tests failed. Deployment aborted."
        return $false
    }
}

# Build Docker image
function Build-DockerImage {
    Write-Status "Building Docker image..."
    docker build -t $DOCKER_IMAGE .
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker image built successfully"
        return $true
    }
    else {
        Write-Error "Failed to build Docker image"
        return $false
    }
}

# Stop existing container
function Stop-ExistingContainer {
    $existingContainer = docker ps -q -f name=$CONTAINER_NAME
    if ($existingContainer) {
        Write-Status "Stopping existing container..."
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
        Write-Success "Existing container stopped and removed"
    }
}

# Start new container
function Start-Container {
    Write-Status "Starting new container..."
    docker run -d --name $CONTAINER_NAME --env-file .env -p "${PORT}:${PORT}" --restart unless-stopped $DOCKER_IMAGE
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Container started successfully"
        return $true
    }
    else {
        Write-Error "Failed to start container"
        return $false
    }
}

# Health check
function Test-Health {
    Write-Status "Performing health check..."
    Start-Sleep -Seconds 10  # Wait for container to start
    
    for ($i = 1; $i -le 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$PORT/health" -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Success "Health check passed"
                return $true
            }
        }
        catch {
            Write-Status "Waiting for service to be ready... ($i/30)"
            Start-Sleep -Seconds 2
        }
    }
    
    Write-Error "Health check failed. Service may not be running properly."
    docker logs $CONTAINER_NAME
    return $false
}

# Show deployment info
function Show-DeploymentInfo {
    Write-Host ""
    Write-Host "🩸 Blood Platform Deployment Complete!" -ForegroundColor Magenta
    Write-Host "=================================="
    Write-Host "Service URL: http://localhost:$PORT"
    Write-Host "Health Check: http://localhost:$PORT/health"
    Write-Host "API Documentation: http://localhost:$PORT/api/docs"
    Write-Host "Container Name: $CONTAINER_NAME"
    Write-Host "Docker Image: $DOCKER_IMAGE"
    Write-Host ""
    Write-Host "Useful Commands:"
    Write-Host "  View logs: docker logs $CONTAINER_NAME"
    Write-Host "  Stop service: docker stop $CONTAINER_NAME"
    Write-Host "  Restart service: docker restart $CONTAINER_NAME"
    Write-Host "  Remove container: docker rm $CONTAINER_NAME"
    Write-Host ""
}

# Main deployment process
try {
    Write-Status "Starting deployment process..."
    
    # Check prerequisites
    if (-not (Test-Docker)) { exit 1 }
    if (-not (Test-Environment)) { exit 1 }
    
    # Development deployment (skip tests for faster deployment)
    if ($Dev) {
        Write-Warning "Development deployment mode - skipping tests"
    }
    else {
        if (-not (Install-Dependencies)) { exit 1 }
        if (-not (Invoke-Tests)) { exit 1 }
    }
    
    # Docker deployment
    if (-not (Build-DockerImage)) { exit 1 }
    Stop-ExistingContainer
    if (-not (Start-Container)) { exit 1 }
    if (-not (Test-Health)) { exit 1 }
    
    Show-DeploymentInfo
    Write-Success "Deployment completed successfully!"
}
catch {
    Write-Error "Deployment failed: $($_.Exception.Message)"
    exit 1
}