import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { SAMPLE_NODES } from './sample-node.ts'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Reset all data
  console.log('🗑️  Resetting existing data...')
  await prisma.flowEdge.deleteMany()
  await prisma.flowNode.deleteMany()
  await prisma.flowProject.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  // Create default admin user with password
  console.log('👤 Creating admin user...')
  const hashedPassword = await bcrypt.hash('admin123', 12) // Default password: admin123
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      emailVerified: new Date(),
      password: hashedPassword,
      role: 'ADMIN',
    }
  })

  // Create default flow project
  console.log('📊 Creating default flow project...')
  const flowProject = await prisma.flowProject.create({
    data: {
      id: 'DEFAULT',
      name: 'Main Project',
      description: 'Main knowledge flow project with sample data',
    }
  })

  // Create a simple sample node (we'll load the full sample data from the frontend)
  console.log('🔗 Creating sample flow node...')
  for (const node of SAMPLE_NODES) {
    const sampleNode = await prisma.flowNode.create({
      data: {
        projectId: flowProject.id,
        nodeId: node.id,
        type: node.type as string,
        position: node.position,
        data: node.data as any
      }
    })
    console.log(`Created sample node: ${sampleNode.nodeId}`)
  }


  console.log('✅ Seed completed successfully!')
  console.log(`   - Created admin user: ${adminUser.email}`)
  console.log(`   - Admin password: admin123`)
  console.log(`   - Created project: ${flowProject.name}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
