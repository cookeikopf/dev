import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ProjectConfig {
  name: string;
  description: string;
  author: string;
  framework: 'hono' | 'express' | 'fastify';
  language: 'typescript' | 'javascript';
  features: {
    authentication: boolean;
    rateLimiting: boolean;
    logging: boolean;
    cors: boolean;
  };
  endpoints: Array<{
    path: string;
    name: string;
    description: string;
    isPaid: boolean;
    price?: string;
  }>;
}

export function generatePackageJson(config: ProjectConfig): string {
  const dependencies: Record<string, string> = {
    '@agentlink/sdk': '^0.1.0',
    'dotenv': '^16.4.0',
    'zod': '^3.22.0'
  };

  const devDependencies: Record<string, string> = {
    '@types/node': '^20.11.0',
    'typescript': '^5.3.0',
    'tsx': '^4.7.0',
    'vitest': '^1.3.0'
  };

  // Add framework-specific dependencies
  switch (config.framework) {
    case 'hono':
      dependencies['hono'] = '^4.0.0';
      dependencies['@hono/node-server'] = '^1.8.0';
      break;
    case 'express':
      dependencies['express'] = '^4.18.0';
      devDependencies['@types/express'] = '^4.17.0';
      break;
    case 'fastify':
      dependencies['fastify'] = '^4.26.0';
      break;
  }

  // Add feature dependencies
  if (config.features.authentication) {
    dependencies['jsonwebtoken'] = '^9.0.0';
    devDependencies['@types/jsonwebtoken'] = '^9.0.0';
  }
  
  if (config.features.rateLimiting) {
    dependencies['rate-limiter-flexible'] = '^5.0.0';
  }
  
  if (config.features.logging) {
    dependencies['pino'] = '^8.18.0';
  }
  
  if (config.features.cors) {
    dependencies['cors'] = '^2.8.0';
    devDependencies['@types/cors'] = '^2.8.0';
  }

  const packageJson = {
    name: config.name,
    version: '0.1.0',
    description: config.description,
    main: config.language === 'typescript' ? 'dist/index.js' : 'src/index.js',
    type: 'module',
    scripts: {
      'dev': config.language === 'typescript' ? 'tsx watch src/index.ts' : 'node --watch src/index.js',
      'build': config.language === 'typescript' ? 'tsc' : 'echo "No build step for JavaScript"',
      'start': config.language === 'typescript' ? 'node dist/index.js' : 'node src/index.js',
      'test': 'vitest',
      'typecheck': config.language === 'typescript' ? 'tsc --noEmit' : 'echo "No type checking for JavaScript"'
    },
    keywords: ['agentlink', 'agent', 'a2a'],
    author: config.author,
    license: 'MIT',
    dependencies,
    devDependencies
  };

  return JSON.stringify(packageJson, null, 2);
}

export function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  }, null, 2);
}

export function generateEnvTemplate(config: ProjectConfig): string {
  const lines = [
    '# AgentLink Environment Configuration',
    '',
    '# Server Configuration',
    'PORT=3000',
    'NODE_ENV=development',
    '',
    '# Agent Identity (fill after running: agentlink identity mint)',
    'AGENT_IDENTITY_ADDRESS=',
    'AGENT_PRIVATE_KEY=',
    '',
    '# Network Configuration',
    'RPC_URL=https://sepolia.base.org',
    'CHAIN_ID=84532',
    '',
    '# Optional: API Keys',
    '# OPENAI_API_KEY=',
    '# ANTHROPIC_API_KEY=',
    ''
  ];

  if (config.features.authentication) {
    lines.push(
      '# Authentication',
      'JWT_SECRET=your-jwt-secret-here',
      ''
    );
  }

  if (config.endpoints.some(e => e.isPaid)) {
    lines.push(
      '# Payment Configuration',
      'PAYMENT_RECEIVER_ADDRESS=',
      ''
    );
  }

  return lines.join('\n');
}

export function generateAgentCard(config: ProjectConfig): object {
  const endpoints = config.endpoints.map(ep => ({
    path: ep.path,
    name: ep.name,
    description: ep.description,
    ...(ep.isPaid && ep.price ? { price: ep.price } : {})
  }));

  return {
    name: config.name,
    description: config.description,
    version: '0.1.0',
    author: config.author,
    framework: config.framework,
    endpoints,
    capabilities: {
      authentication: config.features.authentication,
      rateLimiting: config.features.rateLimiting,
      logging: config.features.logging,
      cors: config.features.cors
    },
    createdAt: new Date().toISOString()
  };
}

export function generateReadme(config: ProjectConfig): string {
  const features = [];
  if (config.features.authentication) features.push('- 🔐 JWT Authentication');
  if (config.features.rateLimiting) features.push('- ⏱️ Rate Limiting');
  if (config.features.logging) features.push('- 📝 Request Logging');
  if (config.features.cors) features.push('- 🌐 CORS Support');

  const endpoints = config.endpoints.map(ep => {
    const priceBadge = ep.isPaid ? ` (💰 ${ep.price})` : '';
    return `- \\\`${ep.path}\\\` - ${ep.description}${priceBadge}`;
  }).join('\n');

  return `# ${config.name}

${config.description}

## Features

${features.join('\n') || '- Built with AgentLink CLI'}

## Endpoints

${endpoints}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev
\`\`\`

## Deployment

\`\`\`bash
# Build for production
npm run build

# Deploy
agentlink deploy
\`\`\`

## Agent Card

This agent is registered on the AgentLink network.

---

Built with [AgentLink](https://agentlink.dev)
`;
}

export function generateGitignore(): string {
  return `# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Temporary
tmp/
temp/
*.tmp
`;
}

export function generateServerCode(config: ProjectConfig): string {
  const isTs = config.language === 'typescript';
  const framework = config.framework;

  let imports = '';
  let serverSetup = '';
  let middlewareSetup = '';
  let endpointHandlers = '';

  // Generate imports based on framework
  switch (framework) {
    case 'hono':
      imports = isTs 
        ? "import { Hono } from 'hono';\nimport { serve } from '@hono/node-server';"
        : "import { Hono } from 'hono';\nimport { serve } from '@hono/node-server';";
      break;
    case 'express':
      imports = "import express from 'express';";
      break;
    case 'fastify':
      imports = "import Fastify from 'fastify';";
      break;
  }

  // Add common imports
  imports += "\nimport dotenv from 'dotenv';";
  imports += "\nimport { z } from 'zod';";

  // Middleware setup
  if (config.features.cors) {
    middlewareSetup += "\n// Enable CORS\napp.use('*', cors());\n";
  }
  
  if (config.features.logging) {
    middlewareSetup += "\n// Request logging\napp.use('*', logger());\n";
  }

  // Generate endpoint handlers
  for (const ep of config.endpoints) {
    endpointHandlers += generateEndpointHandler(ep, framework, isTs);
  }

  // Server setup based on framework
  switch (framework) {
    case 'hono':
      serverSetup = `
const app = new Hono();

${middlewareSetup}

// Health check
app.get('/health', (c) => c.json({ status: 'ok', agent: '${config.name}' }));

// Agent Card endpoint
app.get('/.well-known/agent-card', (c) => {
  const agentCard = {
    name: '${config.name}',
    description: '${config.description}',
    version: '0.1.0',
    endpoints: ${JSON.stringify(config.endpoints.map(e => ({ path: e.path, name: e.name, description: e.description })))}
  };
  return c.json(agentCard);
});

${endpointHandlers}

const port = parseInt(process.env.PORT || '3000');

console.log(\`🚀 \${'${config.name}'} running on http://localhost:\${port}\`);

serve({
  fetch: app.fetch,
  port
});
`;
      break;

    case 'express':
      serverSetup = `
const app = express();
app.use(express.json());

${middlewareSetup}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: '${config.name}' });
});

// Agent Card endpoint
app.get('/.well-known/agent-card', (req, res) => {
  const agentCard = {
    name: '${config.name}',
    description: '${config.description}',
    version: '0.1.0',
    endpoints: ${JSON.stringify(config.endpoints.map(e => ({ path: e.path, name: e.name, description: e.description })))}
  };
  res.json(agentCard);
});

${endpointHandlers}

const port = parseInt(process.env.PORT || '3000');

app.listen(port, () => {
  console.log(\`🚀 \${'${config.name}'} running on http://localhost:\${port}\`);
});
`;
      break;

    case 'fastify':
      serverSetup = `
const app = Fastify({ logger: ${config.features.logging ? 'true' : 'false'} });

${middlewareSetup}

// Health check
app.get('/health', async () => {
  return { status: 'ok', agent: '${config.name}' };
});

// Agent Card endpoint
app.get('/.well-known/agent-card', async () => {
  return {
    name: '${config.name}',
    description: '${config.description}',
    version: '0.1.0',
    endpoints: ${JSON.stringify(config.endpoints.map(e => ({ path: e.path, name: e.name, description: e.description })))}
  };
});

${endpointHandlers}

const port = parseInt(process.env.PORT || '3000');

try {
  await app.listen({ port });
  console.log(\`🚀 \${'${config.name}'} running on http://localhost:\${port}\`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
`;
      break;
  }

  return `${imports}

dotenv.config();

${serverSetup}
`;
}

function generateEndpointHandler(
  endpoint: ProjectConfig['endpoints'][0], 
  framework: string,
  isTs: boolean
): string {
  const { path, name, description, isPaid, price } = endpoint;
  
  let handler = '';
  
  switch (framework) {
    case 'hono':
      handler = `
// ${name}: ${description}${isPaid ? ` (Paid: ${price})` : ''}
app.post('${path}', async (c) => {
  const body = await c.req.json();
  
  // TODO: Implement ${name} logic
  ${isPaid ? '// TODO: Verify payment before processing' : ''}
  
  return c.json({
    success: true,
    message: '${name} endpoint - implement your logic here',
    received: body
  });
});
`;
      break;

    case 'express':
      handler = `
// ${name}: ${description}${isPaid ? ` (Paid: ${price})` : ''}
app.post('${path}', async (req, res) => {
  const body = req.body;
  
  // TODO: Implement ${name} logic
  ${isPaid ? '// TODO: Verify payment before processing' : ''}
  
  res.json({
    success: true,
    message: '${name} endpoint - implement your logic here',
    received: body
  });
});
`;
      break;

    case 'fastify':
      handler = `
// ${name}: ${description}${isPaid ? ` (Paid: ${price})` : ''}
app.post('${path}', async (request, reply) => {
  const body = request.body;
  
  // TODO: Implement ${name} logic
  ${isPaid ? '// TODO: Verify payment before processing' : ''}
  
  return {
    success: true,
    message: '${name} endpoint - implement your logic here',
    received: body
  };
});
`;
      break;
  }
  
  return handler;
}

export function generateVitestConfig(): string {
  return `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/']
    }
  }
});
`;
}

export function generateSampleTest(config: ProjectConfig): string {
  return `import { describe, it, expect } from 'vitest';

describe('${config.name}', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle agent endpoints', () => {
    // TODO: Add endpoint tests
    expect(1 + 1).toBe(2);
  });
});
`;
}
