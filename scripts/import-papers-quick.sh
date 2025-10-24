#!/bin/bash

# Quick Start Script for Paper Import
# This script imports papers from MinIO into the PostgreSQL vector database

echo "================================================"
echo "  Knowledge Base Paper Import - Quick Start"
echo "================================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "⚠️  Warning: .env file not found!"
  echo "Please ensure your .env file contains:"
  echo "  - MINIO_ENDPOINT"
  echo "  - MINIO_ACCESS_KEY"
  echo "  - MINIO_SECRET_KEY"
  echo "  - OPENAI_API_KEY"
  echo ""
  read -p "Do you want to continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Ask for import limit
echo "How many papers do you want to import?"
echo "  1. Import first 5 papers (testing)"
echo "  2. Import first 25 papers (small batch)"
echo "  3. Import first 100 papers (medium batch)"
echo "  4. Import ALL papers (full import)"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    export IMPORT_LIMIT=5
    ;;
  2)
    export IMPORT_LIMIT=25
    ;;
  3)
    export IMPORT_LIMIT=100
    ;;
  4)
    unset IMPORT_LIMIT
    ;;
  *)
    echo "Invalid choice. Defaulting to 5 papers."
    export IMPORT_LIMIT=5
    ;;
esac

echo ""
echo "🚀 Starting import..."
echo "================================================"
echo ""

# Run the import script
npx tsx src/scripts/import-papers.ts

echo ""
echo "================================================"
echo "✅ Import complete!"
echo ""
echo "Next steps:"
echo "  1. Test a query: http://localhost:3000/api/ai/search"
echo "  2. View imported papers: http://localhost:3000/api/knowledge/upload"
echo "  3. Check documentation: KNOWLEDGE_BASE_SETUP.md"
echo "================================================"

