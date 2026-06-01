# REMINDRA Cloud Deployment

## 1. Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Create the operator user in Supabase Auth using email/password.
4. Copy the project URL and anon key.

## 2. Vercel

1. Push this project to a Git repository.
2. Import the repository in Vercel.
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` for WhatsApp webhook status updates
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_GRAPH_API_VERSION`
   - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Deploy.
5. Use the generated Vercel production URL as the REMINDRA application URL.

## 3. WhatsApp Cloud API

1. Configure the Meta WhatsApp webhook URL to `/api/whatsapp/webhook` on the Vercel production domain.
2. Use the same verify token as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
3. Subscribe the app to message status updates so REMINDRA can update `sent`, `delivered`, `read`, and `failed`.

## 4. Smartphone Use

Open the Vercel production URL from the smartphone browser and login with the Supabase Auth user.

## Notes

- Parser V2 remains deterministic and non-AI for v1.
- WhatsApp supports manual copy/open fallback and Cloud API send when its environment variables are configured.
- SQLite is no longer used for cloud v1.
- Vercel is the official deployment target for REMINDRA cloud v1.
