# LFR Music Label Dashboard

A professional music label employee dashboard with local JSON storage and OpenAI-powered AI analysis. Features role-based access control for Artists, Managers, and Admins with comprehensive analytics and data visualization.

## Features

### 🔐 Authentication
- Email/password login system
- Role-based access control
- Protected routes

### 👤 User Roles

#### Artist Dashboard
- Streaming statistics (Spotify & Apple Music)
- Social media metrics (Instagram, Twitter, TikTok)
- Upcoming releases calendar
- Revenue breakdown with charts
- Performance trends and growth metrics

#### Manager Dashboard
- Overview of all managed artists
- Task checklist for releases
- Team communication section
- Artist performance comparisons
- Monthly growth trends

#### Admin Dashboard
- Complete overview of all artists
- **CSV data file upload with local JSON storage**
- **AI-powered analysis using OpenAI GPT-4**
- Real-time insights on streaming trends, performance breakdown, and engagement patterns
- Platform comparison analytics
- Label-wide performance metrics
- Advanced analytics visualizations

### 🎨 Design Features
- **Black theme by default** - Professional dark interface
- Modern, sleek SaaS-style UI
- Responsive layout (mobile, tablet, desktop)
- Interactive charts and data visualization
- Smooth animations and transitions
- Gradient cards and modern styling

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Storage**: Local JSON files (stored in `/data` directory)
- **AI**: OpenAI GPT-4
- **CSV Parsing**: PapaParse

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- OpenAI API key

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file in the root directory:
```env
# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key

# AI Server URL (optional - defaults to http://localhost:3001)
# Set this if your message AI server is running on a different URL/port
AI_SERVER_URL=http://localhost:3001

# Cron Secret (optional - for securing scheduled jobs)
# Used to protect Instagram metrics fetch endpoint
CRON_SECRET=your_random_secret_string
```

3. **AI Server Setup** (Required for AI Chat feature):
   - The dashboard requires a separate "message AI server" running on port 3001
   - This server handles AI chat interactions and notifications
   - If you don't have the AI server running, the AI chat feature will show an error
   - To start the AI server, navigate to the message AI server directory and run it
   - The server should be accessible at `http://localhost:3001` (or your configured `AI_SERVER_URL`)
   - **Note**: The dashboard will still function without the AI server, but AI chat features will be unavailable

4. Run the development server:
```bash
npm run dev
```

5. **Start the AI Server** (if using AI chat features):
   - Ensure the message AI server is running on port 3001
   - The dashboard will connect to it automatically

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## CSV Upload & AI Analysis

### Uploading CSV Data

1. Navigate to the Admin Dashboard
2. Click on the CSV upload area
3. Select a CSV file with your streaming/performance data
4. The file will be parsed and stored locally in JSON files within the `/data` directory
5. AI analysis will automatically trigger after upload

### AI Analysis

1. After uploading a CSV, AI analysis will automatically trigger
2. The system will analyze your data using OpenAI GPT-4
3. Get insights on:
   - Streaming trends and patterns
   - Performance breakdown by platform/artist
   - Engagement patterns and growth opportunities
   - Actionable recommendations

## Project Structure

```
lfr-dashboard/
├── app/
│   ├── api/
│   │   ├── upload-csv/      # CSV upload endpoint
│   │   ├── analyze-data/     # OpenAI analysis endpoint
│   │   ├── get-analyses/     # Fetch analyses
│   │   └── get-uploads/      # Fetch uploads
│   ├── dashboard/            # Dashboard pages
│   ├── login/                # Login page
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   ├── dashboards/           # Role-specific dashboards
│   ├── Chart.tsx             # Reusable chart component
│   ├── Sidebar.tsx           # Navigation sidebar
│   └── ProtectedRoute.tsx   # Route protection
├── contexts/
│   ├── AuthContext.tsx       # Authentication state
│   └── ThemeContext.tsx      # Dark mode state
├── lib/
│   └── storage.ts            # Local JSON storage utilities
├── data/                     # Local data storage directory
│   ├── uploads.json          # CSV upload records
│   ├── analyses.json         # AI analysis results
│   ├── catalog.json          # Catalog items
│   ├── users.json            # User accounts
│   └── artist_*.json         # Artist-specific data files
└── types/
    └── index.ts              # TypeScript type definitions
```

## Features in Detail

### Charts & Visualization
- Line charts for trend analysis
- Bar charts for comparisons
- Pie charts for distribution
- Responsive and interactive
- Multiple analytics views

### Responsive Design
- Mobile-first approach
- Collapsible sidebar on mobile
- Adaptive grid layouts
- Touch-friendly interactions

### Black Theme
- Default black/dark theme
- Professional appearance
- Gradient cards and modern styling
- Smooth theme transitions

## Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in values (never commit `.env.local`). At minimum, set `OPENAI_API_KEY` for AI features; on a server, set `DATA_DIR` and `UPLOAD_DIR` to persistent paths (see `.env.example` comments).

## Repository & deployment (GitHub / Vercel / server)

- **CI:** `.github/workflows/ci.yml` runs `npm ci` and `npm run build` on pushes/PRs to `main` or `master`.
- **Vercel + GitHub:** see [`GITHUB_VERCEL.md`](./GITHUB_VERCEL.md) for import steps and which env vars to add. This app needs **persistent disk** for `data/` and file uploads. **Vercel serverless** does not keep that data between requests the way a Mac or VPS does; for a full production deploy with the same behavior as local, use a **VPS / systemd / Docker** with a volume (`QUICK_DEPLOY.md`, `DEPLOY_DIGITALOCEAN.md`).
- **Data and uploads off-repo (faster git/deploy):** run **`npm run setup:split`** to put `DATA_DIR` on your Mac and `UPLOAD_DIR` on the external volume (or see [`EXTERNAL_DATA.md`](./EXTERNAL_DATA.md)). Check paths with `npm run paths`.

## Data Storage

All data is stored locally in JSON files within the `/data` directory:
- CSV uploads are parsed and stored as JSON
- Each artist has their own JSON file
- Catalog items, analyses, and user data are stored separately
- Files are automatically created and managed by the storage utilities

## License

MIT
