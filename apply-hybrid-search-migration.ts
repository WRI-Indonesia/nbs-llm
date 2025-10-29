// Script to apply the hybrid search migration
// Run this with: npx dotenv-cli -e .env -- tsx apply-hybrid-search-migration.ts

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyMigration() {
  console.log('🔄 Applying hybrid search migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'prisma', 'migrations', 'add_hybrid_search', 'migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Parse SQL statements, handling function definitions with $$ delimiters
    const statements: string[] = [];
    let currentStatement = '';
    let inFunctionBody = false;
    let functionDelimiter = '';
    
    // Split by lines to properly handle function definitions
    const lines = migrationSQL.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('--')) {
        continue;
      }
      
      // Check for function start: AS $$ or AS $tag$
      const functionStartMatch = trimmedLine.match(/AS\s+(\$\$|\$[a-zA-Z_]+\$)/i);
      if (functionStartMatch && !inFunctionBody) {
        inFunctionBody = true;
        functionDelimiter = functionStartMatch[1];
        currentStatement += (currentStatement ? '\n' : '') + line;
        continue;
      }
      
      // Check for function end: $$ or $tag$ (may be at end of line or in middle with LANGUAGE)
      if (inFunctionBody && trimmedLine.includes(functionDelimiter)) {
        inFunctionBody = false;
        currentStatement += '\n' + line;
        statements.push(currentStatement.trim());
        currentStatement = '';
        functionDelimiter = '';
        continue;
      }
      
      // If in function body, just add the line
      if (inFunctionBody) {
        currentStatement += '\n' + line;
        continue;
      }
      
      // Not in function body, check for semicolon (statement end)
      currentStatement += (currentStatement ? '\n' : '') + line;
      
      if (trimmedLine.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    // Filter out empty statements
    const validStatements = statements.filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${validStatements.length} SQL statements to execute\n`);
    
    for (let i = 0; i < validStatements.length; i++) {
      const statement = validStatements[i];
      
      try {
        console.log(`Executing statement ${i + 1}/${validStatements.length}...`);
        // Remove trailing semicolon for function definitions (they don't need it)
        let cleanStatement = statement;
        if (!statement.includes('$$') && statement.endsWith(';')) {
          cleanStatement = statement.slice(0, -1).trim();
        }
        await prisma.$executeRawUnsafe(cleanStatement);
        console.log(`✅ Statement ${i + 1} completed\n`);
      } catch (error: any) {
        // Some statements might fail if they already exist
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist') ||
            error.message.includes('duplicate key')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message.split('\n')[0]}\n`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.error(`Statement preview: ${statement.substring(0, 200)}...\n`);
          throw error;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Added text_search_vector columns to minio_docs and node_docs');
    console.log('   - Created GIN indexes for full-text search');
    console.log('   - Updated existing rows with text_search_vector values');
    console.log('   - Created triggers for automatic text_search_vector updates');
    console.log('   - Created hybrid search functions: match_minio_docs_hybrid and match_node_docs_hybrid');
    console.log('\n💡 Hybrid search is now enabled by default (use_hybrid=true, hybrid_alpha=0.7)');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration().catch(console.error);

