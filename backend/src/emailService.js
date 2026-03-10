/**
 * emailService.js — iaio Test v2 (Simplified for Jam.dev Style)
 *
 * Sends a minimalist notification email with a link to the interactive web report.
 */

const { Resend } = require('resend')
const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * @param {Object} params
 * @param {string} params.to
 * @param {string} params.title
 * @param {string} params.bugId
 * @param {string} params.reportUrl
 * @param {string} params.url
 */
async function sendBugReport({
  to,
  title,
  bugId,
  reportUrl,
  url,
}) {
  const date = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  let hostname = url
  try { hostname = new URL(url).hostname } catch { }

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#050810;font-family:sans-serif;color:#e8eaf6;">
  <div style="max-width:500px;margin:0 auto;background:#080d1a;padding:32px;border-radius:12px;border:1px solid rgba(0,240,255,0.12);box-shadow:0 8px 32px rgba(0,0,0,0.4);">
    <h2 style="color:#00f0ff;margin:0 0 8px;font-size:20px;">Bug Report: ${bugId}</h2>
    <p style="font-size:14px;color:#a0a8c0;margin:0 0 24px;">Incident captured at <strong>${hostname}</strong></p>
    
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${reportUrl}" style="display:inline-block;padding:14px 32px;background:#00f0ff;color:#050810;text-decoration:none;font-weight:800;border-radius:6px;font-size:14px;letter-spacing:0.05em;">VIEW INTERACTIVE REPORT</a>
    </div>

    <div style="border-top:1px solid rgba(0,240,255,0.06);padding-top:20px;font-size:12px;color:#5a6080;line-height:1.6;">
      <p style="margin:2px 0;"><strong>ID:</strong> ${bugId}</p>
      <p style="margin:2px 0;"><strong>Title:</strong> ${title}</p>
      <p style="margin:2px 0;"><strong>Date:</strong> ${date}</p>
    </div>
    
    <div style="margin-top:24px;text-align:center;">
      <span style="font-size:10px;color:rgba(0,240,255,0.3);text-transform:uppercase;letter-spacing:0.1em;">Powered by iaio Labs</span>
    </div>
  </div>
</body>
</html>`

  const { data, error } = await resend.emails.send({
    from: process.env.FROM_EMAIL || 'reports@iaiolabs.com',
    to: [to],
    subject: `[iaio Test] Bug ${bugId}: ${title}`,
    html,
  })

  if (error) {
    const err = new Error(error.message || 'Resend error')
    err.code = error.name
    throw err
  }
  return data
}

module.exports = { sendBugReport }
