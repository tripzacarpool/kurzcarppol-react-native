/*
  # Add Location and IP Tracking to Profiles

  1. Changes to `profiles` table
    - Add `last_latitude` (numeric, nullable) - User's last known latitude
    - Add `last_longitude` (numeric, nullable) - User's last known longitude
    - Add `last_location_update` (timestamptz, nullable) - When location was last updated
    - Add `city` (text, nullable) - User's current city
    - Add `country` (text, nullable) - User's current country
    - Add `ip_address` (text, nullable) - User's IP address
    - Add `last_ip_update` (timestamptz, nullable) - When IP was last updated

  2. Indexes
    - Add index on city for faster location-based queries
    - Add index on country for analytics

  Note: No RLS policy changes needed as existing policies already cover these columns
*/

-- Add location and IP columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_latitude'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_latitude numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_longitude'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_longitude numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_location_update'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_location_update timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'city'
  ) THEN
    ALTER TABLE profiles ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'country'
  ) THEN
    ALTER TABLE profiles ADD COLUMN country text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ip_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_ip_update'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_ip_update timestamptz;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);
