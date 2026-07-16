# Daily Reset Beta 1.0 Deployment

## Local release preflight

Run from the project root:

```powershell
node scripts/release-preflight.mjs
npm run build
```

Run both in one command:

```powershell
node scripts/release-preflight.mjs --build
```

## Vercel production variables

Configure these for the Production environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

Do not expose `OPENAI_API_KEY` through a `NEXT_PUBLIC_` variable.

## Supabase Auth

In Supabase Authentication URL Configuration:

1. Set the Site URL to the production Vercel or custom domain.
2. Add the production `/auth/callback` URL to allowed redirects.
3. Keep localhost callback entries for local development.

## Release sequence

```powershell
node scripts/release-preflight.mjs --build
git add .
git commit -m "Daily Reset Beta 1.0"
git push
```

After Vercel deploys:

1. Sign in on the production HTTPS URL.
2. Open `release.readiness` and run the audit.
3. Open `deployment.control` and verify `PRODUCTION ONLINE`.
4. Test the installed PWA on a phone.
5. Download a final JSON backup from `data.safety`.
6. Save the release and deployment audit reports privately.

## Public-safe uptime endpoint

`/api/status` returns release and deployment metadata only. It does not expose database credentials, auth tokens, environment values, or user data.
