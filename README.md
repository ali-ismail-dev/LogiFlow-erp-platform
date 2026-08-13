# LogiFlow | Multi-Tenant B2B Enterprise Logistics Platform

> A production-grade logistics and dispatch platform featuring strict multi-tenant database isolation, real-time WebSocket telemetry, and high-concurrency transactional integrity.

## 🏗 System Architecture

LogiFlow is built on a decoupled architecture, separating a highly responsive client-side interface from a heavy, stateful business logic core. 

* **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
* **Backend Core:** PHP 8.4, Laravel 13, RESTful APIs
* **Database & Caching:** PostgreSQL, Redis
* **Real-Time Telemetry:** Laravel Reverb (WebSockets)
* **Infrastructure:** Docker, Nginx Reverse Proxy, GitHub Actions CI/CD

---

## 🚀 Core Architectural Features

### Airtight Multi-Tenancy & Data Security
Engineered a custom database-level isolation layer (`BelongsToTenant`) enforcing row-level corporate record firewalls via global Eloquent scopes. Protected by stateful Laravel Sanctum cookie guards with strict cross-site policies (SameSite/Lax) to prevent cross-tenant boundary leakage and session hijacking.

### Pessimistic Concurrency & Data Integrity
Implemented raw SQL pessimistic locking (`FOR UPDATE`) inside backend database transactions. This architecture neutralizes race conditions and prevents resource locks during high-frequency bulk order dispatching and route-manifest grouping.

### Real-Time Telemetry Event Streaming
Connected mobile driver cockpits to administrative control panels via WebSockets. Broadcasts encrypted, tenant-scoped data payloads to update live operational dispatch metrics instantly without HTTP polling overhead.

### Rigorous CI/CD & Testing
The backend environment maintains an **88.6% total code coverage** through deep HTTP integration test suites. Validation gates are executed automatically via GitHub Actions on all push events to ensure zero-regression deployments.

---

## 🛠 Local Development & Setup

This application is fully containerized using Docker for reproducible local environments.

### Prerequisites
* Docker & Docker Compose
* Node.js (v20+)
* PHP 8.4 (Local CLI for Composer)

### Backend Installation

```bash
# Clone the repository
git clone [https://github.com/ali-ismail-dev/logiflow-erp-platform.git](https://github.com/ali-ismail-dev/logiflow-erp-platform.git)
cd logiflow-erp-platform/backend

# Install dependencies
composer install

# Copy environment file
cp .env.example .env

# Boot the Docker containers (Sail/PostgreSQL/Redis)
./vendor/bin/sail up -d

# Run migrations and seed the database
./vendor/bin/sail artisan migrate --seed

# Start the WebSocket Server for telemetry
./vendor/bin/sail artisan reverb:start
```
### Frontend Installation
```bash
cd ../frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
Architected and maintained by Ali Ismail.
