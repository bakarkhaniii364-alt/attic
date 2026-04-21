import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utywhgnxqanetqwmhhie.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0eXdoZ254cWFuZXRxd21oaGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTEzNjgsImV4cCI6MjA5MjM2NzM2OH0.CdTOhJXkR_PKjxoICBeyP8SCtnB2mvCbg3RgIqkh_pk';

export const supabase = createClient(supabaseUrl, supabaseKey);
