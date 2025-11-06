import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { SAMPLE_NODES } from './sample-node.ts'
import {
  createMatchMinioDocsFunction,
  createMatchMinioDocsHybridFunction,
  createMatchNodeDocsHybridFunction,
  createMatchNodeDocsFunction,
} from './function.ts'
import {
  addTextSearchVectorColumns,
  populateTextSearchVectors,
  createUpdateTextSearchVectorFunction,
  createTextSearchTriggers,
} from './trigger.ts'
import { UserConfig } from '@/types/user-config.ts'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Setup triggers and text search vectors for hybrid search
  console.log('🔧 Setting up triggers and text search vectors...')
  await addTextSearchVectorColumns()
  await populateTextSearchVectors()
  await createUpdateTextSearchVectorFunction()
  await createTextSearchTriggers()

  // Create database functions
  console.log('⚙️  Creating database functions...')
  await createMatchMinioDocsFunction()
  await createMatchMinioDocsHybridFunction()
  await createMatchNodeDocsHybridFunction()
  await createMatchNodeDocsFunction()

  // --- Your existing seed logic -------------------------------------------
  // console.log('🗑️  Resetting existing data...')
  // await prisma.flowEdge.deleteMany()
  // await prisma.flowNode.deleteMany()
  // await prisma.flowProject.deleteMany()
  // await prisma.session.deleteMany()
  // await prisma.account.deleteMany()
  // await prisma.user.deleteMany()

  console.log('👤 Upserting admin user...')
  const hashedPassword = await bcrypt.hash('admin123', 12)
  const defaultConfig: UserConfig = {
    chunkSize: 1000,
    overlap: 200,
    topK: 10,
    minCos: 0.2,
    cacheEnabled: true,
    semanticTopK: 10,
    cacheTtlSemretr: 1800,
    useHybridSearch: true,
    hybridMinCosine: 0.2,
    hybridTopK: 5,
    hybridAlpha: 0.7,
    rerankEnabled: true,
    rerankTopN: 20,
    rerankModelName: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
    repromptAgentModel: 'gpt-4o-mini',
    sqlGeneratorAgentModel: 'gpt-4o',
    embeddingAgentModel: 'text-embedding-3-large',
    summarizationModelEndpoint: 'https://seallm.wri-indonesia.or.id/v1/chat/completions',
    summarizationModel: 'SeaLLMs/SeaLLM-7B-v2.5',
  }
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Admin User',
      emailVerified: new Date(),
      password: hashedPassword,
      role: 'ADMIN',
      config: defaultConfig as any,
    },
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN',
      config: defaultConfig as any,
    },
  })

  console.log('📊 Upserting default flow project...')
  const flowProject = await prisma.flowProject.upsert({
    where: { id: 'DEFAULT' },
    update: {
      name: 'Main Project',
      description: 'Main knowledge flow project with sample data',
    },
    create: {
      id: 'DEFAULT',
      name: 'Main Project',
      description: 'Main knowledge flow project with sample data',
    }
  })

  console.log('🔗 Upserting sample flow node...')
  for (const node of SAMPLE_NODES) {
    // Find existing node by composite unique constraint (projectId, nodeId)
    const existingNode = await prisma.flowNode.findFirst({
      where: {
        projectId: flowProject.id,
        nodeId: node.id,
      },
    })

    const sampleNode = existingNode
      ? await prisma.flowNode.update({
        where: { id: existingNode.id },
        data: {
          projectId: flowProject.id,
          type: node.type as string,
          position: node.position,
          data: node.data as any,
        },
      })
      : await prisma.flowNode.create({
        data: {
          id: node.id,
          projectId: flowProject.id,
          nodeId: node.id,
          data: node.data as any,
          type: node.type as string,
          position: node.position,
        },
      })
    console.log(`Upserted sample node: ${sampleNode.nodeId}`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
