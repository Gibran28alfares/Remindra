#!/bin/bash
# Setup script untuk deploy REMINDRA ke Google Cloud Run

set -e

echo "🚀 REMINDRA - Google Cloud Run Deployment Setup"
echo "==============================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI tidak ditemukan. Silakan install dari: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
read -p "Masukkan Google Cloud Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Project ID tidak boleh kosong"
    exit 1
fi

echo "📝 Mengatur project ke: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Mengaktifkan required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Create .env.local for Cloud Run (if needed)
echo ""
echo "⚙️  Setup Environment Variables"
echo "==============================="
echo "Anda akan diminta untuk mengisi variabel environment yang diperlukan:"
echo ""

# Get Supabase credentials
read -p "NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_KEY
read -p "SUPABASE_SERVICE_ROLE_KEY: " SERVICE_ROLE_KEY

# Get WhatsApp credentials (optional)
read -p "WHATSAPP_ACCESS_TOKEN (optional): " WHATSAPP_TOKEN
read -p "WHATSAPP_PHONE_NUMBER_ID (optional): " PHONE_ID
read -p "WHATSAPP_GRAPH_API_VERSION (optional, default v23.0): " GRAPH_VERSION

GRAPH_VERSION=${GRAPH_VERSION:-v23.0}

read -p "WHATSAPP_WEBHOOK_VERIFY_TOKEN (optional): " WEBHOOK_TOKEN

# Create Cloud Run service dengan environment variables
echo ""
echo "🐳 Building dan deploying Docker image..."

# Build using Cloud Build
gcloud builds submit \
    --config=cloudbuild.yaml \
    --substitutions _SUPABASE_URL="$SUPABASE_URL",_SUPABASE_KEY="$SUPABASE_KEY"

echo ""
echo "✅ Deployment selesai!"
echo ""
echo "📊 Informasi Service:"
echo "Service Name: remindra"
echo "Region: us-central1"
echo ""
echo "Untuk melihat logs:"
echo "  gcloud run logs remindra --region=us-central1 --limit=50"
echo ""
echo "Untuk update environment variables:"
echo "  gcloud run services update remindra --region=us-central1 --update-env-vars KEY=VALUE"
