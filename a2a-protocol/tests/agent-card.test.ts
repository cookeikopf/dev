/**
 * A2A Protocol - Agent Card Tests
 * 
 * Tests for Agent Card builder and utilities
 */

import { describe, it, expect } from 'vitest';
import {
  AgentCardBuilder,
  SkillBuilder,
  AgentCardValidationError,
  createAgentCard,
  createSkill,
  validateAgentCard,
  parseAgentCard,
  createMinimalAgentCard,
  createBasicAgentCard,
  createTaskAgentCard,
  type AgentCard,
  type AgentSkill,
} from '../src/agent-card.js';

describe('AgentCardBuilder', () => {
  it('should build a complete agent card', () => {
    const card = createAgentCard()
      .name('Test Agent')
      .description('A test agent')
      .url('https://example.com/a2a')
      .version('1.0.0')
      .capabilities({ streaming: true })
      .defaultInputModes(['text/plain', 'application/json'])
      .defaultOutputModes(['text/plain'])
      .addSkill(
        createSkill()
          .id('test-skill')
          .name('Test Skill')
          .description('A test skill')
          .tags(['test', 'demo'])
          .examples(['Example 1', 'Example 2'])
          .build()
      )
      .build();

    expect(card.name).toBe('Test Agent');
    expect(card.description).toBe('A test agent');
    expect(card.url).toBe('https://example.com/a2a');
    expect(card.version).toBe('1.0.0');
    expect(card.capabilities.streaming).toBe(true);
    expect(card.defaultInputModes).toEqual(['text/plain', 'application/json']);
    expect(card.skills).toHaveLength(1);
    expect(card.skills[0].id).toBe('test-skill');
  });

  it('should support chaining multiple skills', () => {
    const card = createAgentCard()
      .name('Multi-Skill Agent')
      .description('An agent with multiple skills')
      .url('https://example.com/a2a')
      .version('1.0.0')
      .addSkills(
        createSkill()
          .id('skill-1')
          .name('Skill 1')
          .description('First skill')
          .build(),
        createSkill()
          .id('skill-2')
          .name('Skill 2')
          .description('Second skill')
          .build()
      )
      .build();

    expect(card.skills).toHaveLength(2);
    expect(card.skills[0].id).toBe('skill-1');
    expect(card.skills[1].id).toBe('skill-2');
  });

  it('should support authentication schemes', () => {
    const card = createAgentCard()
      .name('Secure Agent')
      .description('An agent with authentication')
      .url('https://example.com/a2a')
      .version('1.0.0')
      .withAPIKeyAuth('apiKey', { in: 'header', name: 'X-API-Key' })
      .withBearerAuth('bearer', 'Bearer token authentication')
      .build();

    expect(card.securitySchemes).toBeDefined();
    expect(card.securitySchemes?.apiKey).toBeDefined();
    expect(card.securitySchemes?.apiKey.type).toBe('apiKey');
    expect(card.securitySchemes?.bearer).toBeDefined();
    expect(card.securitySchemes?.bearer.type).toBe('http');
  });

  it('should support OAuth2 authentication', () => {
    const card = createAgentCard()
      .name('OAuth Agent')
      .description('An agent with OAuth2')
      .url('https://example.com/a2a')
      .version('1.0.0')
      .withOAuth2('oauth2', {
        authorizationEndpoint: 'https://auth.example.com/authorize',
        tokenEndpoint: 'https://auth.example.com/token',
        scopes: { read: 'Read access', write: 'Write access' },
      })
      .build();

    expect(card.securitySchemes?.oauth2).toBeDefined();
    expect(card.securitySchemes?.oauth2.type).toBe('oauth2');
    expect(card.securitySchemes?.oauth2.flows?.authorizationCode).toBeDefined();
  });

  it('should support capability toggles', () => {
    const card = createAgentCard()
      .name('Feature-Rich Agent')
      .description('An agent with all features')
      .url('https://example.com/a2a')
      .version('1.0.0')
      .withStreaming()
      .withPushNotifications()
      .withStateTransitionHistory()
      .withExtendedAgentCard()
      .build();

    expect(card.capabilities.streaming).toBe(true);
    expect(card.capabilities.pushNotifications).toBe(true);
    expect(card.capabilities.stateTransitionHistory).toBe(true);
    expect(card.capabilities.extendedAgentCard).toBe(true);
  });

  it('should support interfaces', () => {
    const card = createAgentCard()
      .name('Multi-Protocol Agent')
      .description('An agent supporting multiple protocols')
      .url('https://example.com/a2a')
      .version('1.0.0')
      .addInterface({
        url: 'https://example.com/a2a/jsonrpc',
        protocolBinding: 'JSONRPC',
        protocolVersion: '1.0',
      })
      .addInterface({
        url: 'https://example.com/a2a/grpc',
        protocolBinding: 'GRPC',
        protocolVersion: '1.0',
      })
      .build();

    expect(card.supportedInterfaces).toHaveLength(2);
    expect(card.supportedInterfaces?.[0].protocolBinding).toBe('JSONRPC');
    expect(card.supportedInterfaces?.[1].protocolBinding).toBe('GRPC');
  });

  it('should throw validation error for incomplete cards', () => {
    expect(() => {
      createAgentCard()
        .name('Incomplete Agent')
        // missing description, url, version
        .build();
    }).toThrow(AgentCardValidationError);
  });

  it('should throw validation error for invalid URL', () => {
    expect(() => {
      createAgentCard()
        .name('Invalid URL Agent')
        .description('An agent with invalid URL')
        .url('not-a-valid-url')
        .version('1.0.0')
        .build();
    }).toThrow(AgentCardValidationError);
  });

  it('should build JSON output', () => {
    const json = createAgentCard()
      .name('JSON Agent')
      .description('An agent for JSON testing')
      .url('https://example.com/a2a')
      .version('1.0.0')
      .buildJSON(2);

    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe('JSON Agent');
  });
});

describe('SkillBuilder', () => {
  it('should build a complete skill', () => {
    const skill = createSkill()
      .id('my-skill')
      .name('My Skill')
      .description('A useful skill')
      .tags(['useful', 'helpful'])
      .examples(['Do this', 'Do that'])
      .inputModes('text/plain', 'application/json')
      .outputModes('text/plain')
      .build();

    expect(skill.id).toBe('my-skill');
    expect(skill.name).toBe('My Skill');
    expect(skill.description).toBe('A useful skill');
    expect(skill.tags).toEqual(['useful', 'helpful']);
    expect(skill.examples).toEqual(['Do this', 'Do that']);
    expect(skill.inputModes).toEqual(['text/plain', 'application/json']);
    expect(skill.outputModes).toEqual(['text/plain']);
  });

  it('should throw error for incomplete skills', () => {
    expect(() => {
      createSkill()
        .id('incomplete')
        .name('Incomplete Skill')
        // missing description
        .build();
    }).toThrow('Skill must have id, name, and description');
  });
});

describe('validateAgentCard', () => {
  it('should validate valid agent cards', () => {
    const card: AgentCard = {
      name: 'Valid Agent',
      description: 'A valid agent',
      url: 'https://example.com/a2a',
      version: '1.0.0',
      capabilities: {},
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [],
    };

    const result = validateAgentCard(card);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should return errors for invalid cards', () => {
    const card = {
      name: 'Invalid Agent',
      // missing required fields
    };

    const result = validateAgentCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });
});

describe('parseAgentCard', () => {
  it('should parse valid JSON agent cards', () => {
    const json = JSON.stringify({
      name: 'Parsed Agent',
      description: 'A parsed agent',
      url: 'https://example.com/a2a',
      version: '1.0.0',
      capabilities: {},
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [],
    });

    const card = parseAgentCard(json);
    expect(card.name).toBe('Parsed Agent');
  });

  it('should throw error for invalid JSON', () => {
    expect(() => {
      parseAgentCard('not valid json');
    }).toThrow(AgentCardValidationError);
  });

  it('should throw error for invalid agent card', () => {
    const json = JSON.stringify({
      name: 'Invalid Agent',
      // missing required fields
    });

    expect(() => {
      parseAgentCard(json);
    }).toThrow(AgentCardValidationError);
  });
});

describe('createMinimalAgentCard', () => {
  it('should create a minimal valid agent card', () => {
    const skills: AgentSkill[] = [
      {
        id: 'default',
        name: 'Default Skill',
        description: 'Default capability',
      },
    ];

    const card = createMinimalAgentCard(
      'Minimal Agent',
      'A minimal agent',
      'https://example.com/a2a',
      '1.0.0',
      skills
    );

    expect(card.name).toBe('Minimal Agent');
    expect(card.skills).toHaveLength(1);
    expect(card.defaultInputModes).toEqual(['text/plain']);
  });
});

describe('createBasicAgentCard', () => {
  it('should create a basic agent card with defaults', () => {
    const card = createBasicAgentCard(
      'Basic Agent',
      'A basic agent',
      'https://example.com'
    );

    expect(card.name).toBe('Basic Agent');
    expect(card.url).toBe('https://example.com/a2a');
    expect(card.capabilities.streaming).toBe(true);
    expect(card.skills).toHaveLength(1);
    expect(card.skills[0].id).toBe('default');
  });
});

describe('createTaskAgentCard', () => {
  it('should create a task-oriented agent card', () => {
    const skills: AgentSkill[] = [
      {
        id: 'task-skill',
        name: 'Task Skill',
        description: 'A task-oriented skill',
      },
    ];

    const card = createTaskAgentCard(
      'Task Agent',
      'A task-oriented agent',
      'https://example.com',
      skills
    );

    expect(card.name).toBe('Task Agent');
    expect(card.capabilities.streaming).toBe(true);
    expect(card.capabilities.pushNotifications).toBe(true);
    expect(card.capabilities.stateTransitionHistory).toBe(true);
    expect(card.skills).toHaveLength(1);
  });
});
