import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10)
  const operatorPassword = await bcrypt.hash('operator123', 10)
  const viewerPassword = await bcrypt.hash('viewer123', 10)

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminPassword, role: 'admin' },
  })

  await prisma.user.upsert({
    where: { username: 'operator' },
    update: {},
    create: { username: 'operator', passwordHash: operatorPassword, role: 'operator' },
  })

  await prisma.user.upsert({
    where: { username: 'viewer' },
    update: {},
    create: { username: 'viewer', passwordHash: viewerPassword, role: 'viewer' },
  })

  // Seed default customer
  await prisma.customer.upsert({
    where: { code: 'DFT' },
    update: {},
    create: { id: 1, name: 'Default Customer', code: 'DFT' },
  })

  // Seed default site
  await prisma.site.upsert({
    where: { name_customerId: { name: 'Default Site', customerId: 1 } },
    update: {},
    create: { id: 1, name: 'Default Site', location: 'Head Office', customerId: 1 },
  })

  console.log('Seeded users:', admin.username)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
