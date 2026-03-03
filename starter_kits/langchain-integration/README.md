# LangChain Integration Template

Connect your LangChain agents to AgentLink for easy deployment and management.

## Features

- LangChain agent wrapper
- Tool integration
- Memory management
- Streaming responses
- Error handling
- Multi-model support

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/agentlink/templates/langchain-integration.git
cd langchain-integration
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Add your API keys:

```env
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
AGENTLINK_API_KEY=your_agentlink_key
```

### 3. Create Your Agent

Edit `src/agent.py`:

```python
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from langchain.tools import tool
from agentlink.langchain import AgentLinkWrapper

# Define your tools
@tool
def search_web(query: str) -> str:
    """Search the web for information"""
    # Your implementation
    pass

@tool
def calculate(expression: str) -> str:
    """Calculate mathematical expressions"""
    return str(eval(expression))

# Create LangChain agent
llm = ChatOpenAI(model="gpt-4")
tools = [search_web, calculate]

agent = create_openai_functions_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)

# Wrap for AgentLink
agentlink_agent = AgentLinkWrapper(agent_executor)
```

### 4. Deploy

```bash
agentlink deploy
```

## Configuration

Edit `agent.yaml`:

```yaml
name: langchain-agent
description: LangChain-powered agent with custom tools
version: 1.0.0

tools:
  - web_search
  - calculator
  - custom_api

config:
  # LLM Configuration
  model: gpt-4
  temperature: 0.7
  max_tokens: 2000
  
  # Agent Configuration
  max_iterations: 10
  early_stopping_method: generate
  
  # Memory
  memory_enabled: true
  memory_key: chat_history
  
  # Streaming
  streaming: true
  
  # Error Handling
  handle_parsing_errors: true
  
  # Rate Limiting
  rate_limit: 60/minute
```

## Usage

### Run Agent

```bash
curl -X POST https://api.agentlink.io/agents/{agent_id}/run \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "What\'s the weather in San Francisco?",
    "chat_history": []
  }'
```

### Response Format

```json
{
  "output": "The current weather in San Francisco is...",
  "intermediate_steps": [
    {
      "tool": "search_web",
      "input": "weather San Francisco",
      "output": "..."
    }
  ],
  "tokens_used": 245,
  "processing_time": 2.3
}
```

### Streaming Response

```bash
curl -X POST https://api.agentlink.io/agents/{agent_id}/run \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Tell me a story",
    "stream": true
  }'
```

## Advanced Configuration

### Custom Tools

```python
from langchain.tools import BaseTool
from pydantic import BaseModel, Field

class CustomInput(BaseModel):
    query: str = Field(description="Search query")
    limit: int = Field(default=5, description="Max results")

class CustomSearchTool(BaseTool):
    name = "custom_search"
    description = "Search custom database"
    args_schema = CustomInput
    
    def _run(self, query: str, limit: int = 5) -> str:
        # Your implementation
        results = search_database(query, limit)
        return format_results(results)
    
    async def _arun(self, query: str, limit: int = 5) -> str:
        # Async implementation
        pass
```

### Memory Management

```python
from langchain.memory import ConversationBufferMemory
from langchain.memory.chat_message_histories import RedisChatMessageHistory

# Redis-backed memory
message_history = RedisChatMessageHistory(
    session_id="session_123",
    url="redis://localhost:6379/0"
)

memory = ConversationBufferMemory(
    memory_key="chat_history",
    chat_memory=message_history,
    return_messages=True
)

agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    memory=memory
)
```

### Multi-Model Support

```python
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

# Configure multiple models
MODELS = {
    "gpt-4": ChatOpenAI(model="gpt-4"),
    "gpt-3.5": ChatOpenAI(model="gpt-3.5-turbo"),
    "claude": ChatAnthropic(model="claude-3-opus-20240229"),
}

def get_agent(model_name: str = "gpt-4"):
    llm = MODELS.get(model_name, MODELS["gpt-4"])
    return create_agent(llm, tools)
```

## Integration Patterns

### RAG Implementation

```python
from langchain.vectorstores import Chroma
from langchain.embeddings import OpenAIEmbeddings
from langchain.chains import RetrievalQA

# Create vector store
embeddings = OpenAIEmbeddings()
vectorstore = Chroma.from_documents(documents, embeddings)

# Create RAG chain
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=vectorstore.as_retriever()
)

# Wrap for AgentLink
agentlink_agent = AgentLinkWrapper(qa_chain)
```

### Agent with Planning

```python
from langchain.agents import load_tools
from langchain_experimental.plan_and_execute import PlanAndExecute, load_agent_executor, load_chat_planner

# Load tools
tools = load_tools(["serpapi", "llm-math"], llm=llm)

# Create planner and executor
planner = load_chat_planner(llm)
executor = load_agent_executor(llm, tools, verbose=True)

# Create plan-and-execute agent
agent = PlanAndExecute(planner=planner, executor=executor)
```

### Multi-Agent System

```python
from langchain.agents import initialize_agent, AgentType

# Create specialized agents
research_agent = initialize_agent(
    tools=[search_tool, scrape_tool],
    llm=llm,
    agent=AgentType.OPENAI_FUNCTIONS
)

writing_agent = initialize_agent(
    tools=[format_tool, grammar_tool],
    llm=llm,
    agent=AgentType.OPENAI_FUNCTIONS
)

# Orchestrate with supervisor
class SupervisorAgent:
    def run(self, task):
        # Research phase
        research = research_agent.run(f"Research: {task}")
        
        # Writing phase
        content = writing_agent.run(f"Write based on: {research}")
        
        return content
```

## API Reference

### Endpoints

- `POST /run` - Execute agent
- `POST /chat` - Chat with agent (with memory)
- `GET /status` - Agent status
- `POST /clear-memory` - Clear conversation memory

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| input | string | User input | required |
| chat_history | array | Previous messages | [] |
| model | string | Model to use | gpt-4 |
| temperature | float | Creativity (0-1) | 0.7 |
| stream | boolean | Stream response | false |
| session_id | string | Conversation ID | auto-generated |

## Testing

```python
# Test your agent
from src.agent import agentlink_agent

def test_agent():
    result = agentlink_agent.run({
        "input": "What is 25 * 47?"
    })
    assert "1175" in result["output"]

# Run tests
pytest tests/
```

## Deployment

### AgentLink Cloud

```bash
agentlink deploy --env production
```

### Environment-Specific Config

```yaml
# config/production.yaml
model: gpt-4
rate_limit: 120/minute

# config/staging.yaml
model: gpt-3.5-turbo
rate_limit: 30/minute
```

## Troubleshooting

### Tool Errors

- Verify tool implementations
- Check API keys and rate limits
- Review tool input/output formats

### Memory Issues

- Check memory backend connection
- Verify session ID consistency
- Review memory size limits

### Performance

- Enable response caching
- Use appropriate model for task
- Optimize tool implementations

## Contributing

See CONTRIBUTING.md

## License

MIT License

## Support

- Docs: https://docs.agentlink.io/templates/langchain
- Discord: https://discord.gg/agentlink
- LangChain Docs: https://python.langchain.com
