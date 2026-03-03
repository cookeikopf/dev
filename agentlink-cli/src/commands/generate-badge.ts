import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileExists } from '../utils/files.js';
import { logger } from '../utils/logger.js';

interface BadgeOptions {
  output?: string;
  format?: 'svg' | 'png' | 'markdown';
  style?: 'flat' | 'flat-square' | 'plastic' | 'for-the-badge';
}

export const generateBadgeCommand = new Command('generate-badge')
  .description('Generate shareable Agent Card badge for README')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Output format (svg|png|markdown)', 'markdown')
  .option('-s, --style <style>', 'Badge style (flat|flat-square|plastic|for-the-badge)', 'flat')
  .action(async (options: BadgeOptions) => {
    const projectPath = process.cwd();
    
    // Validate project
    const agentCardPath = path.join(projectPath, 'agent-card.json');
    if (!(await fileExists(agentCardPath))) {
      logger.error('Not an AgentLink project. Run "agentlink create" first.');
      process.exit(1);
    }

    const agentCard = await fs.readJson(agentCardPath);
    
    logger.section('Generate AgentLink Badge');
    logger.info(`Agent: ${chalk.cyan(agentCard.name)}`);
    logger.info(`Format: ${chalk.cyan(options.format)}`);
    logger.blank();

    const outputPath = options.output || path.join(projectPath, 'agentlink-badge.md');

    switch (options.format) {
      case 'svg':
        await generateSvgBadge(agentCard, outputPath, options.style);
        break;
      case 'png':
        await generatePngBadge(agentCard, outputPath, options.style);
        break;
      case 'markdown':
      default:
        await generateMarkdownBadge(agentCard, outputPath, options.style);
        break;
    }

    logger.blank();
    logger.success(`Badge generated: ${chalk.cyan(outputPath)}`);
    
    // Display usage instructions
    displayBadgeUsage(outputPath, options.format);
  });

async function generateSvgBadge(
  agentCard: any, 
  outputPath: string,
  style: string
): Promise<void> {
  const badgeSvg = createBadgeSvg(agentCard.name, 'AgentLink', style);
  await fs.writeFile(outputPath, badgeSvg);
}

async function generatePngBadge(
  agentCard: any,
  outputPath: string,
  style: string
): Promise<void> {
  // For PNG generation, we'd typically use a library like sharp or canvas
  // For this implementation, we'll create an SVG and note that PNG conversion
  // would require additional dependencies
  
  const svgPath = outputPath.replace('.png', '.svg');
  await generateSvgBadge(agentCard, svgPath, style);
  
  logger.warning('PNG generation requires sharp or canvas library.');
  logger.info(`SVG badge created instead: ${chalk.cyan(svgPath)}`);
  logger.info('Convert to PNG using: sharp svg-to-png or similar tool');
}

async function generateMarkdownBadge(
  agentCard: any,
  outputPath: string,
  style: string
): Promise<void> {
  const badgeUrl = createShieldsBadgeUrl(agentCard.name, 'AgentLink', style);
  const agentUrl = agentCard.identity?.address 
    ? `https://agentlink.dev/agent/${agentCard.identity.address}`
    : 'https://agentlink.dev';

  const markdown = `<!-- AgentLink Badge - Generated on ${new Date().toISOString()} -->
[![AgentLink](${badgeUrl})](${agentUrl})

<!-- Add the above line to your README.md -->
`;

  await fs.writeFile(outputPath, markdown);
}

function createBadgeSvg(text: string, label: string, style: string): string {
  const labelWidth = label.length * 7 + 10;
  const textWidth = text.length * 7 + 10;
  const totalWidth = labelWidth + textWidth;
  
  const colors = {
    label: '#555',
    text: '#00D4AA' // AgentLink brand color
  };

  let rectRadius = 3;
  if (style === 'flat-square') rectRadius = 0;
  if (style === 'plastic') rectRadius = 4;
  if (style === 'for-the-badge') rectRadius = 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${text}">
  <title>${label}: ${text}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="${rectRadius}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="${colors.label}"/>
    <rect x="${labelWidth}" width="${textWidth}" height="20" fill="${colors.text}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${labelWidth * 5}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(labelWidth - 10) * 10}">${label}</text>
    <text x="${labelWidth * 5}" y="140" transform="scale(.1)" fill="#fff" textLength="${(labelWidth - 10) * 10}">${label}</text>
    <text aria-hidden="true" x="${labelWidth * 10 + textWidth * 5}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(textWidth - 10) * 10}">${escapeXml(text)}</text>
    <text x="${labelWidth * 10 + textWidth * 5}" y="140" transform="scale(.1)" fill="#fff" textLength="${(textWidth - 10) * 10}">${escapeXml(text)}</text>
  </g>
</svg>`;
}

function createShieldsBadgeUrl(text: string, label: string, style: string): string {
  const encodedText = encodeURIComponent(text);
  const encodedLabel = encodeURIComponent(label);
  const color = '00D4AA'; // AgentLink brand color
  
  return `https://img.shields.io/badge/${encodedLabel}-${encodedText}-${color}?style=${style}`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function displayBadgeUsage(outputPath: string, format: string): void {
  const readmePath = path.join(process.cwd(), 'README.md');
  
  logger.blank();
  logger.box(
    'Add Badge to README',
    format === 'markdown' 
      ? `Copy the badge markdown from:
${chalk.cyan(outputPath)}

And paste it at the top of your README.md`
      : `Use the generated badge file:
${chalk.cyan(outputPath)}

In your README.md:
${chalk.gray('![AgentLink](./agentlink-badge.svg)')}`
  );

  // Check if README exists and offer to add badge
  if (fileExists(readmePath)) {
    logger.blank();
    logger.info('Tip: You can manually add the badge to your README.md');
  }
}

// Additional badge generation utilities
export async function generateFullBadgeSet(
  agentCard: any,
  outputDir: string
): Promise<void> {
  await fs.ensureDir(outputDir);

  const badges = [
    { name: 'agentlink', label: 'AgentLink', text: agentCard.name },
    { name: 'version', label: 'version', text: agentCard.version || '0.1.0' },
    { name: 'endpoints', label: 'endpoints', text: String(agentCard.endpoints?.length || 0) },
    { name: 'identity', label: 'identity', text: agentCard.identity ? 'verified' : 'pending' }
  ];

  for (const badge of badges) {
    const svg = createBadgeSvg(badge.text, badge.label, 'flat');
    await fs.writeFile(path.join(outputDir, `${badge.name}-badge.svg`), svg);
  }

  // Generate combined markdown
  const markdown = badges.map(b => {
    const url = createShieldsBadgeUrl(b.text, b.label, 'flat');
    return `[![${b.label}](${url})](https://agentlink.dev)`;
  }).join('\n');

  await fs.writeFile(path.join(outputDir, 'badges.md'), markdown);
}
