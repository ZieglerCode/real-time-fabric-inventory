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
   APP_URL="http://localhost:3000"
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.
