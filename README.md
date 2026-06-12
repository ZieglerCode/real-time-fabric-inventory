# Real-time Fabric Inventory

This application is an internal real-time system spanning mobile captures and desktop tagging to digitize fabric samples with QR codes.

## Features

- **Photographer Workspace (Mobile)**: Capture fabric photos on smartphones and upload them directly to storage.
- **Tagger Workspace (Desktop)**: View captured samples in real-time, tag styles, generate printable/copyable QR codes, and archive inventory.

## Development

### Prerequisites

- Node.js (version 20 or higher)

### Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env`:
   ```text
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   FABRIC_API_KEYS="replace-with-a-long-random-token"
   APP_URL="http://localhost:3000"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Integration API

QR labels encode the public mobile viewer URL:

```text
GET /public/fabrics/{qr_code_id}
```

Customers can save multiple scanned fabrics locally on their phone and open their saved selection at:

```text
GET /public/selection
```

The machine-readable public lookup API remains available:

```text
GET /api/public/fabrics/{qr_code_id}
```

This public endpoint returns one completed fabric record with metadata, team/session context, image URL, and import links.

Protected import endpoints require either `Authorization: Bearer <key>` or `x-api-key: <key>`, where `<key>` is one of the comma-separated `FABRIC_API_KEYS` values:

```text
GET /api/v1/fabrics
GET /api/v1/fabrics/{qr_code_id}
```

Supported list filters:

```text
?status=completed
?team_id=<uuid>
?session_id=<uuid>
?created_since=2026-06-01T00:00:00Z
?updated_since=2026-06-01T00:00:00Z
?q=FABRIC-3313ED11
?limit=100&offset=0
```
