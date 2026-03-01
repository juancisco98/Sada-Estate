-- Migration: Categorize all properties at "Velez Sarsfield 134" as Edificio
-- These are apartments in the same building and should be grouped together.
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard > SQL Editor)

-- Step 1: Create the building record
-- First, get the address and coordinates from one of the existing properties
INSERT INTO buildings (id, address, coordinates, country, currency, user_id)
SELECT
  'bld-velez-sarsfield-134',
  address,
  coordinates,
  country,
  currency,
  user_id
FROM properties
WHERE LOWER(REPLACE(address, 'é', 'e')) LIKE '%velez sarsfield 134%'
   OR LOWER(REPLACE(address, 'é', 'e')) LIKE '%134 velez sarsfield%'
   OR LOWER(address) LIKE '%vélez sársfield 134%'
   OR LOWER(address) LIKE '%134 vélez sársfield%'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Step 2: Update all properties at that address to be edificio type with shared building_id
UPDATE properties
SET
  property_type = 'edificio',
  building_id = 'bld-velez-sarsfield-134',
  unit_label = CASE
    WHEN unit_label IS NOT NULL AND unit_label != '' THEN unit_label
    ELSE 'Dpto. ' || ROW_NUMBER() OVER (
      ORDER BY created_at ASC
    )
  END
WHERE LOWER(REPLACE(address, 'é', 'e')) LIKE '%velez sarsfield 134%'
   OR LOWER(REPLACE(address, 'é', 'e')) LIKE '%134 velez sarsfield%'
   OR LOWER(address) LIKE '%vélez sársfield 134%'
   OR LOWER(address) LIKE '%134 vélez sársfield%';

-- Verify the changes
SELECT id, address, property_type, building_id, unit_label
FROM properties
WHERE building_id = 'bld-velez-sarsfield-134'
ORDER BY unit_label;
