/**
 * A2A Protocol - Zod Schemas
 * 
 * This module defines Zod schemas for all A2A protocol data structures
 * following the Agent2Agent Protocol Specification.
 * 
 * @module a2a/schemas
 * @version 1.0.0
 */

import { z } from 'zod';

// ============================================================================
// Utility Schemas
// ============================================================================

/** ISO 8601 timestamp schema */
export const TimestampSchema = z.string().datetime({ message: 'Must be a valid ISO 8601 timestamp' });

/** UUID schema for identifiers */
export const UUIDSchema = z.string().uuid({ message: 'Must be a valid UUID' });

/** Media type schema (e.g., 'text/plain', 'application/json') */
export const MediaTypeSchema = z.string().min(1);

/** URL schema */
export const URLSchema = z.string().url({ message: 'Must be a valid URL' });

// ============================================================================
// Part Schemas - Content parts for messages and artifacts
// ============================================================================

/** Text part schema */
export const TextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

/** File part schema */
export const FilePartSchema = z.object({
  type: z.literal('file'),
  file: z.object({
    name: z.string().optional(),
    mimeType: z.string().optional(),
    bytes: z.string().optional(), // Base64 encoded
    uri: z.string().optional(),
  }),
});

/** Data part schema for structured content */
export const DataPartSchema = z.object({
  type: z.literal('data'),
  data: z.record(z.unknown()),
});

/** Union of all part types */
export const PartSchema = z.discriminatedUnion('type', [
  TextPartSchema,
  FilePartSchema,
  DataPartSchema,
]);

// ============================================================================
// Message Schema
// ============================================================================

/** Role enum for message participants */
export const RoleSchema = z.enum(['user', 'agent']);

/** Message schema */
export const MessageSchema = z.object({
  messageId: z.string(),
  role: RoleSchema,
  parts: z.array(PartSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
  timestamp: TimestampSchema.optional(),
});

// ============================================================================
// Task State and Status Schemas
// ============================================================================

/** Task state enum */
export const TaskStateSchema = z.enum([
  'submitted',
  'working',
  'input-required',
  'completed',
  'canceled',
  'failed',
  'rejected',
]);

/** Task status schema */
export const TaskStatusSchema = z.object({
  state: TaskStateSchema,
  message: MessageSchema.optional(),
  timestamp: TimestampSchema,
});

// ============================================================================
// Artifact Schema
// ============================================================================

/** Artifact schema for task outputs */
export const ArtifactSchema = z.object({
  artifactId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  parts: z.array(PartSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
  timestamp: TimestampSchema.optional(),
  index: z.number().int().nonnegative().optional(),
});

// ============================================================================
// Task Schema
// ============================================================================

/** Task schema - the core unit of work in A2A */
export const TaskSchema = z.object({
  id: z.string(),
  contextId: z.string().optional(),
  sessionId: z.string().optional(),
  status: TaskStatusSchema,
  artifacts: z.array(ArtifactSchema).optional(),
  history: z.array(MessageSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

// ============================================================================
// Streaming Event Schemas
// ============================================================================

/** Task status update event schema */
export const TaskStatusUpdateEventSchema = z.object({
  taskId: z.string(),
  status: TaskStatusSchema,
  final: z.boolean().optional(),
  timestamp: TimestampSchema,
});

/** Task artifact update event schema */
export const TaskArtifactUpdateEventSchema = z.object({
  taskId: z.string(),
  artifact: ArtifactSchema,
  timestamp: TimestampSchema,
});

/** Stream response schema */
export const StreamResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('status'),
    taskId: z.string(),
    status: TaskStatusSchema,
    final: z.boolean().optional(),
    timestamp: TimestampSchema,
  }),
  z.object({
    type: z.literal('artifact'),
    taskId: z.string(),
    artifact: ArtifactSchema,
    timestamp: TimestampSchema,
  }),
  z.object({
    type: z.literal('message'),
    message: MessageSchema,
    timestamp: TimestampSchema,
  }),
]);

// ============================================================================
// Agent Card Schemas
// ============================================================================

/** Agent provider schema */
export const AgentProviderSchema = z.object({
  organization: z.string(),
  url: URLSchema.optional(),
});

/** Agent capabilities schema */
export const AgentCapabilitiesSchema = z.object({
  streaming: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  stateTransitionHistory: z.boolean().optional(),
  extendedAgentCard: z.boolean().optional(),
});

/** Agent skill schema */
export const AgentSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  inputModes: z.array(MediaTypeSchema).optional(),
  outputModes: z.array(MediaTypeSchema).optional(),
});

/** Security scheme types */
export const SecuritySchemeTypeSchema = z.enum([
  'apiKey',
  'http',
  'oauth2',
  'openIdConnect',
  'mutualTLS',
]);

/** API Key security scheme */
export const APIKeySecuritySchemeSchema = z.object({
  type: z.literal('apiKey'),
  in: z.enum(['header', 'query']).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

/** HTTP security scheme */
export const HTTPAuthSecuritySchemeSchema = z.object({
  type: z.literal('http'),
  scheme: z.enum(['basic', 'bearer']).optional(),
  description: z.string().optional(),
});

/** OAuth2 security scheme */
export const OAuth2SecuritySchemeSchema = z.object({
  type: z.literal('oauth2'),
  flows: z.object({
    authorizationCode: z.object({
      authorizationEndpoint: URLSchema,
      tokenEndpoint: URLSchema,
      scopes: z.record(z.string()).optional(),
    }).optional(),
    clientCredentials: z.object({
      tokenEndpoint: URLSchema,
      scopes: z.record(z.string()).optional(),
    }).optional(),
  }).optional(),
  description: z.string().optional(),
});

/** OpenID Connect security scheme */
export const OpenIdConnectSecuritySchemeSchema = z.object({
  type: z.literal('openIdConnect'),
  openIdConnectUrl: URLSchema,
  description: z.string().optional(),
});

/** Security scheme union */
export const SecuritySchemeSchema = z.discriminatedUnion('type', [
  APIKeySecuritySchemeSchema,
  HTTPAuthSecuritySchemeSchema,
  OAuth2SecuritySchemeSchema,
  OpenIdConnectSecuritySchemeSchema,
]);

/** Security requirement schema */
export const SecurityRequirementSchema = z.record(z.array(z.string()));

/** Agent interface schema */
export const AgentInterfaceSchema = z.object({
  url: URLSchema,
  protocolBinding: z.enum(['JSONRPC', 'GRPC', 'HTTP+JSON']),
  protocolVersion: z.string(),
});

/** Agent card signature schema */
export const AgentCardSignatureSchema = z.object({
  protected: z.string(),
  signature: z.string(),
});

/** Agent card schema - the core discovery document */
export const AgentCardSchema = z.object({
  name: z.string(),
  description: z.string(),
  url: URLSchema,
  version: z.string(),
  provider: AgentProviderSchema.optional(),
  documentationUrl: URLSchema.optional(),
  capabilities: AgentCapabilitiesSchema,
  securitySchemes: z.record(SecuritySchemeSchema).optional(),
  security: z.array(SecurityRequirementSchema).optional(),
  defaultInputModes: z.array(MediaTypeSchema),
  defaultOutputModes: z.array(MediaTypeSchema),
  skills: z.array(AgentSkillSchema),
  supportedInterfaces: z.array(AgentInterfaceSchema).optional(),
  iconUrl: URLSchema.optional(),
  signatures: z.array(AgentCardSignatureSchema).optional(),
});

// ============================================================================
// JSON-RPC Request/Response Schemas
// ============================================================================

/** JSON-RPC error schema */
export const JSONRPCErrorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});

/** JSON-RPC request schema */
export const JSONRPCRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});

/** JSON-RPC response schema */
export const JSONRPCResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown().optional(),
  error: JSONRPCErrorSchema.optional(),
});

// ============================================================================
// Method-Specific Request Schemas
// ============================================================================

/** Send message request params */
export const SendMessageRequestSchema = z.object({
  message: MessageSchema,
  taskId: z.string().optional(),
  contextId: z.string().optional(),
  sessionId: z.string().optional(),
  acceptedOutputModes: z.array(MediaTypeSchema).optional(),
  pushNotificationConfig: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  historyLength: z.number().int().nonnegative().optional(),
});

/** Get task request params */
export const GetTaskRequestSchema = z.object({
  id: z.string(),
  historyLength: z.number().int().nonnegative().optional(),
});

/** List tasks request params */
export const ListTasksRequestSchema = z.object({
  contextId: z.string().optional(),
  status: TaskStateSchema.optional(),
  pageSize: z.number().int().positive().optional(),
  pageToken: z.string().optional(),
});

/** Cancel task request params */
export const CancelTaskRequestSchema = z.object({
  id: z.string(),
});

/** Subscribe to task request params */
export const SubscribeToTaskRequestSchema = z.object({
  id: z.string(),
});

// ============================================================================
// Method-Specific Response Schemas
// ============================================================================

/** Send message response schema */
export const SendMessageResponseSchema = z.object({
  task: TaskSchema.optional(),
  message: MessageSchema.optional(),
});

/** List tasks response schema */
export const ListTasksResponseSchema = z.object({
  tasks: z.array(TaskSchema),
  totalSize: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  nextPageToken: z.string().optional(),
});

// ============================================================================
// Error Code Constants
// ============================================================================

export const A2AErrorCodes = {
  // JSON-RPC standard errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // A2A-specific errors
  TASK_NOT_FOUND: -32001,
  TASK_ALREADY_EXISTS: -32002,
  INVALID_TASK_STATE: -32003,
  CONTENT_TYPE_NOT_SUPPORTED: -32004,
  UNAUTHORIZED: -32005,
  PUSH_NOTIFICATION_NOT_SUPPORTED: -32006,
  UNSUPPORTED_OPERATION: -32007,
  EXTENDED_AGENT_CARD_NOT_CONFIGURED: -32008,
  VERSION_NOT_SUPPORTED: -32009,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type TextPart = z.infer<typeof TextPartSchema>;
export type FilePart = z.infer<typeof FilePartSchema>;
export type DataPart = z.infer<typeof DataPartSchema>;
export type Part = z.infer<typeof PartSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type TaskState = z.infer<typeof TaskStateSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type TaskStatusUpdateEvent = z.infer<typeof TaskStatusUpdateEventSchema>;
export type TaskArtifactUpdateEvent = z.infer<typeof TaskArtifactUpdateEventSchema>;
export type StreamResponse = z.infer<typeof StreamResponseSchema>;
export type AgentProvider = z.infer<typeof AgentProviderSchema>;
export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;
export type AgentSkill = z.infer<typeof AgentSkillSchema>;
export type SecurityScheme = z.infer<typeof SecuritySchemeSchema>;
export type SecurityRequirement = z.infer<typeof SecurityRequirementSchema>;
export type AgentInterface = z.infer<typeof AgentInterfaceSchema>;
export type AgentCardSignature = z.infer<typeof AgentCardSignatureSchema>;
export type AgentCard = z.infer<typeof AgentCardSchema>;
export type JSONRPCError = z.infer<typeof JSONRPCErrorSchema>;
export type JSONRPCRequest = z.infer<typeof JSONRPCRequestSchema>;
export type JSONRPCResponse = z.infer<typeof JSONRPCResponseSchema>;
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
export type GetTaskRequest = z.infer<typeof GetTaskRequestSchema>;
export type ListTasksRequest = z.infer<typeof ListTasksRequestSchema>;
export type CancelTaskRequest = z.infer<typeof CancelTaskRequestSchema>;
export type SubscribeToTaskRequest = z.infer<typeof SubscribeToTaskRequestSchema>;
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;
export type ListTasksResponse = z.infer<typeof ListTasksResponseSchema>;
