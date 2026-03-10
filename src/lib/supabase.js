import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://yskvxkhefpltgmyajqmt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlza3Z4a2hlZnBsdGdteWFqcW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjA4MDQsImV4cCI6MjA4ODYzNjgwNH0.GwZAUqQIOE0e9YxS7zko1h0cVvnLamiZtWTyzoqtseY'
)
