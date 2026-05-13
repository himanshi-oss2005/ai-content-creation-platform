# ✍️ WriteGen AI — AI Content Generator Platform

A production-ready AI SaaS web application for generating blogs, ads, captions, product descriptions, emails, and taglines using OpenAI GPT.

![Tech Stack](https://img.shields.io/badge/Angular-17-red) ![Node.js](https://img.shields.io/badge/Node.js-Express-green) ![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-blue)

---

## 🚀 Features

- **JWT Authentication** — Secure login/signup with bcrypt password hashing
- **Role-Based Access** — Free (10/day) vs Premium (100/day) users
- **AI Content Generation** — Blog posts, ad copy, captions, product descriptions, emails, taglines
- **Tone Selection** — Professional, Casual, Marketing, Funny, Formal
- **Credit System** — Daily credit limits with real-time tracking
- **Stripe Payments** — Premium subscription with webhook handling (mock mode available)
- **Content History** — Search, filter, favorite, copy, delete past content
- **Export** — Download as TXT or print-to-PDF
- **Dashboard** — Usage stats, content breakdown, recent activity
- **Dark Mode** — System-aware with manual toggle
- **Rate Limiting** — Global + per-route protection

---

## 📁 Project Structure

```
AI Content Generator Platform/
├── backend/
│   ├── src/
│   │   ├── controllers/     # auth, content, user, payment
│   │   ├── middleware/       # auth JWT, validation
│   │   ├── models/           # User, Content, Transaction
│   │   ├── routes/           # Express routers
│   │   ├── services/         # AI service (OpenAI + mock)
│   │   ├── utils/            # DB connection
│   │   ├── app.js            # Express app setup
│   │   └── server.js         # Entry point
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── guards/       # authGuard, guestGuard
│   │   │   │   ├── interceptors/ # JWT interceptor
│   │   │   │   ├── models/       # TypeScript interfaces
│   │   │   │   └── services/     # auth, content, payment, theme, toast
│   │   │   ├── features/
│   │   │   │   ├── auth/         # login, signup
│   │   │   │   ├── dashboard/    # stats overview
│   │   │   │   ├── generator/    # AI content generator
│   │   │   │   ├── history/      # content history
│   │   │   │   └── pricing/      # subscription plans
│   │   │   ├── app.component.ts  # Root + navbar
│   │   │   ├── app.config.ts     # Angular providers
│   │   │   └── app.routes.ts     # Lazy-loaded routes
│   │   ├── environments/
│   │   └── styles.css            # Tailwind + custom CSS
│   └── package.json
├── render.yaml       # Render deployment
├── netlify.toml      # Netlify deployment
└── README.md
```

---

## ⚙️ Local Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://cloud.mongodb.com))
- npm or yarn

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd "AI Content Generator Platform"

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure Backend

```bash
cd backend
cp .env .env.local   # edit values
```

Edit `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/writegen_ai
JWT_SECRET=<your-jwt-secret>
USE_MOCK_AI=true          # set false + add OPENAI_API_KEY for real AI
OPENAI_API_KEY=sk-...     # optional
STRIPE_SECRET_KEY=sk_test_...  # optional
FRONTEND_URL=http://localhost:4200
```

### 3. Run Backend

```bash
cd backend
npm run dev   # starts on http://localhost:5000
```

### 4. Run Frontend

```bash
cd frontend
npm start     # starts on http://localhost:4200
```

---

## 🔌 API Documentation

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | ❌ |
| POST | `/api/auth/login` | Login | ❌ |
| GET | `/api/auth/me` | Get current user | ✅ |

### Content
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/content/generate` | Generate AI content | ✅ |
| GET | `/api/content/history` | Get content history | ✅ |
| GET | `/api/content/stats` | Get dashboard stats | ✅ |
| DELETE | `/api/content/:id` | Delete content | ✅ |
| PATCH | `/api/content/:id/favorite` | Toggle favorite | ✅ |

### Users
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/users/profile` | Get profile | ✅ |
| PATCH | `/api/users/profile` | Update profile | ✅ |
| GET | `/api/users/transactions` | Get transactions | ✅ |

### Payments
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/payments/checkout` | Create Stripe session | ✅ |
| POST | `/api/payments/webhook` | Stripe webhook | ❌ |
| POST | `/api/payments/cancel` | Cancel subscription | ✅ |

### Generate Request Body
```json
{
  "type": "blog | ad | caption | product_description | email | tagline",
  "tone": "professional | casual | marketing | funny | formal",
  "prompt": "Your content prompt here"
}
```

---

## 🌐 Deployment

### Backend → Render
1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect repo, set root dir to `backend`
4. Add environment variables from `.env`
5. Deploy — uses `render.yaml` config

### Frontend → Netlify
1. Go to [netlify.com](https://netlify.com) → New Site
2. Connect repo, set base dir to `frontend`
3. Build command: `npm run build:prod`
4. Publish dir: `dist/writegen-ai/browser`
5. Add env var: `VITE_API_URL` = your Render backend URL
6. Update `frontend/src/environments/environment.prod.ts` with backend URL

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
```

---

## 🔐 Security Features

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with expiry
- Helmet.js security headers
- CORS restricted to frontend origin
- Rate limiting: 100 req/15min global, 5 req/min for AI generation
- Input validation with express-validator
- MongoDB injection protection via Mongoose

---

## 🧪 Mock Mode

Set `USE_MOCK_AI=true` in `.env` to use built-in mock responses without an OpenAI API key. Mock responses simulate realistic content for all 6 content types.

For Stripe, if `STRIPE_SECRET_KEY` is not set, clicking "Upgrade" will instantly mock-upgrade the user to Premium.

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 17 (Standalone), TailwindCSS 3 |
| Backend | Node.js, Express 4 |
| Database | MongoDB, Mongoose 8 |
| Auth | JWT, bcryptjs |
| AI | OpenAI GPT-3.5 (+ mock fallback) |
| Payments | Stripe |
| Security | Helmet, express-rate-limit, express-validator |
| Deployment | Render (backend), Netlify/Vercel (frontend) |
