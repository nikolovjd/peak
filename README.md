# Peak

A [NestJS](https://nestjs.com) backend service.

## Project setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in the required values (a local Postgres instance is expected at `DATABASE_URL`).

```bash
cp .env.example .env
```

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

This starts Postgres, runs database migrations, and starts the app, as defined in [docker-compose.yml](docker-compose.yml).

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

## License

UNLICENSED
