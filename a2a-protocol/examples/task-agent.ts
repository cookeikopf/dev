/**
 * A2A Protocol - Task Agent Example
 * 
 * This example demonstrates a more advanced A2A agent with:
 * - Task lifecycle management
 * - Async processing
 * - SSE streaming updates
 * - Artifacts
 */

import {
  createA2AServer,
  createAgentCard,
  createSkill,
  createTaskStatusUpdate,
  createTaskArtifactUpdate,
  isTerminalState,
  type Task,
  type Message,
  type TaskHandler,
  type TaskStore,
} from '../src/index.js';

// ============================================================================
// Step 1: Create the Agent Card
// ============================================================================

const agentCard = createAgentCard()
  .name('Task Processor Agent')
  .description('An agent that processes tasks with status updates and artifacts')
  .url('http://localhost:3001/a2a')
  .version('1.0.0')
  .withStreaming()
  .withPushNotifications()
  .withStateTransitionHistory()
  .defaultInputModes(['text/plain', 'application/json'])
  .defaultOutputModes(['text/plain', 'application/json'])
  .addSkill(
    createSkill()
      .id('process')
      .name('Process Task')
      .description('Processes a task and provides updates')
      .tags(['processing', 'async'])
      .examples(['Process this data', 'Analyze the following'])
      .inputModes(['text/plain', 'application/json'])
      .outputModes(['text/plain', 'application/json'])
      .build()
  )
  .addSkill(
    createSkill()
      .id('generate')
      .name('Generate Report')
      .description('Generates a report artifact')
      .tags(['report', 'artifact'])
      .examples(['Generate a summary report'])
      .inputModes(['text/plain'])
      .outputModes(['application/json'])
      .build()
  )
  .build();

// ============================================================================
// Step 2: Create a Custom Task Handler with Async Processing
// ============================================================================

class TaskProcessor implements TaskHandler {
  private server: ReturnType<typeof createA2AServer>;

  setServer(server: ReturnType<typeof createA2AServer>) {
    this.server = server;
  }

  async processMessage(
    message: Message,
    options: {
      taskId?: string;
      contextId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ task?: Task; message?: Message }> {
    const text = message.parts[0]?.type === 'text' 
      ? message.parts[0].text 
      : 'Process this';

    // If continuing an existing task, just return it
    if (options.taskId) {
      const existingTask = await this.server.getTask(options.taskId);
      if (existingTask) {
        return { task: existingTask };
      }
    }

    // Create a new task
    const task = await this.server.createTask(message, {
      contextId: options.contextId,
      sessionId: options.sessionId,
      metadata: options.metadata,
    });

    // Start async processing
    this.processTaskAsync(task.id, text);

    return { task };
  }

  private async processTaskAsync(taskId: string, input: string): Promise<void> {
    try {
      // Step 1: Transition to working state
      await this.server.transitionTask(taskId, 'working', {
        message: 'Starting processing...',
      });

      // Simulate processing steps
      await this.delay(1000);
      
      // Step 2: Add intermediate update
      await this.server.transitionTask(taskId, 'working', {
        message: 'Analyzing input...',
      });

      await this.delay(1000);

      // Step 3: Create an artifact
      const analysisResult = this.analyzeInput(input);
      await this.server.addArtifact(taskId, {
        artifactId: `analysis-${Date.now()}`,
        name: 'Analysis Result',
        description: 'Initial analysis of the input',
        parts: [
          { type: 'data', data: analysisResult },
        ],
        timestamp: new Date().toISOString(),
      });

      await this.delay(1000);

      // Step 4: Generate final report
      const report = this.generateReport(input, analysisResult);
      await this.server.addArtifact(taskId, {
        artifactId: `report-${Date.now()}`,
        name: 'Final Report',
        description: 'Complete processing report',
        parts: [
          { type: 'data', data: report },
        ],
        timestamp: new Date().toISOString(),
      });

      // Step 5: Complete the task
      await this.server.transitionTask(taskId, 'completed', {
        message: 'Processing complete! Check the artifacts for results.',
      });

    } catch (error) {
      console.error('Task processing error:', error);
      await this.server.transitionTask(taskId, 'failed', {
        message: `Processing failed: ${(error as Error).message}`,
      });
    }
  }

  private analyzeInput(input: string): Record<string, unknown> {
    return {
      inputLength: input.length,
      wordCount: input.split(/\s+/).length,
      characterCount: input.length,
      timestamp: new Date().toISOString(),
    };
  }

  private generateReport(
    input: string,
    analysis: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      summary: `Processed input: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`,
      analysis,
      recommendations: [
        'Input was successfully analyzed',
        'No issues detected',
        'Processing completed successfully',
      ],
      completedAt: new Date().toISOString(),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async cancelTask(taskId: string): Promise<Task> {
    console.log(`Canceling task: ${taskId}`);
    const task = await this.server.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Perform cleanup if needed
    console.log(`Cleanup for task: ${taskId}`);

    return this.server.cancelTask(taskId);
  }
}

// ============================================================================
// Step 3: Create the A2A Server
// ============================================================================

const taskProcessor = new TaskProcessor();

const server = createA2AServer({
  agentCard,
  taskHandler: taskProcessor,
  debug: true,
});

taskProcessor.setServer(server);

// ============================================================================
// Step 4: Create HTTP Server
// ============================================================================

import http from 'http';

const httpServer = http.createServer(async (req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    const handler = server.getHandler();

    await handler(
      {
        method: req.method || 'GET',
        url: req.url || '/',
        headers: req.headers as Record<string, string>,
        body,
      },
      {
        status: (code: number) => {
          res.statusCode = code;
          return {
            json: (data: unknown) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            send: (data: string) => {
              res.end(data);
            },
          };
        },
        setHeader: (name: string, value: string) => {
          res.setHeader(name, value);
        },
        write: (data: string) => {
          res.write(data);
        },
        end: () => {
          res.end();
        },
      }
    );
  });
});

// ============================================================================
// Step 5: Start the Server
// ============================================================================

const PORT = 3001;

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Task Processor Agent running on http://localhost:${PORT}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`  - Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
  console.log(`  - JSON-RPC:   http://localhost:${PORT}/a2a`);
  console.log(`  - Health:     http://localhost:${PORT}/health`);
  console.log(`\n📝 Example workflow:`);
  console.log(`  # 1. Get Agent Card`);
  console.log(`  curl http://localhost:${PORT}/.well-known/agent.json | jq`);
  console.log(`\n  # 2. Create a task`);
  console.log(`  curl -X POST http://localhost:${PORT}/a2a \\\n    -H "Content-Type: application/json" \\\n    -d '{"jsonrpc":"2.0","id":1,"method":"SendMessage","params":{"message":{"messageId":"msg-1","role":"user","parts":[{"type":"text","text":"Analyze this sample data for processing"}]}}}' | jq`);
  console.log(`\n  # 3. Get task status (replace TASK_ID with actual ID)`);
  console.log(`  curl -X POST http://localhost:${PORT}/a2a \\\n    -H "Content-Type: application/json" \\\n    -d '{"jsonrpc":"2.0","id":2,"method":"GetTask","params":{"id":"TASK_ID"}}' | jq`);
  console.log(`\n  # 4. Stream task updates (replace TASK_ID with actual ID)`);
  console.log(`  curl -N http://localhost:${PORT}/a2a/stream/TASK_ID`);
  console.log(`\n  # 5. List all tasks`);
  console.log(`  curl -X POST http://localhost:${PORT}/a2a \\\n    -H "Content-Type: application/json" \\\n    -d '{"jsonrpc":"2.0","id":3,"method":"ListTasks"}' | jq`);
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
