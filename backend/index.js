require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const supabase = require('./lib/supabase')

const app = express()
const server = http.createServer(app)

// Socket.io — handles real-time rider location updates
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

app.use(cors())
app.use(express.json())

// ── ROUTES ──
app.use('/darkstores', require('./routes/darkstores'))
app.use('/checkin',    require('./routes/checkin'))
app.use('/earnings',   require('./routes/earnings'))

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }))

// ── SOCKET.IO — REAL-TIME GEOLOCATION ──
// This is the engine of the scarcity map.
// When a rider's location updates, all other connected riders get updated counts.

io.on('connection', (socket) => {
  console.log('Rider connected:', socket.id)

  // Rider sends their location every 60 seconds while app is open
  // Data: { riderAnonId, darkstoreId, platform, lat, lng }
  socket.on('rider:location', async (data) => {
    const { riderAnonId, darkstoreId, platform } = data

    // Update last_ping in database
    await supabase
      .from('checkins')
      .update({ last_ping: new Date().toISOString() })
      .eq('rider_anon_id', riderAnonId)
      .eq('status', 'active')

    // Recompute scarcity for affected darkstore
    const { data: counts } = await supabase
      .from('checkins')
      .select('darkstore_id, count', { count: 'exact' })
      .eq('darkstore_id', darkstoreId)
      .eq('status', 'active')
      .gte('last_ping', new Date(Date.now() - 10 * 60 * 1000).toISOString())

    const activeRiders = counts?.length || 0
    const BASELINE_RIDERS = 8
    const scarcityScore = Math.max(0, BASELINE_RIDERS - activeRiders)

    // ── CONTROLLED RELEASE ALGORITHM ──
    // Only notify riders if there's genuine scarcity
    // and only notify as many riders as the gap requires
    if (scarcityScore >= 3) {
      const ridersNeeded = scarcityScore

      // Broadcast scarcity to ALL connected riders
      // The frontend filters based on distance — only nearby riders act on it
      io.emit('scarcity:update', {
        darkstoreId,
        activeRiders,
        scarcityScore,
        ridersNeeded,
        timestamp: new Date().toISOString()
      })
    }
  })

  // Rider opens the app — subscribe to scarcity updates for their area
  socket.on('rider:subscribe', (data) => {
    const { city } = data
    socket.join(`city:${city}`) // group riders by city
    console.log(`Rider ${socket.id} subscribed to ${city}`)
  })

  socket.on('disconnect', () => {
    console.log('Rider disconnected:', socket.id)
  })
})

// ── AUTO-EXPIRE stale check-ins every 5 minutes ──
// If a rider hasn't pinged in 10 minutes, mark them inactive
setInterval(async () => {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  await supabase
    .from('checkins')
    .update({ status: 'inactive' })
    .eq('status', 'active')
    .lt('last_ping', cutoff)
}, 5 * 60 * 1000)

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Kamai backend running on port ${PORT}`)
})