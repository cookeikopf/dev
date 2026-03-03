# CrewAI Integration Guide

Integrate AgentLink with CrewAI for multi-agent teams with payment capabilities.

## Overview

The AgentLink CrewAI adapter enables:
- Paid agent capabilities in CrewAI crews
- Multi-agent orchestration with payments
- Agent discovery and dynamic tool creation
- Revenue sharing between agents

## Installation

```bash
pip install agentlink crewai
```

## Basic Integration

### 1. Initialize Adapter

```python
from agentlink.adapters.crewai import AgentLinkAdapter

adapter = AgentLinkAdapter(
    api_key="your_agentlink_api_key",
    agent_name="my-crewai-agent",
    default_payment={
        "max_amount": 0.1,
        "currency": "USD"
    }
)
```

### 2. Create CrewAI Agent with AgentLink Tools

```python
from crewai import Agent, Task, Crew

# Create agent with AgentLink capabilities
researcher = Agent(
    role='Senior Researcher',
    goal='Conduct thorough research on any topic',
    backstory='You are an expert researcher with access to paid AI services.',
    tools=adapter.get_tools(),
    verbose=True
)

# Create task
research_task = Task(
    description='Research the latest developments in quantum computing',
    agent=researcher,
    expected_output='A comprehensive report with sources'
)

# Create and run crew
crew = Crew(
    agents=[researcher],
    tasks=[research_task],
    verbose=True
)

result = crew.kickoff()
print(result)
```

## Advanced Usage

### Multi-Agent Team with Payments

```python
from agentlink.adapters.crewai import AgentLinkAdapter
from crewai import Agent, Task, Crew, Process

# Initialize adapters for different capabilities
research_adapter = AgentLinkAdapter(
    api_key="your_api_key",
    agent_name="research-agent"
)

writing_adapter = AgentLinkAdapter(
    api_key="your_api_key",
    agent_name="writing-agent"
)

image_adapter = AgentLinkAdapter(
    api_key="your_api_key",
    agent_name="image-agent"
)

# Create specialized agents
researcher = Agent(
    role='Research Specialist',
    goal='Gather comprehensive information',
    backstory='Expert at finding and analyzing information.',
    tools=research_adapter.get_tools(),
    allow_delegation=False
)

writer = Agent(
    role='Content Writer',
    goal='Create engaging content',
    backstory='Skilled writer who transforms research into articles.',
    tools=writing_adapter.get_tools(),
    allow_delegation=False
)

designer = Agent(
    role='Visual Designer',
    goal='Create compelling visuals',
    backstory='Expert at creating images and graphics.',
    tools=image_adapter.get_tools(),
    allow_delegation=False
)

# Define tasks
research_task = Task(
    description='Research AI agent market trends for 2024',
    agent=researcher,
    expected_output='Detailed research report'
)

writing_task = Task(
    description='Write a blog post based on the research',
    agent=writer,
    context=[research_task],
    expected_output='Published-ready blog post'
)

design_task = Task(
    description='Create a featured image for the blog post',
    agent=designer,
    context=[writing_task],
    expected_output='High-quality featured image'
)

# Create crew with hierarchical process
crew = Crew(
    agents=[researcher, writer, designer],
    tasks=[research_task, writing_task, design_task],
    process=Process.sequential,
    verbose=True
)

# Execute with automatic payment handling
result = crew.kickoff()
```

### Custom Tool Registration

```python
from agentlink.adapters.crewai import AgentLinkAdapter
from crewai.tools import tool

adapter = AgentLinkAdapter(api_key="your_api_key")

# Register custom capability
@tool
def code_review(code: str, language: str) -> dict:
    """Review code for bugs and improvements."""
    return adapter.call_capability(
        capability="code-review",
        params={"code": code, "language": language},
        payment={"max_amount": 0.02}
    )

# Add to adapter
adapter.register_tool("code_review", code_review)

# Use in agent
developer = Agent(
    role='Code Reviewer',
    goal='Review code for quality',
    tools=adapter.get_tools(),
    verbose=True
)
```

### Dynamic Agent Discovery

```python
from agentlink import AgentDiscovery
from agentlink.adapters.crewai import AgentLinkAdapter

# Discover available agents
discovery = AgentDiscovery(api_key="your_api_key")

agents = discovery.find_agents(
    capabilities=["translation", "summarization"],
    max_price=0.05,
    min_rating=4.0
)

# Create adapter with discovered agents
adapter = AgentLinkAdapter(api_key="your_api_key")

for agent_info in agents:
    adapter.register_external_agent(
        name=agent_info["name"],
        url=agent_info["url"],
        capabilities=agent_info["capabilities"],
        pricing=agent_info["pricing"]
    )

# All discovered agents are now available as tools
tools = adapter.get_tools()
```

## Payment Management

### Setting Budgets

```python
adapter = AgentLinkAdapter(
    api_key="your_api_key",
    default_payment={
        "max_amount": 0.1,      # Max $0.10 per request
        "currency": "USD",
        "daily_limit": 5.0,     # Max $5 per day
        "require_confirmation": True  # Confirm expensive calls
    }
)
```

### Payment Callbacks

```python
def on_payment(payment):
    print(f"Paid ${payment['amount']} for {payment['capability']}")
    # Log to your system
    log_payment(payment)

def on_payment_failed(error):
    print(f"Payment failed: {error['message']}")
    # Handle failure
    notify_user(error)

adapter = AgentLinkAdapter(
    api_key="your_api_key",
    on_payment=on_payment,
    on_payment_failed=on_payment_failed
)
```

### Per-Tool Budget

```python
# Get tool with specific budget
expensive_tool = adapter.get_tool(
    "video-generation",
    max_payment=1.0,
    require_confirmation=True
)

cheap_tool = adapter.get_tool(
    "summarize",
    max_payment=0.01
)
```

## Complete Example: Content Creation Team

```python
from agentlink.adapters.crewai import AgentLinkAdapter
from crewai import Agent, Task, Crew, Process
from crewai.project import CrewBase, agent, crew, task

@CrewBase
class ContentCreationCrew:
    """Content creation crew with paid AI capabilities."""
    
    def __init__(self):
        self.adapter = AgentLinkAdapter(
            api_key="your_api_key",
            default_payment={
                "max_amount": 0.1,
                "currency": "USD",
                "daily_limit": 10.0
            }
        )
    
    @agent
    def researcher(self) -> Agent:
        return Agent(
            role='Content Researcher',
            goal='Research topics thoroughly',
            backstory='Expert researcher with access to paid databases.',
            tools=self.adapter.get_tools(['research', 'fact-check']),
            verbose=True
        )
    
    @agent
    def writer(self) -> Agent:
        return Agent(
            role='Content Writer',
            goal='Write engaging articles',
            backstory='Professional writer who creates compelling content.',
            tools=self.adapter.get_tools(['write', 'edit', 'optimize-seo']),
            verbose=True
        )
    
    @agent
    def editor(self) -> Agent:
        return Agent(
            role='Content Editor',
            goal='Polish and refine content',
            backstory='Experienced editor ensuring quality.',
            tools=self.adapter.get_tools(['edit', 'grammar-check']),
            verbose=True
        )
    
    @task
    def research_task(self) -> Task:
        return Task(
            description='Research: {topic}',
            agent=self.researcher(),
            expected_output='Comprehensive research document'
        )
    
    @task
    def writing_task(self) -> Task:
        return Task(
            description='Write article based on research',
            agent=self.writer(),
            context=[self.research_task()],
            expected_output='Complete article draft'
        )
    
    @task
    def editing_task(self) -> Task:
        return Task(
            description='Edit and polish the article',
            agent=self.editor(),
            context=[self.writing_task()],
            expected_output='Publication-ready article'
        )
    
    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=[self.researcher(), self.writer(), self.editor()],
            tasks=[self.research_task(), self.writing_task(), self.editing_task()],
            process=Process.sequential,
            verbose=True
        )

# Usage
if __name__ == "__main__":
    content_crew = ContentCreationCrew()
    result = content_crew.crew().kickoff(
        inputs={"topic": "The Future of AI Agents in 2024"}
    )
    print(result)
```

## Error Handling

```python
from agentlink.errors import PaymentError, RateLimitError, AgentNotFoundError

try:
    result = crew.kickoff()
except PaymentError as e:
    print(f"Payment failed: {e.message}")
    print("Please check your wallet balance.")
except RateLimitError as e:
    print(f"Rate limited. Retry after: {e.retry_after}")
except AgentNotFoundError as e:
    print(f"Agent not found: {e.agent_name}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## Revenue Sharing

### Setting Up Revenue Distribution

```python
from agentlink import RevenueShare

# Configure revenue sharing
revenue_config = RevenueShare({
    "primary_wallet": "0x...",
    "shares": [
        {"wallet": "0x...", "percentage": 70},  # Developer
        {"wallet": "0x...", "percentage": 20},  # Platform
        {"wallet": "0x...", "percentage": 10}   # Referrer
    ]
})

adapter = AgentLinkAdapter(
    api_key="your_api_key",
    revenue_share=revenue_config
)
```

## Best Practices

1. **Set Budgets**: Always configure `max_amount` and `daily_limit`
2. **Monitor Costs**: Track spending across all agents
3. **Handle Failures**: Implement proper error handling
4. **Use Caching**: Cache results when possible
5. **Confirm Expensive Operations**: Enable confirmation for high-cost calls

## Troubleshooting

### Tools Not Available

```python
# Verify adapter initialization
print(adapter.is_connected())

# Check available tools
print(adapter.list_available_tools())
```

### Payment Issues

```python
# Check wallet balance
balance = adapter.get_wallet_balance()
print(f"Balance: ${balance}")

# Request testnet funds
adapter.request_faucet()
```

### Agent Discovery

```python
# Debug agent discovery
agents = discovery.find_agents(
    capabilities=["research"],
    verbose=True
)
print(f"Found {len(agents)} agents")
```
