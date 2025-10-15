# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MemoTrip is a lightweight, self-hosted expense splitting and photo gallery application designed for group trips. The system combines multi-party expense tracking with photo sharing capabilities, featuring AI-powered receipt parsing and one-click settlement export.

**Core Features:**
- Multi-household expense tracking with configurable participant weights
- AI-powered receipt parsing using OpenAI Vision API
- Photo gallery with EXIF metadata support
- Settlement calculation and visual export (PNG/PDF)
- Invite-based trip access control

## Architecture

### Tech Stack
- **Frontend/Backend:** Next.js 15 (App Router) with TypeScript and API Routes on port 3001
- **Database:** PostgreSQL 16 (containerized with volume persistence)
- **ORM:** Prisma for type-safe database access
- **Cache:** Redis 7 (for future queue implementation)
- **File Storage:** Local filesystem volumes (`./data/uploads`, `./data/thumbs`, `./data/exports`)
- **Export Rendering:** Server-side rendered HTML pages (Puppeteer integration planned)
- **Styling:** Tailwind CSS with dark mode support
- **Authentication:** Simple email/password with localStorage (session management TBD)

### Deployment Model
Single-machine Docker Compose deployment with no cloud dependencies (no S3, CDN, or reverse proxy required). All file operations use local volumes.

### Data Architecture

**Permission Model:**
- Row-level security based on `tripId`
- Trip access controlled via `TripAdmin` and `TripParticipant` relationships
- Household-based grouping for expense splitting

**Key Entities:**
- `User`: Basic user profile
- `Household`: Grouping entity for expense splitting (e.g., families)
- `Trip`: Event boundary containing receipts, photos, and settlements
- `Receipt`: Uploaded receipt with AI parsing results and manual edits
- `Settlement`: Versioned settlement calculations with tableJson and transfersJson
- `Photo`: Gallery images with EXIF metadata

**File Storage Strategy:**
- Receipts: `data/uploads/receipts/`
- Photos: `data/uploads/photos/`
- Thumbnails: `data/thumbs/`
- Exports: `data/exports/`
- All paths stored as relative paths in database, NOT S3 keys
- File access gated through API endpoints that verify user permissions

## Development Commands

### Docker Compose Operations
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f web

# Stop services
docker compose down

# Rebuild after code changes
docker compose up -d --build web
```

### Database Operations
```bash
# Run Prisma migrations (on first setup)
# Inside web container or via docker exec
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
npx prisma studio
```

### Testing During Development
```bash
# Run tests (when implemented)
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## Critical Implementation Details

### Receipt Parsing Workflow
1. User uploads receipts to `data/uploads/receipts/`
2. Click "Parse All" triggers sequential/parallel OpenAI Vision API calls
3. Input: Base64-encoded receipt image + trip context (households, weights, currency)
4. Output: Strict JSON with total, tax/tip, date, merchant, suggested participating households
5. Results displayed in AG Grid for inline editing
6. "Recalculate Settlement" generates `Settlement.tableJson` and `Settlement.transfersJson`

**Important:** Parse operations may be synchronous (no queue) for small teams. Add Redis/BullMQ later for scale.

### Settlement Export (Critical Feature)

**Export Flow:**
1. User clicks Export button (PNG/PDF/CSV options)
2. Backend opens readonly route `/export/settlement/:tripId/:version?style=compact`
3. Puppeteer/Playwright renders HTML to image/PDF
4. File saved to `data/exports/settlement-<trip>-v<version>.png|pdf`
5. Download link returned to user

**Export Template Visual Spec:**
- Three-column layout (dynamically adapts to household count)
- Three rows: `Adults(x1)`, `Kids(x0.5)`, `Total` (showing weighted sums)
- Expense categories below (House, Lunch, Dinner, etc.)
- `Paid` row shows amounts in parentheses as negative: `(1,555.76)`
- `Net Amount` row: **bold**, thick bottom border (`border-b-4`), right-aligned tabular numbers
- Use `font-feature-settings: "tnum"` or Tailwind's `tabular-nums`
- Subtotal rows have top border (`border-t`), total rows have heavier border (`border-t-2`)
- Black/white export by default (print-friendly), optional color mode
- Hide navigation UI in export, show only table with proper padding (32px for PNG, 10-15mm for PDF)
- Optional: Display total weight (e.g., "Total Weight = 10.5") on right side

**Font Requirements:**
- Primary: Inter or Noto Sans
- Tabular numbers for proper alignment
- Add Noto Sans SC for Chinese text support

### Settlement Algorithm
1. Calculate participation weights (kids = 0.5, adults = 1.0, configurable)
2. For each receipt, split `grandTotal` by weight to get `shouldPay_i` per household
3. Track `paid_i` based on which household paid
4. Calculate `net_i = paid_i - shouldPay_i` (positive = owed to them, negative = they owe)
5. Generate minimum transfer suggestions using greedy matching
6. Round to 2 decimals, allow ±0.01 tolerance for rounding differences
7. Store as versioned `Settlement` record

### Photo Gallery Features
- Upload to `data/uploads/photos/`
- Extract EXIF on frontend (using exifr), send to backend with POST
- Generate thumbnails on first access (sync is acceptable for MVP)
- Timeline/grouping based on EXIF date
- "Select → Download" creates streaming ZIP to `data/exports/*.zip`
- Implement periodic cleanup for exports

### File Access Security
**CRITICAL:** All file downloads must go through API endpoints that:
1. Verify user has access to the trip
2. Read file from local volume
3. Stream file to user
4. Never expose direct file paths to frontend

Example: `GET /api/trips/:tripId/photos/:photoId/download`

### API Route Patterns

**Implemented Routes:**
```
# Authentication
POST /api/auth/register                   # Create user + default household
POST /api/auth/login                      # Login user

# Households
GET  /api/households?userId={id}          # List user's households

# Trips
POST /api/trips                           # Create trip
GET  /api/trips?userId={id}               # List user's trips
GET  /api/trips/:tripId                   # Get trip details

# Participants
GET  /api/trips/:tripId/participants      # List trip participants
POST /api/trips/:tripId/participants      # Add participant
DELETE /api/trips/:tripId/participants?participantId={id}  # Remove participant

# Receipts
POST /api/trips/:tripId/receipts          # Upload receipt
GET  /api/trips/:tripId/receipts          # List receipts

# Photos
POST /api/trips/:tripId/photos            # Upload photo
GET  /api/trips/:tripId/photos            # List photos

# Settlements
GET  /api/trips/:tripId/settlements       # List settlements
POST /api/trips/:tripId/settlements/recompute  # Calculate new settlement

# File Serving
GET  /api/files/:...path                  # Serve uploaded files (images)

# Export Templates
GET  /export/settlement/:tripId/:version  # Settlement export template (HTML)
```

**Planned Routes:**
```
POST /api/trips/:tripId/invite            # Create invite code
POST /api/invite/accept                   # Accept invite
POST /api/trips/:tripId/receipts/parse    # Trigger AI parsing
PATCH /api/receipts/:id                   # Manual corrections
POST /api/trips/:tripId/photos/zip        # Generate ZIP
GET  /api/trips/:tripId/settlements/:id/export.{png|pdf|csv}  # Export settlement
```

### Environment Variables
```
DATABASE_URL=postgresql://trip:trip@db:5432/trip
OPENAI_API_KEY=sk-...
UPLOAD_ROOT=/app/data/uploads
EXPORT_ROOT=/app/data/exports
THUMB_ROOT=/app/data/thumbs
PORT=3000
NODE_ENV=production
```

## Implementation Status

### ✅ Completed Features

**User Management:**
- User registration with automatic household creation
- Email/password authentication
- User login with localStorage session

**Trip Management:**
- Create trips with currency selection
- Trip dashboard with receipt/photo counts
- Automatic creator household as first participant
- Trip detail view with tabbed interface

**Household & Participant Management:**
- Automatic household creation on user registration
- Add/remove participants from trips
- Configurable participant weights (0.5 for kids, 1.0 for adults)
- Household member display with email addresses

**Receipt Management:**
- Receipt file upload
- Receipt status tracking (PENDING, PARSED, REVIEWED, ERROR)
- Receipt image preview with click-to-enlarge
- Receipt listing by trip

**Photo Gallery:**
- Photo file upload
- Photo grid display with uploader info
- Photo image preview
- Photo listing by trip

**Settlement Calculation:**
- Weight-based expense splitting algorithm
- Settlement calculation with version tracking
- Transfer suggestion generation (minimum transfers)
- Settlement export template (server-side rendered HTML)

**File Serving:**
- Secure file serving API (`/api/files/[...path]`)
- Image display for receipts and photos
- Security check to prevent directory traversal

### 🚧 In Progress / Planned Features

**MVP Phase 2:**
- OpenAI-powered receipt parsing
- Editable expense grid for manual corrections
- Puppeteer PNG/PDF rendering for settlements
- ZIP download for selected photos

**Enhancement Phase:**
- Invitation system for trip access
- Redis + BullMQ for queue-based processing
- Duplicate receipt detection (file hash + similarity)
- EXIF metadata extraction and display
- Thumbnail generation for photos
- Auto-cleanup for old exports
- Backup strategy for database and files
- Session-based authentication (replace localStorage)

## Development Considerations

### Local-First Constraints
- No cloud object storage (S3/MinIO)
- No CDN or reverse proxy required
- All files on local volumes
- Disk space management is critical (implement cleanup policies)

### Puppeteer/Playwright
- Large Docker image size (consider `puppeteer-core` + separate Chromium)
- May need `SYS_ADMIN` capability in Docker
- Alternative: Use official Playwright Docker image

### Concurrency
- Without queue: Parse/export operations block main process
- Show "please wait" UI for batch operations
- Consider processing limit (e.g., 50 receipts at once)
- Add Redis/BullMQ when scale demands it

### Export Visual Validation Checklist
When implementing export template, verify:
- [ ] Column headers show household names with underline
- [ ] Adults(x1) / Kids(x0.5) / Total rows present
- [ ] Expense categories right-aligned with proper borders
- [ ] Paid row uses parentheses for negative amounts
- [ ] Net Amount row is bold with thick bottom border
- [ ] Tabular numbers properly aligned
- [ ] Total weight annotation displayed (optional)
- [ ] No navigation UI in export view
- [ ] Proper padding/margins for PNG (32px) and PDF (10-15mm)

## Key Technical Decisions

1. **No Queue for MVP:** Synchronous processing acceptable for small teams, add Redis/BullMQ later
2. **Local File Storage:** Simplifies deployment, eliminates cloud dependencies
3. **Puppeteer for Export:** Provides "what you see is what you get" export from HTML template
4. **Row-Level Security:** All queries filtered by `tripId` based on user's trip memberships
5. **Versioned Settlements:** Each recalculation creates new version, enables audit trail
6. **Weight-Based Splitting:** Configurable participant weights (kids=0.5) for fair cost allocation
