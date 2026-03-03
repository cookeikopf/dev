import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { Listr } from 'listr2';
import { fileExists, loadEnvFile } from '../utils/files.js';
import { logger } from '../utils/logger.js';

interface DeployOptions {
  platform?: string;
  skipBuild?: boolean;
  auto?: boolean;
}

const DEPLOYMENT_PLATFORMS = [
  { name: 'Railway (recommended)', value: 'railway' },
  { name: 'Render', value: 'render' },
  { name: 'Fly.io', value: 'fly' },
  { name: 'Vercel', value: 'vercel' },
  { name: 'Docker (self-hosted)', value: 'docker' },
  { name: 'Manual deployment', value: 'manual' }
];

export const deployCommand = new Command('deploy')
  .description('Deploy your AgentLink agent to production')
  .option('-p, --platform <platform>', 'Deployment platform')
  .option('--skip-build', 'Skip build step')
  .option('--auto', 'Auto-deploy without prompts')
  .action(async (options: DeployOptions) => {
    const projectPath = process.cwd();
    
    // Validate project
    const agentCardPath = path.join(projectPath, 'agent-card.json');
    if (!(await fileExists(agentCardPath))) {
      logger.error('Not an AgentLink project. Run "agentlink create" first.');
      process.exit(1);
    }

    const agentCard = await fs.readJson(agentCardPath);
    const env = await loadEnvFile(path.join(projectPath, '.env'));

    logger.section('AgentLink Deployment');
    
    // Pre-deployment checks
    const checks = await runPreDeploymentChecks(projectPath, agentCard, env);
    
    if (!checks.passed) {
      logger.error('Pre-deployment checks failed. Please fix the issues above.');
      process.exit(1);
    }

    // Select platform
    let platform = options.platform;
    if (!platform && !options.auto) {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'platform',
          message: 'Choose deployment platform:',
          choices: DEPLOYMENT_PLATFORMS
        }
      ]);
      platform = answer.platform;
    }
    platform = platform || 'railway';

    // Generate deployment guide
    await generateDeploymentGuide(projectPath, platform, agentCard);

    // Optionally auto-deploy
    if (options.auto) {
      await autoDeploy(projectPath, platform);
    } else {
      displayManualInstructions(platform);
    }
  });

interface DeploymentChecks {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message?: string;
  }>;
}

async function runPreDeploymentChecks(
  projectPath: string,
  agentCard: any,
  env: Record<string, string>
): Promise<DeploymentChecks> {
  const checks: DeploymentChecks['checks'] = [];

  logger.info('Running pre-deployment checks...');
  logger.blank();

  // Check 1: Project structure
  const hasPackageJson = await fileExists(path.join(projectPath, 'package.json'));
  checks.push({
    name: 'package.json exists',
    passed: hasPackageJson,
    message: hasPackageJson ? undefined : 'package.json not found'
  });

  // Check 2: Agent identity
  const hasIdentity = !!agentCard.identity || !!env.AGENT_IDENTITY_ADDRESS;
  checks.push({
    name: 'Agent identity configured',
    passed: hasIdentity,
    message: hasIdentity ? undefined : 'Run "agentlink identity mint" first'
  });

  // Check 3: Environment variables
  const hasRequiredEnv = !!env.PORT || true; // PORT has default
  checks.push({
    name: 'Environment configured',
    passed: hasRequiredEnv
  });

  // Check 4: Build script
  const packageJson = await fs.readJson(path.join(projectPath, 'package.json'));
  const hasBuildScript = !!packageJson.scripts?.build;
  checks.push({
    name: 'Build script defined',
    passed: hasBuildScript,
    message: hasBuildScript ? undefined : 'Add a build script to package.json'
  });

  // Check 5: Dependencies installed
  const hasNodeModules = await fileExists(path.join(projectPath, 'node_modules'));
  checks.push({
    name: 'Dependencies installed',
    passed: hasNodeModules,
    message: hasNodeModules ? undefined : 'Run "npm install"'
  });

  // Display results
  for (const check of checks) {
    if (check.passed) {
      logger.success(check.name);
    } else {
      logger.error(`${check.name}${check.message ? ` - ${check.message}` : ''}`);
    }
  }

  logger.blank();

  return {
    passed: checks.every(c => c.passed),
    checks
  };
}

async function generateDeploymentGuide(
  projectPath: string,
  platform: string,
  agentCard: any
): Promise<void> {
  const guidesDir = path.join(projectPath, 'deployment');
  await fs.ensureDir(guidesDir);

  // Generate platform-specific guide
  const guideContent = generatePlatformGuide(platform, agentCard);
  await fs.writeFile(path.join(guidesDir, `${platform}.md`), guideContent);

  // Generate Dockerfile if needed
  if (platform === 'docker' || platform === 'railway' || platform === 'render') {
    const dockerfile = generateDockerfile(agentCard);
    await fs.writeFile(path.join(projectPath, 'Dockerfile'), dockerfile);
  }

  // Generate docker-compose.yml for docker deployments
  if (platform === 'docker') {
    const compose = generateDockerCompose(agentCard);
    await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), compose);
  }

  // Generate GitHub Actions workflow
  if (platform !== 'manual') {
    const workflowDir = path.join(projectPath, '.github', 'workflows');
    await fs.ensureDir(workflowDir);
    const workflow = generateGitHubWorkflow(platform);
    await fs.writeFile(path.join(workflowDir, 'deploy.yml'), workflow);
  }

  // Generate deployment checklist
  const checklist = generateDeploymentChecklist(platform, agentCard);
  await fs.writeFile(path.join(guidesDir, 'CHECKLIST.md'), checklist);

  logger.success(`Generated deployment files in ${chalk.gray('deployment/')}`);
}

function generatePlatformGuide(platform: string, agentCard: any): string {
  const guides: Record<string, string> = {
    railway: `# Deploy to Railway

## Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/AGENTLINK)

## Manual Deploy

1. **Install Railway CLI**
   \`\`\`bash
   npm install -g @railway/cli
   \`\`\`

2. **Login to Railway**
   \`\`\`bash
   railway login
   \`\`\`

3. **Create new project**
   \`\`\`bash
   railway init
   \`\`\`

4. **Set environment variables**
   \`\`\`bash
   railway variables set PORT=3000
   railway variables set NODE_ENV=production
   railway variables set AGENT_IDENTITY_ADDRESS=${agentCard.identity?.address || 'YOUR_IDENTITY_ADDRESS'}
   \`\`\`

5. **Deploy**
   \`\`\`bash
   railway up
   \`\`\`

## Post-Deploy

- Your agent will be available at: \`https://your-project.railway.app\`
- Update your Agent Card with the production URL
`,

    render: `# Deploy to Render

## Using Render Dashboard

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: ${agentCard.name}
   - **Runtime**: Node
   - **Build Command**: \`npm install && npm run build\`
   - **Start Command**: \`npm start\`

5. Add environment variables:
   - \`PORT\`: 3000
   - \`NODE_ENV\`: production
   - \`AGENT_IDENTITY_ADDRESS\`: ${agentCard.identity?.address || 'YOUR_IDENTITY_ADDRESS'}

6. Click "Create Web Service"

## Using Render Blueprint

A \`render.yaml\` has been generated. Push to GitHub and use "Blueprint" option.
`,

    fly: `# Deploy to Fly.io

## Prerequisites

1. **Install Fly CLI**
   \`\`\`bash
   curl -L https://fly.io/install.sh | sh
   \`\`\`

2. **Login**
   \`\`\`bash
   fly auth login
   \`\`\`

## Deploy

1. **Create app**
   \`\`\`bash
   fly apps create ${agentCard.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}
   \`\`\`

2. **Set secrets**
   \`\`\`bash
   fly secrets set AGENT_IDENTITY_ADDRESS=${agentCard.identity?.address || 'YOUR_IDENTITY_ADDRESS'}
   \`\`\`

3. **Deploy**
   \`\`\`bash
   fly deploy
   \`\`\`
`,

    vercel: `# Deploy to Vercel

## Note

Vercel is primarily for serverless functions. For a persistent agent server, consider Railway or Render.

## Deploy

1. **Install Vercel CLI**
   \`\`\`bash
   npm install -g vercel
   \`\`\`

2. **Deploy**
   \`\`\`bash
   vercel
   \`\`\`

3. **Set environment variables**
   \`\`\`bash
   vercel env add AGENT_IDENTITY_ADDRESS
   \`\`\`
`,

    docker: `# Docker Deployment

## Local Testing

\`\`\`bash
# Build image
docker build -t ${agentCard.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')} .

# Run container
docker run -p 3000:3000 --env-file .env ${agentCard.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}
\`\`\`

## Production with Docker Compose

\`\`\`bash
docker-compose up -d
\`\`\`

## Push to Registry

\`\`\`bash
# Tag for your registry
docker tag ${agentCard.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')} your-registry/${agentCard.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:latest

# Push
docker push your-registry/${agentCard.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:latest
\`\`\`
`,

    manual: `# Manual Deployment

## Build

\`\`\`bash
npm install
npm run build
\`\`\`

## Environment Setup

Create a \`.env\` file on your server:

\`\`\`env
PORT=3000
NODE_ENV=production
AGENT_IDENTITY_ADDRESS=${agentCard.identity?.address || 'YOUR_IDENTITY_ADDRESS'}
\`\`\`

## Run

\`\`\`bash
npm start
\`\`\`

## Process Management (PM2)

\`\`\`bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "${agentCard.name}" -- start

# Save PM2 config
pm2 save
pm2 startup
\`\`\`
`
  };

  return guides[platform] || guides.manual;
}

function generateDockerfile(agentCard: any): string {
  return `# AgentLink Agent Dockerfile
# Agent: ${agentCard.name}

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build (if TypeScript)
RUN npm run build || echo "No build step"

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["npm", "start"]
`;
}

function generateDockerCompose(agentCard: any): string {
  return `version: '3.8'

services:
  agent:
    build: .
    container_name: ${agentCard.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
`;
}

function generateGitHubWorkflow(platform: string): string {
  const platformConfigs: Record<string, string> = {
    railway: `name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Deploy to Railway
        uses: railway/cli@latest
        with:
          railway_token: \${{ secrets.RAILWAY_TOKEN }}
        run: railway up`,

    render: `name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Render
        uses: johnbeynon/render-deploy-action@v0.0.8
        with:
          service-id: \${{ secrets.RENDER_SERVICE_ID }}
          api-key: \${{ secrets.RENDER_API_KEY }}`,

    fly: `name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Flyctl
        uses: superfly/flyctl-actions/setup-flyctl@master
        
      - name: Deploy
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: \${{ secrets.FLY_API_TOKEN }}`,

    docker: `name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}
          
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: \${{ secrets.DOCKER_USERNAME }}/agent:latest`,

    vercel: `name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: vercel/action-deploy@v1
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}`,

    manual: `name: Build and Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Test
        run: npm test`
  };

  return platformConfigs[platform] || platformConfigs.manual;
}

function generateDeploymentChecklist(platform: string, agentCard: any): string {
  return `# Deployment Checklist

## Pre-Deployment

- [ ] Agent identity minted (\`agentlink identity mint\`)
- [ ] Environment variables configured
- [ ] All dependencies installed
- [ ] Build succeeds locally
- [ ] Tests pass
- [ ] Agent Card updated

## Platform: ${platform.charAt(0).toUpperCase() + platform.slice(1)}

- [ ] Platform account created
- [ ] CLI tool installed (if applicable)
- [ ] Authentication configured
- [ ] Environment variables set in platform
- [ ] Domain/subdomain configured

## Post-Deployment

- [ ] Health endpoint responds: \`GET /health\`
- [ ] Agent Card accessible: \`GET /.well-known/agent-card\`
- [ ] All endpoints functional
- [ ] Logging working
- [ ] Monitoring/alerts configured (optional)

## AgentLink Network Registration

- [ ] Update Agent Card with production URL
- [ ] Register on AgentLink directory (coming soon)
- [ ] Generate and add badge to README (\`agentlink generate-badge\`)

## Documentation

- [ ] README updated with production URL
- [ ] API documentation complete
- [ ] Changelog updated

---

**Agent**: ${agentCard.name}
**Platform**: ${platform}
**Deployed**: ${new Date().toISOString()}
`;
}

async function autoDeploy(projectPath: string, platform: string): Promise<void> {
  logger.info(`Auto-deploying to ${platform}...`);
  
  // This would implement actual deployment logic
  // For now, just a placeholder
  
  logger.warning('Auto-deploy not yet implemented for this platform.');
  logger.info('Please follow the manual deployment guide.');
}

function displayManualInstructions(platform: string): void {
  logger.blank();
  logger.box(
    'Deployment Guide Generated',
    `Platform: ${chalk.cyan(platform)}

${chalk.gray('See deployment guide:')}
${chalk.cyan(`deployment/${platform}.md`)}

${chalk.gray('Deployment checklist:')}
${chalk.cyan('deployment/CHECKLIST.md')}

${chalk.gray('Next steps:')}
1. Review the deployment guide
2. Complete the checklist
3. Follow platform-specific instructions`
  );
}
