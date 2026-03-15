/**
 * server.js — iaio Test v2
 *
 * Endpoints:
 *   GET  /health        → sanity check
 *   POST /analyze-bug   → AI analysis via Claude
 *   POST /create-issue  → creates Jira issue + attaches screenshot
 */

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const path = require('path')
const { rateLimit } = require('express-rate-limit')

// Load environment variables FIRST before requiring other services.
// In production (Railway, Render) env vars are injected by the platform — dotenv is skipped.
// In dev, load from SECRETS_PATH env var or fall back to the local secrets file.
if (process.env.NODE_ENV !== 'production') {
  const secretsPath = process.env.SECRETS_PATH ||
    path.resolve('/Users/lalomartinjodor/Desktop/secrets-iaiolabs/.env')
  require('dotenv').config({ path: secretsPath })
}

const { createIssue, addAttachment } = require('./jiraService')
const { analyzeBug } = require('./aiService')
const { sendBugReport } = require('./emailService')
const { saveReport, getReport, listReports, deleteReport, getStats, UPLOADS_DIR } = require('./storageService')
const { requireAuth } = require('./authMiddleware')

const app = express()
const PORT = process.env.PORT || 3000

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Try again in a minute.' },
})

const sendReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Try again in a minute.' },
})

const createIssueLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Try again in a minute.' },
})

const reportViewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Try again in a minute.' },
})

app.use(cors())
app.use(bodyParser.json({ limit: '30mb' }))

// Serve uploads folder for the web viewer
app.use('/uploads', express.static(UPLOADS_DIR))

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  const { count, lastReportAt } = await getStats()
  res.json({
    status: 'ok',
    version: '2.0.0',
    uptime: Math.floor(process.uptime()),
    reports: { count, lastReportAt },
  })
})

// ─── AI Bug Analysis ──────────────────────────────────────────────────────────

app.post('/analyze-bug', analyzeLimiter, async (req, res) => {
  const { screenshot, consoleLogs, networkLogs, url, title } = req.body

  if (!url) {
    return res.status(400).json({ success: false, error: 'url is required' })
  }

  try {
    const suggestion = await analyzeBug({ screenshot, consoleLogs, networkLogs, url, title })
    res.json({ success: true, suggestion })
  } catch (error) {
    console.error('[/analyze-bug]', error.message)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ─── Reports API ──────────────────────────────────────────────────────────────

app.get('/api/reports', requireAuth, reportViewLimiter, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20))
  const result = await listReports({ page, limit })
  res.json({ success: true, ...result })
})

app.get('/api/report/:id', reportViewLimiter, async (req, res) => {
  const report = await getReport(req.params.id)
  if (!report) return res.status(404).json({ success: false, error: 'Report not found' })
  res.json({ success: true, report })
})

app.delete('/api/report/:id', requireAuth, async (req, res) => {
  const deleted = await deleteReport(req.params.id)
  if (!deleted) return res.status(404).json({ success: false, error: 'Report not found' })
  res.json({ success: true })
})

// ─── Send Email Report ────────────────────────────────────────────────────────

app.post('/send-report', sendReportLimiter, async (req, res) => {
  const payload = req.body

  if (!payload.email) return res.status(400).json({ success: false, error: 'email is required' })
  if (!payload.title) return res.status(400).json({ success: false, error: 'title is required' })

  // Normalize incoming extension schema to expected backend schema
  payload.consoleEntries = payload.logs || payload.consoleEntries || [];
  payload.networkEntries = payload.network || payload.networkEntries || [];
  payload.dom = payload.domFragment || payload.dom || '';

  // Generate plain text versions for AI and legacy formatting
  payload.consoleLogs = payload.consoleEntries.map(e => `[${e.level}] ${e.message}`).join('\n');
  payload.networkLogs = payload.networkEntries.map(e => `${e.method} ${e.status} ${e.url}`).join('\n');
  console.log('[/send-report] received →', {
    consoleEntries: Array.isArray(payload.consoleEntries) ? payload.consoleEntries.length : typeof payload.consoleEntries,
    networkEntries: Array.isArray(payload.networkEntries) ? payload.networkEntries.length : typeof payload.networkEntries,
    consoleLogs_chars: typeof payload.consoleLogs === 'string' ? payload.consoleLogs.length : typeof payload.consoleLogs,
    networkLogs_chars: typeof payload.networkLogs === 'string' ? payload.networkLogs.length : typeof payload.networkLogs,
    dom_chars: typeof payload.dom === 'string' ? payload.dom.length : 0,
  })

  try {
    // 1. Persist Report
    const bugId = await saveReport(payload)
    const reportUrl = `${req.protocol}://${req.get('host')}/report/${bugId}`

    // 2. Send Email with Link
    await sendBugReport({
      to: payload.email,
      title: payload.title,
      notes: payload.notes,
      aiSuggestion: payload.aiSuggestion,
      screenshotBase64: payload.screenshotBase64,
      url: payload.url,
      resolution: payload.resolution,
      consoleLogs: payload.consoleLogs,
      networkLogs: payload.networkLogs,
      dom: payload.dom,
      systemInfo: payload.systemInfo,
      bugId,
      reportUrl
    })

    res.json({ success: true, bugId, reportUrl })
  } catch (error) {
    console.error('[/send-report]', error.message)
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'unknown_error',
    })
  }
})

// ─── Create Jira Issue (optional / advanced) ──────────────────────────────────

app.post('/create-issue', requireAuth, createIssueLimiter, async (req, res) => {
  const {
    title,
    description: userDescription,
    issueType,
    url,
    resolution,
    consoleLogs,
    networkLogs,
    systemInfo,
    screenshotBase64,
  } = req.body

  if (!title) {
    return res.status(400).json({ success: false, error: 'title is required' })
  }

  const fullDescription = `
${userDescription || 'No description provided.'}

--- 🖥️ System Info ---
URL: ${url}
Platform: ${systemInfo?.platform || 'Unknown'}
Resolution: ${resolution}
User Agent: ${systemInfo?.userAgent || 'Unknown'}
Language: ${systemInfo?.language || 'Unknown'}

--- 🛡️ Network Requests ---
${networkLogs || 'No network issues captured.'}

--- 📝 Console Errors ---
${consoleLogs || 'No console errors captured.'}

---
Captured via iaio Test v2
  `.trim()

  try {
    const issue = await createIssue({
      title: `[iaio] ${title}`,
      description: fullDescription,
      issueType: issueType || 'Bug',
    })

    if (screenshotBase64) {
      await addAttachment(issue.key, screenshotBase64)
    }

    res.status(201).json({ success: true, issueKey: issue.key })
  } catch (error) {
    console.error('[/create-issue]', error.message)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ─── Serve Report Viewer HTML (SSR) ───────────────────────────

const fs = require('fs')

app.get('/report/:id', reportViewLimiter, async (req, res) => {
  try {
    const report = await getReport(req.params.id)
    if (!report) {
      return res.status(404).send('<div style="color:#00f0ff; background:#050810; height:100vh; display:flex; align-items:center; justify-content:center; font-family:monospace; font-size:24px;">REPORT NOT FOUND</div>')
    }

    // Read the static HTML
    const viewerPath = path.join(__dirname, 'views/viewer.html')
    let html = fs.readFileSync(viewerPath, 'utf8')

    // BULLETPROOF SSR: Encode as base64 so it NEVER crashes the browser parser
    const base64Data = Buffer.from(JSON.stringify(report)).toString('base64');
    const scriptInjection = `
      <script id="report-data" type="application/json">
        ${base64Data}
      </script>
    `
    html = html.replace('</head>', `${scriptInjection}</head>`)

    res.send(html)
  } catch (err) {
    console.error('SSR Error:', err)
    res.status(500).send('Internal Server Error')
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`iaio Test v2 backend → http://localhost:${PORT}`)
})
