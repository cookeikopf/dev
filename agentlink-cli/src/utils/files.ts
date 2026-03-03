import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function copyTemplate(templatePath: string, destPath: string, variables: Record<string, string> = {}): Promise<void> {
  let content = await fs.readFile(templatePath, 'utf-8');
  
  // Replace template variables
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  await writeFile(destPath, content);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T = any>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJson(filePath: string, data: any): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2));
}

export function getTemplatePath(templateName: string): string {
  // In development, use src/templates
  // In production (after build), use dist/templates
  const isDev = process.env.NODE_ENV === 'development' || !__dirname.includes('dist');
  const basePath = isDev 
    ? path.resolve(process.cwd(), 'src/templates')
    : path.resolve(__dirname, '../templates');
  
  return path.join(basePath, templateName);
}

export async function getProjectPackageJson(projectPath: string): Promise<any | null> {
  return readJson(path.join(projectPath, 'package.json'));
}

export async function updateProjectPackageJson(
  projectPath: string, 
  updates: Record<string, any>
): Promise<void> {
  const packageJson = await getProjectPackageJson(projectPath) || {};
  const updated = { ...packageJson, ...updates };
  await writeJson(path.join(projectPath, 'package.json'), updated);
}

export async function safeWriteFile(
  filePath: string, 
  content: string, 
  options: { overwrite?: boolean } = {}
): Promise<{ success: boolean; skipped?: boolean }> {
  const { overwrite = false } = options;
  
  if (!overwrite && await fileExists(filePath)) {
    return { success: false, skipped: true };
  }
  
  await writeFile(filePath, content);
  return { success: true };
}

export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>
): Promise<T> {
  const spinner = ora(message).start();
  
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

export async function findFilesByPattern(
  dir: string, 
  pattern: RegExp
): Promise<string[]> {
  const results: string[] = [];
  
  async function search(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        await search(fullPath);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  
  await search(dir);
  return results;
}

export async function loadEnvFile(envPath: string): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  
  if (!(await fileExists(envPath))) {
    return env;
  }
  
  const content = await fs.readFile(envPath, 'utf-8');
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  
  return env;
}
