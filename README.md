# LogiFlow | Multi-Tenant B2B Enterprise Logistics Platform

> **Production-Grade Logistics & Dispatch Engine**  
> A highly concurrent B2B SaaS platform featuring strict multi-tenant database isolation, real-time WebSocket telemetry, and pessimistic concurrency locking to guarantee absolute data integrity during high-frequency dispatch runs.

[![Laravel](https://img.shields.io/badge/Laravel-13.x-FF2D20?logo=laravel)](https://laravel.com)
[![PHP](https://img.shields.io/badge/PHP-8.4+-777BB4?logo=php)](https://www.php.net)
[![Next.js](https://img.shields.io/badge/Next.js-App_Router-000000?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com)

---

## 🏗 System Topology

```text
┌─────────────────┐       (WSS / Sub-second)       ┌─────────────────┐
│  Next.js App    │ ◄────────────────────────────► │  Laravel Reverb │
│  (App Router)   │                                │ (Socket Server) │
└───────┬─────────┘                                └────────┬────────┘
        │ (REST API)                                        │ (Event Bus)
        ▼                                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Laravel API Routing Core (PHP 8.4)              │
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
Engineered a custom database-level isolation layer (`BelongsToTenant`) enforcing row-level corporate record firewalls via global Eloquent query scopes. Protected by stateful Laravel Sanctum cookie guards with strict cross-site policies (SameSite/Lax) to prevent cross-tenant boundary leakage and session hijacking.

### Pessimistic Concurrency & Data Integrity
Implemented raw SQL pessimistic locking (`FOR UPDATE`) inside backend database transactions. This architecture neutralizes race conditions and completely prevents multi-user index allocation drifts during high-frequency bulk order dispatching and route-manifest grouping.

### Dual-Persona Workspace Interface
Features a dynamic client-side authentication vector split via modern Next.js Edge Middleware. Logistics supervisors land on an analytical administration tracking cockpit to build routes, while field operatives are funneled straight into a lightweight, touch-screen optimized mobile driver dashboard.

### Real-Time Telemetry Event Streaming
Connected mobile driver dashboards to administrative control panels via WebSockets. When a field operator advances their manifest state, a live event loop transmits encrypted, tenant-scoped data payloads to update live operational metrics instantly without any HTTP polling overhead.

### Rigorous Test-Driven CI/CD
The backend environment maintains an **88.6% total code coverage** through deep HTTP integration feature test suites. Validation gates are executed automatically via GitHub Actions on all push events to ensure zero-regression deployments.

---

## 🔬 Core Integration Test Matrix

The platform is backed by comprehensive integration suites simulating real-world operational workflows. Run `php artisan test` inside the backend microservice to verify:

*   **Cross-Tenant Isolation Guard**: Validates that Tenant A cannot query, view, or manipulate resources belonging to Tenant B under any circumstance.
*   **Alphabetical Sub-Profile Joins**: Verifies that the drivers listing directory executes optimized relational table database joins to accurately order operative entries alphabetically by user display names.
*   **Stateful Redirection Gates**: Verifies that unauthorized sessions or corrupted cookie handshakes fail closed instantly, repelling illicit access attempts from reaching protected route perimeters.

---

## 🛠 Local Development & Setup

This application is fully containerized using Docker for reproducible local environments.

### Prerequisites
* Docker & Docker Compose
* Node.js (v20+)

### Backend Installation

```bash
# Clone the repository
git clone https://github.com/ali-ismail-dev/logiflow-erp-platform.git
cd logiflow-erp-platform/backend

# Install dependencies inside the container environment
composer install

# Copy environment file
cp .env.example .env

# Boot the Docker containers (PostgreSQL/Redis/PHP)
docker compose up -d

# Run migrations and seed the workspace database
docker compose exec backend php artisan migrate --seed

# Start the WebSocket Server for telemetry streaming
docker compose exec backend php artisan reverb:start
```

### Frontend Installation

```bash
cd ../frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

---
Architected and maintained by **Ali Ismail** — ali.ismail.dev1@gmail.com
