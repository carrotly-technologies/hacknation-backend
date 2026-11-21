# hacknation-backend

NestJS API for HackNation. The React frontend lives in
[hacknation-frontend](https://github.com/carrotly-technologies/hacknation-frontend).

## Setup

```bash
npm install
cp .env.example .env   # optional, defaults work out of the box
```

| Variable       | Default                 | Description                    |
| -------------- | ----------------------- | ------------------------------ |
| `PORT`         | `3000`                  | Port the API listens on        |
| `FRONTEND_URL` | `http://localhost:5173` | Origin allowed by CORS         |

## Run

```bash
npm run start:dev    # watch mode on http://localhost:3000
npm run start        # single run
npm run build && npm run start:prod
```

All routes are under the `/api` prefix:

```bash
curl localhost:3000/api/health   # {"status":"ok"}
```

## Quality

```bash
npm run lint       # oxlint (type-aware)
npm run format     # prettier
npm test           # unit tests (Vitest)
npm run test:e2e   # e2e tests (Vitest + supertest)
npm run test:cov
```

## Deploy

Production runs on Coolify (project **Hackathons**, environment `production`)
as the `hacknation-backend` application, built from this repo's `Dockerfile`:

- URL: <https://api.hacknation.rabbithole.carrotly.tech> (health: `/api/health`)
- Every push to `main` triggers a new deploy (GitHub App source, auto-deploy on).
- Env: `PORT=3000`, `FRONTEND_URL=https://hacknation.rabbithole.carrotly.tech`.
  Change them in the Coolify app settings and redeploy.

Build and run the image locally:

```bash
docker build -t hacknation-backend .
docker run --rm -p 3000:3000 -e FRONTEND_URL=http://localhost:5173 hacknation-backend
curl localhost:3000/api/health   # {"status":"ok"}
```

The container listens on `0.0.0.0:$PORT` and has a Docker `HEALTHCHECK` on
`/api/health`.
