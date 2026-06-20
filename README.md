# Peak

A [NestJS](https://nestjs.com) service that tracks stock prices. You start tracking a symbol, and a cron job polls [Finnhub](https://finnhub.io) every minute for the latest quote and stores it; you can then read back the latest price and a moving average.

## API

Interactive API docs (Swagger) are served at `/docs` once the app is running.

| Method | Path             | Description                                                            |
| ------ | ---------------- | ------------------------------------------------------------------------ |
| `PUT`  | `/stock/:symbol` | Start tracking a symbol — upserts it and records an initial price (`404` if the symbol doesn't exist) |
| `GET`  | `/stock/:symbol` | Get the latest price, last updated time, and moving average for a symbol (`404` if nothing has been recorded yet) |

If the configured `FINNHUB_API_KEY` is invalid, requests that need a live quote (`PUT`, and the cron poll) fail with `503 Service Unavailable` rather than a generic `500`. An unknown stock symbol fails with `404 Not Found` and is never tracked or persisted.

## Project setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

- `FINNHUB_API_KEY` — a free key from [finnhub.io](https://finnhub.io)
- `DATABASE_URL` — a Postgres connection string

## Database

This project uses [Prisma](https://www.prisma.io) with PostgreSQL.

```bash
# generate the Prisma client
npx prisma generate

# run migrations
npx prisma migrate dev
```

## Running the app

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

## Running with Docker

```bash
docker compose up --build
```

This starts Postgres, runs database migrations, and starts the app, as defined in [docker-compose.yml](docker-compose.yml). `FINNHUB_API_KEY` must be set in your shell or `.env` file before running, since compose passes it through to the `app` service.

Migrations run automatically via a one-off `migrate` service (built from the `builder` stage of the [Dockerfile](Dockerfile), which has the Prisma CLI and schema) that runs before `app` starts — no manual steps needed.

## Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## Lint & format

```bash
# lint (auto-fix)
npm run lint

# lint (check only, used in CI)
npm run lint:check

# format (auto-fix)
npm run format

# format (check only, used in CI)
npm run format:check
```

## CI

GitHub Actions runs lint, format check, and tests on every pull request and on pushes to `main`. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Limitations

- **Quote polling doesn't scale.** `pollStocksCron` calls Finnhub's REST `/quote` endpoint once per tracked symbol, every minute, batched 20 at a time. This is fine for a handful of symbols but isn't designed for mass use — it doesn't scale with the number of tracked symbols, and a free-tier Finnhub key has a low rate limit that this will exhaust quickly with more than a few dozen symbols. Finnhub's [websocket trade streaming API](https://finnhub.io/docs/api/websocket-trades) is built for this instead: a single persistent connection pushes trade updates for all subscribed symbols, with no per-symbol polling and no per-request rate limit. Moving `StockService` to consume a stream (subscribing on `startTracking`, persisting incoming trades) would remove the polling bottleneck entirely.
- **No backoff or retry on provider failures.** A failed quote fetch is logged and skipped until the next cron tick; there's no exponential backoff or circuit breaker if Finnhub is degraded.
- **No authentication on the API itself.** Anything that can reach the service can track arbitrary symbols or read prices.
