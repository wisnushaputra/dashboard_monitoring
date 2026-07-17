import prisma from './prisma'

export interface NotifPayload {
  nodeName: string
  nodeIp: string
  status: string
  latencyMs?: number | null
  deviceType: string
}

export async function sendNotifications(payload: NotifPayload) {
  const settings = await prisma.notificationSetting.findMany()

  for (const s of settings) {
    if (s.emailEnabled && s.emailAddress) {
      sendEmail(s.emailAddress, payload).catch(console.error)
    }
    if (s.webhookEnabled && s.webhookUrl) {
      sendWebhook(s.webhookUrl, payload).catch(console.error)
    }
    if (s.slackEnabled && s.slackWebhook) {
      sendSlack(s.slackWebhook, payload).catch(console.error)
    }
  }
}

async function sendEmail(to: string, p: NotifPayload) {
  console.log(`[Notif] Email to ${to}: ${p.nodeName} is ${p.status}`)
  // ponytail: SMTP integration placeholder, add nodemailer when email is required
}

async function sendWebhook(url: string, p: NotifPayload) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'alarm', ...p, timestamp: new Date().toISOString() }),
    })
  } catch (err) {
    console.error(`[Notif] Webhook failed:`, err)
  }
}

async function sendSlack(url: string, p: NotifPayload) {
  const color = p.status === 'down' ? '#ef4444' : p.status === 'warning' ? '#f59e0b' : '#22c55e'
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: `${p.nodeName} — ${p.status.toUpperCase()}`,
          fields: [
            { title: 'IP', value: p.nodeIp, short: true },
            { title: 'Type', value: p.deviceType, short: true },
            { title: 'Latency', value: p.latencyMs ? `${p.latencyMs}ms` : 'N/A', short: true },
          ],
          ts: Math.floor(Date.now() / 1000),
        }],
      }),
    })
  } catch (err) {
    console.error(`[Notif] Slack failed:`, err)
  }
}
