/**
 * AgentLink Core - Agent Implementation
 */

import type {
  Agent,
  AgentConfig,
  AgentCard,
  Capability,
  CapabilityContext,
  CapabilityInfo,
  RequestContext,
  TelemetryEmitter,
} from './types/index.js';
import { createTelemetryEmitter } from './telemetry.js';
import { generateId } from './utils/index.js';

export function createAgent(config: AgentConfig): Agent {
  // Validate required fields
  if (!config.name) {
    throw new Error('Agent name is required');
  }
  
  if (!config.identity) {
    throw new Error('Agent identity is required');
  }
  
  if (!isValidIdentityReference(config.identity)) {
    throw new Error(`Invalid identity reference: ${config.identity}`);
  }

  // Build capabilities map
  const capabilities = new Map<string, Capability>();
  for (const capability of config.capabilities) {
    if (capabilities.has(capability.id)) {
      throw new Error(`Duplicate capability ID: ${capability.id}`);
    }
    capabilities.set(capability.id, capability);
  }

  // Create telemetry emitter
  const telemetry = createTelemetryEmitter(config.telemetry);

  const agent: Agent = {
    name: config.name,
    identity: config.identity,
    description: config.description || '',
    capabilities,
    version: config.version || '1.0.0',
    url: config.url,
    documentationUrl: config.documentationUrl,
    provider: config.provider,
    x402: config.x402,
    telemetry,

    async executeCapability(
      id: string,
      input: unknown,
      context?: Partial<CapabilityContext>
    ): Promise<unknown> {
      const capability = capabilities.get(id);
      if (!capability) {
        throw new Error(`Capability not found: ${id}`);
      }

      const requestId = generateId();
      const startTime = Date.now();
      
      const fullContext: CapabilityContext = {
        agent: this,
        request: context?.request || createDefaultRequestContext(requestId),
        payment: context?.payment,
        telemetry,
      };

      // Emit invoke event
      telemetry.emit('capability:invoke:start', {
        capabilityId: id,
        requestId,
        input,
        timestamp: new Date(),
      });

      try {
        const result = await capability.handler(input, fullContext);
        const duration = Date.now() - startTime;

        // Emit success event
        telemetry.emit('capability:invoke:success', {
          capabilityId: id,
          requestId,
          duration,
          timestamp: new Date(),
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Emit error event
        telemetry.emit('capability:invoke:error', {
          capabilityId: id,
          requestId,
          duration,
          error: errorMessage,
          timestamp: new Date(),
        });

        throw error;
      }
    },

    getCapability(id: string): Capability | undefined {
      return capabilities.get(id);
    },

    listCapabilities(): CapabilityInfo[] {
      return Array.from(capabilities.values()).map(cap => ({
        id: cap.id,
        name: cap.name,
        description: cap.description,
        pricing: cap.pricing,
        input: cap.input,
        output: cap.output,
        tags: cap.tags,
        examples: cap.examples,
      }));
    },

    getAgentCard(): AgentCard {
      return {
        schema_version: '1.0',
        name: this.name,
        description: this.description,
        url: this.url || '',
        version: this.version,
        capabilities: {
          streaming: config.a2a?.streaming ?? false,
          pushNotifications: config.a2a?.pushNotifications ?? false,
          stateTransitionHistory: config.a2a?.stateTransitionHistory ?? false,
        },
        skills: Array.from(capabilities.values()).map(cap => ({
          id: cap.id,
          name: cap.name,
          description: cap.description,
          tags: cap.tags,
          examples: cap.examples?.map(e => e.name),
          input: cap.input,
          output: cap.output,
          pricing: cap.pricing,
        })),
        provider: this.provider,
        documentationUrl: this.documentationUrl,
      };
    },
  };

  return agent;
}

function createDefaultRequestContext(requestId: string): RequestContext {
  return {
    id: requestId,
    headers: {},
    timestamp: new Date(),
  };
}

function isValidIdentityReference(identity: string): boolean {
  const pattern = /^eip155:\d+\/0x[a-fA-F0-9]{40}$/;
  return pattern.test(identity);
}
