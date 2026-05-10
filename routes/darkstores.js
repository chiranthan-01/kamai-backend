const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

// GET /darkstores?lat=12.93&lng=77.62&radius=5000
// Returns all darkstores within radius (metres) of rider's location
// with live rider count and scarcity score
router.get('/', async (req, res) => {
  const { lat, lng, radius = 5000 } = req.query

  try {
    // Get all darkstores with their active rider counts
    // Active = checked in within the last 10 minutes
    const { data: darkstores, error } = await supabase
      .from('darkstores')
      .select(`
        id, name, platform, area, address,
        checkins(count)
      `)
      .filter('checkins.status', 'eq', 'active')
      .filter('checkins.last_ping', 'gte', new Date(Date.now() - 10 * 60 * 1000).toISOString())

    if (error) throw error

    // Calculate scarcity score for each darkstore
    // Scarcity score = orders_per_rider proxy
    // We don't have live order data, so we use rider count as inverse signal
    // Low riders = high scarcity = high opportunity
    const BASELINE_RIDERS = 8 // below this, it's considered scarce

    const enriched = darkstores.map(store => {
      const activeRiders = store.checkins?.[0]?.count || 0
      const scarcityScore = Math.max(0, BASELINE_RIDERS - activeRiders)
      const opportunity = scarcityScore >= 5 ? 'hot' 
                        : scarcityScore >= 2 ? 'warm' 
                        : 'balanced'

      return {
        ...store,
        activeRiders,
        scarcityScore,
        opportunity,
        checkins: undefined // remove raw count from response
      }
    })

    // Sort by scarcity descending — most opportunity first
    enriched.sort((a, b) => b.scarcityScore - a.scarcityScore)

    res.json({ success: true, data: enriched })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router