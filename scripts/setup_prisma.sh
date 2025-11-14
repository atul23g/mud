#!/bin/bash
# Setup Prisma database

set -e

echo "=========================================="
echo "Setting up Prisma Database"
echo "=========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo "Please create .env file from .env.example"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env"
    exit 1
fi

# Check if it's a placeholder
if [[ "$DATABASE_URL" == *"neon-host.neon.tech"* ]] || [[ "$DATABASE_URL" == *"user:password"* ]]; then
    echo "❌ DATABASE_URL contains placeholder values"
    echo "Please update .env with your actual Neon database URL"
    exit 1
fi

echo "✅ DATABASE_URL is set"

# Generate Prisma client
echo ""
echo "Generating Prisma client..."
python -m prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma client generated"
else
    echo "❌ Failed to generate Prisma client"
    exit 1
fi

# Push schema to database
echo ""
echo "Pushing schema to database..."
python -m prisma db push

if [ $? -eq 0 ]; then
    echo "✅ Schema pushed to database"
else
    echo "❌ Failed to push schema to database"
    echo "Check your DATABASE_URL and database connection"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Prisma setup complete!"
echo "=========================================="


