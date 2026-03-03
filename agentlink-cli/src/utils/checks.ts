import chalk from 'chalk';
import semver from 'semver';
import { execSync } from 'child_process';

const MIN_NODE_VERSION = '18.0.0';

export async function checkNodeVersion(): Promise<void> {
  const currentVersion = process.version;
  
  if (!semver.gte(currentVersion, MIN_NODE_VERSION)) {
    console.error(
      chalk.red(`\n✖ Error: AgentLink CLI requires Node.js ${MIN_NODE_VERSION} or higher.`)
    );
    console.error(chalk.yellow(`  Current version: ${currentVersion}\n`));
    process.exit(1);
  }
}

export async function checkForUpdates(): Promise<void> {
  try {
    // Check for updates (in production, this would check npm registry)
    // For now, just a placeholder
  } catch {
    // Silently fail - not critical
  }
}

export function checkGitInstallation(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function validateProjectName(name: string): { valid: boolean; error?: string } {
  // Check for valid npm package name
  const npmNameRegex = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  
  if (!name) {
    return { valid: false, error: 'Project name is required' };
  }
  
  if (!npmNameRegex.test(name)) {
    return { 
      valid: false, 
      error: 'Invalid project name. Use lowercase letters, numbers, hyphens, and underscores only.' 
    };
  }
  
  if (name.length > 214) {
    return { valid: false, error: 'Project name must be 214 characters or less' };
  }
  
  return { valid: true };
}

export function validateEndpointPath(path: string): { valid: boolean; error?: string } {
  if (!path.startsWith('/')) {
    return { valid: false, error: 'Endpoint path must start with "/"' };
  }
  
  if (!/^[a-zA-Z0-9/_-]+$/.test(path)) {
    return { valid: false, error: 'Endpoint path contains invalid characters' };
  }
  
  return { valid: true };
}
