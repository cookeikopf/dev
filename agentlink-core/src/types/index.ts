/**
 * AgentLink Core - Type Definitions
 */

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentConfig {
  name: string;
  identity: `eip155:${number}/${string}`;
  description?: string;
  capabilities: Capability[];
  pricing?: Record<string, number>;
  x402?: X402Config;
  telemetry?: TelemetryConfig;
  a2a?: A2AConfig;
  version?: string;
  url?: string;
  documentationUrl?: string;
  provider?: ProviderInfo;
}

export interface Agent {
  name: string;
  identity: `eip155:${number}/${string}`;
  description: string;
  capabilities: Map<string, Capability>;
  version: string;
  url?: string;
  documentationUrl?: string;
  provider?: ProviderInfo;
  x402?: X402Config;
  telemetry: TelemetryEmitter;
  
  executeCapability(id: string, input: unknown, context?: Partial<CapabilityContext>): Promise<unknown>;
  getCapability(id: string): Capability | undefined;
  listCapabilities(): CapabilityInfo[];
  getAgentCard(): AgentCard;
}

export interface ProviderInfo {
  name: string;
  url?: string;
  icon?: string;
}

// ============================================================================
// Capability Types
// ============================================================================

export interface Capability {
  id: string;
  name: string;
  description: string;
  pricing?: number;
  input?: InputSchema;
  output?: OutputSchema;
  handler: CapabilityHandler;
  tags?: string[];
  examples?: CapabilityExample[];
}

export interface CapabilityInfo {
  id: string;
  name: string;
  description: string;
  pricing?: number;
  input?: InputSchema;
  output?: OutputSchema;
  tags?: string[];
  examples?: CapabilityExample[];
}

export interface InputSchema {
  schema: Record<string, unknown>;
  description?: string;
  examples?: unknown[];
}

export interface OutputSchema {
  schema: Record<string, unknown>;
  description?: string;
}

export interface CapabilityExample {
  name: string;
  input: unknown;
  output?: unknown;
}

export type CapabilityHandler = (
  input: unknown,
  context: CapabilityContext
) => Promise<unknown>;

export interface CapabilityContext {
  agent: Agent;
  request: RequestContext;
  payment?: PaymentContext;
  telemetry: TelemetryEmitter;
}

export interface RequestContext {
  id: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  timestamp: Date;
}

export interface PaymentContext {
  amount: number;
  txHash: string;
  payer: string;
  timestamp: Date;
}

// ============================================================================
// A2A Protocol Types
// ============================================================================

export interface A2AConfig {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
}

export interface AgentCard {
  schema_version: string;
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: AgentCapabilities;
  skills: AgentSkill[];
  provider?: ProviderInfo;
  documentationUrl?: string;
}

export interface AgentCapabilities {
  streaming: boolean;
  pushNotifications: boolean;
  stateTransitionHistory: boolean;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  examples?: string[];
  input?: InputSchema;
  output?: OutputSchema;
  pricing?: number;
}

// ============================================================================
// x402 Payment Types
// ============================================================================

export interface X402Config {
  usdcAddress: string;
  chainId: number;
  receiver: string;
  timeout?: number;
  verifyPayment?: (txHash: string, amount: number) => Promise<boolean>;
}

export interface PaymentRequirement {
  amount: number;
  token: string;
  chainId: number;
  receiver: string;
  paymentId: string;
  expiresAt: number;
}

export interface PaymentProof {
  txHash: string;
  amount: number;
  token: string;
  chainId: number;
  receiver: string;
  paymentId: string;
}

// ============================================================================
// Telemetry Types
// ============================================================================

export interface TelemetryConfig {
  enabled: boolean;
  hooks?: TelemetryHooks;
}

export interface TelemetryHooks {
  onCapabilityInvoke?: (event: CapabilityInvokeEvent) => void | Promise<void>;
  onPaymentReceived?: (event: PaymentReceivedEvent) => void | Promise<void>;
  onError?: (event: ErrorEvent) => void | Promise<void>;
}

export interface CapabilityInvokeEvent {
  capabilityId: string;
  requestId: string;
  input: unknown;
  timestamp: Date;
  duration?: number;
  success: boolean;
  error?: string;
}

export interface PaymentReceivedEvent {
  amount: number;
  txHash: string;
  payer: string;
  capabilityId: string;
  timestamp: Date;
}

export interface ErrorEvent {
  message: string;
  stack?: string;
  context: string;
  timestamp: Date;
}

export interface TelemetryEmitter {
  on(event: string, handler: (data: unknown) => void): void;
  off(event: string, handler: (data: unknown) => void): void;
  emit(event: string, data: unknown): void;
}

// ============================================================================
// Adapter Types
// ============================================================================

export interface AdapterOptions {
  enableSse?: boolean;
  cors?: CorsConfig;
  path?: string;
}

export interface CorsConfig {
  origin: string | string[];
  methods?: string[];
  headers?: string[];
}

export interface HTTPRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface HTTPResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface IdentityReference {
  chainNamespace: string;
  chainId: number;
  address: string;
}
