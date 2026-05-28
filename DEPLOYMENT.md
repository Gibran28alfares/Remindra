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
4. Deploy.

## 3. Smartphone Use

Open the Vercel production URL from the smartphone browser and login with the Supabase Auth user.

## Notes

- Parser V2 remains deterministic and non-AI for v1.
- WhatsApp is copy-message only; auto-send is roadmap.
- SQLite is no longer used for cloud v1.
