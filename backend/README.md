# FallVision Backend API

FastAPI backend serving real-time fall prevention data from AWS DynamoDB.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure AWS Credentials
Make sure AWS credentials are configured:
```bash
aws configure
# Set Access Key, Secret Key, Region: us-east-1
```

### 3. Run Server
```bash
python run.py
```

Server starts at: **http://localhost:8000**

---

## 📡 API Endpoints

### **Sleep Diary Data**
```http
GET /api/v1/sleep/{resident_id}
```
**Example:**
```bash
curl http://localhost:8000/api/v1/sleep/RES%23res-20251112-0001
```

**Response Format:** Matches React `sleepData.json` structure
- Patient info
- Metrics (Total Sleep Time, Efficiency, WASO, Latency)
- Sleep stages (Deep, REM, Light)
- Sleep duration over time (7 days)
- Body movement hourly
- Wake episodes

---

### **Gait Analysis Data**
```http
GET /api/v1/gait/{resident_id}
```
**Example:**
```bash
curl http://localhost:8000/api/v1/gait/RES%23res-20251112-0001
```

**Response Format:** Matches React `gaitData.json` structure
- Gait metrics (Step Frequency, Stride Length, Balance, Fall Risk)
- Step frequency over time (30 days)
- Stride length distribution (hourly)
- Arm swing symmetry
- Body tilt analysis

---

### **Residents**
```http
GET /api/v1/residents              # List all residents
GET /api/v1/residents/{resident_id} # Get resident details
GET /api/v1/residents/{resident_id}/alerts
GET /api/v1/residents/{resident_id}/suggestions
GET /api/v1/residents/{resident_id}/health-score
```

---

## 🧪 Test in Browser

- **API Root:** http://localhost:8000
- **API Docs (Swagger):** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health

---

## 📁 Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Configuration settings
│   ├── routes/
│   │   ├── sleep.py         # Sleep diary endpoints
│   │   ├── gait.py          # Gait analysis endpoints
│   │   └── residents.py     # Resident management
│   └── services/
│       ├── dynamodb_service.py      # DynamoDB queries
│       └── data_transformer.py      # Data format conversion
└── run.py                   # Server launcher
```

---

## 🔗 React Integration

### Update React to use API instead of JSON files:

**Before (hardcoded JSON):**
```javascript
import sleepData from '../data/sleepData.json';
```

**After (API call):**
```javascript
const [sleepData, setSleepData] = useState(null);

useEffect(() => {
  fetch('http://localhost:8000/api/v1/sleep/RES%23res-20251112-0001')
    .then(res => res.json())
    .then(data => setSleepData(data));
}, []);
```

---

## 🗃️ Database Tables Used

| Table | Purpose |
|-------|---------|
| `residents` | Patient master records |
| `sleep_nightly_summary` | Nightly sleep metrics |
| `sleep_movement_hourly` | Hourly body movement |
| `sleep_wake_episodes` | Wake-up events |
| `gait_metrics_snapshot` | Current gait metrics |
| `gait_daily_steps` | Daily step counts |
| `stride_length_hourly` | Hourly stride data |
| `unified_alerts` | System alerts |
| `resident_smart_suggestions` | AI recommendations |
| `resident_health_score` | Health scores |

---

## 🛠️ Environment Variables

Configure in `app/config.py`:
- `AWS_REGION`: us-east-1
- `FACILITY_ID`: FAC#f-001
- `CORS_ORIGINS`: React dev server URL

---

## 📊 Sample Test Resident IDs

From seeded data (10 residents):
```
RES#res-20251112-0001  (James Smith, Room 201)
RES#res-20250603-0002  (Mary Johnson, Room 202)
RES#res-20250802-0003  (Robert Williams, Room 203)
RES#res-20250617-0004  (Patricia Brown, Room 204)
RES#res-20250330-0005  (John Davis, Room 205)
```

---

## ⚡ Performance Notes

- **Latency:** 50-150ms per request (DynamoDB query)
- **CORS:** Configured for React dev server (localhost:3000)
- **Auto-reload:** Server restarts on code changes
- **Error handling:** Returns proper HTTP status codes

---

## 🐛 Troubleshooting

**Server won't start:**
```bash
# Check if port 8000 is available
netstat -ano | findstr :8000

# Kill process if needed
taskkill /PID <PID> /F
```

**AWS Credentials Error:**
```bash
aws sts get-caller-identity  # Verify credentials
```

**CORS Error in React:**
```javascript
// Check backend/app/config.py CORS_ORIGINS includes:
"http://localhost:3000"
```

---

## 📝 Next Steps

1. **Integrate with React:** Update Sleep/Gait pages to call API
2. **Add Authentication:** JWT tokens for API access
3. **Add Caching:** Redis for frequently accessed data
4. **Add WebSockets:** Real-time updates for alerts
5. **Deploy to AWS:** Lambda + API Gateway

---

**Backend is ready! Time to connect React frontend →** 🚀
