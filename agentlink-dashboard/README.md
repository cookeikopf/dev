# AgentLink Dashboard

A modern Next.js dashboard for managing AI agents, tracking transactions, and monitoring revenue metrics.

## Features

- **Agent Management**: Register, view, and manage AI agents with detailed information
- **Transaction Tracking**: Monitor all payments with filtering and export capabilities
- **Revenue Analytics**: Visualize revenue trends and transaction volumes with interactive charts
- **Activity Feed**: Stay updated with real-time agent activities
- **Authentication**: Secure user authentication with Clerk
- **Responsive Design**: Fully responsive UI that works on all devices

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts
- **Data Fetching**: React Query (TanStack Query)
- **Authentication**: Clerk
- **Testing**: Playwright (E2E)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd agentlink-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
- Get Clerk API keys from [clerk.dev](https://clerk.dev)
- Configure your API URL

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
agentlink-dashboard/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Dashboard routes (protected)
│   │   ├── agents/         # Agent list and detail pages
│   │   ├── transactions/   # Transaction logs
│   │   └── settings/       # User settings
│   ├── sign-in/            # Sign-in page
│   ├── sign-up/            # Sign-up page
│   └── layout.tsx          # Root layout
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components (sidebar, header)
│   ├── dashboard/          # Dashboard-specific components
│   ├── agents/             # Agent-related components
│   └── transactions/       # Transaction-related components
├── lib/                    # Utility functions
│   ├── utils.ts            # Helper functions
│   └── api.ts              # API client
├── types/                  # TypeScript type definitions
├── hooks/                  # Custom React hooks
├── e2e/                    # Playwright E2E tests
└── public/                 # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run test:e2e:ui` - Run Playwright tests with UI

## API Integration

The dashboard uses a mock API client (`lib/api.ts`) that simulates backend responses. To connect to a real backend:

1. Update the `API_BASE_URL` in `lib/api.ts`
2. Replace mock data functions with actual fetch calls
3. Update TypeScript types in `types/index.ts` if needed

## Authentication

Authentication is handled by Clerk. Protected routes use the `auth()` helper from `@clerk/nextjs` to check if a user is authenticated.

## Customization

### Theming

The dashboard uses CSS variables for theming. Edit `app/globals.css` to customize colors.

### Adding New Pages

1. Create a new folder in `app/dashboard/`
2. Add a `page.tsx` file with your component
3. Update the sidebar navigation in `components/layout/sidebar.tsx`

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

Build the application:
```bash
npm run build
```

The static export will be in the `dist` folder.

## License

MIT
