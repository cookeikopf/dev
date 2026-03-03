# AgentLink CLI Examples

This directory contains example projects and usage patterns for the AgentLink CLI.

## Quick Examples

### 1. Create a Basic Agent

```bash
agentlink create my-basic-agent
```

This creates a basic agent with:
- Hono framework
- TypeScript
- Standard features (auth, rate limiting, logging, CORS)
- Sample endpoints

### 2. Create an Express Agent

```bash
agentlink create my-express-agent --framework express
```

### 3. Create a JavaScript Agent

```bash
# Interactive mode, select JavaScript
agentlink create my-js-agent
```

### 4. Development Workflow

```bash
# Create project
agentlink create my-agent
cd my-agent

# Start development
agentlink dev

# In another terminal, make changes to src/index.ts
# The server will automatically reload

# Mint identity
agentlink identity mint

# Deploy
agentlink deploy --platform railway
```

### 5. Mint Identity with Options

```bash
# With private key
agentlink identity mint --key 0x1234...

# Custom RPC
agentlink identity mint --rpc https://custom-rpc.com

# Mainnet
agentlink identity mint --mainnet
```

### 6. Generate Badges

```bash
# Default markdown badge
agentlink generate-badge

# SVG format
agentlink generate-badge --format svg

# Custom style
agentlink generate-badge --style for-the-badge
```

## Project Examples

### Example 1: Chat Agent

A simple chat agent with OpenAI integration:

```bash
agentlink create chat-agent
cd chat-agent
npm install openai
```

Update `src/index.ts`:

```typescript
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/chat', async (c) => {
  const { message } = await c.req.json();
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: message }]
  });
  
  return c.json({
    response: completion.choices[0].message.content
  });
});
```

### Example 2: Premium Agent with Payments

```bash
agentlink create premium-agent
```

During setup, enable the paid endpoint. Then implement payment verification:

```typescript
app.post('/premium', async (c) => {
  const { paymentTx } = await c.req.json();
  
  // Verify payment transaction
  const isValid = await verifyPayment(paymentTx);
  if (!isValid) {
    return c.json({ error: 'Invalid payment' }, 402);
  }
  
  // Process premium request
  return c.json({ result: 'Premium content' });
});
```

### Example 3: Multi-Tool Agent

```typescript
const tools = {
  calculator: (expr: string) => eval(expr),
  weather: async (city: string) => {
    // Fetch weather data
  },
  search: async (query: string) => {
    // Perform search
  }
};

app.get('/tools', (c) => {
  return c.json({
    available: Object.keys(tools),
    descriptions: {
      calculator: 'Evaluate mathematical expressions',
      weather: 'Get weather for a city',
      search: 'Search the web'
    }
  });
});

app.post('/tools/:name', async (c) => {
  const toolName = c.req.param('name');
  const tool = tools[toolName];
  
  if (!tool) {
    return c.json({ error: 'Tool not found' }, 404);
  }
  
  const params = await c.req.json();
  const result = await tool(...params);
  
  return c.json({ result });
});
```

## Deployment Examples

### Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
agentlink deploy --platform railway
```

### Docker Deployment

```bash
# Generate Docker files
agentlink deploy --platform docker

# Build and run
docker-compose up -d
```

### GitHub Actions

The CLI automatically generates `.github/workflows/deploy.yml`. Just add these secrets:

- `RAILWAY_TOKEN` - For Railway deployment
- `RENDER_API_KEY` - For Render deployment
- `FLY_API_TOKEN` - For Fly.io deployment

## Advanced Usage

### Custom Templates

You can extend the CLI with custom templates by modifying the `src/utils/templates.ts` file.

### Environment-Specific Configuration

Create `.env.development` and `.env.production` files:

```bash
# .env.development
PORT=3000
DEBUG=true

# .env.production
PORT=80
DEBUG=false
```

### Custom Middleware

Add custom middleware in `src/index.ts`:

```typescript
// Custom logging
app.use('*', async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
});

// Custom auth
app.use('/premium/*', async (c, next) => {
  const token = c.req.header('Authorization');
  if (!verifyToken(token)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});
```

## More Examples

See the [AgentLink Documentation](https://agentlink.dev/docs) for more examples and patterns.
