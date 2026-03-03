import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ethers } from 'ethers';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import { fileExists, loadEnvFile, writeFile } from '../utils/files.js';
import { logger } from '../utils/logger.js';

// ERC-8004 Identity Registry Contract ABI (simplified)
const IDENTITY_REGISTRY_ABI = [
  'function mintIdentity(string memory metadataURI) public payable returns (uint256)',
  'function getIdentity(address owner) external view returns (uint256 tokenId, string memory metadataURI, bool exists)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'event IdentityMinted(uint256 indexed tokenId, address indexed owner, string metadataURI)',
  'function mintPrice() external view returns (uint256)'
];

// Base Sepolia testnet contract address (placeholder - would be actual deployed address)
const BASE_SEPOLIA_CONTRACT = '0x1234567890123456789012345678901234567890';

export const identityCommand = new Command('identity')
  .description('Manage agent identity and NFT minting')
  .addCommand(
    new Command('mint')
      .description('Mint ERC-8004 identity NFT on Base Sepolia')
      .option('-k, --key <privateKey>', 'Private key for signing')
      .option('-r, --rpc <rpcUrl>', 'RPC URL for Base Sepolia')
      .option('-n, --name <name>', 'Agent name for metadata')
      .option('-d, --description <description>', 'Agent description')
      .option('--mainnet', 'Use Base mainnet instead of Sepolia')
      .action(async (options) => {
        await mintIdentity(options);
      })
  )
  .addCommand(
    new Command('info')
      .description('Display current identity information')
      .action(async () => {
        await displayIdentityInfo();
      })
  )
  .addCommand(
    new Command('update')
      .description('Update identity metadata')
      .option('-n, --name <name>', 'New agent name')
      .option('-d, --description <description>', 'New description')
      .action(async (options) => {
        await updateIdentity(options);
      })
  );

interface MintOptions {
  key?: string;
  rpc?: string;
  name?: string;
  description?: string;
  mainnet?: boolean;
}

async function mintIdentity(options: MintOptions): Promise<void> {
  const projectPath = process.cwd();
  
  // Validate project
  const agentCardPath = path.join(projectPath, 'agent-card.json');
  if (!(await fileExists(agentCardPath))) {
    logger.error('Not an AgentLink project. Run "agentlink create" first.');
    process.exit(1);
  }

  // Load agent card for metadata
  const agentCard = await fs.readJson(agentCardPath);
  
  logger.section('Mint Agent Identity NFT');
  logger.info('This will mint an ERC-8004 identity NFT on Base Sepolia testnet.');
  logger.blank();

  // Get private key
  let privateKey = options.key;
  if (!privateKey) {
    const envPath = path.join(projectPath, '.env');
    const env = await loadEnvFile(envPath);
    
    if (env.AGENT_PRIVATE_KEY) {
      privateKey = env.AGENT_PRIVATE_KEY;
    } else {
      const answer = await inquirer.prompt([
        {
          type: 'password',
          name: 'key',
          message: 'Enter your wallet private key:',
          mask: '*',
          validate: (input: string) => {
            try {
              new ethers.Wallet(input);
              return true;
            } catch {
              return 'Invalid private key';
            }
          }
        }
      ]);
      privateKey = answer.key;
    }
  }

  // Get RPC URL
  const rpcUrl = options.rpc || 'https://sepolia.base.org';
  
  // Get agent metadata
  const agentName = options.name || agentCard.name || 'Unnamed Agent';
  const agentDescription = options.description || agentCard.description || '';

  // Confirm with user
  logger.blank();
  logger.info('Minting details:');
  logger.table([
    ['Network', options.mainnet ? chalk.yellow('Base Mainnet') : chalk.cyan('Base Sepolia')],
    ['Agent Name', agentName],
    ['RPC URL', rpcUrl]
  ]);
  logger.blank();

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed with minting?',
      default: true
    }
  ]);

  if (!confirm) {
    logger.info('Minting cancelled.');
    return;
  }

  // Setup provider and wallet
  const spinner = ora('Connecting to network...').start();
  
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    spinner.text = 'Checking wallet balance...';
    
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    
    spinner.succeed(`Connected: ${chalk.cyan(wallet.address)}`);
    logger.info(`Balance: ${chalk.cyan(balanceEth)} ETH`);
    logger.blank();

    // Check if identity already exists
    spinner.start('Checking for existing identity...');
    
    const contractAddress = options.mainnet 
      ? '0x0000000000000000000000000000000000000000' // Mainnet address would go here
      : BASE_SEPOLIA_CONTRACT;
    
    const contract = new ethers.Contract(
      contractAddress,
      IDENTITY_REGISTRY_ABI,
      wallet
    );

    try {
      const existingIdentity = await contract.getIdentity(wallet.address);
      if (existingIdentity.exists) {
        spinner.warn('Identity already exists for this wallet!');
        logger.info(`Token ID: ${chalk.cyan(existingIdentity.tokenId.toString())}`);
        
        const { update } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'update',
            message: 'Would you like to update the metadata instead?',
            default: true
          }
        ]);
        
        if (update) {
          await updateIdentityMetadata(wallet, contract, existingIdentity.tokenId, {
            name: agentName,
            description: agentDescription,
            endpoints: agentCard.endpoints
          });
        }
        return;
      }
    } catch {
      // No existing identity, continue with minting
    }

    // Prepare metadata
    spinner.start('Preparing metadata...');
    
    const metadata = {
      name: agentName,
      description: agentDescription,
      image: '', // Could be generated or provided
      attributes: [
        { trait_type: 'Framework', value: agentCard.framework || 'unknown' },
        { trait_type: 'Version', value: agentCard.version || '0.1.0' },
        { trait_type: 'Endpoints', value: agentCard.endpoints?.length || 0 }
      ],
      agentlink: {
        version: '0.1.0',
        endpoints: agentCard.endpoints || [],
        capabilities: agentCard.capabilities || {}
      }
    };

    // In a real implementation, this would be uploaded to IPFS or similar
    const metadataURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;
    
    spinner.succeed('Metadata prepared');

    // Get mint price
    spinner.start('Getting mint price...');
    let mintPrice: bigint;
    try {
      mintPrice = await contract.mintPrice();
      spinner.succeed(`Mint price: ${chalk.cyan(ethers.formatEther(mintPrice))} ETH`);
    } catch {
      // Default to 0 if function not available
      mintPrice = BigInt(0);
      spinner.succeed('Mint price: Free');
    }

    // Confirm mint cost
    if (mintPrice > BigInt(0)) {
      const { confirmCost } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmCost',
          message: `This will cost ${ethers.formatEther(mintPrice)} ETH. Continue?`,
          default: true
        }
      ]);
      
      if (!confirmCost) {
        logger.info('Minting cancelled.');
        return;
      }
    }

    // Mint the NFT
    spinner.start('Minting identity NFT...');
    
    const tx = await contract.mintIdentity(metadataURI, {
      value: mintPrice
    });
    
    spinner.text = `Waiting for transaction... ${chalk.gray(tx.hash)}`;
    
    const receipt = await tx.wait();
    
    spinner.succeed('Identity NFT minted successfully!');
    logger.blank();

    // Parse token ID from event
    let tokenId = 'unknown';
    try {
      const event = receipt?.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'IdentityMinted';
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsedEvent = contract.interface.parseLog(event);
        tokenId = parsedEvent?.args.tokenId.toString();
      }
    } catch {
      // Could not parse token ID
    }

    // Display results
    logger.box(
      'Identity Minted',
      `${chalk.bold('Token ID:')} ${chalk.cyan(tokenId)}
${chalk.bold('Owner:')} ${chalk.cyan(wallet.address)}
${chalk.bold('Transaction:')} ${chalk.gray(tx.hash)}
${chalk.bold('Block:')} ${chalk.gray(receipt?.blockNumber || 'pending')}
${chalk.bold('Contract:')} ${chalk.gray(contractAddress)}`
    );

    // Update .env file
    const envPath = path.join(projectPath, '.env');
    const envContent = await fs.readFile(envPath, 'utf-8').catch(() => '');
    
    const updatedEnv = envContent
      .replace(/^AGENT_IDENTITY_ADDRESS=.*$/m, `AGENT_IDENTITY_ADDRESS=${wallet.address}`)
      .replace(/^AGENT_PRIVATE_KEY=.*$/m, `AGENT_PRIVATE_KEY=${privateKey}`);
    
    if (!updatedEnv.includes('AGENT_IDENTITY_ADDRESS=')) {
      await writeFile(envPath, updatedEnv + `\nAGENT_IDENTITY_ADDRESS=${wallet.address}\n`);
    } else {
      await writeFile(envPath, updatedEnv);
    }
    
    logger.success('Updated .env with identity address');
    
    // Update agent-card.json
    agentCard.identity = {
      address: wallet.address,
      tokenId: tokenId,
      contract: contractAddress,
      network: options.mainnet ? 'base-mainnet' : 'base-sepolia',
      mintedAt: new Date().toISOString()
    };
    
    await fs.writeJson(agentCardPath, agentCard, { spaces: 2 });
    logger.success('Updated agent-card.json with identity info');
    
    logger.blank();
    logger.info(chalk.gray('View on explorer:'));
    logger.code(`https://${options.mainnet ? '' : 'sepolia.'}basescan.org/tx/${tx.hash}`);

  } catch (error: any) {
    spinner.fail('Minting failed');
    logger.error(error.message || 'Unknown error');
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      logger.info(chalk.yellow('\nTip: Get test ETH from the Base Sepolia faucet:'));
      logger.code('https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
    }
    
    process.exit(1);
  }
}

async function displayIdentityInfo(): Promise<void> {
  const projectPath = process.cwd();
  const agentCardPath = path.join(projectPath, 'agent-card.json');
  const envPath = path.join(projectPath, '.env');
  
  if (!(await fileExists(agentCardPath))) {
    logger.error('Not an AgentLink project. Run "agentlink create" first.');
    process.exit(1);
  }

  const agentCard = await fs.readJson(agentCardPath);
  const env = await loadEnvFile(envPath);
  
  logger.section('Agent Identity Information');
  
  if (agentCard.identity) {
    logger.table([
      ['Name', agentCard.name || 'N/A'],
      ['Description', agentCard.description || 'N/A'],
      ['Identity Address', agentCard.identity.address || env.AGENT_IDENTITY_ADDRESS || 'Not set'],
      ['Token ID', agentCard.identity.tokenId || 'N/A'],
      ['Network', agentCard.identity.network || 'N/A'],
      ['Contract', agentCard.identity.contract || 'N/A'],
      ['Minted At', agentCard.identity.mintedAt ? new Date(agentCard.identity.mintedAt).toLocaleString() : 'N/A']
    ]);
  } else {
    logger.warning('No identity found. Run "agentlink identity mint" to create one.');
  }
}

async function updateIdentity(options: { name?: string; description?: string }): Promise<void> {
  const projectPath = process.cwd();
  const agentCardPath = path.join(projectPath, 'agent-card.json');
  
  if (!(await fileExists(agentCardPath))) {
    logger.error('Not an AgentLink project.');
    process.exit(1);
  }

  const agentCard = await fs.readJson(agentCardPath);
  
  if (!agentCard.identity) {
    logger.error('No identity found. Mint an identity first.');
    process.exit(1);
  }

  // Update fields
  if (options.name) {
    agentCard.name = options.name;
  }
  
  if (options.description) {
    agentCard.description = options.description;
  }

  agentCard.updatedAt = new Date().toISOString();
  
  await fs.writeJson(agentCardPath, agentCard, { spaces: 2 });
  logger.success('Identity metadata updated locally.');
  logger.info(chalk.gray('Note: On-chain metadata update not yet implemented.'));
}

async function updateIdentityMetadata(
  wallet: ethers.Wallet,
  contract: ethers.Contract,
  tokenId: string,
  metadata: any
): Promise<void> {
  const spinner = ora('Updating metadata...').start();
  
  // This would call the contract's updateMetadata function
  // For now, just a placeholder
  
  spinner.succeed('Metadata update initiated');
  logger.info(chalk.gray('Note: Full metadata update flow coming soon.'));
}
