# Friends Included finance system

Day 4 homework application. Supabase is the source of truth; Google Sheets is a view-only synchronized copy.

## Setup

1. Copy `.env.example` to `.env.local` and fill it locally. Do not share or commit this file.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create a Google Sheet with tabs named `Sales` and `Expenses`, share it with the service-account email, and add the spreadsheet ID to `.env.local`.
4. Create a Telegram bot. Store its token only in `.env.local` and Vercel environment variables.
5. Run `pnpm dev`. After deployment, set Telegram's webhook to `https://YOUR-VERCEL-URL/api/telegram` with a secret token.

## Security rules

- No API keys are exposed to browser code: no `NEXT_PUBLIC_` variables are used for secrets.
- The service-role key, Google private key, Telegram token, and webhook secret are server-only.
- `.env.local`, `.pem`, and service-account JSON files are ignored by Git.
