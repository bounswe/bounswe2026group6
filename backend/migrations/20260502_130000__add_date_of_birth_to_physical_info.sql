ALTER TABLE physical_info
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE INDEX IF NOT EXISTS idx_physical_info_date_of_birth
  ON physical_info (date_of_birth);
