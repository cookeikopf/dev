import { describe, it, expect } from 'vitest';
import {
  generatePackageJson,
  generateTsConfig,
  generateEnvTemplate,
  generateAgentCard,
  generateReadme,
  generateGitignore,
  generateServerCode,
  generateVitestConfig,
  generateSampleTest,
  type ProjectConfig
} from '../../src/utils/templates.js';

describe('Template Generation', () => {
  const baseConfig: ProjectConfig = {
    name: 'test-agent',
    description: 'A test agent',
    author: 'Test Author',
    framework: 'hono',
    language: 'typescript',
    features: {
      authentication: true,
      rateLimiting: true,
      logging: true,
      cors: true
    },
    endpoints: [
      { path: '/chat', name: 'Chat', description: 'Chat endpoint', isPaid: false },
      { path: '/premium', name: 'Premium', description: 'Premium features', isPaid: true, price: '0.001 ETH' }
    ]
  };

  describe('generatePackageJson', () => {
    it('should generate valid package.json', () => {
      const packageJson = generatePackageJson(baseConfig);
      const parsed = JSON.parse(packageJson);

      expect(parsed.name).toBe('test-agent');
      expect(parsed.description).toBe('A test agent');
      expect(parsed.author).toBe('Test Author');
      expect(parsed.type).toBe('module');
      expect(parsed.dependencies.hono).toBeDefined();
      expect(parsed.dependencies['@agentlink/sdk']).toBeDefined();
      expect(parsed.dependencies.jsonwebtoken).toBeDefined();
      expect(parsed.scripts.dev).toBeDefined();
      expect(parsed.scripts.build).toBeDefined();
      expect(parsed.scripts.test).toBeDefined();
    });

    it('should include correct framework dependencies', () => {
      const expressConfig = { ...baseConfig, framework: 'express' as const };
      const expressPackage = JSON.parse(generatePackageJson(expressConfig));
      expect(expressPackage.dependencies.express).toBeDefined();
      expect(expressPackage.dependencies.hono).toBeUndefined();

      const fastifyConfig = { ...baseConfig, framework: 'fastify' as const };
      const fastifyPackage = JSON.parse(generatePackageJson(fastifyConfig));
      expect(fastifyPackage.dependencies.fastify).toBeDefined();
    });

    it('should handle JavaScript projects', () => {
      const jsConfig = { ...baseConfig, language: 'javascript' as const };
      const packageJson = JSON.parse(generatePackageJson(jsConfig));
      expect(packageJson.main).toBe('src/index.js');
      expect(packageJson.scripts.build).toContain('echo');
    });
  });

  describe('generateTsConfig', () => {
    it('should generate valid tsconfig.json', () => {
      const tsConfig = generateTsConfig();
      const parsed = JSON.parse(tsConfig);

      expect(parsed.compilerOptions.target).toBe('ES2022');
      expect(parsed.compilerOptions.module).toBe('NodeNext');
      expect(parsed.compilerOptions.strict).toBe(true);
      expect(parsed.compilerOptions.outDir).toBe('./dist');
      expect(parsed.compilerOptions.rootDir).toBe('./src');
    });
  });

  describe('generateEnvTemplate', () => {
    it('should include required environment variables', () => {
      const envTemplate = generateEnvTemplate(baseConfig);

      expect(envTemplate).toContain('PORT=3000');
      expect(envTemplate).toContain('NODE_ENV=development');
      expect(envTemplate).toContain('AGENT_IDENTITY_ADDRESS=');
      expect(envTemplate).toContain('RPC_URL=');
    });

    it('should include auth variables when authentication is enabled', () => {
      const envTemplate = generateEnvTemplate(baseConfig);
      expect(envTemplate).toContain('JWT_SECRET=');
    });

    it('should include payment variables when paid endpoints exist', () => {
      const envTemplate = generateEnvTemplate(baseConfig);
      expect(envTemplate).toContain('PAYMENT_RECEIVER_ADDRESS=');
    });
  });

  describe('generateAgentCard', () => {
    it('should generate valid agent card structure', () => {
      const agentCard = generateAgentCard(baseConfig);

      expect(agentCard.name).toBe('test-agent');
      expect(agentCard.description).toBe('A test agent');
      expect(agentCard.version).toBe('0.1.0');
      expect(agentCard.author).toBe('Test Author');
      expect(agentCard.framework).toBe('hono');
      expect(agentCard.endpoints).toHaveLength(2);
      expect(agentCard.capabilities.authentication).toBe(true);
      expect(agentCard.createdAt).toBeDefined();
    });

    it('should include endpoint prices for paid endpoints', () => {
      const agentCard = generateAgentCard(baseConfig);
      const premiumEndpoint = agentCard.endpoints.find((e: any) => e.path === '/premium');
      expect(premiumEndpoint.price).toBe('0.001 ETH');
    });
  });

  describe('generateReadme', () => {
    it('should include project name and description', () => {
      const readme = generateReadme(baseConfig);

      expect(readme).toContain('# test-agent');
      expect(readme).toContain('A test agent');
    });

    it('should list all endpoints', () => {
      const readme = generateReadme(baseConfig);

      expect(readme).toContain('/chat');
      expect(readme).toContain('/premium');
      expect(readme).toContain('Premium features');
    });

    it('should include feature badges', () => {
      const readme = generateReadme(baseConfig);

      expect(readme).toContain('JWT Authentication');
      expect(readme).toContain('Rate Limiting');
    });
  });

  describe('generateGitignore', () => {
    it('should include standard ignores', () => {
      const gitignore = generateGitignore();

      expect(gitignore).toContain('node_modules/');
      expect(gitignore).toContain('dist/');
      expect(gitignore).toContain('.env');
      expect(gitignore).toContain('.DS_Store');
    });
  });

  describe('generateServerCode', () => {
    it('should generate Hono server code', () => {
      const code = generateServerCode(baseConfig);

      expect(code).toContain("import { Hono } from 'hono'");
      expect(code).toContain("new Hono()");
      expect(code).toContain("app.get('/health'");
      expect(code).toContain("/.well-known/agent-card");
    });

    it('should generate Express server code', () => {
      const expressConfig = { ...baseConfig, framework: 'express' as const };
      const code = generateServerCode(expressConfig);

      expect(code).toContain("import express from 'express'");
      expect(code).toContain("express()");
    });

    it('should include endpoint handlers', () => {
      const code = generateServerCode(baseConfig);

      expect(code).toContain("app.post('/chat'");
      expect(code).toContain("app.post('/premium'");
      expect(code).toContain('// TODO: Verify payment before processing');
    });
  });

  describe('generateVitestConfig', () => {
    it('should generate valid vitest config', () => {
      const config = generateVitestConfig();

      expect(config).toContain('defineConfig');
      expect(config).toContain("environment: 'node'");
      expect(config).toContain("globals: true");
    });
  });

  describe('generateSampleTest', () => {
    it('should generate test file with agent name', () => {
      const test = generateSampleTest(baseConfig);

      expect(test).toContain("describe('test-agent'");
      expect(test).toContain('vitest');
      expect(test).toContain('expect(true).toBe(true)');
    });
  });
});
