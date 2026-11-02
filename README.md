# Teacher Management Dashboard — Backend API

Enterprise modular backend for the Teacher Management System at educational institutions (MSEC).

## Tech Stack
- **Runtime:** Node.js (v20+)
- **Language:** TypeScript (strict mode)
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (Short-lived access tokens + Rotating refresh tokens) & bcrypt password hashing
- **Validation:** Zod schema validation
- **Testing:** Jest + Supertest with in-memory MongoDB runner
- **Security:** Helmet, CORS, Rate-Limiting, Mongo Sanitization

## Installation & Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file and configure variables:
```bash
cp .env.example .env
```

3. Run in development:
```bash
npm run dev
```

4. Run tests:
```bash
npm test
```

5. Build for production:
```bash
npm run build
npm start
```
