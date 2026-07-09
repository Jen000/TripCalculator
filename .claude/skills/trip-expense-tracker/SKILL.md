## name: trip-expense-tracker
description: Project context for the Trip Expense Tracker app — a mobile-friendly React + AWS Lambda web app for tracking shared trip expenses. Use this skill whenever the user asks about this project, including adding features, fixing bugs, writing new Lambda functions, updating DynamoDB logic, modifying frontend components, working with the context/caching layer, handling authentication, deploying code, or anything else related to this codebase. Trigger even for general questions like "how does auth work here?" or "where should I add this?"

# Trip Expense Tracker — Project Skill

A mobile-friendly web app for tracking shared expenses on a trip. Multiple people join a trip, log what they paid, and the app calculates who owes whom at the end.

---

## Tech Stack

### Frontend

- **React 18 + TypeScript** — UI framework
- **Vite** — build tool and dev server (`npm run dev` → localhost:5173)
- **React Router v6** — client-side routing
- **MUI (Material UI) v7** — component library and theming
- **Recharts** — charts on the Summary page
- **AWS Amplify JS SDK** — Cognito auth token management
- **Framer Motion** — animations

### Backend

No server. Each API route maps to one **AWS Lambda function** (plain JavaScript, ESM).

|Service               |Purpose                                        |
|----------------------|-----------------------------------------------|
|Lambda                |API handlers (one function per route)          |
|API Gateway (HTTP API)|Routes requests to Lambdas; validates JWTs     |
|Cognito               |User auth (username + password)                |
|DynamoDB              |All data storage                               |
|Amplify Hosting       |Frontend builds; auto-deploys on push to `main`|

---

## Project Structure

```
src/
  pages/          # One file per route
  context/        # React context providers (data fetching + caching)
  api/            # Typed fetch wrappers for each API resource
  components/     # Shared UI (Layout, AuthGate, skeletons, etc.)
  trip-lambdas/
    trips/        # Trip and settings handlers
    expenses/     # Expense CRUD
    payments/     # Settle-up payment CRUD
    users/        # Profile get/update
    shared/       # db.js, auth.js, response.js — imported by all lambdas
    deploy.sh     # Zips and deploys all lambdas via AWS CLI
```

---

## DynamoDB Tables

|Table                   |Partition key|Sort key   |What's stored                                               |
|------------------------|-------------|-----------|------------------------------------------------------------|
|`TRIPS_TABLE`           |`userSub`    |`tripId`   |Trip name, createdAt                                        |
|`TRIP_SETTINGS_TABLE`   |`tripId`     |—          |People list, categories, budgets, split rules, members array|
|`TRIP_MEMBERSHIPS_TABLE`|`userSub`    |`tripId`   |Shared trip lookups; ownerSub stored here                   |
|`EXPENSES_TABLE`        |`tripId`     |`expenseId`|Date, description, whoPaid, category, costCents             |
|`PAYMENTS_TABLE`        |`tripId`     |`paymentId`|Settle-up payments (fromUser, toUser, amountCents)          |
|`USERS_TABLE`           |`userSub`    |—          |User profile (firstName)                                    |

**Money is always stored in cents** (integer). Never store floats for currency.

---

## Authentication

- Cognito handles auth. Frontend uses `aws-amplify/auth` to sign in and attach a JWT Bearer token to every request.
- API Gateway validates the JWT before forwarding to Lambda.
- Inside each Lambda, `getUserSub(event)` (from `shared/auth.js`) extracts the Cognito `sub` from JWT claims.
- `src/aws-config.ts` points to the production Cognito pool — there is no local auth emulator; use a real account.

---

## Context / Caching Layer

Data is managed by React context providers (no third-party state library):

|Context              |What it manages                                                      |Cache strategy                           |
|---------------------|---------------------------------------------------------------------|-----------------------------------------|
|`TripContext`        |Trip list                                                            |60s localStorage cache to avoid flicker  |
|`TripSettingsContext`|Per-trip settings (people, categories, budgets, split rules, members)|localStorage; always revalidated on mount|
|`ExpensesContext`    |Expenses per trip                                                    |In-memory, loaded on demand              |
|`PaymentsContext`    |Payments per trip                                                    |In-memory, loaded on demand              |
|`BudgetContext`      |Budget summary                                                       |Derived from expenses + settings         |
|`UserContext`        |Current user's profile (firstName)                                   |In-memory                                |

All contexts expose `loadX` functions that hit the API and update both in-memory state and localStorage. Cached value shows immediately; fresh fetch runs in background.

---

## Key Design Decisions

### People list vs Members list

- `settings.people` — plain string array in DynamoDB; the canonical source for the "Who Paid?" dropdown. Managed manually in Trip Settings.
- `settings.members` — Cognito users who've been invited. Used for access control and display name enrichment, **not** the dropdown source.
- When a member's `firstName` is known (looked up from `USERS_TABLE`), stale email-prefix entries in `settings.people` (e.g. `"hjpanzica"`) are reconciled to the real name (e.g. `"Sam"`) in the API response — without changing the stored value.

### Split Rules

- Each trip can define a default split (e.g. Jenna 60%, Sam 40%) and per-category overrides.
- If no split rule is set, expenses are divided equally across all people.
- Split rules stored in `settings.splitRules`; applied at Settle Up calculation time on the **frontend**.

### Settle Up Calculation

- `computeSettleUp` in `SettleUp.tsx` runs entirely on the client.
- Takes full expense and payment lists, applies split rules, uses a greedy algorithm to find the minimum number of transfers.
- No Lambda involved.

---

## Lambda Deployment

Lambdas are deployed **manually** — no CI pipeline for them.

```bash
cd src/trip-lambdas
git pull
./deploy.sh
```

`deploy.sh` zips each handler with the four shared files (`db.js`, `auth.js`, `response.js`, `package.json`) and deploys via AWS CLI. Run from CloudShell or any machine with the AWS CLI configured.

### Required Lambda Environment Variables

|Lambda                             |Env var(s)                                                              |
|-----------------------------------|------------------------------------------------------------------------|
|All trips/expenses/payments lambdas|`TRIP_SETTINGS_TABLE`, `TRIPS_TABLE`, `EXPENSES_TABLE`, `PAYMENTS_TABLE`|
|`trip-get-settings`                |`USERS_TABLE`                                                           |
|`get-trip`                         |`TRIP_MEMBERSHIPS_TABLE`                                                |
|`post-trip-member`                 |`USERS_TABLE`, `TRIP_MEMBERSHIPS_TABLE`                                 |

---

## Frontend Deployment

Push to `main` — Amplify auto-builds and deploys. No manual step needed.

---

## Local Development

```bash
npm install
npm run dev   # Vite dev server at localhost:5173
```

The frontend talks to the **real** AWS backend. There is no local backend emulator.

---

## Tips for Working in This Codebase

- When writing a new Lambda, model it after existing handlers in `trips/` or `expenses/`. Always import shared helpers from `../shared/`.
- New API routes need a corresponding typed fetch wrapper in `src/api/`.
- New data that needs to be available app-wide should get its own context in `src/context/`, following the existing `loadX` + localStorage pattern.
- When adding a new DynamoDB attribute, make sure the relevant Lambda env vars are set and document the table change here.
- Always use `costCents` / `amountCents` (integers) for money — never floats.
