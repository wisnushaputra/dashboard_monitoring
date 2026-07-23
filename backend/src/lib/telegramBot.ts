import prisma from './prisma'

export interface TelegramSendResult {
  ok: boolean
  error?: string
}

function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<TelegramSendResult> {
  if (!botToken || !botToken.trim()) {
    return { ok: false, error: 'Telegram Bot Token is required' }
  }
  if (!chatId || !chatId.trim()) {
    return { ok: false, error: 'Telegram Chat ID / Group ID is required' }
  }

  const cleanToken = botToken.trim()
  const cleanChatId = chatId.trim()

  // Telegram limits single message length to 4096 characters.
  // Chunk message into max 3800 char blocks if necessary.
  const MAX_CHUNK_SIZE = 3800
  const chunks: string[] = []

  if (text.length <= MAX_CHUNK_SIZE) {
    chunks.push(text)
  } else {
    const lines = text.split('\n')
    let currentChunk = ''
    for (const line of lines) {
      if ((currentChunk + '\n' + line).length > MAX_CHUNK_SIZE) {
        if (currentChunk) chunks.push(currentChunk)
        currentChunk = line
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n${line}` : line
      }
    }
    if (currentChunk) chunks.push(currentChunk)
  }

  try {
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`
    let lastError = ''

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks.length > 1 ? `[Part ${i + 1}/${chunks.length}]\n${chunks[i]}` : chunks[i]

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: chunkText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      })

      const json = (await res.json()) as any
      if (!json.ok) {
        lastError = json.description || `Telegram API Error code ${json.error_code}`
        console.error(`[Telegram] Send message failed: ${lastError}`)
        return { ok: false, error: lastError }
      }
    }

    return { ok: true }
  } catch (err: any) {
    console.error('[Telegram] Fetch error:', err)
    return { ok: false, error: err.message || 'Network connection failed' }
  }
}

export async function generateDailyReportText(targetDate = new Date()): Promise<string> {
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0)
  const now = new Date()

  // Format date code DDMMYYYY
  const dd = String(targetDate.getDate()).padStart(2, '0')
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0')
  const yyyy = String(targetDate.getFullYear())
  const dateCode = `${dd}${mm}${yyyy}`

  // Find all DOWN alarms created or active today
  const alarms = await prisma.alarm.findMany({
    where: {
      startTime: { lte: now },
      OR: [
        { endTime: { gte: dayStart } },
        { endTime: null },
      ],
    },
    include: {
      node: { select: { id: true, name: true, location: true, deviceType: true, ipAddress: true } },
    },
    orderBy: { startTime: 'asc' },
  })

  if (alarms.length === 0) {
    return `📋 <b>LAPORAN HARIAN INSIDEN NOC (${dd}/${mm}/${yyyy} 20:00 WIB)</b>\n\n✅ <b>Seluruh site &amp; perangkat jangkauan jaringan beroperasi normal (0 Insiden Down hari ini).</b>`
  }

  const lines: string[] = []
  lines.push(`📋 <b>LAPORAN HARIAN INSIDEN NOC (${dd}/${mm}/${yyyy} 20:00 WIB)</b>\n`)

  alarms.forEach((alarm, idx) => {
    const seq = String(idx + 1).padStart(3, '0')
    const ticketId = `.PASS${dateCode}${seq}`

    const start = new Date(alarm.startTime)
    const end = alarm.endTime ? new Date(alarm.endTime) : null

    const startTimeStr = start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
    const endTimeStr = end ? end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'ONGOING'

    // Calculate duration text
    let durationStr = ''
    if (end) {
      const diffMs = end.getTime() - start.getTime()
      const totalMins = Math.floor(diffMs / (1000 * 60))
      const hours = Math.floor(totalMins / 60)
      const mins = totalMins % 60

      if (hours > 0 && mins > 0) {
        durationStr = `${hours} jam ${mins} menit`
      } else if (hours > 0) {
        durationStr = `${hours} jam`
      } else {
        durationStr = `${mins} menit`
      }
    } else {
      const diffMs = now.getTime() - start.getTime()
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      durationStr = hours > 0 ? `${hours} jam (berlangsung)` : 'berlangsung'
    }

    const nodeLabel = escapeHtml(alarm.node ? alarm.node.name : `Site #${alarm.nodeId}`)
    const rawIndication = alarm.recoveryNote || alarm.cause || 'Penanganan Pemulihan Jaringan NOC'
    const indication = escapeHtml(rawIndication)
    const ticketStatus = alarm.status === 'resolved' ? 'CLOSED' : 'OPEN'

    const ticketLine = `${ticketId} ${startTimeStr} - ${endTimeStr} (${durationStr}) : Terdeteksi alarm down untuk ${nodeLabel} dengan indikasi  ${indication} = ${ticketStatus}`
    lines.push(ticketLine)
  })

  lines.push(`\n<i>Total Insiden Terdata: ${alarms.length} Site</i>`)
  return lines.join('\n\n')
}
