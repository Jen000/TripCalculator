# Trip Expense Tracker — Project Overview

A mobile-friendly web app for tracking shared expenses on a trip. Multiple people can join a trip, log what they paid, and the app calculates who owes whom at the end.

---

## What it does

- **Trips** — create and name trips; invite other users by email to share a trip
- **Expenses** — log individual expenses (date, description, who paid, category, cost)
- **Summary** — overview of spending by category with budget tracking
- **Settle Up** — calculates the minimum set of payments to balance everyone's share, records payments as they're made
- **Trip Settings** — manage the people list, expense categories, budgets, and per-category or default split rules
- **User profile** — set your display name, used everywhere names appear

---

## Tech stack

### Frontend
| Library | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool and dev server |
| React Router v6 | Client-side routing |
| MUI (Material UI) v7 | Component library and theming |
| Recharts | Charts on the Summary page |
| AWS Amplify (JS SDK) | Auth token management (Cognito) |
| Framer Motion | Animations |

### Backend
All backend logic runs as individual **AWS Lambda functions** written in plain JavaScript (ESM). There is no server — each API route maps directly to one Lambda.

| AWS Service | Purpose |
|---|---|
| Lambda | API handlers (one function per route) |
| API Gateway (HTTP API) | Routes HTTP requests to Lambdas; validates JWTs |
| Cognito | User authentication (username + password) |
| DynamoDB | All data storage |
| Amplify Hosting | Frontend build and deployment (connected to `main`) |

---

## DynamoDB tables

| Table | Partition key | Sort key | What's stored |
|---|---|---|---|
| `TRIPS_TABLE` | `userSub` | `tripId` | Trip name, createdAt |
| `TRIP_SETTINGS_TABLE` | `tripId` | — | People list, categories, budgets, split rules, members array |
| `TRIP_MEMBERSHIPS_TABLE` | `userSub` | `tripId` | Fast index for shared trip lookups (ownerSub stored here) |
| `EXPENSES_TABLE` | `tripId` | `expenseId` | Date, description, whoPaid, category, costCents |
| `PAYMENTS_TABLE` | `tripId` | `paymentId` | Settle-up payments (fromUser, toUser, amountCents) |
| `USERS_TABLE` | `userSub` | — | User profile (firstName) |

---

## Project structure

```
src/
  pages/          # One file per route
  context/        # React context providers (data fetching + caching)
  api/            # Typed fetch wrappers for each API resource
  components/     # Shared UI components (Layout, AuthGate, skeletons, etc.)
  trip-lambdas/   # All Lambda source code
    trips/        # Trip and settings handlers
    expenses/     # Expense CRUD
    payments/     # Settle-up payment CRUD
    users/        # Profile get/update
    shared/       # db.js, auth.js, response.js — imported by all lambdas
    deploy.sh     # Zips and deploys all lambdas via AWS CLI
```

---

## Authentication

Cognito handles auth. The frontend uses the Amplify SDK (`aws-amplify/auth`) to sign in and attach a JWT Bearer token to every API request. API Gateway validates the JWT before forwarding to Lambda. Inside each Lambda, `getUserSub(event)` extracts the user's Cognito `sub` (unique user ID) from the JWT claims.

---

## Context / caching layer

Data is managed by React context providers rather than a third-party state library:

- **TripContext** — trip list with a 60-second localStorage cache to avoid flicker on reload
- **TripSettingsContext** — per-trip settings (people, categories, budgets, split rules, members); cached in localStorage, always revalidated on mount
- **ExpensesContext / PaymentsContext** — in-memory cache per trip, loaded on demand
- **BudgetContext** — budget summary derived from expenses and settings
- **UserContext** — current user's profile (firstName)

All contexts expose `loadX` functions that hit the API and update both in-memory state and localStorage. The cached value is shown immediately while the fresh fetch runs in the background.

---

## Lambda deployment

Lambdas are deployed manually via the AWS CLI. Each function is zipped with its handler file plus the four shared files (`db.js`, `auth.js`, `response.js`, `package.json`).

```bash
cd src/trip-lambdas
git pull
./deploy.sh
```

`deploy.sh` handles all functions in one pass. There is no CI deployment for lambdas — you run this from CloudShell or any machine with the AWS CLI configured.

### Required Lambda environment variables

| Lambda | Env var | Value |
|---|---|---|
| All trips/expenses/payments lambdas | `TRIP_SETTINGS_TABLE`, `TRIPS_TABLE`, `EXPENSES_TABLE`, `PAYMENTS_TABLE` | DynamoDB table names |
| `trip-get-settings` | `USERS_TABLE` | Users table name — enables live firstName lookup for members |
| `get-trip` | `TRIP_MEMBERSHIPS_TABLE` | Memberships table name — enables fast shared-trip loading |
| `post-trip-member` | `USERS_TABLE`, `TRIP_MEMBERSHIPS_TABLE` | Needed to resolve invitee's name and write membership record |

---

## Key design decisions

**People list vs members list**

`settings.people` (stored in DynamoDB) is the canonical list of names shown in the "Who Paid?" dropdown. It's a plain string array managed manually in Trip Settings. `settings.members` is the list of Cognito users who have been invited — it's used for access control and for enriching display names, but it is not the dropdown source.

When a member's `firstName` is known (looked up live from `USERS_TABLE`), stale email-prefix entries in `settings.people` (e.g. `"hjpanzica"` stored at invite time) are reconciled to the real name (e.g. `"Sam"`) in the API response — without changing the stored value.

**Split rules**

Each trip can define a default split (e.g. Jenna 60%, Sam 40%) and per-category overrides. If no split rule is set, expenses are divided equally across all people. Split rules are stored in `settings.splitRules` and applied at Settle Up calculation time on the frontend.

**Settle Up calculation**

`computeSettleUp` in `SettleUp.tsx` runs entirely on the client. It takes the full expense and payment lists, applies split rules, and uses a greedy algorithm to find the minimum number of transfers. No lambda involved.

---

## Local development

```bash
npm install
npm run dev        # starts Vite dev server at localhost:5173
```

The frontend talks to the real AWS backend (API Gateway + Lambda + DynamoDB). There is no local backend emulator. `src/aws-config.ts` points to the production Cognito pool — use a real account to log in.

To deploy frontend changes: push to `main` — Amplify auto-builds and deploys.
To deploy lambda changes: run `./deploy.sh` from CloudShell or a configured local terminal.
