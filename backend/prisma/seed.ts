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

  // Seed corporate customers
  const customersData = [
    { id: 1, code: 'DFT', name: 'Default Customer' },
    { code: 'PASS-INFRA', name: 'Passnet Infrastructure & Core' },
    { code: 'DIRGANTARA', name: 'PT Dirgantara Yudha Artha' },
    { code: 'KING-HOTEL', name: 'King Hotel Bandung' },
    { code: 'ZEST-HOTEL', name: 'Hotel Zest Bandung' },
    { code: 'DEDY-JAYA', name: 'Dedy Jaya Group (Hotel & RS)' },
    { code: 'BJP-CORP', name: 'PT Bangunan Jaya Prima' },
    { code: 'KUM-CORP', name: 'PT Karya Utama Mandiri' },
    { code: 'HALAMAN-IDE', name: 'PT Halaman Ide Indonesia' },
    { code: 'GRAHA-BUNDA', name: 'RSIA Graha Bunda' },
    { code: 'AL-ZAZERA', name: 'Al-Zazera Corporate' },
    { code: 'VML-BDG', name: 'VML Bandung' },
    { code: 'INTI88', name: 'Inti88 Corporate' },
    { code: 'UNPAS', name: 'Universitas Pasundan (UNPAS)' },
    { code: 'SATERA', name: 'Satera Hotel Prime' },
    { code: 'COFFEE-150', name: '150 Coffee Garden' },
    { code: 'VALORE', name: 'Valore Hotel' },
    { code: 'RETAIL-NET', name: 'Retail & Community Networks' },
  ]

  for (const c of customersData) {
    await prisma.customer.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    })
  }

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
