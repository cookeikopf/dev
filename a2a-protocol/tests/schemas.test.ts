/**
 * A2A Protocol - Schema Tests
 * 
 * Tests for Zod schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  // Schemas
  TimestampSchema,
  UUIDSchema,
  MediaTypeSchema,
  TextPartSchema,
  FilePartSchema,
  DataPartSchema,
  PartSchema,
  RoleSchema,
  MessageSchema,
  TaskStateSchema,
  TaskStatusSchema,
  ArtifactSchema,
  TaskSchema,
  AgentCardSchema,
  JSONRPCRequestSchema,
  JSONRPCResponseSchema,
  SendMessageRequestSchema,
  A2AErrorCodes,
  // Types
  type AgentCard,
  type Task,
  type Message,
} from '../src/schemas.js';

describe('Utility Schemas', () => {
  describe('TimestampSchema', () => {
    it('should validate valid ISO 8601 timestamps', () => {
      expect(TimestampSchema.safeParse('2024-01-15T10:30:00.000Z').success).toBe(true);
      expect(TimestampSchema.safeParse('2024-01-15T10:30:00Z').success).toBe(true);
    });

    it('should reject invalid timestamps', () => {
      expect(TimestampSchema.safeParse('not-a-timestamp').success).toBe(false);
      expect(TimestampSchema.safeParse('2024-01-15').success).toBe(false);
      expect(TimestampSchema.safeParse('').success).toBe(false);
    });
  });

  describe('UUIDSchema', () => {
    it('should validate valid UUIDs', () => {
      expect(UUIDSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(UUIDSchema.safeParse('not-a-uuid').success).toBe(false);
      expect(UUIDSchema.safeParse('').success).toBe(false);
    });
  });

  describe('MediaTypeSchema', () => {
    it('should validate media types', () => {
      expect(MediaTypeSchema.safeParse('text/plain').success).toBe(true);
      expect(MediaTypeSchema.safeParse('application/json').success).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(MediaTypeSchema.safeParse('').success).toBe(false);
    });
  });
});

describe('Part Schemas', () => {
  describe('TextPartSchema', () => {
    it('should validate text parts', () => {
      const part = { type: 'text', text: 'Hello, world!' };
      expect(TextPartSchema.safeParse(part).success).toBe(true);
    });

    it('should reject missing text', () => {
      const part = { type: 'text' };
      expect(TextPartSchema.safeParse(part).success).toBe(false);
    });
  });

  describe('FilePartSchema', () => {
    it('should validate file parts', () => {
      const part = {
        type: 'file',
        file: {
          name: 'document.pdf',
          mimeType: 'application/pdf',
          bytes: 'base64encodedcontent',
        },
      };
      expect(FilePartSchema.safeParse(part).success).toBe(true);
    });

    it('should validate file parts with URI', () => {
      const part = {
        type: 'file',
        file: {
          uri: 'https://example.com/file.pdf',
        },
      };
      expect(FilePartSchema.safeParse(part).success).toBe(true);
    });
  });

  describe('DataPartSchema', () => {
    it('should validate data parts', () => {
      const part = {
        type: 'data',
        data: { key: 'value', number: 42 },
      };
      expect(DataPartSchema.safeParse(part).success).toBe(true);
    });
  });

  describe('PartSchema', () => {
    it('should validate any part type', () => {
      const textPart = { type: 'text', text: 'Hello' };
      const filePart = { type: 'file', file: { uri: 'https://example.com/file' } };
      const dataPart = { type: 'data', data: { key: 'value' } };

      expect(PartSchema.safeParse(textPart).success).toBe(true);
      expect(PartSchema.safeParse(filePart).success).toBe(true);
      expect(PartSchema.safeParse(dataPart).success).toBe(true);
    });

    it('should reject unknown part types', () => {
      const unknownPart = { type: 'unknown', content: 'test' };
      expect(PartSchema.safeParse(unknownPart).success).toBe(false);
    });
  });
});

describe('Message Schema', () => {
  it('should validate valid messages', () => {
    const message: Message = {
      messageId: 'msg-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello' }],
      timestamp: '2024-01-15T10:30:00.000Z',
    };
    expect(MessageSchema.safeParse(message).success).toBe(true);
  });

  it('should reject messages without parts', () => {
    const message = {
      messageId: 'msg-1',
      role: 'user',
      parts: [],
    };
    expect(MessageSchema.safeParse(message).success).toBe(false);
  });

  it('should reject invalid roles', () => {
    const message = {
      messageId: 'msg-1',
      role: 'invalid-role',
      parts: [{ type: 'text', text: 'Hello' }],
    };
    expect(MessageSchema.safeParse(message).success).toBe(false);
  });
});

describe('Task Schemas', () => {
  describe('TaskStateSchema', () => {
    it('should validate all task states', () => {
      const states = ['submitted', 'working', 'input-required', 'completed', 'canceled', 'failed', 'rejected'];
      for (const state of states) {
        expect(TaskStateSchema.safeParse(state).success).toBe(true);
      }
    });

    it('should reject invalid states', () => {
      expect(TaskStateSchema.safeParse('invalid-state').success).toBe(false);
    });
  });

  describe('TaskStatusSchema', () => {
    it('should validate task status', () => {
      const status = {
        state: 'working',
        timestamp: '2024-01-15T10:30:00.000Z',
      };
      expect(TaskStatusSchema.safeParse(status).success).toBe(true);
    });
  });

  describe('TaskSchema', () => {
    it('should validate complete tasks', () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'ctx-1',
        status: {
          state: 'working',
          timestamp: '2024-01-15T10:30:00.000Z',
        },
        history: [
          {
            messageId: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Hello' }],
            timestamp: '2024-01-15T10:30:00.000Z',
          },
        ],
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      };
      expect(TaskSchema.safeParse(task).success).toBe(true);
    });

    it('should reject tasks without required fields', () => {
      const task = {
        id: 'task-1',
        // missing status
        createdAt: '2024-01-15T10:30:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      };
      expect(TaskSchema.safeParse(task).success).toBe(false);
    });
  });
});

describe('Agent Card Schema', () => {
  it('should validate complete agent cards', () => {
    const card: AgentCard = {
      name: 'Test Agent',
      description: 'A test agent',
      url: 'https://example.com/a2a',
      version: '1.0.0',
      capabilities: {
        streaming: true,
        pushNotifications: false,
      },
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [
        {
          id: 'test-skill',
          name: 'Test Skill',
          description: 'A test skill',
        },
      ],
    };
    expect(AgentCardSchema.safeParse(card).success).toBe(true);
  });

  it('should reject agent cards without required fields', () => {
    const card = {
      name: 'Test Agent',
      // missing description, url, version
      capabilities: {},
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [],
    };
    expect(AgentCardSchema.safeParse(card).success).toBe(false);
  });

  it('should reject agent cards with invalid URLs', () => {
    const card = {
      name: 'Test Agent',
      description: 'A test agent',
      url: 'not-a-url',
      version: '1.0.0',
      capabilities: {},
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [],
    };
    expect(AgentCardSchema.safeParse(card).success).toBe(false);
  });
});

describe('JSON-RPC Schemas', () => {
  describe('JSONRPCRequestSchema', () => {
    it('should validate valid JSON-RPC requests', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'SendMessage',
        params: { message: { messageId: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] } },
      };
      expect(JSONRPCRequestSchema.safeParse(request).success).toBe(true);
    });

    it('should validate requests with string IDs', () => {
      const request = {
        jsonrpc: '2.0',
        id: 'req-1',
        method: 'GetTask',
        params: { id: 'task-1' },
      };
      expect(JSONRPCRequestSchema.safeParse(request).success).toBe(true);
    });

    it('should validate notifications (null ID)', () => {
      const request = {
        jsonrpc: '2.0',
        id: null,
        method: 'SendMessage',
        params: {},
      };
      expect(JSONRPCRequestSchema.safeParse(request).success).toBe(true);
    });

    it('should reject invalid JSON-RPC versions', () => {
      const request = {
        jsonrpc: '1.0',
        id: 1,
        method: 'SendMessage',
        params: {},
      };
      expect(JSONRPCRequestSchema.safeParse(request).success).toBe(false);
    });
  });

  describe('JSONRPCResponseSchema', () => {
    it('should validate success responses', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        result: { task: { id: 'task-1', status: { state: 'working', timestamp: '2024-01-15T10:30:00.000Z' }, createdAt: '2024-01-15T10:30:00.000Z', updatedAt: '2024-01-15T10:30:00.000Z' } },
      };
      expect(JSONRPCResponseSchema.safeParse(response).success).toBe(true);
    });

    it('should validate error responses', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: A2AErrorCodes.TASK_NOT_FOUND,
          message: 'Task not found',
        },
      };
      expect(JSONRPCResponseSchema.safeParse(response).success).toBe(true);
    });
  });
});

describe('SendMessageRequestSchema', () => {
  it('should validate valid send message requests', () => {
    const request = {
      message: {
        messageId: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      },
      taskId: 'task-1',
      contextId: 'ctx-1',
    };
    expect(SendMessageRequestSchema.safeParse(request).success).toBe(true);
  });

  it('should reject requests without message', () => {
    const request = {
      taskId: 'task-1',
    };
    expect(SendMessageRequestSchema.safeParse(request).success).toBe(false);
  });
});

describe('A2AErrorCodes', () => {
  it('should have correct error code values', () => {
    expect(A2AErrorCodes.PARSE_ERROR).toBe(-32700);
    expect(A2AErrorCodes.INVALID_REQUEST).toBe(-32600);
    expect(A2AErrorCodes.METHOD_NOT_FOUND).toBe(-32601);
    expect(A2AErrorCodes.INVALID_PARAMS).toBe(-32602);
    expect(A2AErrorCodes.INTERNAL_ERROR).toBe(-32603);
    expect(A2AErrorCodes.TASK_NOT_FOUND).toBe(-32001);
    expect(A2AErrorCodes.UNSUPPORTED_OPERATION).toBe(-32007);
  });
});
