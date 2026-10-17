-- Remove birth dates and their legacy correction audit after a database backup.
-- Deploy DOB-free application code before applying this migration.
DROP TABLE IF EXISTS user_dob_audit;
ALTER TABLE users DROP COLUMN date_of_birth;
ALTER TABLE user_stubs DROP COLUMN date_of_birth;
