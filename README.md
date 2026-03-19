# FallVision

A comprehensive healthcare monitoring system for tracking gait analysis and sleep patterns.

## Project Structure

```
fallvision/
├── frontend/          # React frontend application
│   ├── public/        # Static files
│   ├── src/           # Source code
│   ├── package.json   # Frontend dependencies
│   └── README.md      # Frontend documentation
│
├── backend/           # Python Flask backend API
│   ├── app/           # Application code
│   │   ├── models/    # Data models
│   │   ├── routes/    # API endpoints
│   │   └── services/  # Business logic
│   ├── requirements.txt  # Python dependencies
│   ├── run.py         # Backend entry point
│   └── README.md      # Backend documentation
│
├── create_tables_and_seed.py  # Database setup script
├── DB Tables.txt      # Database schema documentation
└── .gitignore         # Git ignore rules
```

## Quick Start

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the backend server:
   ```bash
   python run.py
   ```

The backend API will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The frontend will be available at `http://localhost:3000`

## Running the Full Application

You need to run both the backend and frontend simultaneously:

1. **Terminal 1** - Start the backend:
   ```bash
   cd backend
   python run.py
   ```

2. **Terminal 2** - Start the frontend:
   ```bash
   cd frontend
   npm start
   ```

## Features

- **Gait Analysis Dashboard** - Track and analyze walking patterns
- **Sleep Monitoring** - Record and visualize sleep data
- **Patient Management** - Manage resident information
- **Real-time Updates** - Live data synchronization

## Technology Stack

### Frontend
- React.js
- React Router
- Axios for API calls
- CSS for styling

### Backend
- Python Flask
- AWS DynamoDB
- RESTful API architecture

## Documentation

- Frontend documentation: [frontend/README.md](frontend/README.md)
- Backend documentation: [backend/README.md](backend/README.md)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
