// public/supabase-config.js
// SAFE TO EXPOSE — this is the public "anon" key, not the service-role key.
// It only allows what Row Level Security policies permit (read-only on
// shared tables; auth sign-in/sign-up). All writes go through /api routes.

window.SUPABASE_URL = 'https://rbtilmwrtwvielegrfbh.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJidGlsbXdydHd2aWVsZWdyZmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTk5NzAsImV4cCI6MjA5Nzg3NTk3MH0.W3TxA1Uktvuf0OXd87VbMq5_v9XcJUoSZK1uRmf_B-g';
