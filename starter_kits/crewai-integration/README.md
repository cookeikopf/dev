# CrewAI Integration Template

Deploy multi-agent crews with AgentLink. Coordinate specialized agents to work together on complex tasks.

## Features

- Crew configuration
- Agent role definition
- Task orchestration
- Inter-agent communication
- Result aggregation
- Hierarchical planning

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/agentlink/templates/crewai-integration.git
cd crewai-integration
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
AGENTLINK_API_KEY=your_agentlink_key
```

### 3. Define Your Crew

Edit `src/crew.py`:

```python
from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool, WebsiteSearchTool
from agentlink.crewai import CrewLinkWrapper

# Define tools
search_tool = SerperDevTool()
web_tool = WebsiteSearchTool()

# Create specialized agents
researcher = Agent(
    role='Research Analyst',
    goal='Gather comprehensive information on topics',
    backstory='Expert researcher with years of experience',
    tools=[search_tool, web_tool],
    verbose=True
)

writer = Agent(
    role='Content Writer',
    goal='Create engaging content from research',
    backstory='Professional writer specializing in tech content',
    verbose=True
)

editor = Agent(
    role='Editor',
    goal='Polish and refine content',
    backstory='Senior editor with attention to detail',
    verbose=True
)

# Define tasks
research_task = Task(
    description='Research: {topic}',
    agent=researcher,
    expected_output='Comprehensive research report'
)

writing_task = Task(
    description='Write article based on research',
    agent=writer,
    context=[research_task],
    expected_output='Well-written article'
)

editing_task = Task(
    description='Edit and polish the article',
    agent=editor,
    context=[writing_task],
    expected_output='Publication-ready article'
)

# Create crew
crew = Crew(
    agents=[researcher, writer, editor],
    tasks=[research_task, writing_task, editing_task],
    process=Process.sequential,
    verbose=True
)

# Wrap for AgentLink
agentlink_crew = CrewLinkWrapper(crew)
```

### 4. Deploy

```bash
agentlink deploy
```

## Configuration

Edit `agent.yaml`:

```yaml
name: content-crew
description: Multi-agent crew for content creation
version: 1.0.0

tools:
  - web_search
  - content_analysis
  - plagiarism_check

config:
  # Crew Configuration
  process: sequential  # sequential, hierarchical, parallel
  
  # Agent Configuration
  model: gpt-4
  temperature: 0.7
  max_iterations: 15
  
  # Task Configuration
  context_window: true
  allow_delegation: true
  
  # Output
  output_format: markdown
  save_intermediate: true
  
  # Rate Limiting
  rate_limit: 30/minute
```

## Usage

### Run Crew

```bash
curl -X POST https://api.agentlink.io/agents/{agent_id}/run \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "The Future of AI Agents in 2025",
    "tone": "professional",
    "length": "medium"
  }'
```

### Response Format

```json
{
  "result": "# The Future of AI Agents in 2025\n\n...",
  "crew_output": {
    "research": "...",
    "writing": "...",
    "editing": "..."
  },
  "agents_used": ["researcher", "writer", "editor"],
  "tasks_completed": 3,
  "processing_time": 45.2,
  "tokens_used": 3456
}
```

## Advanced Configuration

### Hierarchical Crew

```python
from crewai import Agent, Task, Crew, Process

# Manager agent
manager = Agent(
    role='Project Manager',
    goal='Coordinate team and ensure quality delivery',
    backstory='Experienced manager who excels at delegation',
    allow_delegation=True
)

# Create hierarchical crew
crew = Crew(
    agents=[manager, researcher, writer, editor],
    tasks=[research_task, writing_task, editing_task],
    process=Process.hierarchical,
    manager_agent=manager,
    verbose=True
)
```

### Parallel Execution

```python
# Tasks that can run in parallel
parallel_tasks = [
    Task(description='Research topic A', agent=researcher),
    Task(description='Research topic B', agent=researcher),
    Task(description='Research topic C', agent=researcher),
]

# Aggregation task
aggregate_task = Task(
    description='Synthesize all research',
    agent=writer,
    context=parallel_tasks
)

crew = Crew(
    agents=[researcher, writer],
    tasks=parallel_tasks + [aggregate_task],
    process=Process.parallel,
    verbose=True
)
```

### Custom Tools

```python
from crewai_tools import BaseTool

class DatabaseTool(BaseTool):
    name: str = "Database Query"
    description: str = "Query internal database"
    
    def _run(self, query: str) -> str:
        # Your implementation
        return execute_query(query)

# Add to agent
analyst = Agent(
    role='Data Analyst',
    goal='Analyze data and generate insights',
    tools=[DatabaseTool()],
    verbose=True
)
```

## Crew Patterns

### Research Team

```python
# Specialized research crew
research_lead = Agent(role='Research Lead', ...)
web_researcher = Agent(role='Web Researcher', tools=[search_tool], ...)
domain_expert = Agent(role='Domain Expert', ...)
report_writer = Agent(role='Report Writer', ...)

research_crew = Crew(
    agents=[research_lead, web_researcher, domain_expert, report_writer],
    tasks=[
        Task(description='Define research scope', agent=research_lead),
        Task(description='Gather web sources', agent=web_researcher),
        Task(description='Provide expert analysis', agent=domain_expert),
        Task(description='Write research report', agent=report_writer),
    ],
    process=Process.sequential
)
```

### Code Review Team

```python
# Code review crew
code_reviewer = Agent(
    role='Code Reviewer',
    goal='Review code for bugs and best practices',
    tools=[code_analysis_tool],
    ...
)

security_reviewer = Agent(
    role='Security Reviewer',
    goal='Identify security vulnerabilities',
    tools=[security_scan_tool],
    ...
)

performance_reviewer = Agent(
    role='Performance Reviewer',
    goal='Optimize code performance',
    tools=[profiling_tool],
    ...
)

review_crew = Crew(
    agents=[code_reviewer, security_reviewer, performance_reviewer],
    tasks=[
        Task(description='Review code quality', agent=code_reviewer),
        Task(description='Security audit', agent=security_reviewer),
        Task(description='Performance analysis', agent=performance_reviewer),
    ],
    process=Process.parallel
)
```

### Customer Support Team

```python
# Support crew
triage_agent = Agent(
    role='Support Triage',
    goal='Categorize and route support tickets',
    ...
)

technical_agent = Agent(
    role='Technical Support',
    goal='Resolve technical issues',
    tools=[knowledge_base_tool, diagnostic_tool],
    ...
)

billing_agent = Agent(
    role='Billing Support',
    goal='Handle billing inquiries',
    tools=[billing_system_tool],
    ...
)

support_crew = Crew(
    agents=[triage_agent, technical_agent, billing_agent],
    tasks=[
        Task(description='Ticket: {ticket}', agent=triage_agent),
        Task(description='Resolve technical issue', agent=technical_agent),
        Task(description='Handle billing if needed', agent=billing_agent),
    ],
    process=Process.hierarchical,
    manager_agent=triage_agent
)
```

## API Reference

### Endpoints

- `POST /run` - Execute crew
- `GET /status` - Crew status
- `GET /agents` - List crew agents
- `GET /tasks` - List crew tasks
- `POST /reset` - Reset crew state

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| topic | string | Main topic/task | required |
| context | object | Additional context | {} |
| process | string | Execution process | sequential |
| verbose | boolean | Detailed output | true |
| timeout | integer | Max execution time (seconds) | 300 |

## Testing

```python
# Test your crew
from src.crew import agentlink_crew

def test_crew():
    result = agentlink_crew.run({
        "topic": "Test topic",
        "tone": "casual"
    })
    assert "result" in result
    assert len(result["crew_output"]) > 0

# Run tests
pytest tests/
```

## Deployment

### AgentLink Cloud

```bash
agentlink deploy --env production
```

### Scaling

```yaml
# config/production.yaml
replicas: 3
resources:
  cpu: 2
  memory: 4Gi
rate_limit: 60/minute
```

## Troubleshooting

### Agent Coordination Issues

- Review task dependencies
- Check context passing
- Verify agent roles are clear

### Performance

- Reduce max_iterations
- Use faster models for simple tasks
- Enable result caching

### Output Quality

- Refine agent backstories
- Add more specific task descriptions
- Include expected_output examples

## Contributing

See CONTRIBUTING.md

## License

MIT License

## Support

- Docs: https://docs.agentlink.io/templates/crewai
- Discord: https://discord.gg/agentlink
- CrewAI Docs: https://docs.crewai.com
