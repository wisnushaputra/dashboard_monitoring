import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

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
