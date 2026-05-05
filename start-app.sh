#!/bin/bash

# Quick start script for LFR Dashboard on DigitalOcean

echo "🚀 Starting LFR Dashboard..."

# Navigate to app directory
cd /root/lfr-dashboard || exit 1

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  Warning: .env.local not found. Creating template..."
    cat > .env.local << EOF
OPENAI_API_KEY=your_openai_api_key_here
AI_SERVER_URL=http://localhost:3001
WEBSITE_URL=http://localhost:3000
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
CRON_SECRET=your_random_secret_string
EOF
    echo "📝 Please edit .env.local with your actual values"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the app if .next doesn't exist
if [ ! -d ".next" ]; then
    echo "🔨 Building the app..."
    npm run build
fi

# Start the app
echo "▶️  Starting Next.js app..."
npm start
