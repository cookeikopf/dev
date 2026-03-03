/**
 * AgentLink Core - Capability Builder
 */

import type {
  Capability,
  CapabilityHandler,
  InputSchema,
  OutputSchema,
  CapabilityExample,
} from './types/index.js';

export class CapabilityBuilder {
  private _id: string = '';
  private _name: string = '';
  private _description: string = '';
  private _pricing?: number;
  private _input?: InputSchema;
  private _output?: OutputSchema;
  private _handler?: CapabilityHandler;
  private _tags: string[] = [];
  private _examples: CapabilityExample[] = [];

  id(value: string): this {
    this._id = value;
    return this;
  }

  name(value: string): this {
    this._name = value;
    return this;
  }

  description(value: string): this {
    this._description = value;
    return this;
  }

  pricing(value: number): this {
    if (value < 0) {
      throw new Error('Pricing cannot be negative');
    }
    this._pricing = value;
    return this;
  }

  input(schema: InputSchema): this {
    this._input = schema;
    return this;
  }

  output(schema: OutputSchema): this {
    this._output = schema;
    return this;
  }

  handler(fn: CapabilityHandler): this {
    this._handler = fn;
    return this;
  }

  tags(values: string[]): this {
    this._tags = [...values];
    return this;
  }

  example(name: string, input: unknown, output?: unknown): this {
    this._examples.push({ name, input, output });
    return this;
  }

  build(): Capability {
    // Validate required fields
    if (!this._id) {
      throw new Error('Capability ID is required');
    }
    
    if (!this._name) {
      throw new Error('Capability name is required');
    }
    
    if (!this._description) {
      throw new Error('Capability description is required');
    }
    
    if (!this._handler) {
      throw new Error('Capability handler is required');
    }

    // Validate ID format (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(this._id)) {
      throw new Error(`Invalid capability ID: ${this._id}. Use only alphanumeric characters, hyphens, and underscores.`);
    }

    return {
      id: this._id,
      name: this._name,
      description: this._description,
      pricing: this._pricing,
      input: this._input,
      output: this._output,
      handler: this._handler,
      tags: this._tags.length > 0 ? this._tags : undefined,
      examples: this._examples.length > 0 ? this._examples : undefined,
    };
  }
}

export function createCapability(): CapabilityBuilder {
  return new CapabilityBuilder();
}
