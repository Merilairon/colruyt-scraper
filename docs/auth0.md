# Auth0 User Support

This document describes the Auth0 integration and the user-specific endpoints added to the `colruyt-scraper` backend.

## Overview

The backend now supports authenticated users via Auth0. A valid Auth0 access token (JWT) is required for all `/api/me` endpoints. The backend validates the JWT, resolves the caller to a local `User` record, and stores per-user data in `UserData`.

The local user profile (`displayName`, `locale`, `email`) is stored in PostgreSQL. Email and password changes are delegated to the Auth0 Management API because credentials must remain authoritative in Auth0.

## Auth0 Configuration

### Required Auth0 entities

1. **Auth0 Application** (e.g. a Single Page Application) used by the frontend.
   - Audience must be set to the API identifier configured below.
   - The access token must include the `email` claim.

2. **Auth0 API** (Resource Server) that represents this backend.
   - Identifier (audience) becomes `AUTH0_AUDIENCE`.
   - Signing algorithm: RS256.

3. **Auth0 Machine-to-Machine (M2M) application** authorized to call the **Auth0 Management API**.
   - Client ID and Client Secret become `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET`.
   - Grant: `read:users update:users` (only `update:users` is strictly required for email/password updates).

### Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AUTH0_DOMAIN` | yes | — | Auth0 tenant domain, e.g. `your-tenant.auth0.com` |
| `AUTH0_AUDIENCE` | yes | — | Identifier of the Auth0 API used by the backend |
| `AUTH0_ISSUER_BASE_URL` | no | `https://${AUTH0_DOMAIN}` | JWT issuer URL |
| `AUTH0_CLIENT_ID` | yes for profile updates | — | M2M application Client ID |
| `AUTH0_CLIENT_SECRET` | yes for profile updates | — | M2M application Client Secret |
| `AUTH0_MANAGEMENT_AUDIENCE` | no | `https://${AUTH0_DOMAIN}/api/v2/` | Auth0 Management API audience |

## Authentication flow

```
Frontend
   │
   ▼
Auth0 ── login / register user
   │
   ▼
Auth0 access token (JWT) returned to frontend
   │
   ▼
Frontend calls /api/me with Authorization: Bearer <token>
   │
   ▼
Backend validates JWT with express-oauth2-jwt-bearer
   │
   ▼
Backend loads or creates local User + UserData records
   │
   ▼
Endpoint handler executes
```

The JWT must include the `sub` claim (Auth0 user ID). The `email` claim is also expected, so the backend can initialise the local `email` field.

## Endpoints

All endpoints are under `/api/me` and require a valid `Authorization: Bearer <jwt>` header.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/me` | Get current user profile and all stored user data |
| `PATCH` | `/api/me` | Update `displayName`/`locale` locally; update `email`/`password` in Auth0 |
| `GET` | `/api/me/shopping-list` | Get shopping list |
| `PUT` | `/api/me/shopping-list` | Replace shopping list |
| `GET` | `/api/me/favourites` | Get favourite product IDs |
| `PUT` | `/api/me/favourites` | Replace favourites |
| `GET` | `/api/me/filters` | Get interesting-changes filters |
| `PUT` | `/api/me/filters` | Replace filters |

Detailed OpenAPI specs are available in the Swagger UI at `/api-docs` and in `src/docs/users.yaml`.

## Request / response examples

### Get current user

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/me
```

```json
{
  "id": 1,
  "auth0Id": "auth0|abc123",
  "email": "user@example.com",
  "displayName": "Jane",
  "locale": "nl",
  "shoppingList": [
    { "productId": "123456", "quantity": 2 }
  ],
  "favourites": ["123456", "789012"],
  "filters": [
    { "filterName": "Big drops", "fromPercentage": -100, "toPercentage": -50 }
  ]
}
```

### Update profile

```bash
curl -X PATCH -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Jane","locale":"nl","email":"new@example.com"}' \
  http://localhost:3000/api/me
```

When `email` or `password` is provided, the backend calls the Auth0 Management API. The local `email` value is updated only after the Management API call succeeds.

### Replace shopping list

```bash
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '[{"productId":"123456","quantity":2},{"productId":"123456","quantity":3}]' \
  http://localhost:3000/api/me/shopping-list
```

Response:

```json
[{ "productId": "123456", "quantity": 5 }]
```

Duplicate product IDs are merged by summing quantities.

## Data validation

### Shopping list

- Must be an array.
- Each item must have `productId` (string) and `quantity` (integer, `>= 1`).
- Duplicate `productId` values are combined.

### Favourites

- Must be an array of unique strings representing product IDs.

### Filters

- Must be an array.
- Each filter must have a `filterName`.
- A filter can be either:
  - **percentage-based**: `fromPercentage` and `toPercentage`, with `fromPercentage <= toPercentage`; or
  - **category-based**: `category` string.
- A single filter cannot combine `category` with percentage fields.

## Database

Run the migration to create the required tables:

```bash
psql $PG_HOST -f migrations/001_add_users_and_user_data.sql
```

Or apply the SQL manually against your PostgreSQL database.

## Error handling

| Scenario | Response |
| --- | --- |
| Missing or invalid token | `401 Unauthorized` |
| Invalid user data shape | `400 Bad Request` with a short message |
| Auth0 Management API failure | Propagated as `500` with the Auth0 error message |
| Unexpected server error | `500 Internal Server Error` |

## Testing

User-route tests mock the JWT middleware and the Auth0 Management API:

```bash
npm test -- src/__tests__/users.route.test.ts
```

The full suite can be run with:

```bash
npm test
```

## Notes and constraints

- The backend does **not** implement Auth0 login/register UI; that happens in the frontend.
- No localStorage import endpoint exists yet because there are no existing users with data to migrate.
- The Auth0 Management API client is initialised at module load with the environment variables above. If the variables are missing, calls to update email/password will fail at request time.
