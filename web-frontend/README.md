# Local Lens Web Frontend

Unified web application providing access to all four Local Lens platforms through a single interface.

## Features

- Unified authentication and platform selection
- Responsive design for desktop and mobile
- Real-time notifications with Socket.io
- Platform-specific routing and navigation
- Shared UI components and design system
- Progressive Web App (PWA) capabilities

## Technology Stack

- **Framework**: Next.js 13 with App Router
- **UI**: React 18, TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Heroicons
- **HTTP Client**: Axios
- **Real-time**: Socket.io Client
- **Testing**: Jest, React Testing Library

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                 # Next.js 13 app directory
│   ├── auth/           # Authentication pages
│   ├── blood/          # Blood platform pages
│   ├── complaint/      # Complaint platform pages
│   ├── architecture/   # Architecture platform pages
│   ├── traffic/        # Traffic platform pages
│   └── layout.tsx      # Root layout
├── components/         # Shared components
│   ├── ui/            # Base UI components
│   ├── auth/          # Auth-specific components
│   └── platform/      # Platform-specific components
├── lib/               # Utilities and configurations
├── hooks/             # Custom React hooks
└── types/             # TypeScript type definitions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Environment Variables

See `.env.example` for required environment variables.

## Deployment

The application can be deployed to:
- Vercel (recommended for Next.js)
- Netlify
- AWS Amplify
- Docker containers