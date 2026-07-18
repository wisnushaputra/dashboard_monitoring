import prisma from './prisma'

export interface AuditPayload {
  userId?: number
  username: string
  action: string
  target?: string | null
  details?: string | null
  ipAddress?: string | null
}

export async function logAudit(p: AuditPayload) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: p.userId || null,
        username: p.username,
        action: p.action,
        target: p.target || null,
        details: p.details || null,
        ipAddress: p.ipAddress || null,
      }
    })
  } catch (err) {
    console.error('[AuditLog] Failed to log audit activity:', err)
  }
}
