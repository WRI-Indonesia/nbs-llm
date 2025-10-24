#!/bin/bash

# Monitor paper import progress

echo "================================================"
echo "  Paper Import Monitor"
echo "================================================"
echo ""

# Check if import process is running
if pgrep -f "import-papers.ts" > /dev/null; then
    echo "✅ Import process is running (PID: $(pgrep -f 'import-papers.ts'))"
else
    echo "⚠️  Import process is not running"
fi

echo ""
echo "📊 Current Progress:"
echo "------------------------------------------------"

# Get latest progress from log
if [ -f paper-import.log ]; then
    # Find the last "Processing" line
    LAST_PROCESSING=$(grep -E "\[[0-9]+/[0-9]+\] Processing:" paper-import.log | tail -1)
    
    if [ ! -z "$LAST_PROCESSING" ]; then
        echo "$LAST_PROCESSING"
    fi
    
    # Count successes and failures
    SUCCESS=$(grep -c "✅ Imported" paper-import.log)
    FAILED=$(grep -c "❌ Failed to import" paper-import.log)
    
    echo ""
    echo "✅ Successfully imported: $SUCCESS papers"
    echo "❌ Failed: $FAILED papers"
    
    # Show last few log lines
    echo ""
    echo "📝 Recent activity:"
    echo "------------------------------------------------"
    tail -15 paper-import.log | grep -E "(Processing:|✅ Imported|❌ Failed|Extracted|Created.*chunks)"
fi

echo ""
echo "📈 Database Status:"
echo "------------------------------------------------"

# Check database
node -e "
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();
prisma.ragDocs.count({where:{source:'paper'}})
  .then(count => {
    console.log('Total paper chunks in database:', count);
    const estimatedPapers = Math.round(count / 15); // ~15 chunks per paper average
    console.log('Estimated papers imported: ~' + estimatedPapers);
  })
  .finally(() => prisma.\$disconnect());
" 2>/dev/null

echo ""
echo "================================================"
echo "Commands:"
echo "  - View live log: tail -f paper-import.log"
echo "  - Check full log: cat paper-import.log"
echo "  - Stop import: pkill -f import-papers.ts"
echo "================================================"

