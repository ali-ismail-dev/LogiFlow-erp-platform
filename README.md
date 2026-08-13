# LogiFlow | Multi-Tenant B2B Enterprise Logistics Platform

> **Production-Grade Logistics & Dispatch Engine**  
> A highly concurrent platform featuring strict multi-tenant database isolation, real-time WebSocket telemetry, and pessimistic locking to guarantee transactional integrity during high-frequency dispatching.

[![Laravel](https://img.shields.io/badge/Laravel-13.x-FF2D20?logo=laravel)](https://laravel.com)
[![PHP](https://img.shields.io/badge/PHP-8.4+-777BB4?logo=php)](https://www.php.net)
[![Next.js](https://img.shields.io/badge/Next.js-App_Router-000000?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com)

---

## 🏗 System Topology

```text
┌─────────────────┐       (WSS / Sub-second)       ┌─────────────────┐
│  Next.js App    │ ◄────────────────────────────► │ Laravel Reverb  │
│  (App Router)   │                                │ (Socket Server) │
└───────┬─────────┘                                └────────┬────────┘
        │ (REST API)                                        │ (Event Bus)
        ▼                                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Laravel 13 API Core (PHP 8.4)                   │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Tenant Scope │  │ Sanctum Auth │  │ Dispatch & Route Actions │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└───────┬───────────────────────────────────────────────────┬────────┘
        │ (Pessimistic Row Locks / FOR UPDATE)              │
        ▼                                                   ▼
┌─────────────────────────────────┐               ┌──────────────────┐
│          PostgreSQL             │               │    Redis Cache   │
│  (Multi-Tenant Scoped Schema)   │               │  (Telemetry &    │
│                                 │               │   Queue Workers) │
└─────────────────────────────────┘               └──────────────────┘
```

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
