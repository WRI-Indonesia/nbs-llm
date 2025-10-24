/**
 * Test MinIO Connection
 * Quick script to verify MinIO credentials and list available papers
 */

import { listPapers, getPaperMetadata } from '../lib/minio-client'

async function testMinIOConnection() {
  console.log('🧪 Testing MinIO Connection...\n')

  try {
    console.log('📡 Connecting to MinIO...')
    console.log(`   Endpoint: ${process.env.MINIO_ENDPOINT}`)
    console.log(`   Bucket: ${process.env.MINIO_BUCKET || 'etl-kms'}`)
    console.log(`   Path: ${process.env.MINIO_PAPERS_PATH || 'open_alex/gold_papers/'}\n`)

    const bucket = process.env.MINIO_BUCKET || 'etl-kms'
    const prefix = process.env.MINIO_PAPERS_PATH || 'open_alex/gold_papers/'

    console.log('📚 Listing papers...')
    const papers = await listPapers(bucket, prefix)

    console.log(`\n✅ Connection successful!`)
    console.log(`   Found ${papers.length} papers\n`)

    if (papers.length > 0) {
      console.log('📄 First 5 papers:')
      console.log('─'.repeat(80))
      
      for (let i = 0; i < Math.min(5, papers.length); i++) {
        const paper = papers[i]
        console.log(`${i + 1}. ${paper.fileName}`)
        console.log(`   Size: ${(paper.fileSize / 1024).toFixed(2)} KB`)
        console.log(`   Last Modified: ${paper.lastModified.toISOString()}`)
        console.log('')
      }

      console.log('─'.repeat(80))
      console.log(`\n💡 Total storage: ${(papers.reduce((sum, p) => sum + p.fileSize, 0) / 1024 / 1024).toFixed(2)} MB`)
      
      // Test downloading metadata for first paper
      console.log('\n📋 Testing metadata retrieval...')
      const firstPaper = papers[0]
      const metadata = await getPaperMetadata(firstPaper.path, bucket)
      
      if (metadata) {
        console.log('✅ Metadata retrieved successfully:')
        console.log(`   File: ${metadata.fileName}`)
        console.log(`   Size: ${(metadata.fileSize / 1024).toFixed(2)} KB`)
        console.log(`   Path: ${metadata.path}`)
      }
    } else {
      console.log('⚠️  No papers found in the specified path')
      console.log('   Please check:')
      console.log('   1. MINIO_BUCKET is correct')
      console.log('   2. MINIO_PAPERS_PATH is correct')
      console.log('   3. Credentials have read access')
    }

    console.log('\n✅ All tests passed!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Connection test failed!')
    console.error('Error:', error instanceof Error ? error.message : String(error))
    console.log('\nPlease check:')
    console.log('1. MINIO_ENDPOINT is correct')
    console.log('2. MINIO_ACCESS_KEY is correct')
    console.log('3. MINIO_SECRET_KEY is correct')
    console.log('4. Network connectivity to MinIO server')
    console.log('5. Firewall/VPN settings')
    process.exit(1)
  }
}

// Run test
testMinIOConnection()

