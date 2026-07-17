import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'
import fs from 'fs'
import path from 'path'

const router = Router()

// Helper to generate default WAV sound if it doesn't exist
function ensureDefaultAlarmSound() {
  const uploadsDir = path.join(__dirname, '../../uploads')
  const customAlarmPath = path.join(uploadsDir, 'alarm.wav')
  
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
  
  if (!fs.existsSync(customAlarmPath)) {
    // Generate default dual-tone beep
    const frequency = 880
    const durationSeconds = 1.5
    const sampleRate = 8000
    const numSamples = Math.floor(sampleRate * durationSeconds)
    const dataSize = numSamples * 2
    const fileSize = 36 + dataSize
    
    const buffer = Buffer.alloc(44 + dataSize)
    
    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(fileSize, 4)
    buffer.write('WAVE', 8)
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(1, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(sampleRate * 2, 28)
    buffer.writeUInt16LE(2, 32)
    buffer.writeUInt16LE(16, 34)
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataSize, 40)
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const cycle = Math.floor(t * 4) % 2
      const freq = cycle === 0 ? frequency : frequency * 1.25
      const fade = Math.min(1, (durationSeconds - t) * 5)
      const sample = Math.sin(2 * Math.PI * freq * t) * 32767 * 0.4 * fade
      buffer.writeInt16LE(Math.round(sample), 44 + i * 2)
    }
    
    fs.writeFileSync(customAlarmPath, buffer)
  }
}

// Public GET route (place before authMiddleware)
router.get('/alarm-sound', (req: Request, res: Response) => {
  const uploadsDir = path.join(__dirname, '../../uploads')
  const customAlarmPath = path.join(uploadsDir, 'alarm.wav')
  ensureDefaultAlarmSound()
  res.sendFile(customAlarmPath)
})

router.use(authMiddleware)

router.post('/alarm-sound', async (req: Request, res: Response) => {
  const { fileData } = req.body
  if (!fileData) {
    res.status(400).json({ error: 'fileData (base64 string) is required' })
    return
  }

  try {
    const base64Content = fileData.split(';base64,').pop()
    if (!base64Content) {
      res.status(400).json({ error: 'Invalid file format' })
      return
    }

    const buffer = Buffer.from(base64Content, 'base64')
    const uploadsDir = path.join(__dirname, '../../uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const customAlarmPath = path.join(uploadsDir, 'alarm.wav')
    fs.writeFileSync(customAlarmPath, buffer)
    
    res.json({ message: 'Alarm sound updated successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  let settings = await prisma.notificationSetting.findUnique({ where: { userId } })
  if (!settings) {
    settings = await prisma.notificationSetting.create({
      data: { userId },
    })
  }
  res.json(settings)
})

router.put('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { soundEnabled, emailEnabled, emailAddress, webhookEnabled, webhookUrl, slackEnabled, slackWebhook } = req.body

  const settings = await prisma.notificationSetting.upsert({
    where: { userId },
    update: {
      ...(soundEnabled !== undefined && { soundEnabled }),
      ...(emailEnabled !== undefined && { emailEnabled }),
      ...(emailAddress !== undefined && { emailAddress }),
      ...(webhookEnabled !== undefined && { webhookEnabled }),
      ...(webhookUrl !== undefined && { webhookUrl }),
      ...(slackEnabled !== undefined && { slackEnabled }),
      ...(slackWebhook !== undefined && { slackWebhook }),
    },
    create: { userId, soundEnabled, emailEnabled, emailAddress, webhookEnabled, webhookUrl, slackEnabled, slackWebhook },
  })

  res.json(settings)
})

export default router
