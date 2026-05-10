const { createClient } = require('@supabase/supabase-js')

// Only load .env file locally — on Render, variables are injected by the platform
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

module.exports = supabase