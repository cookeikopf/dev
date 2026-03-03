import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { Listr } from 'listr2';
import { validateProjectName } from '../utils/checks.js';
import { 
  ensureDir, 
  writeFile, 
  writeJson,
  fileExists 
} from '../utils/files.js';
import { logger } from '../utils/logger.js';
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
} from '../utils/templates.js';

export const createCommand = new Command('create')
  .description('Scaffold a new AgentLink agent project')
  .argument('[project-name]', 'Name of the project')
  .option('-t, --template <template>', 'Project template (hono|express|fastify)', 'hono')
  .option('-f, --framework <framework>', 'Server framework', 'hono')
  .option('--skip-install', 'Skip npm install', false)
  .option('--git', 'Initialize git repository', true)
  .action(async (projectNameArg, options) => {
    let projectName = projectNameArg;

    // Interactive prompts if project name not provided
    if (!projectName) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Project name:',
          validate: (input: string) => {
            const result = validateProjectName(input);
            return result.valid || result.error || 'Invalid project name';
          }
        },
        {
          type: 'input',
          name: 'description',
          message: 'Project description:',
          default: (answers: any) => `An AgentLink agent powered by ${answers.name}`
        },
        {
          type: 'input',
          name: 'author',
          message: 'Author:',
          default: ''
        },
        {
          type: 'list',
          name: 'framework',
          message: 'Choose a framework:',
          choices: [
            { name: 'Hono (lightweight, fast)', value: 'hono' },
            { name: 'Express (popular, mature)', value: 'express' },
            { name: 'Fastify (high performance)', value: 'fastify' }
          ],
          default: 'hono'
        },
        {
          type: 'list',
          name: 'language',
          message: 'Language:',
          choices: [
            { name: 'TypeScript', value: 'typescript' },
            { name: 'JavaScript', value: 'javascript' }
          ],
          default: 'typescript'
        },
        {
          type: 'checkbox',
          name: 'features',
          message: 'Select features to include:',
          choices: [
            { name: 'Authentication (JWT)', value: 'authentication', checked: true },
            { name: 'Rate Limiting', value: 'rateLimiting', checked: true },
            { name: 'Request Logging', value: 'logging', checked: true },
            { name: 'CORS Support', value: 'cors', checked: true }
          ]
        },
        {
          type: 'confirm',
          name: 'addPaidEndpoint',
          message: 'Add a sample paid endpoint?',
          default: true
        },
        {
          type: 'input',
          name: 'paidEndpointPrice',
          message: 'Price for paid endpoint (in ETH):',
          default: '0.001',
          when: (answers: any) => answers.addPaidEndpoint,
          validate: (input: string) => {
            const num = parseFloat(input);
            return !isNaN(num) && num > 0 ? true : 'Please enter a valid positive number';
          }
        }
      ]);

      projectName = answers.name;
      options.framework = answers.framework;
      
      // Build complete config from answers
      const config: ProjectConfig = {
        name: answers.name,
        description: answers.description,
        author: answers.author,
        framework: answers.framework,
        language: answers.language,
        features: {
          authentication: answers.features.includes('authentication'),
          rateLimiting: answers.features.includes('rateLimiting'),
          logging: answers.features.includes('logging'),
          cors: answers.features.includes('cors')
        },
        endpoints: [
          {
            path: '/chat',
            name: 'Chat',
            description: 'Main chat endpoint for the agent',
            isPaid: false
          },
          {
            path: '/tools',
            name: 'Tools',
            description: 'List available tools',
            isPaid: false
          }
        ]
      };

      if (answers.addPaidEndpoint) {
        config.endpoints.push({
          path: '/premium',
          name: 'Premium',
          description: 'Premium features endpoint',
          isPaid: true,
          price: `${answers.paidEndpointPrice} ETH`
        });
      }

      await scaffoldProject(projectName, config, options);
    } else {
      // Validate provided project name
      const validation = validateProjectName(projectName);
      if (!validation.valid) {
        logger.error(validation.error || 'Invalid project name');
        process.exit(1);
      }

      // Use defaults for non-interactive mode
      const config: ProjectConfig = {
        name: projectName,
        description: `An AgentLink agent powered by ${projectName}`,
        author: '',
        framework: options.framework || 'hono',
        language: 'typescript',
        features: {
          authentication: true,
          rateLimiting: true,
          logging: true,
          cors: true
        },
        endpoints: [
          {
            path: '/chat',
            name: 'Chat',
            description: 'Main chat endpoint for the agent',
            isPaid: false
          },
          {
            path: '/premium',
            name: 'Premium',
            description: 'Premium features endpoint',
            isPaid: true,
            price: '0.001 ETH'
          }
        ]
      };

      await scaffoldProject(projectName, config, options);
    }
  });

async function scaffoldProject(
  projectName: string, 
  config: ProjectConfig,
  options: { skipInstall?: boolean; git?: boolean }
): Promise<void> {
  const projectPath = path.resolve(process.cwd(), projectName);
  const srcPath = path.join(projectPath, 'src');

  // Check if directory already exists
  if (await fileExists(projectPath)) {
    logger.error(`Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  logger.section('Creating AgentLink Project');
  logger.info(`Project: ${chalk.cyan(projectName)}`);
  logger.info(`Framework: ${chalk.cyan(config.framework)}`);
  logger.info(`Location: ${chalk.gray(projectPath)}`);
  logger.blank();

  const tasks = new Listr([
    {
      title: 'Create project directory',
      task: async () => {
        await ensureDir(projectPath);
      }
    },
    {
      title: 'Generate package.json',
      task: async () => {
        const packageJson = generatePackageJson(config);
        await writeFile(path.join(projectPath, 'package.json'), packageJson);
      }
    },
    {
      title: 'Generate tsconfig.json',
      task: async () => {
        if (config.language === 'typescript') {
          const tsConfig = generateTsConfig();
          await writeFile(path.join(projectPath, 'tsconfig.json'), tsConfig);
        }
      },
      skip: () => config.language !== 'typescript'
    },
    {
      title: 'Generate source files',
      task: async () => {
        await ensureDir(srcPath);
        
        // Generate main server file
        const serverCode = generateServerCode(config);
        const ext = config.language === 'typescript' ? 'ts' : 'js';
        await writeFile(path.join(srcPath, `index.${ext}`), serverCode);
        
        // Generate types file
        if (config.language === 'typescript') {
          const typesContent = generateTypesFile(config);
          await writeFile(path.join(srcPath, 'types.ts'), typesContent);
        }
      }
    },
    {
      title: 'Generate configuration files',
      task: async () => {
        // .env.template
        const envTemplate = generateEnvTemplate(config);
        await writeFile(path.join(projectPath, '.env.template'), envTemplate);
        
        // .env (copy from template)
        await writeFile(path.join(projectPath, '.env'), envTemplate);
        
        // .gitignore
        const gitignore = generateGitignore();
        await writeFile(path.join(projectPath, '.gitignore'), gitignore);
        
        // vitest.config.ts
        const vitestConfig = generateVitestConfig();
        await writeFile(path.join(projectPath, 'vitest.config.ts'), vitestConfig);
      }
    },
    {
      title: 'Generate Agent Card',
      task: async () => {
        const agentCard = generateAgentCard(config);
        await writeJson(path.join(projectPath, 'agent-card.json'), agentCard);
      }
    },
    {
      title: 'Generate README.md',
      task: async () => {
        const readme = generateReadme(config);
        await writeFile(path.join(projectPath, 'README.md'), readme);
      }
    },
    {
      title: 'Generate test files',
      task: async () => {
        const testDir = path.join(projectPath, 'src', '__tests__');
        await ensureDir(testDir);
        const sampleTest = generateSampleTest(config);
        await writeFile(path.join(testDir, 'index.test.ts'), sampleTest);
      }
    },
    {
      title: 'Initialize git repository',
      task: async () => {
        const { execSync } = await import('child_process');
        execSync('git init', { cwd: projectPath, stdio: 'ignore' });
        execSync('git add .', { cwd: projectPath, stdio: 'ignore' });
        execSync('git commit -m "Initial commit from AgentLink CLI"', { 
          cwd: projectPath, 
          stdio: 'ignore' 
        });
      },
      skip: () => !options.git
    },
    {
      title: 'Install dependencies',
      task: async () => {
        const { execSync } = await import('child_process');
        execSync('npm install', { cwd: projectPath, stdio: 'ignore' });
      },
      skip: () => options.skipInstall
    }
  ], {
    concurrent: false,
    rendererOptions: {
      collapseSubtasks: false
    }
  });

  try {
    await tasks.run();
    
    logger.blank();
    logger.success(`Project ${chalk.cyan(projectName)} created successfully!`);
    logger.blank();
    
    logger.box(
      'Next Steps',
      `${chalk.cyan('cd')} ${projectName}
${chalk.cyan('agentlink dev')}        ${chalk.gray('# Start development server')}
${chalk.cyan('agentlink identity mint')}  ${chalk.gray('# Mint your agent identity')}
${chalk.cyan('agentlink deploy')}     ${chalk.gray('# Deploy to production')}`
    );
    
    logger.blank();
    logger.info('Project structure:');
    logger.dim(`${projectName}/
├── src/
│   ├── index.${config.language === 'typescript' ? 'ts' : 'js'}
│   └── __tests__/
├── agent-card.json
├── package.json
├── tsconfig.json
├── .env
└── README.md`);
    
  } catch (error: any) {
    logger.error(`Failed to create project: ${error.message}`);
    
    // Clean up on failure
    try {
      await fs.remove(projectPath);
    } catch {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

function generateTypesFile(config: ProjectConfig): string {
  return `/**
 * Type definitions for ${config.name}
 */

export interface AgentRequest {
  message: string;
  context?: Record<string, unknown>;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  endpoints: Array<{
    path: string;
    name: string;
    description: string;
    price?: string;
  }>;
  capabilities: {
    authentication: boolean;
    rateLimiting: boolean;
    logging: boolean;
    cors: boolean;
  };
}

${config.endpoints.some(e => e.isPaid) ? `
export interface PaymentVerification {
  txHash: string;
  amount: string;
  sender: string;
}
` : ''}
`;
}
