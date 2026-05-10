const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

// POST /checkin
// Body: { riderAnonId, darkstoreId, platform }
// Rider checks in at a darkstore. Their anon ID is stored — never name or phone.
router.post('/', async (req, res) => {
  const { riderAnonId, darkstoreId, platform } = req.body

  if (!riderAnonId || !darkstoreId || !platform) {
    return res.status(400).json({ 
      success: false, 
      error: 'riderAnonId, darkstoreId, and platform are required' 
    })
  }

  try {
    // Upsert — if this rider already has an active check-in, update it
    // Otherwise create a new one
    const { data, error } = await supabase
      .from('checkins')
      .upsert({
        rider_anon_id: riderAnonId,
        darkstore_id: darkstoreId,
        platform,
        status: 'active',
        last_ping: new Date().toISOString()
      }, {
        onConflict: 'rider_anon_id',
        ignoreDuplicates: false
      })
      .select()

    if (error) throw error

    res.json({ success: true, data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /checkin/ping
// Body: { riderAnonId }
// Rider is still active — update last_ping timestamp
// Called every 2 minutes from the app to keep check-in alive
router.post('/ping', async (req, res) => {
  const { riderAnonId } = req.body

  try {
    const { error } = await supabase
      .from('checkins')
      .update({ last_ping: new Date().toISOString() })
      .eq('rider_anon_id', riderAnonId)
      .eq('status', 'active')

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /checkin/leave
// Body: { riderAnonId }
// Rider manually checks out or closes app
router.post('/leave', async (req, res) => {
  const { riderAnonId } = req.body

  try {
    const { error } = await supabase
      .from('checkins')
      .update({ status: 'inactive' })
      .eq('rider_anon_id', riderAnonId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router