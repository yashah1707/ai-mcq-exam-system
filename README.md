# AI-Based Student Performance Monitoring & Adaptive Test Platform

An intelligent examination system that adapts to student performance and provides AI-driven insights for placement preparation.

## 🚀 Features
- **Adaptive Tests**: Difficulty and topics adjust based on previous performance.
- **AI Analytics**: Python-based microservice for Clustering and Trend Analysis.
- **Placement Readiness**: Score calculating your probability of cracking interviews.
- **Admin Dashboard**: Batch-level heatmaps and weak-topic identification.

## 🛠 Tech Stack
- **Frontend**: React.js, Tailwind CSS, Recharts
- **Backend**: Node.js, Express, MongoDB
- **AI Engine**: Python (Flask, Scikit-Learn, Pandas)

## 📦 Setup & Installation

### Prerequisites
- Node.js & npm
- Python 3.9+
- MongoDB (Running locally or Atlas)

### 1. Clone & Install Dependencies
```bash
# Server
cd server
npm install

# Client
cd ../client
npm install

# AI Service
cd ../ai-service
pip install -r requirements.txt
```

### 2. Run Locally (Dev Mode)
You need 3 terminals:

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```

**Terminal 2 (AI Service):**
```bash
cd ai-service
python app.py
```

**Terminal 3 (Frontend):**
```bash
cd client
npm run dev
```

### 3. Run the stack locally
Follow the instructions in `DEV_SETUP.md` for local development commands (no Docker).

## 🧠 AI & Logic Explained
See [VIVA_EXPLANATION.md](./VIVA_EXPLANATION.md) for detailed architecture and adaptivity logic usage.

## 🖼 Question Image Uploads

Question image uploads use Cloudinary.

Set these variables in `server/.env` before using image upload from the admin question forms:

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```
