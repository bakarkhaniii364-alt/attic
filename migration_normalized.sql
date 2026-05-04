-- ============================================================
-- MIGRATION: Database Normalization (Phase 1)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    type TEXT DEFAULT 'text', -- 'text', 'voice', 'image', 'system'
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- For reactions, replies, group info
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create shared_assets table (Doodles, Scrapbook Images)
CREATE TABLE IF NOT EXISTS shared_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id),
    type TEXT DEFAULT 'image', -- 'doodle', 'scrapbook', 'background'
    url TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- For labels, dimensions, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_assets ENABLE ROW LEVEL SECURITY;

-- 4. Create B-Tree Indices for performance (As per Pro-Tip #1)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_assets_room_id ON shared_assets(room_id);

-- 5. RLS Policies
-- Users can only access data belonging to their room
DROP POLICY IF EXISTS "access_room_chat" ON chat_messages;
CREATE POLICY "access_room_chat" ON chat_messages
    FOR ALL USING (
        room_id IN (
            SELECT id FROM rooms 
            WHERE (creator_id = auth.uid() OR partner_id = auth.uid()) AND is_active = true
        )
    );

DROP POLICY IF EXISTS "access_room_assets" ON shared_assets;
CREATE POLICY "access_room_assets" ON shared_assets
    FOR ALL USING (
        room_id IN (
            SELECT id FROM rooms 
            WHERE (creator_id = auth.uid() OR partner_id = auth.uid()) AND is_active = true
        )
    );

-- 6. Add to Realtime Publication (As per Pro-Tip #4)
-- Note: If you get an error here saying it's already a member, it's safe to ignore.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'shared_assets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE shared_assets;
    END IF;
END $$;

-- ============================================================
-- NOTE: SUPABASE STORAGE BUCKETS
-- You must manually create the following buckets in the dashboard:
-- 1. 'doodles' (Public: true)
-- 2. 'scrapbook' (Public: true)
-- 3. 'voice_notes' (Public: true)
-- ============================================================

-- ============================================================
-- PRIVACY & COMPLIANCE: Right to be Forgotten
-- ============================================================

CREATE OR REPLACE FUNCTION delete_my_room()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  -- Find the room the user belongs to
  SELECT * INTO r FROM public.rooms 
  WHERE (creator_id = auth.uid() OR partner_id = auth.uid()) AND is_active = true
  LIMIT 1;

  IF r.id IS NOT NULL THEN
    IF r.partner_id IS NOT NULL THEN
      -- Paired room: unpair instead of deleting
      IF r.creator_id = auth.uid() THEN
        UPDATE public.rooms SET creator_id = r.partner_id, partner_id = NULL WHERE id = r.id;
      ELSE
        UPDATE public.rooms SET partner_id = NULL WHERE id = r.id;
      END IF;
    ELSE
      -- Solo room: hard delete
      DELETE FROM public.rooms WHERE id = r.id;
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- MIGRATION: Database Normalization (Phase 2)
-- Adding specialized tables for stats and metadata
-- ============================================================

-- 1. Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    streaks JSONB DEFAULT '{"count": 0, "lastActiveDate": null}'::jsonb,
    game_scores JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create room_metadata table
CREATE TABLE IF NOT EXISTS room_metadata (
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE PRIMARY KEY,
    anniversary TIMESTAMPTZ,
    pet_data JSONB DEFAULT '{"name": "pet", "skin": "/assets/cat_1_9", "happy": 60}'::jsonb,
    nicknames JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{"bgPattern": "grid"}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_metadata ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "access_my_stats" ON user_stats;
CREATE POLICY "access_my_stats" ON user_stats
    FOR ALL USING (
        user_id = auth.uid() OR 
        room_id IN (
            SELECT id FROM rooms 
            WHERE (creator_id = auth.uid() OR partner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "access_room_metadata" ON room_metadata;
CREATE POLICY "access_room_metadata" ON room_metadata
    FOR ALL USING (
        room_id IN (
            SELECT id FROM rooms 
            WHERE (creator_id = auth.uid() OR partner_id = auth.uid())
        )
    );

-- 5. Add to Realtime Publication
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'user_stats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE user_stats;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'room_metadata'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE room_metadata;
    END IF;
END $$;