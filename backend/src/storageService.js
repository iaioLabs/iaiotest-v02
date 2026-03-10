const fs = require('fs').promises
const path = require('path')
const { randomUUID } = require('crypto')

const DATA_DIR = path.join(__dirname, '../data')
const REPORTS_DIR = path.join(DATA_DIR, 'reports')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

/**
 * storageService.js
 * Handles local persistence of bug reports.
 */

// Ensure data directories exist on startup
async function initDirs() {
    await fs.mkdir(REPORTS_DIR, { recursive: true })
    await fs.mkdir(UPLOADS_DIR, { recursive: true })
}
initDirs().catch(err => console.error('[storageService] Failed to init dirs:', err))

function generateBugId() {
    return randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()
}

async function saveReport(reportData) {
    const bugId = generateBugId()
    const timestamp = new Date().toISOString()

    // 1. Process and save screenshot if present
    let screenshotName = null
    if (reportData.screenshotBase64) {
        const rawBase64 = reportData.screenshotBase64.replace(/^data:image\/\w+;base64,/, '')
        screenshotName = `bug-${bugId}.png`
        const screenshotPath = path.join(UPLOADS_DIR, screenshotName)
        try {
            await fs.writeFile(screenshotPath, Buffer.from(rawBase64, 'base64'))
        } catch (e) {
            console.error('Failed to save screenshot', e)
        }
    }

    // 2. Prepare JSON data
    const reportToStore = {
        id: bugId,
        timestamp,
        url: reportData.url,
        title: reportData.title,
        notes: reportData.notes,
        aiSuggestion: reportData.aiSuggestion,
        resolution: reportData.resolution,
        systemInfo: reportData.systemInfo,
        consoleLogs: reportData.consoleLogs || '',
        networkLogs: reportData.networkLogs || '',
        consoleEntries: reportData.logs || (Array.isArray(reportData.consoleEntries) ? reportData.consoleEntries : []),
        networkEntries: reportData.network || (Array.isArray(reportData.networkEntries) ? reportData.networkEntries : []),
        dom: reportData.domFragment || reportData.dom || '',
        screenshotFile: screenshotName
    }

    // 3. Save JSON report
    const reportPath = path.join(REPORTS_DIR, `${bugId}.json`)
    try {
        await fs.writeFile(reportPath, JSON.stringify(reportToStore, null, 2))
    } catch (e) {
        console.error('Failed to save report JSON', e)
        throw e
    }

    return bugId
}

async function getReport(bugId) {
    try {
        const reportPath = path.join(REPORTS_DIR, `${bugId}.json`)
        const data = await fs.readFile(reportPath, 'utf8')
        return JSON.parse(data)
    } catch (error) {
        return null
    }
}

async function listReports({ page = 1, limit = 20 } = {}) {
    try {
        const files = await fs.readdir(REPORTS_DIR)
        const jsonFiles = files.filter(f => f.endsWith('.json'))

        // Sort newest first via mtime
        const withStats = await Promise.all(
            jsonFiles.map(async f => {
                const stat = await fs.stat(path.join(REPORTS_DIR, f))
                return { file: f, mtime: stat.mtime }
            })
        )
        withStats.sort((a, b) => b.mtime - a.mtime)

        const total = withStats.length
        const offset = (page - 1) * limit
        const pageSlice = withStats.slice(offset, offset + limit)

        // Return only metadata — skip heavy fields (dom, screenshotBase64)
        const reports = await Promise.all(
            pageSlice.map(async ({ file }) => {
                const data = await fs.readFile(path.join(REPORTS_DIR, file), 'utf8')
                const r = JSON.parse(data)
                return {
                    id: r.id,
                    title: r.title,
                    url: r.url,
                    timestamp: r.timestamp,
                    resolution: r.resolution,
                    screenshotFile: r.screenshotFile,
                    systemInfo: r.systemInfo,
                }
            })
        )

        return { reports, total, page, limit, pages: Math.ceil(total / limit) }
    } catch (error) {
        return { reports: [], total: 0, page, limit, pages: 0 }
    }
}

async function deleteReport(bugId) {
    try {
        const report = await getReport(bugId)
        if (!report) return false

        await fs.unlink(path.join(REPORTS_DIR, `${bugId}.json`))

        if (report.screenshotFile) {
            await fs.unlink(path.join(UPLOADS_DIR, report.screenshotFile)).catch(() => { })
        }

        return true
    } catch (error) {
        return false
    }
}

async function getStats() {
    try {
        const files = await fs.readdir(REPORTS_DIR)
        const jsonFiles = files.filter(f => f.endsWith('.json'))
        const count = jsonFiles.length

        let lastReportAt = null
        if (count > 0) {
            const mtimes = await Promise.all(
                jsonFiles.map(f => fs.stat(path.join(REPORTS_DIR, f)).then(s => s.mtime))
            )
            lastReportAt = new Date(Math.max(...mtimes)).toISOString()
        }

        return { count, lastReportAt }
    } catch {
        return { count: 0, lastReportAt: null }
    }
}

module.exports = {
    saveReport,
    getReport,
    listReports,
    deleteReport,
    getStats,
    UPLOADS_DIR
}
