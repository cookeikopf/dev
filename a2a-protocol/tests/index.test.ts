/**
 * A2A Protocol - Index Tests
 * 
 * Tests for module exports
 */

import { describe, it, expect } from 'vitest';
import * as A2A from '../src/index.js';

describe('Module Exports', () => {
  it('should export schemas', () => {
    expect(A2A.TimestampSchema).toBeDefined();
    expect(A2A.UUIDSchema).toBeDefined();
    expect(A2A.MessageSchema).toBeDefined();
    expect(A2A.TaskSchema).toBeDefined();
    expect(A2A.AgentCardSchema).toBeDefined();
    expect(A2A.JSONRPCRequestSchema).toBeDefined();
    expect(A2A.JSONRPCResponseSchema).toBeDefined();
    expect(A2A.A2AErrorCodes).toBeDefined();
  });

  it('should export agent card utilities', () => {
    expect(A2A.AgentCardBuilder).toBeDefined();
    expect(A2A.SkillBuilder).toBeDefined();
    expect(A2A.AgentCardValidationError).toBeDefined();
    expect(A2A.createAgentCard).toBeDefined();
    expect(A2A.createSkill).toBeDefined();
    expect(A2A.validateAgentCard).toBeDefined();
    expect(A2A.parseAgentCard).toBeDefined();
    expect(A2A.createMinimalAgentCard).toBeDefined();
    expect(A2A.createBasicAgentCard).toBeDefined();
    expect(A2A.createTaskAgentCard).toBeDefined();
  });

  it('should export JSON-RPC handler', () => {
    expect(A2A.JSONRPCHandler).toBeDefined();
    expect(A2A.JSONRPCError).toBeDefined();
    expect(A2A.InMemoryTaskStore).toBeDefined();
    expect(A2A.createSuccessResponse).toBeDefined();
    expect(A2A.createErrorResponse).toBeDefined();
    expect(A2A.parseJSONRPCRequest).toBeDefined();
  });

  it('should export SSE stream utilities', () => {
    expect(A2A.TaskStreamManager).toBeDefined();
    expect(A2A.createSSEStreamController).toBeDefined();
    expect(A2A.formatSSEEvent).toBeDefined();
    expect(A2A.createStatusUpdateEvent).toBeDefined();
    expect(A2A.createArtifactUpdateEvent).toBeDefined();
    expect(A2A.createMessageEvent).toBeDefined();
    expect(A2A.createErrorEvent).toBeDefined();
    expect(A2A.createCloseEvent).toBeDefined();
    expect(A2A.createSSEHeaders).toBeDefined();
    expect(A2A.SSE_HEADERS).toBeDefined();
    expect(A2A.parseSSEStream).toBeDefined();
    expect(A2A.createTaskStatusUpdate).toBeDefined();
    expect(A2A.createTaskArtifactUpdate).toBeDefined();
    expect(A2A.isTerminalState).toBeDefined();
  });

  it('should export server', () => {
    expect(A2A.A2AServer).toBeDefined();
    expect(A2A.createA2AServer).toBeDefined();
    expect(A2A.createExpressMiddleware).toBeDefined();
  });

  it('should export version info', () => {
    expect(A2A.A2A_PROTOCOL_VERSION).toBeDefined();
    expect(A2A.LIBRARY_VERSION).toBeDefined();
    expect(A2A.getVersionInfo).toBeDefined();

    const versionInfo = A2A.getVersionInfo();
    expect(versionInfo.library).toBeDefined();
    expect(versionInfo.protocol).toBeDefined();
    expect(versionInfo.spec).toBeDefined();
  });
});

describe('Type Exports', () => {
  // These tests verify that types are properly exported
  // They will fail at compile time if types are missing
  it('should export Part types', () => {
    const textPart: A2A.TextPart = { type: 'text', text: 'Hello' };
    expect(textPart.type).toBe('text');
  });

  it('should export Message type', () => {
    const message: A2A.Message = {
      messageId: 'msg-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello' }],
      timestamp: '2024-01-15T10:30:00.000Z',
    };
    expect(message.role).toBe('user');
  });

  it('should export Task type', () => {
    const task: A2A.Task = {
      id: 'task-1',
      status: {
        state: 'working',
        timestamp: '2024-01-15T10:30:00.000Z',
      },
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T10:30:00.000Z',
    };
    expect(task.status.state).toBe('working');
  });

  it('should export AgentCard type', () => {
    const card: A2A.AgentCard = {
      name: 'Test Agent',
      description: 'A test agent',
      url: 'https://example.com/a2a',
      version: '1.0.0',
      capabilities: {},
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [],
    };
    expect(card.name).toBe('Test Agent');
  });

  it('should export JSON-RPC types', () => {
    const request: A2A.JSONRPCRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'SendMessage',
      params: {},
    };
    expect(request.jsonrpc).toBe('2.0');
  });

  it('should export TaskState type', () => {
    const state: A2A.TaskState = 'completed';
    expect(state).toBe('completed');
  });

  it('should export Role type', () => {
    const role: A2A.Role = 'agent';
    expect(role).toBe('agent');
  });
});
