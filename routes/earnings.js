const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

// POST /earnings
// Save a week's earnings entry for a rider
router.post('/', async (req, res) => {
  const {
    riderAnonId, platform, weekStart, gross, orders,
    hours, bonus, appFee, fuel, tdsApplied, commissionPct
  } = req.body

  try {
    const { data, error } = await supabase
      .from('earnings')
      .insert({
        rider_anon_id: riderAnonId,
        platform,
        week_start: weekStart,
        gross,
        orders,
        hours,
        bonus: bonus || 0,
        app_fee: appFee || 0,
        fuel: fuel || 0,
        tds_applied: tdsApplied || false,
        commission_pct: commissionPct
      })
      .select()

    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /earnings/:riderAnonId
// Get last 100 earnings entries for a rider
router.get('/:riderAnonId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('earnings')
      .select('*')
      .eq('rider_anon_id', req.params.riderAnonId)
      .order('week_start', { ascending: false })
      .limit(100)

    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router