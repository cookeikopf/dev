import { Command } from 'commander';
import chalk from 'chalk';
import chokidar from 'chokidar';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { fileExists, loadEnvFile } from '../utils/files.js';
import { logger } from '../utils/logger.js';

interface DevOptions {
  port?: string;
  host?: string;
  watch?: boolean;
}

let serverProcess: ChildProcess | null = null;
let isRestarting = false;

export const devCommand = new Command('dev')
  .description('Start local development server with hot reload')
  .option('-p, --port <port>', 'Port to run server on', '3000')
  .option('-h, --host <host>', 'Host to bind server to', 'localhost')
  .option('--no-watch', 'Disable hot reload', true)
  .action(async (options: DevOptions) => {
    const projectPath = process.cwd();
    
    // Validate we're in an AgentLink project
    const isValidProject = await validateAgentLinkProject(projectPath);
    if (!isValidProject) {
      logger.error('Not an AgentLink project. Run "agentlink create" first.');
      process.exit(1);
    }

    // Load environment variables
    await loadEnvironment(projectPath);

    const port = parseInt(options.port || '3000');
    const host = options.host || 'localhost';

    logger.section('Starting Development Server');
    logger.info(`Port: ${chalk.cyan(port)}`);
    logger.info(`Host: ${chalk.cyan(host)}`);
    logger.info(`Hot reload: ${options.watch !== false ? chalk.green('enabled') : chalk.gray('disabled')}`);
    logger.blank();

    // Display available endpoints
    await displayEndpoints(projectPath, port, host);

    // Start server
    await startServer(projectPath, port, host);

    // Setup file watcher if enabled
    if (options.watch !== false) {
      setupFileWatcher(projectPath, port, host);
    }

    // Handle graceful shutdown
    setupShutdownHandlers();
  });

async function validateAgentLinkProject(projectPath: string): Promise<boolean> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const agentCardPath = path.join(projectPath, 'agent-card.json');
  
  if (!(await fileExists(packageJsonPath))) {
    return false;
  }
  
  try {
    const packageJson = await fs.readJson(packageJsonPath);
    // Check if it's an AgentLink project by looking for agentlink keywords or agent-card.json
    const hasAgentLinkKeywords = packageJson.keywords?.includes('agentlink');
    const hasAgentCard = await fileExists(agentCardPath);
    
    return hasAgentLinkKeywords || hasAgentCard;
  } catch {
    return false;
  }
}

async function loadEnvironment(projectPath: string): Promise<void> {
  const envPath = path.join(projectPath, '.env');
  
  if (await fileExists(envPath)) {
    const env = await loadEnvFile(envPath);
    
    // Set environment variables
    for (const [key, value] of Object.entries(env)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    
    logger.success('Loaded environment from .env');
  } else {
    logger.warning('No .env file found. Using default environment.');
  }
}

async function displayEndpoints(projectPath: string, port: number, host: string): Promise<void> {
  const agentCardPath = path.join(projectPath, 'agent-card.json');
  const baseUrl = `http://${host}:${port}`;
  
  logger.section('Available Endpoints');
  
  // Standard endpoints
  logger.command('GET  /health', 'Health check endpoint');
  logger.command('GET  /.well-known/agent-card', 'Agent Card (A2A discovery)');
  
  // Custom endpoints from agent-card.json
  if (await fileExists(agentCardPath)) {
    try {
      const agentCard = await fs.readJson(agentCardPath);
      
      if (agentCard.endpoints && Array.isArray(agentCard.endpoints)) {
        for (const endpoint of agentCard.endpoints) {
          const method = 'POST';
          const priceBadge = endpoint.price ? chalk.yellow(` [${endpoint.price}]`) : '';
          logger.command(`${method} ${endpoint.path}`, `${endpoint.description}${priceBadge}`);
        }
      }
    } catch {
      // Ignore agent-card.json parsing errors
    }
  }
  
  logger.blank();
  logger.info('Local URLs:');
  logger.code(`${baseUrl}`);
  logger.code(`${baseUrl}/health`);
  logger.code(`${baseUrl}/.well-known/agent-card`);
  logger.blank();
}

async function startServer(projectPath: string, port: number, host: string): Promise<void> {
  // Kill existing server if running
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }

  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);
  
  // Determine the dev command
  const devCommand = packageJson.scripts?.dev || 'tsx watch src/index.ts';
  
  // Set environment variables
  const env = {
    ...process.env,
    PORT: port.toString(),
    HOST: host,
    NODE_ENV: 'development'
  };

  // Start the server process
  const [cmd, ...args] = devCommand.split(' ');
  
  serverProcess = spawn(cmd, args, {
    cwd: projectPath,
    env,
    stdio: 'pipe',
    shell: true
  });

  // Handle server output
  serverProcess.stdout?.on('data', (data: Buffer) => {
    const output = data.toString().trim();
    if (output) {
      // Filter out some common noise
      if (!output.includes('TSFILE:') && !output.includes('[watch]')) {
        console.log(chalk.gray(`[server]`), output);
      }
    }
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    const output = data.toString().trim();
    if (output) {
      console.error(chalk.red(`[server]`), output);
    }
  });

  serverProcess.on('error', (error) => {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null && !isRestarting) {
      logger.error(`Server exited with code ${code}`);
      process.exit(code);
    }
  });

  // Give the server a moment to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (!isRestarting) {
    logger.success('Development server started!');
    logger.blank();
    logger.info(chalk.gray('Press Ctrl+C to stop'));
    logger.blank();
  }
}

function setupFileWatcher(projectPath: string, port: number, host: string): void {
  const srcPath = path.join(projectPath, 'src');
  
  // Watch src directory
  const watcher = chokidar.watch(srcPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('change', async (filePath) => {
    if (isRestarting) return;
    
    const relativePath = path.relative(projectPath, filePath);
    logger.blank();
    logger.info(chalk.yellow(`File changed: ${relativePath}`));
    logger.info('Restarting server...');
    
    isRestarting = true;
    
    try {
      await startServer(projectPath, port, host);
    } finally {
      isRestarting = false;
    }
  });

  watcher.on('add', async (filePath) => {
    if (isRestarting) return;
    
    const relativePath = path.relative(projectPath, filePath);
    logger.blank();
    logger.info(chalk.green(`File added: ${relativePath}`));
    logger.info('Restarting server...');
    
    isRestarting = true;
    
    try {
      await startServer(projectPath, port, host);
    } finally {
      isRestarting = false;
    }
  });

  logger.info(chalk.gray('Watching for file changes...'));
}

function setupShutdownHandlers(): void {
  const shutdown = (signal: string) => {
    logger.blank();
    logger.info(`Received ${signal}. Shutting down...`);
    
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    if (serverProcess) {
      serverProcess.kill();
    }
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
  });
}
