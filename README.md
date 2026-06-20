# 💰 FinTech Wallet & Ledger System

A production-ready fullstack digital wallet application with secure transactions, real-time ledger tracking, and modern UI.

## Tech Stack

### Backend
- **Runtime**: Node.js (≥18)
- **Framework**: Express.js + TypeScript
- **Database**: MongoDB (Mongoose)
- **Cache**: Redis (ioredis)
- **Auth**: JWT + bcrypt
- **Validation**: Zod
- **Security**: Helmet, CORS

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **HTTP Client**: Axios

## Getting Started

### Prerequisites
- Node.js ≥ 18
- MongoDB
- Redis

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env      # configure your environment variables
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env      # configure your environment variables
npm run dev
```

## Project Structure
```
fintech-wallet/
├── backend/
│   ├── src/              # Express API source code
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/              # React app source code
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

## License
MIT
