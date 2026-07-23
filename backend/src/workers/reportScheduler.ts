import prisma from '../lib/prisma'
import { generateDailyReportText, sendTelegramMessage } from '../lib/telegramBot'

let lastSentDateStr = ''

export function startReportScheduler() {
  console.log('[Scheduler] Daily 8:00 PM (20:00) Telegram Report Scheduler initiated.')

  // Check time every 30 seconds
  setInterval(async () => {
    try {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const todayStr = now.toISOString().substring(0, 10)

      // Trigger at 20:00 (8:00 PM) once per day
      if (hours === 20 && minutes === 0 && lastSentDateStr !== todayStr) {
        lastSentDateStr = todayStr
        console.log(`[Scheduler] 🕗 Triggering Daily 8:00 PM Telegram Report for ${todayStr}...`)
        await triggerDailyTelegramReport()
      }
    } catch (err) {
      console.error('[Scheduler] Error checking report schedule:', err)
    }
  }, 30000)
}

export async function triggerDailyTelegramReport(): Promise<{ success: boolean; message: string; count: number }> {
  const settings = await prisma.notificationSetting.findMany({
    where: { telegramEnabled: true },
  })

  if (settings.length === 0) {
    return { success: false, message: 'No active Telegram notification settings enabled', count: 0 }
  }

  const reportText = await generateDailyReportText(new Date())
  let successCount = 0

  for (const s of settings) {
    if (s.telegramBotToken && s.telegramChatId) {
      const res = await sendTelegramMessage(s.telegramBotToken, s.telegramChatId, reportText)
      if (res.ok) successCount++
    }
  }

  return {
    success: successCount > 0,
    message: `Daily report dispatched to ${successCount} Telegram destination(s)`,
    count: successCount,
  }
}
