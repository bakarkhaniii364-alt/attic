-- Migration to enforce that E2EE key and salt inside app_state JSONB are immutable after initial insert.
CREATE OR REPLACE FUNCTION enforce_immutable_e2ee_fields()
RETURNS TRIGGER AS $$
DECLARE
  old_profiles JSONB;
  new_profiles JSONB;
  user_id_key TEXT;
  old_user_profile JSONB;
  new_user_profile JSONB;
BEGIN
  -- Extract room_profiles from old and new state
  old_profiles := COALESCE(OLD.state->'room_profiles', '{}'::jsonb);
  new_profiles := COALESCE(NEW.state->'room_profiles', '{}'::jsonb);

  -- Loop through users in new_profiles
  FOR user_id_key IN SELECT jsonb_object_keys(new_profiles) LOOP
    old_user_profile := old_profiles->user_id_key;
    new_user_profile := new_profiles->user_id_key;

    IF old_user_profile IS NOT NULL THEN
      -- If old user profile had encrypted_private_key, ensure it doesn't change
      IF (old_user_profile->'encrypted_private_key') IS NOT NULL AND 
         (new_user_profile->'encrypted_private_key') IS DISTINCT FROM (old_user_profile->'encrypted_private_key') THEN
        RAISE EXCEPTION 'encrypted_private_key is immutable after initial setup';
      END IF;

      -- If old user profile had e2ee_salt, ensure it doesn't change
      IF (old_user_profile->'e2ee_salt') IS NOT NULL AND 
         (new_user_profile->'e2ee_salt') IS DISTINCT FROM (old_user_profile->'e2ee_salt') THEN
        RAISE EXCEPTION 'e2ee_salt is immutable after initial setup';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if trigger already exists, if not, create it
DROP TRIGGER IF EXISTS trg_enforce_immutable_e2ee_fields ON app_state;

CREATE TRIGGER trg_enforce_immutable_e2ee_fields
BEFORE UPDATE ON app_state
FOR EACH ROW
EXECUTE FUNCTION enforce_immutable_e2ee_fields();
