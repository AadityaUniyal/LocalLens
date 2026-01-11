# Local Lens Web Frontend

A modern, responsive web frontend for the Local Lens multi-platform ecosystem built with Next.js, TypeScript, and Tailwind CSS.

## 🚀 Features

### Modern Design System
- **Glass Morphism UI**: Beautiful translucent interfaces with backdrop blur effects
- **Dark Theme**: Elegant dark mode with gradient backgrounds and glowing elements
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Smooth Animations**: Framer Motion powered transitions and micro-interactions

### Real-Time Dashboard
- **Live Data Updates**: Real-time metrics and status updates every 3 seconds
- **Interactive Components**: Hover effects, loading states, and dynamic content
- **System Monitoring**: Live connection status, uptime tracking, and performance metrics
- **Smart Notifications**: Toast notifications with auto-dismiss and priority levels

### Traffic Management System
- **Signal Control**: Manual override capabilities with duration and reason tracking
- **Emergency Detection**: Real-time emergency vehicle detection and routing
- **Analytics Dashboard**: Performance metrics, response times, and system efficiency
- **Live Map Integration**: Interactive traffic map with real-time signal status

### Platform Integration
- **Multi-Platform Support**: Unified interface for all Local Lens platforms
- **Status Monitoring**: Real-time status tracking for all connected systems
- **Quick Actions**: Fast access to frequently used features and controls
- **Cross-Platform Navigation**: Seamless switching between different platforms

## 🛠 Technology Stack

- **Framework**: Next.js 13.4.19 with App Router
- **Language**: TypeScript 5.2.2
- **Styling**: Tailwind CSS 3.3.3 with custom animations
- **Icons**: Heroicons & Lucide React
- **Animations**: Custom CSS animations with hardware acceleration
- **Real-time**: Socket.IO client for live updates
- **HTTP Client**: Axios for API communication
- **Development**: TypeScript with Next.js

## 📦 Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🎨 Design Features

### Color Palette
- **Primary**: Blue gradients (#3B82F6 to #6366F1)
- **Secondary**: Purple accents (#8B5CF6 to #A855F7)
- **Success**: Green indicators (#10B981 to #059669)
- **Warning**: Orange/Yellow alerts (#F59E0B to #D97706)
- **Error**: Red notifications (#EF4444 to #DC2626)

### Typography
- **Headings**: Inter font family with gradient text effects
- **Body**: System fonts with optimized readability
- **Code**: Monospace fonts for technical data display

### Animations
- **Page Transitions**: Smooth fade-in and slide animations
- **Hover Effects**: Scale transforms and shadow enhancements
- **Loading States**: Skeleton screens and spinner animations
- **Live Indicators**: Pulsing effects for real-time elements

## 🔧 Configuration

### Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=ws://localhost:5000
NEXT_PUBLIC_MAP_API_KEY=your_map_api_key
```

### Tailwind Configuration
Custom utilities and components are defined in `globals.css`:
- Glass morphism effects (`.glass`, `.glass-dark`)
- Enhanced button styles (`.btn-primary`, `.btn-secondary`)
- Animation classes (`.animate-fadeIn`, `.animate-slideInLeft`)
- Status indicators (`.status-online`, `.status-offline`)

## 📱 Responsive Breakpoints

- **Mobile**: 320px - 768px
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px - 1440px
- **Large Desktop**: 1440px+

## 🚦 Traffic Management Features

### Dashboard Tabs
1. **Overview**: System metrics, live map, and recent activity
2. **Signal Control**: Manual override controls and signal status
3. **Emergency Log**: Detection history and response analytics
4. **Analytics**: Performance charts and system statistics
5. **Other Platforms**: Integration status and quick access

### Real-Time Features
- **Live Signal Updates**: Signal state changes every 3 seconds
- **Emergency Alerts**: Instant notifications for emergency vehicle detection
- **Performance Monitoring**: Response time tracking and system efficiency
- **Connection Status**: Real-time connection monitoring with reconnection handling

## 🎯 Performance Optimizations

### Code Splitting
- Route-based code splitting with Next.js App Router
- Component-level lazy loading for heavy components
- Dynamic imports for non-critical features

### Image Optimization
- Next.js Image component with automatic optimization
- WebP format support with fallbacks
- Responsive image loading with proper sizing

### Caching Strategy
- Static generation for marketing pages
- Incremental Static Regeneration for dynamic content
- Client-side caching for API responses

## 🚀 Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

### Development Guidelines
- Component development with TypeScript
- Integration with authentication service
- API communication with backend services
- Real-time updates and notifications

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Setup
- Production API endpoints configuration
- SSL certificate setup for HTTPS
- CDN configuration for static assets
- Monitoring and logging integration

## 📊 Analytics Integration

### Performance Monitoring
- Core Web Vitals tracking
- User interaction analytics
- Error boundary reporting
- Real-time performance metrics

### User Experience
- Page load time optimization
- Interactive element response tracking
- Mobile usability metrics
- Accessibility compliance monitoring

## 🔒 Security Features

### Authentication
- JWT token-based authentication
- Secure session management
- Role-based access control
- Auto-logout on inactivity

### Data Protection
- Input validation and sanitization
- XSS protection with Content Security Policy
- CSRF token validation
- Secure API communication with HTTPS

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Use ESLint and Prettier for code formatting
- Implement new components and features
- Follow accessibility best practices (WCAG 2.1)
- Optimize for performance and SEO

## 📄 License

This project is part of the Local Lens ecosystem and is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in `/docs`
- Contact the development team

---

Built with ❤️ for smart city initiatives and civic technology advancement.