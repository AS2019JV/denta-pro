# Database Setup Instructions

## Auto-Create Profile Trigger

To prevent the `PGRST116` error when users sign up, you need to run the SQL migration that automatically creates a profile record when a new user is created in Supabase Auth.

### Steps to Apply the Migration:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `supabase/migrations/20231123_auto_create_profile.sql`
6. Click **Run** to execute the migration

### What This Does:

- Creates a PostgreSQL function `handle_new_user()` that automatically inserts a profile record
- Creates a trigger `on_auth_user_created` that fires whenever a new user signs up
- The profile is created with:
  - User's ID from auth.users
  - Full name from signup metadata (or email username as fallback)
  - Email address
  - Role from signup metadata (defaults to 'doctor')
  - Avatar URL from OAuth providers (if using Google sign-in)

### Google OAuth Setup (Optional)

To enable Google OAuth sign-in:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and click to configure
4. Follow the instructions to:
   - Create a Google Cloud Project
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs (Supabase will provide these)
5. Copy your Google Client ID and Client Secret into Supabase
6. Enable the Google provider

### Testing

After applying the migration:

1. Try creating a new account via the signup page
2. The profile should be automatically created
3. No more `PGRST116` errors in the console
4. User data should load correctly after login

### For Existing Users

If you have existing users (like `maria.gonzalez@dentapro.com`) who don't have profiles yet, you can either:

**Option A: Manual Insert**
```sql
INSERT INTO public.profiles (id, full_name, email, role)
VALUES (
  'user-uuid-from-auth-users-table',
  'Maria Gonzalez',
  'maria.gonzalez@dentapro.com',
  'doctor'
);
```

**Option B: Bulk Create for All Existing Users**
```sql
INSERT INTO public.profiles (id, full_name, email, role)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  email,
  COALESCE(raw_user_meta_data->>'role', 'doctor')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
```
