/**
 * aiService.js — iaio Test v2
 *
 * Analyzes a bug report using Claude (Anthropic API).
 * Accepts screenshot, console logs, network logs, and the page URL.
 * Returns a concise diagnosis + suggested fix.
 */

const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * @param {Object} params
 * @param {string} [params.screenshot]    Base64 PNG (data:image/png;base64,...)
 * @param {string} [params.consoleLogs]   Captured console.error lines
 * @param {string} [params.networkLogs]   Captured failed network requests
 * @param {string}  params.url            Page URL where the bug occurred
 * @returns {Promise<string>}             Markdown-formatted analysis
 */
async function analyzeBug({ screenshot, consoleLogs, networkLogs, url }) {
  /** @type {import('@anthropic-ai/sdk').MessageParam['content']} */
  const content = []

  // Attach screenshot if available (vision input)
  if (screenshot) {
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '')
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: base64Data,
      },
    })
  }

  const prompt = `You are a senior full-stack engineer doing a quick bug triage.

**Page Title:** ${params.title || 'Unknown'}
**Page URL:** ${url}

**Console Errors:**
${consoleLogs?.trim() || 'None captured'}

**Network Issues:**
${networkLogs?.trim() || 'None captured'}

${screenshot ? 'Review the screenshot above for visual clues.' : ''}

Respond with a focused bug report in exactly this structure (use plain text, no markdown headers):

What's broken: <1 sentence describing the visible or logged problem>
Probable cause: <most likely technical root cause, be specific>
Steps to Reproduce: <deduce the logical steps (1, 2, 3...) the user took based on URL, title, and logs>
Suggested fix: <concrete actionable step for the developer>

Keep the total response under 150 words. No preamble.`

  content.push({ type: 'text', text: prompt })

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 300,
    messages: [{ role: 'user', content }],
  })

  const block = message.content[0]
  return block.type === 'text' ? block.text.trim() : ''
}

module.exports = { analyzeBug }
