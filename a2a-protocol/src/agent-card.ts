/**
 * A2A Protocol - Agent Card Generator
 * 
 * This module provides utilities for creating and managing Agent Cards
 * following the Agent2Agent Protocol Specification.
 * 
 * @module a2a/agent-card
 * @version 1.0.0
 */

import {
  AgentCard,
  AgentCardSchema,
  AgentSkill,
  AgentCapabilities,
  SecurityScheme,
  SecurityRequirement,
  AgentInterface,
  AgentProvider,
} from './schemas.js';

// ============================================================================
// Agent Card Builder
// ============================================================================

/**
 * Builder class for constructing Agent Cards with a fluent API
 */
export class AgentCardBuilder {
  private card: Partial<AgentCard> = {
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
      extendedAgentCard: false,
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [],
    supportedInterfaces: [],
  };

  /**
   * Set the agent name
   */
  name(name: string): this {
    this.card.name = name;
    return this;
  }

  /**
   * Set the agent description
   */
  description(description: string): this {
    this.card.description = description;
    return this;
  }

  /**
   * Set the agent URL (A2A endpoint)
   */
  url(url: string): this {
    this.card.url = url;
    return this;
  }

  /**
   * Set the agent version
   */
  version(version: string): this {
    this.card.version = version;
    return this;
  }

  /**
   * Set the provider information
   */
  provider(provider: AgentProvider): this {
    this.card.provider = provider;
    return this;
  }

  /**
   * Set the documentation URL
   */
  documentationUrl(url: string): this {
    this.card.documentationUrl = url;
    return this;
  }

  /**
   * Set the capabilities
   */
  capabilities(capabilities: AgentCapabilities): this {
    this.card.capabilities = { ...this.card.capabilities, ...capabilities };
    return this;
  }

  /**
   * Enable streaming capability
   */
  withStreaming(enabled: boolean = true): this {
    this.card.capabilities!.streaming = enabled;
    return this;
  }

  /**
   * Enable push notifications capability
   */
  withPushNotifications(enabled: boolean = true): this {
    this.card.capabilities!.pushNotifications = enabled;
    return this;
  }

  /**
   * Enable state transition history capability
   */
  withStateTransitionHistory(enabled: boolean = true): this {
    this.card.capabilities!.stateTransitionHistory = enabled;
    return this;
  }

  /**
   * Enable extended agent card capability
   */
  withExtendedAgentCard(enabled: boolean = true): this {
    this.card.capabilities!.extendedAgentCard = enabled;
    return this;
  }

  /**
   * Add a security scheme
   */
  addSecurityScheme(name: string, scheme: SecurityScheme): this {
    if (!this.card.securitySchemes) {
      this.card.securitySchemes = {};
    }
    this.card.securitySchemes[name] = scheme;
    return this;
  }

  /**
   * Add API key authentication
   */
  withAPIKeyAuth(
    name: string = 'apiKey',
    options: { in?: 'header' | 'query'; name?: string; description?: string } = {}
  ): this {
    return this.addSecurityScheme(name, {
      type: 'apiKey',
      in: options.in || 'header',
      name: options.name || 'X-API-Key',
      description: options.description || 'API key authentication',
    });
  }

  /**
   * Add Bearer token authentication
   */
  withBearerAuth(name: string = 'bearer', description?: string): this {
    return this.addSecurityScheme(name, {
      type: 'http',
      scheme: 'bearer',
      description: description || 'Bearer token authentication',
    });
  }

  /**
   * Add OAuth2 authentication
   */
  withOAuth2(
    name: string = 'oauth2',
    options: {
      tokenEndpoint: string;
      authorizationEndpoint?: string;
      scopes?: Record<string, string>;
      description?: string;
    }
  ): this {
    const flows: SecurityScheme['flows'] = {};
    if (options.authorizationEndpoint) {
      flows.authorizationCode = {
        authorizationEndpoint: options.authorizationEndpoint,
        tokenEndpoint: options.tokenEndpoint,
        scopes: options.scopes,
      };
    } else {
      flows.clientCredentials = {
        tokenEndpoint: options.tokenEndpoint,
        scopes: options.scopes,
      };
    }
    return this.addSecurityScheme(name, {
      type: 'oauth2',
      flows,
      description: options.description || 'OAuth2 authentication',
    });
  }

  /**
   * Add security requirement
   */
  addSecurityRequirement(requirement: SecurityRequirement): this {
    if (!this.card.security) {
      this.card.security = [];
    }
    this.card.security.push(requirement);
    return this;
  }

  /**
   * Set default input modes
   */
  defaultInputModes(modes: string[]): this {
    this.card.defaultInputModes = modes;
    return this;
  }

  /**
   * Set default output modes
   */
  defaultOutputModes(modes: string[]): this {
    this.card.defaultOutputModes = modes;
    return this;
  }

  /**
   * Add a skill
   */
  addSkill(skill: AgentSkill): this {
    this.card.skills!.push(skill);
    return this;
  }

  /**
   * Add multiple skills
   */
  addSkills(...skills: AgentSkill[]): this {
    this.card.skills!.push(...skills);
    return this;
  }

  /**
   * Add a supported interface
   */
  addInterface(iface: AgentInterface): this {
    this.card.supportedInterfaces!.push(iface);
    return this;
  }

  /**
   * Set the icon URL
   */
  iconUrl(url: string): this {
    this.card.iconUrl = url;
    return this;
  }

  /**
   * Build and validate the Agent Card
   */
  build(): AgentCard {
    const result = AgentCardSchema.safeParse(this.card);
    if (!result.success) {
      throw new AgentCardValidationError(
        'Invalid Agent Card configuration',
        result.error.errors
      );
    }
    return result.data;
  }

  /**
   * Build and return the Agent Card as JSON string
   */
  buildJSON(space?: number): string {
    return JSON.stringify(this.build(), null, space);
  }
}

// ============================================================================
// Agent Card Validation Error
// ============================================================================

/**
 * Error thrown when Agent Card validation fails
 */
export class AgentCardValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: Array<{ path: (string | number)[]; message: string }>
  ) {
    super(message);
    this.name = 'AgentCardValidationError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors,
    };
  }
}

// ============================================================================
// Agent Card Utilities
// ============================================================================

/**
 * Create a new Agent Card builder
 */
export function createAgentCard(): AgentCardBuilder {
  return new AgentCardBuilder();
}

/**
 * Validate an Agent Card object
 */
export function validateAgentCard(card: unknown): { valid: boolean; errors?: Array<{ path: (string | number)[]; message: string }> } {
  const result = AgentCardSchema.safeParse(card);
  if (result.success) {
    return { valid: true };
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => ({
      path: e.path,
      message: e.message,
    })),
  };
}

/**
 * Parse and validate an Agent Card from JSON string
 */
export function parseAgentCard(json: string): AgentCard {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new AgentCardValidationError(
      'Invalid JSON: ' + (e as Error).message,
      []
    );
  }
  const result = AgentCardSchema.safeParse(parsed);
  if (!result.success) {
    throw new AgentCardValidationError(
      'Invalid Agent Card',
      result.error.errors
    );
  }
  return result.data;
}

/**
 * Create a minimal Agent Card with required fields
 */
export function createMinimalAgentCard(
  name: string,
  description: string,
  url: string,
  version: string,
  skills: AgentSkill[]
): AgentCard {
  return createAgentCard()
    .name(name)
    .description(description)
    .url(url)
    .version(version)
    .addSkills(...skills)
    .build();
}

// ============================================================================
// Skill Builder
// ============================================================================

/**
 * Builder class for constructing Agent Skills
 */
export class SkillBuilder {
  private skill: Partial<AgentSkill> = {};

  id(id: string): this {
    this.skill.id = id;
    return this;
  }

  name(name: string): this {
    this.skill.name = name;
    return this;
  }

  description(description: string): this {
    this.skill.description = description;
    return this;
  }

  tags(...tags: string[]): this {
    this.skill.tags = tags;
    return this;
  }

  examples(...examples: string[]): this {
    this.skill.examples = examples;
    return this;
  }

  inputModes(...modes: string[]): this {
    this.skill.inputModes = modes;
    return this;
  }

  outputModes(...modes: string[]): this {
    this.skill.outputModes = modes;
    return this;
  }

  build(): AgentSkill {
    if (!this.skill.id || !this.skill.name || !this.skill.description) {
      throw new Error('Skill must have id, name, and description');
    }
    return this.skill as AgentSkill;
  }
}

/**
 * Create a new skill builder
 */
export function createSkill(): SkillBuilder {
  return new SkillBuilder();
}

// ============================================================================
// Preset Agent Cards
// ============================================================================

/**
 * Create a basic agent card template
 */
export function createBasicAgentCard(
  name: string,
  description: string,
  baseUrl: string
): AgentCard {
  return createAgentCard()
    .name(name)
    .description(description)
    .url(`${baseUrl}/a2a`)
    .version('1.0.0')
    .withStreaming()
    .defaultInputModes(['text/plain', 'application/json'])
    .defaultOutputModes(['text/plain', 'application/json'])
    .addSkill(
      createSkill()
        .id('default')
        .name('Default Skill')
        .description('Default agent capability')
        .tags(['general'])
        .examples(['Hello', 'How can you help me?'])
        .build()
    )
    .addInterface({
      url: `${baseUrl}/a2a`,
      protocolBinding: 'JSONRPC',
      protocolVersion: '1.0',
    })
    .build();
}

/**
 * Create an agent card for a task-oriented agent
 */
export function createTaskAgentCard(
  name: string,
  description: string,
  baseUrl: string,
  taskSkills: AgentSkill[]
): AgentCard {
  return createAgentCard()
    .name(name)
    .description(description)
    .url(`${baseUrl}/a2a`)
    .version('1.0.0')
    .withStreaming()
    .withPushNotifications()
    .withStateTransitionHistory()
    .defaultInputModes(['text/plain', 'application/json'])
    .defaultOutputModes(['text/plain', 'application/json'])
    .addSkills(...taskSkills)
    .addInterface({
      url: `${baseUrl}/a2a`,
      protocolBinding: 'JSONRPC',
      protocolVersion: '1.0',
    })
    .build();
}
