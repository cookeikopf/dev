/**
 * Persistent Receipt Store for Production
 * Replaces in-memory store to prevent replay attacks across restarts
 */

import { ReceiptStore, PaymentReceipt } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const RECEIPTS_DIR = path.join(process.cwd(), '.x402', 'receipts');
const USED_PAYMENTS_FILE = path.join(process.cwd(), '.x402', 'used-payments.json');

/**
 * File-based receipt store for production use
 * Prevents replay attacks across server restarts
 */
export class PersistentReceiptStore implements ReceiptStore {
  private usedPayments: Set<string> = new Set();
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;
    
    // Create directories
    fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
    
    // Load used payments from file
    if (fs.existsSync(USED_PAYMENTS_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(USED_PAYMENTS_FILE, 'utf-8'));
        this.usedPayments = new Set(data.usedPayments || []);
      } catch (error) {
        console.error('Failed to load used payments, starting fresh');
        this.usedPayments = new Set();
      }
    }
    
    this.initialized = true;
  }

  private saveUsedPayments(): void {
    const data = {
      usedPayments: Array.from(this.usedPayments),
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(USED_PAYMENTS_FILE, JSON.stringify(data, null, 2));
  }

  async store(receipt: PaymentReceipt): Promise<void> {
    // Save receipt to file
    const receiptPath = path.join(RECEIPTS_DIR, `${receipt.receiptId}.json`);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));

    // Track used payment ID
    this.usedPayments.add(receipt.paymentId);
    this.saveUsedPayments();
  }

  async get(receiptId: string): Promise<PaymentReceipt | null> {
    const receiptPath = path.join(RECEIPTS_DIR, `${receiptId}.json`);
    
    if (!fs.existsSync(receiptPath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(receiptPath, 'utf-8');
      return JSON.parse(data) as PaymentReceipt;
    } catch {
      return null;
    }
  }

  async getByPaymentId(paymentId: string): Promise<PaymentReceipt[]> {
    const receipts: PaymentReceipt[] = [];
    
    if (!fs.existsSync(RECEIPTS_DIR)) {
      return receipts;
    }

    const files = fs.readdirSync(RECEIPTS_DIR);
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const data = fs.readFileSync(path.join(RECEIPTS_DIR, file), 'utf-8');
        const receipt = JSON.parse(data) as PaymentReceipt;
        if (receipt.paymentId === paymentId) {
          receipts.push(receipt);
        }
      } catch {
        // Skip invalid files
      }
    }

    return receipts;
  }

  async isPaymentIdUsed(paymentId: string): Promise<boolean> {
    // Check in-memory first (fast)
    if (this.usedPayments.has(paymentId)) {
      return true;
    }

    // Double-check by scanning files (slower but thorough)
    const receipts = await this.getByPaymentId(paymentId);
    if (receipts.length > 0) {
      // Add to cache
      this.usedPayments.add(paymentId);
      return true;
    }

    return false;
  }

  /** Clear all receipts (for testing) */
  clear(): void {
    if (fs.existsSync(RECEIPTS_DIR)) {
      fs.rmSync(RECEIPTS_DIR, { recursive: true });
    }
    if (fs.existsSync(USED_PAYMENTS_FILE)) {
      fs.unlinkSync(USED_PAYMENTS_FILE);
    }
    this.usedPayments.clear();
    this.initialized = false;
  }

  /** Get all receipts (for debugging) */
  async getAll(): Promise<PaymentReceipt[]> {
    const receipts: PaymentReceipt[] = [];
    
    if (!fs.existsSync(RECEIPTS_DIR)) {
      return receipts;
    }

    const files = fs.readdirSync(RECEIPTS_DIR);
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const data = fs.readFileSync(path.join(RECEIPTS_DIR, file), 'utf-8');
        receipts.push(JSON.parse(data) as PaymentReceipt);
      } catch {
        // Skip invalid files
      }
    }

    return receipts;
  }

  /** Get statistics */
  async getStats(): Promise<{ totalReceipts: number; uniquePayments: number }> {
    const all = await this.getAll();
    const uniquePayments = new Set(all.map(r => r.paymentId));
    
    return {
      totalReceipts: all.length,
      uniquePayments: uniquePayments.size,
    };
  }
}

/**
 * Redis-backed receipt store for multi-server deployments
 * (Optional - requires redis package)
 */
export class RedisReceiptStore implements ReceiptStore {
  // Implementation would require ioredis package
  // This is a placeholder for future multi-server scaling
  
  async store(): Promise<void> {
    throw new Error('Redis store not implemented - install ioredis package');
  }
  
  async get(): Promise<null> {
    return null;
  }
  
  async getByPaymentId(): Promise<[]> {
    return [];
  }
  
  async isPaymentIdUsed(): Promise<boolean> {
    return false;
  }
}
