import chalk from 'chalk';
import boxen from 'boxen';

export const logger = {
  info: (message: string): void => {
    console.log(chalk.blue('ℹ'), message);
  },
  
  success: (message: string): void => {
    console.log(chalk.green('✔'), message);
  },
  
  error: (message: string): void => {
    console.error(chalk.red('✖'), message);
  },
  
  warning: (message: string): void => {
    console.log(chalk.yellow('⚠'), message);
  },
  
  step: (step: number, total: number, message: string): void => {
    console.log(chalk.cyan(`[${step}/${total}]`), message);
  },
  
  blank: (): void => {
    console.log();
  },
  
  dim: (message: string): void => {
    console.log(chalk.gray(message));
  },
  
  code: (code: string): void => {
    console.log(chalk.gray('  >'), chalk.cyan(code));
  },
  
  url: (url: string): void => {
    console.log(chalk.underline(chalk.blue(url)));
  },
  
  box: (title: string, content: string, options: { borderColor?: string } = {}): void => {
    const { borderColor = 'cyan' } = options;
    console.log(
      boxen(content, {
        title: chalk.bold(title),
        titleAlignment: 'center',
        padding: 1,
        borderStyle: 'round',
        borderColor: borderColor as any,
      })
    );
  },
  
  table: (rows: Array<[string, string]>): void => {
    const maxKeyLength = Math.max(...rows.map(([key]) => key.length));
    
    for (const [key, value] of rows) {
      const paddedKey = key.padEnd(maxKeyLength);
      console.log(`  ${chalk.gray(paddedKey)}  ${value}`);
    }
  },
  
  section: (title: string): void => {
    console.log();
    console.log(chalk.bold.cyan(title));
    console.log(chalk.gray('─'.repeat(title.length + 2)));
  },
  
  command: (cmd: string, description?: string): void => {
    if (description) {
      console.log(`  ${chalk.cyan(cmd.padEnd(25))} ${chalk.gray(description)}`);
    } else {
      console.log(`  ${chalk.cyan(cmd)}`);
    }
  }
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
