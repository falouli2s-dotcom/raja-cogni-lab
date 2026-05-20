import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

// One-off demo seeding endpoint. Safe to re-run — uses upsert semantics where possible.
// Protected by SEED_TOKEN header check.

type Accent = {
  email: string
  password: string
  full_name: string
  role: 'joueur' | 'coach' | 'admin'
  birth_date?: string
  position?: 'Attaquant' | 'Milieu' | 'Défenseur' | 'Gardien'
  category?: 'U13' | 'U14' | 'U15' | 'U16' | 'U17' | 'U18' | 'U21'
}

const ACCOUNTS: Accent[] = [
  { email: 'joueur@gmail.com', password: 'joueur', full_name: 'Reda AKHETAB', role: 'joueur', birth_date: '2008-04-30', position: 'Attaquant', category: 'U18' },
  { email: 'joueur2@gmail.com', password: 'joueur2', full_name: 'NOKRY Taha', role: 'joueur', birth_date: '2008-05-06', position: 'Attaquant', category: 'U18' },
  { email: 'joueur3@gmail.com', password: 'joueur3', full_name: 'CHBILI Ismail', role: 'joueur', birth_date: '2009-05-01', position: 'Attaquant', category: 'U18' },
  { email: 'coach@gmail.com', password: 'coach', full_name: 'Mohammed BENALI', role: 'coach' },
  { email: 'admin@gmail.com', password: 'admin', full_name: 'Admin CogniRaja', role: 'admin' },
]

// Target dimension scores per player per session (10 sessions, weeks W-10..W-1)
// Order: [sgs, tr, inhib, wm, flex, vvp]
const REDA = [
  [54, 58, 68, 44, 50, 55],
  [57, 61, 70, 47, 53, 57],
  [60, 63, 72, 50, 55, 60],
  [58, 60, 71, 48, 52, 58],
  [62, 64, 73, 53, 57, 61],
  [65, 67, 75, 56, 60, 64],
  [68, 69, 77, 59, 63, 66],
  [70, 71, 78, 62, 65, 68],
  [73, 73, 80, 65, 68, 71],
  [76, 75, 82, 68, 71, 74],
]
const TAHA = [
  [46, 48, 47, 45, 46, 48],
  [50, 51, 51, 49, 50, 51],
  [54, 55, 54, 53, 54, 55],
  [51, 52, 52, 50, 51, 52],
  [56, 57, 57, 55, 56, 57],
  [61, 62, 61, 60, 61, 62],
  [65, 65, 65, 64, 65, 65],
  [68, 68, 68, 67, 68, 68],
  [72, 71, 72, 71, 72, 71],
  [76, 74, 75, 75, 76, 74],
]
const ISMAIL = [
  [58, 62, 59, 55, 40, 74],
  [60, 63, 61, 57, 43, 76],
  [63, 65, 63, 59, 46, 78],
  [61, 63, 62, 57, 44, 77],
  [65, 67, 65, 61, 49, 79],
  [68, 69, 67, 64, 53, 81],
  [71, 71, 70, 67, 57, 83],
  [73, 73, 72, 69, 61, 84],
  [76, 75, 74, 71, 65, 86],
  [79, 77, 76, 73, 69, 88],
]

// Exercise IDs from the catalog matching each player's weakest dimension
const EXERCISES = {
  reda: [ // working memory
    '8a13ea5a-c139-4ca0-a385-92d7c78bbb5f',
    'e6e5e5a1-8604-43ad-a0d3-be5fe2485c10',
    'bc8ab0ea-728a-433e-adf8-e84b37ed5081',
    '1ec1197f-9196-4ef4-b2a1-4d0269d61268',
  ],
  taha: [ // mixed/general
    '656b10fa-2b3e-4fc2-b2d6-49e3552feb6d',
    'c51d254d-9fff-45e9-a2d6-a2b104f445b5',
    'a960e1d7-bcde-44b2-9859-a6f4c30e068c',
    'b7a3c5be-9226-4500-b0c6-3a0d9946d569',
  ],
  ismail: [ // flexibility
    '2e17085a-7d34-4048-8ded-675c87ccded1',
    '5ee9a164-2c50-4b98-b808-89c3c133e0a3',
    '69aa2eed-ce18-4fe3-83e2-44e1d59f13ea',
    '5ee9a164-2c50-4b98-b808-89c3c133e0a3',
  ],
}

// Inverse of the client-side SGS engine: given target dimension scores 0-100
// produce raw metric values that yield those scores in src/lib/sgs-engine.ts.
function metricsForTargets(tr: number, inhib: number, wm: number, flex: number, vvp: number) {
  // RT: rtScore = ((800 - avgRT)/600)*100 with accuracy=100 → avgRT = 800 - tr*6
  const avgRT = Math.max(200, Math.round(800 - tr * 6))
  const accuracy = 100
  // Inhibition: combine simonEffect + incongruentErrorRate
  let simonEffect: number, incongruentErrorRate: number
  if (inhib >= 50) {
    incongruentErrorRate = 0
    const effectScore = 2 * inhib - 100 // 0..100
    simonEffect = Math.max(0, Math.round(120 - effectScore * 1.2))
  } else {
    simonEffect = 120
    incongruentErrorRate = Math.max(0, Math.round(((50 - inhib) / 100) * 10000) / 10000)
  }
  // WM: dPrime = wm*3/100
  const dPrime = Math.round((wm * 0.03) * 100) / 100
  // Flex: ratioBA = 4 - flex*0.025 (valid when flex >= 0, ratio in [1.5,4])
  const ratioBA = Math.round((4 - flex * 0.025) * 1000) / 1000
  // VVP: timeA(ms) such that efficiency=25/timeS, vvp = (efficiency/1.5)*100 → timeS = 25*100/(vvp*1.5)
  const timeSeconds = Math.max(15, 1666.667 / Math.max(vvp, 5))
  const timeA = Math.round(timeSeconds * 1000)
  const timeB = Math.round(timeA * ratioBA)
  return {
    simon: { avgRT, accuracy, simonEffect, incongruentErrorRate },
    nback: { dPrime, accuracy: 80, targetErrorRate: 0.1 },
    tmt: { ratioBA, timeA, timeB, partAErrors: 0 },
  }
}

function weeksAgoISO(weeks: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - weeks * 7)
  d.setUTCHours(10, 0, 0, 0)
  return d.toISOString()
}

async function ensureUser(acc: Accent): Promise<string> {
  // Check if user exists
  let userId: string | null = null
  let page = 1
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === acc.email.toLowerCase())
    if (found) { userId = found.id; break }
    if (data.users.length < 1000) break
    page++
  }
  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: {
        full_name: acc.full_name,
        intended_role: acc.role === 'coach' ? 'coach' : 'joueur',
      },
    })
    if (error) throw error
    userId = data.user!.id
  } else {
    // Make sure password is set
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: acc.password,
      email_confirm: true,
      user_metadata: {
        full_name: acc.full_name,
        intended_role: acc.role === 'coach' ? 'coach' : 'joueur',
      },
    })
  }
  // Upsert profile with full data + correct role
  const finalRole = acc.role === 'coach' ? 'coach' : acc.role === 'admin' ? 'admin' : 'joueur'
  const { error: pErr } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    full_name: acc.full_name,
    role: finalRole,
    birth_date: acc.birth_date ?? null,
    position: acc.position ?? null,
    category: acc.category ?? null,
  }, { onConflict: 'id' })
  if (pErr) throw pErr
  return userId
}

async function seedPlayerSessions(userId: string, weeklyTargets: number[][]) {
  for (let i = 0; i < weeklyTargets.length; i++) {
    const weeks = 10 - i // W-10..W-1
    const isoDate = weeksAgoISO(weeks)
    const [sgs, tr, inhib, wm, flex, vvp] = weeklyTargets[i]
    const metrics = metricsForTargets(tr, inhib, wm, flex, vvp)
    const sessionGroupId = crypto.randomUUID()

    for (const testType of ['simon', 'nback', 'tmt'] as const) {
      const { data: sess, error: sErr } = await supabaseAdmin
        .from('sessions_test')
        .insert({
          user_id: userId,
          test_type: testType,
          created_at: isoDate,
          status: 'completed',
          sgs_score: sgs,
          score_global: sgs,
          donnees_brutes: { sessionId: sessionGroupId },
        })
        .select('id')
        .single()
      if (sErr) throw sErr
      const sid = sess!.id

      const rows: any[] = []
      if (testType === 'simon') {
        rows.push(
          { session_id: sid, user_id: userId, test_type: 'simon', metrique: 'avgRT', valeur: metrics.simon.avgRT, unite: 'ms', created_at: isoDate },
          { session_id: sid, user_id: userId, test_type: 'simon', metrique: 'simonEffect', valeur: metrics.simon.simonEffect, unite: 'ms', created_at: isoDate },
          { session_id: sid, user_id: userId, test_type: 'simon', metrique: 'incongruentErrorRate', valeur: metrics.simon.incongruentErrorRate, unite: 'ratio', created_at: isoDate },
          { session_id: sid, user_id: userId, test_type: 'simon', metrique: 'accuracy', valeur: metrics.simon.accuracy, unite: '%', created_at: isoDate, details: { avg_rt: metrics.simon.avgRT, accuracy: metrics.simon.accuracy, incongruent_error_rate: metrics.simon.incongruentErrorRate } },
        )
      } else if (testType === 'nback') {
        rows.push(
          { session_id: sid, user_id: userId, test_type: 'nback', metrique: 'dPrime', valeur: metrics.nback.dPrime, unite: "d'", created_at: isoDate },
          { session_id: sid, user_id: userId, test_type: 'nback', metrique: 'accuracy', valeur: metrics.nback.accuracy, unite: '%', created_at: isoDate, details: { accuracy: metrics.nback.accuracy, target_error_rate: metrics.nback.targetErrorRate, d_prime: metrics.nback.dPrime } },
        )
      } else {
        rows.push(
          { session_id: sid, user_id: userId, test_type: 'tmt', metrique: 'ratioBA', valeur: metrics.tmt.ratioBA, unite: 'ratio', created_at: isoDate },
          { session_id: sid, user_id: userId, test_type: 'tmt', metrique: 'timeA', valeur: metrics.tmt.timeA, unite: 'ms', created_at: isoDate },
          { session_id: sid, user_id: userId, test_type: 'tmt', metrique: 'partAErrors', valeur: metrics.tmt.partAErrors, unite: 'count', created_at: isoDate, details: { time_a: metrics.tmt.timeA, time_b: metrics.tmt.timeB, ratio_ba: metrics.tmt.ratioBA, errors_a: metrics.tmt.partAErrors } },
        )
      }
      const { error: rErr } = await supabaseAdmin.from('resultats_test').insert(rows)
      if (rErr) throw rErr
    }
  }
}

export const Route = createFileRoute('/api/public/seed-demo')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get('x-seed-token')
        if (token !== 'cogniraja-demo-2026') {
          return new Response('Forbidden', { status: 403 })
        }
        try {
          const ids: Record<string, string> = {}
          for (const acc of ACCOUNTS) {
            ids[acc.email] = await ensureUser(acc)
          }

          const coachId = ids['coach@gmail.com']
          const playerEmails = ['joueur@gmail.com', 'joueur2@gmail.com', 'joueur3@gmail.com']
          const playerIds = playerEmails.map((e) => ids[e])

          // coach_requests: mark as approved with reviewed_at = 10 weeks ago
          const reviewedAt = weeksAgoISO(10)
          const { data: existingReq } = await supabaseAdmin
            .from('coach_requests')
            .select('id')
            .eq('user_id', coachId)
            .maybeSingle()
          if (existingReq) {
            await supabaseAdmin.from('coach_requests')
              .update({ status: 'approved', reviewed_at: reviewedAt })
              .eq('id', existingReq.id)
          } else {
            await supabaseAdmin.from('coach_requests').insert({
              user_id: coachId,
              full_name: 'Mohammed BENALI',
              email: 'coach@gmail.com',
              status: 'approved',
              reviewed_at: reviewedAt,
            })
          }

          // coach_players links — delete existing then re-insert (status accepted)
          await supabaseAdmin.from('coach_players')
            .delete()
            .eq('coach_id', coachId)
            .in('player_id', playerIds)
          await supabaseAdmin.from('coach_players').insert(
            playerIds.map((pid) => ({ coach_id: coachId, player_id: pid, status: 'accepted' }))
          )

          // Wipe and re-seed sessions for these players (idempotent)
          for (const pid of playerIds) {
            const { data: oldSessions } = await supabaseAdmin
              .from('sessions_test').select('id').eq('user_id', pid)
            const oldIds = (oldSessions ?? []).map((s: any) => s.id)
            if (oldIds.length > 0) {
              await supabaseAdmin.from('resultats_test').delete().in('session_id', oldIds)
              await supabaseAdmin.from('sessions_test').delete().in('id', oldIds)
            }
            await supabaseAdmin.from('completed_exercises').delete().eq('user_id', pid)
          }

          await seedPlayerSessions(playerIds[0], REDA)
          await seedPlayerSessions(playerIds[1], TAHA)
          await seedPlayerSessions(playerIds[2], ISMAIL)

          // completed_exercises — weeks 8, 6, 4, 2
          const weeksForEx = [8, 6, 4, 2]
          const exMap: Record<string, string[]> = {
            [playerIds[0]]: EXERCISES.reda,
            [playerIds[1]]: EXERCISES.taha,
            [playerIds[2]]: EXERCISES.ismail,
          }
          for (const pid of playerIds) {
            const exIds = exMap[pid]
            const rows = weeksForEx.map((w, idx) => ({
              user_id: pid,
              exercise_id: exIds[idx],
              series_completed: 3,
              completed_at: weeksAgoISO(w),
              created_at: weeksAgoISO(w),
            }))
            const { error } = await supabaseAdmin.from('completed_exercises').insert(rows)
            if (error) throw error
          }

          return new Response(JSON.stringify({ ok: true, ids }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
