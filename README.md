<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f9e494df-9bc9-4253-8861-31f5087a4bf5

## Run Locally

**Prerequisites:** Node.js 20 or newer


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## MongoDB Atlas and Vercel

The Express API stores users, accounts, transactions, verification codes, and audit logs in MongoDB Atlas through Mongoose. Set `MONGO_URI` in `.env.local` for local development and in the Vercel project environment variables for deployment. Use an Atlas database user with access limited to this application's database.

To provision the first administrator in a new database, set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment before the first API request. The password is hashed before it is stored. These values are only used to create the administrator if that email does not already exist.

Vercel serves the Vite build from `dist` and sends `/api/*` requests to the serverless Express function in `api/index.ts`. The MongoDB connection is cached across warm function invocations; each request waits for the connection before running an API route.

The previous local `bank.sqlite` file is no longer read or modified, and its records are not imported automatically. Export and migrate any data you need before relying on the Atlas database.

## Password recovery email

Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPPORT_EMAIL`, `VITE_SUPPORT_EMAIL`, and `NEXT_PUBLIC_APP_URL` in local and deployment environments. The API key must only be configured as a server-side secret and must never be committed. Password recovery and sign-in verification emails are sent through Resend from the configured `RESEND_FROM_EMAIL` (default: `American Credit Union <notifications@americancreditunionfinancing.app>`). Transactional emails set `SUPPORT_EMAIL` as their reply-to address and include a support footer; the frontend uses `VITE_SUPPORT_EMAIL` for support links. Keep both support variables aligned. Reset links expire after 20 minutes, and sign-in verification codes expire after 10 minutes. The sign-in `POST /api/auth/send-otp` route accepts a signed `tempToken`; the server generates and stores the OTP before sending it, rather than accepting caller-supplied codes. For production delivery, ensure the sender address is authorized for the Resend account.

## Passkey sign-in

Customers can register and manage passkeys from **Profile** and use a saved passkey as an alternative to password and email-code sign-in. Passkeys require a secure browser context (HTTPS in deployment; `localhost` is allowed for local development), and the authenticator must verify the user.

Configure `PASSKEY_ORIGIN` to the exact trusted application origin (for example, `https://american-credit-union-financing.vercel.app`) and `PASSKEY_RP_ID` to that host or a parent domain in local and deployed server environments. Hostnames without a scheme are accepted and normalized to HTTPS in production (HTTP locally). When `PASSKEY_ORIGIN` is unset, production uses Vercel's `VERCEL_PROJECT_PRODUCTION_URL` or `VERCEL_URL`, falling back to the production domain above; local development uses `http://localhost:5173`. Set local values to `http://localhost:5173` and `localhost`. For Vercel previews or additional custom domains, configure their exact origins in `PASSKEY_ORIGIN` as a comma-separated allowlist; set `PASSKEY_RP_ID` if those origins share a parent domain. The request's `Origin` header only selects from this trusted allowlist; arbitrary `Host` headers are never trusted. Each challenge is bound to its selected origin and RP ID.

Registration and sign-in challenges are stored in MongoDB, expire after five minutes, and are consumed once. Credential public keys and signature counters are persisted separately from user profile data. User verification is required, and account activation and enrollment state are checked during passkey use.

## Customer enrollment review

The two-step enrollment process collects a customer profile, a verification reference, and supporting document file details. The browser does not upload document contents; MongoDB stores the verification reference and selected-file metadata (filename, MIME type, and size). Customers should not enter a Social Security number or select an actual identity document, and should contact customer support to complete registration.

New enrollments are saved in MongoDB with an `under_review` status. After submitting, customers are instructed to contact `americancreditunion.financing@gmail.com` to complete registration. Customers can sign in to see the account-under-review screen, but banking APIs and the dashboard remain unavailable until an administrator approves the account. The status screen refreshes periodically so an approval grants access without requiring another sign-in. Administrators can set customer enrollment statuses to `under_review`, `approved`, or `rejected` (a reason is required for rejection) under **Enrollment review**; changes are added to the audit log. Existing accounts without a verification status remain usable for backward compatibility.

## Investment portfolio

The investment catalog uses locally maintained indicative reference prices and daily movements; it does not retrieve live quotes, send brokerage orders, or custody securities. Investment orders atomically debit the member's active checking ledger, create an `Investments` transaction, and update portfolio holdings. Catalog values are not live market data or investment advice.

## Savings accounts and interest

New registrations include a checking account and a 1.50% APY savings account. Provision savings accounts for existing members with:

```sh
npm run migrate:savings-accounts
```

The migration is safe to rerun. Daily interest is calculated in UTC, rounded to cents, compounded into each active USD savings balance, and recorded as a ledger transaction in the same MongoDB transaction. Set a strong `CRON_SECRET` in the deployment environment. Vercel invokes `/api/cron/savings-interest` daily at 00:05 UTC using its scheduled-cron bearer authorization; non-Vercel Node deployments use the in-process `node-cron` scheduler. MongoDB transactions require a replica set.
