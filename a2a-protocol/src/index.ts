/**
 * A2A Protocol - AgentLink Implementation
 * 
 * A complete implementation of the Agent-to-Agent (A2A) protocol
 * following the Agent2Agent Protocol Specification.
 * 
 * @packageDocumentation
 * @module a2a
 * @version 1.0.0
 */

// ============================================================================
// Schemas - Zod validation schemas and types
// ============================================================================

export {
  // Utility schemas
  TimestampSchema,
  UUIDSchema,
  MediaTypeSchema,
  URLSchema,
  
  // Part schemas
  TextPartSchema,
  FilePartSchema,
  DataPartSchema,
  PartSchema,
  
  // Message schemas
  RoleSchema,
  MessageSchema,
  
  // Task schemas
  TaskStateSchema,
  TaskStatusSchema,
  ArtifactSchema,
  TaskSchema,
  
  // Streaming schemas
  TaskStatusUpdateEventSchema,
  TaskArtifactUpdateEventSchema,
  StreamResponseSchema,
  
  // Agent Card schemas
  AgentProviderSchema,
  AgentCapabilitiesSchema,
  AgentSkillSchema,
  SecuritySchemeTypeSchema,
  APIKeySecuritySchemeSchema,
  HTTPAuthSecuritySchemeSchema,
  OAuth2SecuritySchemeSchema,
  OpenIdConnectSecuritySchemeSchema,
  SecuritySchemeSchema,
  SecurityRequirementSchema,
  AgentInterfaceSchema,
  AgentCardSignatureSchema,
  AgentCardSchema,
  
  // JSON-RPC schemas
  JSONRPCErrorSchema,
  JSONRPCRequestSchema,
  JSONRPCResponseSchema,
  
  // Method request schemas
  SendMessageRequestSchema,
  GetTaskRequestSchema,
  ListTasksRequestSchema,
  CancelTaskRequestSchema,
  SubscribeToTaskRequestSchema,
  
  // Method response schemas
  SendMessageResponseSchema,
  ListTasksResponseSchema,
  
  // Error codes
  A2AErrorCodes,
  
  // Type exports
  type TextPart,
  type FilePart,
  type DataPart,
  type Part,
  type Role,
  type Message,
  type TaskState,
  type TaskStatus,
  type Artifact,
  type Task,
  type TaskStatusUpdateEvent,
  type TaskArtifactUpdateEvent,
  type StreamResponse,
  type AgentProvider,
  type AgentCapabilities,
  type AgentSkill,
  type SecurityScheme,
  type SecurityRequirement,
  type AgentInterface,
  type AgentCardSignature,
  type AgentCard,
  type JSONRPCError,
  type JSONRPCRequest,
  type JSONRPCResponse,
  type SendMessageRequest,
  type GetTaskRequest,
  type ListTasksRequest,
  type CancelTaskRequest,
  type SubscribeToTaskRequest,
  type SendMessageResponse,
  type ListTasksResponse,
} from './schemas.js';

// ============================================================================
// Agent Card - Builder and utilities
// ============================================================================

export {
  AgentCardBuilder,
  AgentCardValidationError,
  SkillBuilder,
  createAgentCard,
  createSkill,
  validateAgentCard,
  parseAgentCard,
  createMinimalAgentCard,
  createBasicAgentCard,
  createTaskAgentCard,
} from './agent-card.js';

// ============================================================================
// JSON-RPC Handler - Core protocol implementation
// ============================================================================

export {
  JSONRPCHandler,
  JSONRPCError,
  InMemoryTaskStore,
  createSuccessResponse,
  createErrorResponse,
  parseJSONRPCRequest,
  type A2AMethodHandler,
  type RequestContext,
  type TaskStore,
  type TaskHandler,
  type JSONRPCHandlerOptions,
} from './jsonrpc-handler.js';

// ============================================================================
// SSE Stream - Server-Sent Events for task updates
// ============================================================================

export {
  TaskStreamManager,
  createSSEStreamController,
  formatSSEEvent,
  createStatusUpdateEvent,
  createArtifactUpdateEvent,
  createMessageEvent,
  createErrorEvent,
  createCloseEvent,
  createSSEHeaders,
  SSE_HEADERS,
  parseSSEStream,
  createTaskStatusUpdate,
  createTaskArtifactUpdate,
  isTerminalState,
  type SSEEventType,
  type SSEEvent,
  type SSEStreamOptions,
  type SSEStreamController,
  type SSEStreamCallbacks,
} from './sse-stream.js';

// ============================================================================
// Server - Complete A2A server implementation
// ============================================================================

export {
  A2AServer,
  createA2AServer,
  createExpressMiddleware,
  type HTTPRequestHandler,
  type A2AServerOptions,
  type TaskUpdateEvent,
} from './server.js';

// ============================================================================
// Version Information
// ============================================================================

/**
 * A2A Protocol version
 */
export const A2A_PROTOCOL_VERSION = '1.0.0';

/**
 * Library version
 */
export const LIBRARY_VERSION = '1.0.0';

/**
 * Get version information
 */
export function getVersionInfo(): {
  library: string;
  protocol: string;
  spec: string;
} {
  return {
    library: LIBRARY_VERSION,
    protocol: A2A_PROTOCOL_VERSION,
    spec: 'A2A Protocol Specification v1.0',
  };
}
