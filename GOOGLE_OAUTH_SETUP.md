# Google OAuth Setup Guide

This guide will help you set up Google OAuth for your ride-sharing app.

## Step 1: Enable Google Auth in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** > **Providers**
4. Find **Google** in the list and click to configure it

## Step 2: Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Go to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Configure the OAuth consent screen if you haven't already
6. Choose **Web application** as the application type
7. Add the following authorized redirect URIs:
   - `https://tjrgjrhzfbufjetquxll.supabase.co/auth/v1/callback`
   - `http://localhost:8081` (for local development)

## Step 3: Configure Supabase

1. Copy the **Client ID** and **Client Secret** from Google Cloud Console
2. Go back to Supabase Dashboard > Authentication > Providers > Google
3. Paste the **Client ID** and **Client Secret**
4. Add your redirect URLs:
   - For production: Your production URL + `/(tabs)`
   - For development: `http://localhost:8081/(tabs)`
5. Click **Save**

## Step 4: Configure Redirect URLs

The app is already configured to handle redirects. When users sign in with Google:
- Web: Redirects to your domain + `/(tabs)`
- Mobile: Redirects to `myapp://(tabs)`

## Testing

1. Start your app
2. Navigate to the login or signup screen
3. Click the "Sign in with Google" or "Sign up with Google" button
4. Complete the Google OAuth flow
5. You should be redirected back to the app and automatically signed in

## Troubleshooting

### "OAuth provider not enabled"
Make sure you've enabled Google as a provider in your Supabase dashboard.

### "Redirect URI mismatch"
Ensure the redirect URI in your Google Cloud Console matches the one shown in your Supabase dashboard.

### "Invalid client ID"
Double-check that you've correctly copied the Client ID and Client Secret from Google Cloud Console.

## Security Notes

- Never commit your Google OAuth credentials to version control
- Use environment variables for sensitive data
- Enable email verification for additional security
- Consider implementing rate limiting for auth endpoints
