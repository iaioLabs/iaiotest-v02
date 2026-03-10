/**
 * jiraService.js — iaio Test v2
 * Jira REST API v3 integration (unchanged from v1).
 */

const axios = require('axios')
const FormData = require('form-data')

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY } = process.env

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')

const jiraApi = axios.create({
  baseURL: JIRA_BASE_URL,
  headers: {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

/**
 * Creates a Jira issue.
 * @param {{ title: string, description: string, issueType: string }} params
 * @returns {Promise<{ key: string, id: string }>}
 */
async function createIssue({ title, description, issueType }) {
  const payload = {
    fields: {
      project: { key: JIRA_PROJECT_KEY },
      summary: title,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: description }],
          },
        ],
      },
      issuetype: { name: issueType || 'Bug' },
    },
  }

  try {
    const response = await jiraApi.post('/rest/api/3/issue', payload)
    return response.data
  } catch (error) {
    console.error('Jira createIssue error:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Attaches a base64-encoded screenshot to a Jira issue.
 * @param {string} issueKey
 * @param {string} screenshotBase64  data:image/png;base64,...
 */
async function addAttachment(issueKey, screenshotBase64) {
  if (!screenshotBase64) return null

  const base64Data = screenshotBase64.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

  const form = new FormData()
  form.append('file', buffer, {
    filename: `iaio-screenshot-${Date.now()}.png`,
    contentType: 'image/png',
  })

  try {
    const response = await axios.post(
      `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/attachments`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Basic ${auth}`,
          'X-Atlassian-Token': 'no-check',
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('Jira addAttachment error:', error.response?.data || error.message)
    throw error
  }
}

module.exports = { createIssue, addAttachment }
