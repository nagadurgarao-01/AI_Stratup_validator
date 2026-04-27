#!/usr/bin/env pwsh
# =============================================================================
# AI Startup Idea Validator — Google Cloud Setup Script
# Run this ONCE to configure your GCP project before the first deployment.
#
# Usage:
#   .\setup-gcp.ps1 -ProjectId "your-firebase-project-id" -GeminiKey "your-key"
#
# Prerequisites:
#   - gcloud CLI installed and logged in (gcloud auth login)
#   - Firebase project already created
#   - service-account.json downloaded from Firebase Console
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,

    [Parameter(Mandatory=$true)]
    [string]$GeminiKey,

    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 AI Startup Idea Validator — GCP Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Project:  $ProjectId"
Write-Host "Region:   $Region`n"

# ── Step 1: Set active project ────────────────────────────────────────────────
Write-Host "📋 Step 1/6: Setting active GCP project..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# ── Step 2: Enable required APIs ─────────────────────────────────────────────
Write-Host "`n📋 Step 2/6: Enabling required APIs (this may take a minute)..." -ForegroundColor Yellow
gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com `
    firestore.googleapis.com `
    secretmanager.googleapis.com `
    dlp.googleapis.com
Write-Host "✅ APIs enabled." -ForegroundColor Green

# ── Step 3: Store secrets in Secret Manager ───────────────────────────────────
Write-Host "`n📋 Step 3/6: Storing secrets in Secret Manager..." -ForegroundColor Yellow

# Gemini API Key
$geminiSecretExists = gcloud secrets list --filter="name~GEMINI_API_KEY" --format="value(name)" 2>$null
if ($geminiSecretExists) {
    Write-Host "  ⚠️  GEMINI_API_KEY secret already exists. Adding new version..."
    $GeminiKey | gcloud secrets versions add GEMINI_API_KEY --data-file=-
} else {
    Write-Host "  Creating GEMINI_API_KEY secret..."
    $GeminiKey | gcloud secrets create GEMINI_API_KEY --data-file=-
}

# Firebase Service Account
$saPath = ".\backend\service-account.json"
if (Test-Path $saPath) {
    $saSecretExists = gcloud secrets list --filter="name~FIREBASE_SERVICE_ACCOUNT" --format="value(name)" 2>$null
    if ($saSecretExists) {
        Write-Host "  ⚠️  FIREBASE_SERVICE_ACCOUNT secret already exists. Adding new version..."
        gcloud secrets versions add FIREBASE_SERVICE_ACCOUNT --data-file=$saPath
    } else {
        Write-Host "  Creating FIREBASE_SERVICE_ACCOUNT secret..."
        gcloud secrets create FIREBASE_SERVICE_ACCOUNT --data-file=$saPath
    }
    Write-Host "✅ Secrets stored." -ForegroundColor Green
} else {
    Write-Host "  ⚠️  WARNING: backend\service-account.json not found." -ForegroundColor Red
    Write-Host "  Download it from Firebase Console → Project Settings → Service Accounts" -ForegroundColor Red
    Write-Host "  Then re-run this script or add the secret manually." -ForegroundColor Red
}

# ── Step 4: Grant Cloud Run SA access to secrets + Firestore ─────────────────
Write-Host "`n📋 Step 4/6: Configuring service account permissions..." -ForegroundColor Yellow
$projectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
$cloudRunSA = "$projectNumber-compute@developer.gserviceaccount.com"

# Secret access
gcloud secrets add-iam-policy-binding GEMINI_API_KEY `
    --member="serviceAccount:$cloudRunSA" `
    --role="roles/secretmanager.secretAccessor"

if (Test-Path $saPath) {
    gcloud secrets add-iam-policy-binding FIREBASE_SERVICE_ACCOUNT `
        --member="serviceAccount:$cloudRunSA" `
        --role="roles/secretmanager.secretAccessor"
}

# Firestore access
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$cloudRunSA" `
    --role="roles/datastore.user"

Write-Host "✅ Permissions configured." -ForegroundColor Green

# ── Step 5: Create GCP Service Account for GitHub Actions ────────────────────
Write-Host "`n📋 Step 5/6: Creating GitHub Actions service account..." -ForegroundColor Yellow
$ghSaName = "github-actions-deployer"
$ghSaEmail = "$ghSaName@$ProjectId.iam.gserviceaccount.com"

$ghSaExists = gcloud iam service-accounts list --filter="email=$ghSaEmail" --format="value(email)" 2>$null
if (-not $ghSaExists) {
    gcloud iam service-accounts create $ghSaName `
        --display-name="GitHub Actions Deployer"
}

# Grant required roles
@(
    "roles/run.admin",
    "roles/cloudbuild.builds.editor",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
    "roles/secretmanager.secretAccessor"
) | ForEach-Object {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$ghSaEmail" `
        --role=$_
}

# Create and download key
$keyFile = "github-actions-sa-key.json"
gcloud iam service-accounts keys create $keyFile --iam-account=$ghSaEmail
Write-Host "✅ GitHub Actions SA created. Key saved to: $keyFile" -ForegroundColor Green

# ── Step 6: Print next steps ──────────────────────────────────────────────────
Write-Host "`n📋 Step 6/6: Summary & Next Steps" -ForegroundColor Yellow
Write-Host "=========================================="
Write-Host ""
Write-Host "✅ GCP setup complete! Now do the following:" -ForegroundColor Green
Write-Host ""
Write-Host "1. Add these GitHub Repository Secrets:" -ForegroundColor Cyan
Write-Host "   Go to: https://github.com/nagadurgarao-01/AI_Stratup_validator/settings/secrets/actions"
Write-Host ""
Write-Host "   GCP_SA_KEY              = (contents of $keyFile)"
Write-Host "   GCP_PROJECT_ID          = $ProjectId"
Write-Host "   FIREBASE_PROJECT_ID     = $ProjectId"
Write-Host "   GEMINI_API_KEY          = (your gemini key — already in Secret Manager)"
Write-Host "   NEXT_PUBLIC_FIREBASE_API_KEY         = (from Firebase Console)"
Write-Host "   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN     = $ProjectId.firebaseapp.com"
Write-Host "   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET  = $ProjectId.appspot.com"
Write-Host "   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = (from Firebase Console)"
Write-Host "   NEXT_PUBLIC_FIREBASE_APP_ID          = (from Firebase Console)"
Write-Host ""
Write-Host "2. Push to main to trigger deployment:" -ForegroundColor Cyan
Write-Host "   git push origin main"
Write-Host ""
Write-Host "⚠️  Delete the key file after adding it to GitHub:" -ForegroundColor Red
Write-Host "   Remove-Item $keyFile"
Write-Host ""
