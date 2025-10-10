#!/bin/bash

# Setup script for Flow Schema Designer
echo "🚀 Setting up Flow Schema Designer..."

# Create .env.local file
echo "📝 Creating .env.local file..."

cat > .env.local << EOF
# NextAuth Configuration
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (optional - for Google sign-in)
# Get these from https://console.developers.google.com/
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL="file:./dev.db"
EOF

echo "✅ Created .env.local with a random NEXTAUTH_SECRET"
echo ""
echo "📋 Next steps:"
echo "1. If you want Google OAuth, update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000 to test the application"
echo "4. Non-authenticated users will be redirected to home when accessing /schemas"
echo "5. Authentication is handled via modals - no separate auth pages needed"
echo ""
echo "🔐 Your NEXTAUTH_SECRET has been generated automatically"
echo "   Keep this secret safe and don't share it publicly!"
