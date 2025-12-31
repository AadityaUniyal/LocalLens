# Local Lens Traffic Management Platform

AI-powered traffic signal control with emergency vehicle detection and intelligent routing for Dehradun city.

## Features

- Emergency vehicle detection using YOLOv8 and OpenCV
- Automatic traffic signal override for emergency vehicles
- Route optimization for ambulances to nearest hospitals
- Multi-signal coordination for green corridors
- Real-time traffic monitoring dashboard
- Dehradun city map integration
- Traffic density-based signal timing

## Technology Stack

- **Computer Vision**: OpenCV, YOLOv8
- **Backend**: Python Flask
- **Database**: PostgreSQL
- **Cache**: Redis
- **AI/ML**: Ultralytics YOLO, NumPy

## Getting Started

```bash
# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env

# Start development server
python src/main.py

# Run tests
pytest tests/
```

## API Endpoints

### Detection
- `POST /api/detect/vehicle` - Detect emergency vehicles in image/video
- `GET /api/detect/status` - Get detection system status

### Traffic Signals
- `GET /api/signals` - Get all traffic signals
- `POST /api/signals/:id/override` - Override signal for emergency
- `PUT /api/signals/:id/timing` - Update signal timing

### Routing
- `POST /api/routing/emergency` - Calculate emergency route
- `GET /api/routing/hospitals` - Get nearby hospitals

### Analytics
- `GET /api/analytics/traffic` - Traffic flow analytics
- `GET /api/analytics/emergency` - Emergency response metrics

## Emergency Vehicle Detection

The system uses YOLOv8 for object detection combined with color analysis to identify:
- Ambulances (white with red/blue markings)
- Police vehicles (distinctive blue/red coloring)
- Fire trucks (red coloring with emergency equipment)

## Docker

```bash
# Build image
docker build -t local-lens-traffic .

# Run container
docker run -p 3005:5000 local-lens-traffic
```

## Configuration

See `.env.example` for required environment variables including:
- Database connections
- Redis configuration
- Detection model parameters
- Dehradun map API keys