# Insighta Labs+ (Stage 3)

## 🚀 Overview

Insighta Labs+ is a secure, multi-interface platform built on top of the Stage 2 Profile Intelligence System. This stage introduces authentication, authorization, multi-client support (CLI + Web), and production-ready security practices.

All Stage 2 features — filtering, sorting, pagination, and natural language search — are fully preserved and extended.

---

## 🌐 Live URLs

* **Backend (Railway):** [https://hngstage3backend-production.up.railway.app](https://hngstage3backend-production.up.railway.app)
* **Web Portal (Netlify):** [https://classy-kheer-00d6fb.netlify.app](https://classy-kheer-00d6fb.netlify.app)

---

## 📦 Repositories

* **Backend:** [https://github.com/bright5455/hngstage3backend](https://github.com/bright5455/hngstage3backend)
* **Web Portal:** [https://github.com/bright5455/hngstage3portal](https://github.com/bright5455/hngstage3portal)
* **CLI Tool:** [https://github.com/bright5455/hngstage3cli](https://github.com/bright5455/hngstage3cli)

---

## 🧠 System Architecture

The system follows a modular, service-oriented architecture:

* **Backend (NestJS + PostgreSQL)**

  * Handles authentication, authorization, business logic
  * Exposes RESTful APIs with versioning

* **Web Portal (Netlify)**

  * Browser-based UI
  * Uses HTTP-only cookies for authentication

* **CLI Tool (Node.js)**

  * Globally installable
  * Stores credentials locally at `~/.insighta/credentials.json`

All clients communicate with a single backend API.

---

## 🔐 Authentication Flow

### GitHub OAuth (Web)

1. User clicks “Login with GitHub”
2. Redirected to GitHub OAuth
3. GitHub redirects back to backend callback
4. Backend:

   * Exchanges code for access token
   * Fetches user data
   * Creates/updates user
   * Generates JWT tokens
5. Tokens stored as HTTP-only cookies
6. User redirected to dashboard

### GitHub OAuth (CLI)

1. CLI opens browser
2. User authenticates via GitHub
3. Backend redirects to CLI callback
4. CLI captures tokens
5. Tokens saved to:

   ```bash
   ~/.insighta/credentials.json
   ```

---

## 🔑 Token Management

* **Access Token**

  * Short-lived (3 minutes)
  * Used for API access

* **Refresh Token**

  * Longer-lived (5 minutes)
  * Used to generate new access tokens

### Refresh Flow

* Automatically handled via `/auth/refresh`
* Web uses cookies
* CLI uses stored tokens

---

## 👥 Role-Based Access Control (RBAC)

Roles:

* `ADMIN`
* `ANALYST`

### Enforcement

* Implemented via custom `@Roles()` decorator
* Guard checks user role from JWT
* Applied across all protected endpoints

### Example

```ts
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
```

---

## 📊 Pagination (Updated Format)

All endpoints return:

```json
{
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

## 🔍 Natural Language Search

Users can query using plain English:

Example:

```
"female users in Lagos with fatigue"
```

The system parses:

* Filters
* Keywords
* Conditions

Then converts to structured database queries.

---

## 📁 CSV Export

* Available for profile data
* Converts filtered results into downloadable CSV
* Supports admin-level access only

---

## 💻 CLI Tool

### Installation

```bash
npm install -g insighta-cli
```

### Usage

```bash
insighta login
insighta profiles
```

### Credential Storage

```bash
~/.insighta/credentials.json
```

---

## 🌍 Web Portal

* Hosted on Netlify
* Uses secure cookies
* CSRF protection enabled

### Features

* GitHub login
* Dashboard
* Profile viewing
* API interaction

---

## 🛡️ Security Features

* Helmet (secure headers)
* HTTP-only cookies
* CSRF protection
* Rate limiting
* Input validation (class-validator)
* Environment-based configs

---

## ⚡ Rate Limiting & Logging

* Throttling via NestJS Throttler
* Prevents abuse
* Logs incoming requests for monitoring

---

## 🧪 Edge Case Handling

* Missing GitHub email
* Token expiration
* Invalid refresh tokens
* Unauthorized access
* Network failures

---

## 🧱 Code Quality

* Modular structure
* DTO validation
* Strong typing
* Clean service/controller separation

---

## ✅ Summary

Insighta Labs+ delivers:

* Secure authentication (OAuth + JWT)
* Multi-client support (Web + CLI)
* Role-based access control
* Scalable architecture
* Production-ready deployment

---

## 📌 Environment Variables

```env
FRONTEND_URL=https://classy-kheer-00d6fb.netlify.app
GITHUB_CALLBACK_URL=https://hngstage3backend-production.up.railway.app/auth/github/callback
DATABASE_URL=your_database_url
JWT_SECRET=your_secret
```

---
