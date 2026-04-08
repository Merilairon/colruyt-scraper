# Colruyt Scraper

A Node.js/TypeScript service that scrapes product prices and promotions from the Colruyt API, stores them in a PostgreSQL database, and exposes a REST API for querying the data. A daily cron job automatically fetches new data and detects price changes.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Docker](#docker)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

---

## Features

- Scrapes product data and promotions from the Colruyt API
- Stores historical prices and promotions in a PostgreSQL database
- Detects and records price changes (increases, decreases, and promotions)
- REST API endpoints for products and promotions
- Interactive Swagger UI at `/api/docs`
- Daily cron job (runs at 08:00) to keep data up to date
- Configurable start modes: API server, scrape+compare, or compare-only-at-startup

---

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+ (`npm install -g pnpm`)
- [PostgreSQL](https://www.postgresql.org/) database

---

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Merilairon/colruyt-scraper.git
   cd colruyt-scraper
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Copy the example file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   See the [Configuration](#configuration) section for details on each variable.

---

## Configuration

All configuration is done via environment variables. Create a `.env` file in the project root (use `.env.example` as a template):

| Variable              | Description                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `PROXY_ENDPOINT`      | Proxy server URL (e.g. `http://user:pass@host:port`)                                            |
| `ENABLE_PROXY`        | Set to `true` to route requests through the proxy                                               |
| `HOST_URL`            | Base URL of the Colruyt website                                                                 |
| `API_HOST_URL`        | Base URL for the Colruyt API host                                                               |
| `API_URL`             | Endpoint for general product/price API calls                                                    |
| `PROMOTION_URL`       | Endpoint for fetching promotion data                                                             |
| `PRODUCT_URL`         | Endpoint for fetching individual product details                                                |
| `PG_HOST`             | PostgreSQL connection string (e.g. `postgres://user:pass@localhost:5432/dbname`)                |
| `PLACE_ID`            | Colruyt store place ID used when querying the API                                               |
| `AMOUNT_OF_DAYS_KEPT` | Number of days of historical price data to retain in the database                              |
| `START_MODE`          | Startup mode: `SCRAPE` (scrape + compare), `COMPARE` (compare only), or empty (API server only) |

---

## Running the Service

### Development (with hot-reload)

```bash
pnpm dev
```

Nodemon watches `src/` for changes, rebuilds, and restarts the server automatically.

### Production

```bash
pnpm build   # compile TypeScript → dist/
pnpm start   # run compiled output
```

The API server starts on port `3000` by default (override with the `PORT` environment variable).

### Start modes

Control the service behaviour via the `START_MODE` variable in `.env`:

| `START_MODE` | Behaviour                                                                   |
| ------------ | --------------------------------------------------------------------------- |
| *(empty)*    | Start the API server only; the cron job runs the scraper daily at 08:00   |
| `SCRAPE`     | Immediately run the scraper and price comparer, then start the server      |
| `COMPARE`    | Immediately run the price comparer only, then start the server              |

---

## API Reference

Interactive documentation (Swagger UI) is available at:

```
http://localhost:3000/api/docs
```

### Endpoints

| Method | Path              | Description                        |
| ------ | ----------------- | ---------------------------------- |
| `GET`  | `/api/products`   | List all scraped products          |
| `GET`  | `/api/promotions` | List all active promotions         |

All other paths return `404 Not Found`.

---

## Testing

Run the full test suite with:

```bash
pnpm test
```

Tests are written with [Jest](https://jestjs.io/) and [Supertest](https://github.com/ladjs/supertest) and live in `src/__tests__/`. Jest is configured to look for files matching `**/__tests__/**/*.test.ts`.

To run a single test file:

```bash
pnpm test -- src/__tests__/comparer.test.ts
```

---

## Docker

A `Dockerfile` is included for containerised deployments.

### Build the image

```bash
docker build -t colruyt-scraper .
```

### Run the container

```bash
docker run -p 3000:3000 --env-file .env colruyt-scraper
```

The container exposes port `3000`. Pass your `.env` file with `--env-file` or use individual `-e` flags.

---

## Project Structure

```
colruyt-scraper/
├── src/
│   ├── __tests__/          # Jest test files
│   ├── comparers/          # Price-change comparison logic
│   ├── docs/               # OpenAPI/Swagger YAML definitions
│   ├── models/             # Sequelize models (Product, Price, Promotion, …)
│   ├── routes/             # Express route handlers
│   ├── scrapers/           # Colruyt API scraping logic
│   ├── utils/              # Shared utility functions
│   ├── comparer.ts         # Comparer entry point
│   ├── database.ts         # Sequelize connection setup
│   ├── scraper.ts          # Scraper entry point
│   └── server.ts           # Express app & server entry point
├── .env.example            # Environment variable template
├── Dockerfile              # Container build instructions
├── nodemon.json            # Nodemon watch configuration
├── package.json
├── tsconfig.json
└── README.md
```

---

## Contributing

1. Fork the repository and create a feature branch (`git checkout -b feature/my-feature`).
2. Make your changes and add tests where applicable.
3. Ensure all tests pass (`pnpm test`).
4. Open a pull request describing your changes.
