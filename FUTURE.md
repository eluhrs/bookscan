### Auto-Crop Photography (deferred from CHANGES-07)
Canvas-based edge detection for smart cropping of book photos.
Conditions: good lighting + solid contrasting background make
simple canvas edge detection viable without heavy libraries like
OpenCV.js. Implementation: scan inward from mask edges until
significant color change detected, crop with ~10% padding per
side. Known limitation: book cover color must contrast with
background. Reference: CHANGES-07 planning discussion.

### eBay Price Suggestion via findCompletedItems (deferred from CHANGES-07)
Three-layer pricing feature using eBay's free findCompletedItems API:
1. Data: Query completed/sold listings by ISBN, last 90 days, 
   cache results to avoid repeated API calls
2. Display: Pricing panel on dashboard showing recent sold prices,
   lowest/highest/median/average statistics, filtered by condition
   where data permits, confidence indicator if sparse data
3. Strategies: Dropdown with Lowest / Median / Average / Custom 
   options that populate the listing price field automatically
Prerequisite: eBay developer account (shared with eBay API listing
integration feature). Implement after eBay API listing push is 
working since both share the same authentication setup.

### Automated CI/CD Pipeline with Bulletproof Deployment (deferred)

**Goal:** Automatically deploy to Hetzner production server on every push to main branch, with reliable ordering of migrations, explicit production mode, and fail-fast error handling.

**Components:**

1. GitHub Actions workflow (.github/workflows/deploy.yml)
   - Triggers on push to main branch only
   - SSHs into Hetzner server using a dedicated deploy key
   - Runs ./deploy.sh on the server
   - Credentials stored as GitHub Secrets (encrypted, write-only, never logged)
   - Use a dedicated SSH key pair generated specifically for deployment — not your personal key

2. Server-side deploy script (deploy.sh in project root)
   - set -e — fail fast on any error
   - git pull origin main
   - Run Alembic migrations before starting new containers
   - Bring up containers explicitly in production mode using docker-compose.prod.yml
   - Verify containers started successfully
   - Store previous commit hash before pull to enable simple manual rollback

3. Production environment hardening
   - .env.production on server explicitly sets NODE_ENV=production, ENVIRONMENT=production
   - docker-compose.prod.yml overrides any dev-mode defaults
   - Prevents app from silently falling back to development configuration

**Deployment order (critical):**
migrations → new containers → verification
Never: new containers → migrations (causes brief schema mismatch)

**Rollback:**
Manual one-liner: git checkout $PREVIOUS_COMMIT && ./deploy.sh
Not automated — simple and safe for a solo workflow.

**Note:** deploy.sh alone (without GitHub Actions) immediately improves manual deployments. Consider implementing the script first as a quick win, then adding GitHub Actions automation separately.

**Prerequisites:** GitHub repository must be set up (already done). Hetzner server SSH access already configured.

### Language selection in scan workflow (deferred from CHANGES-25)
C:Language is hardcoded to "English" in eBay export. Some inventory may be
in other languages. Add a language field to the scan workflow so non-English
books can be tagged correctly for eBay item specifics.

### C:Binding capture in scan workflow (deferred from CHANGES-25)
Currently omitted from eBay export. Could be added as a field in the scan
workflow or inferred from catalog data (hardcover vs paperback).

### C:Topic and C:Genre population from catalog subject data (deferred from CHANGES-25)
Mapping layer needed between library catalog vocabulary (LCSH, BISAC) and
eBay's controlled terms for Topic and Genre item specifics. Subject data
is available from Open Library and LoC but doesn't map 1:1 to eBay's
category-specific item specific values.
