# FallVision Frontend

This is the frontend application for FallVision, built with React.

## Project Structure

```
frontend/
├── public/          # Static files
├── src/
│   ├── assets/      # Images, icons, SVG files
│   ├── components/  # Reusable React components
│   ├── data/        # Static data files
│   ├── hooks/       # Custom React hooks
│   ├── pages/       # Page components
│   ├── services/    # API services
│   ├── index.css    # Global styles
│   └── index.js     # Entry point
├── package.json
└── package-lock.json
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

Start the development server:
```bash
npm start
```

The application will open in your browser at [http://localhost:3000](http://localhost:3000)

### Building for Production

Create a production build:
```bash
npm run build
```

The build files will be generated in the `build/` directory.

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)

## Features

- **Dashboard** - Overview of patient metrics
- **Gait Analysis** - Detailed gait tracking and analysis
- **Sleep Diary** - Sleep pattern monitoring
- **Sleep Dashboard** - Sleep metrics visualization

## API Integration

The frontend communicates with the backend API. Make sure the backend server is running before starting the frontend.

Default backend URL: `http://localhost:5000`

Configure the API URL in `src/services/api.js`
