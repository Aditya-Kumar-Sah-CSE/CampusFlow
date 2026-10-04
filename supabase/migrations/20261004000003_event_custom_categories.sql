-- Add performance_categories and participation_modes columns to events table
-- These allow admins to configure custom categories per event instead of hardcoded defaults

ALTER TABLE events ADD COLUMN IF NOT EXISTS performance_categories TEXT[] DEFAULT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS participation_modes TEXT[] DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN events.performance_categories IS 'Admin-configured performance category options for Google Form (e.g. Singing, Dance, Quiz). NULL = use defaults.';
COMMENT ON COLUMN events.participation_modes IS 'Admin-configured participation mode options for Google Form (e.g. Solo, Duet, Group). NULL = use defaults.';
