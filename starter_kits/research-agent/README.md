# Research Agent Template

A ready-to-deploy agent for web research and information gathering.

## Features

- Web search integration
- Content summarization
- Source citation
- Result caching
- Rate limiting

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/agentlink/templates/research-agent.git
cd research-agent
pip install -r requirements.txt
```

### 2. Configure

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
# Edit .env with your keys
```

### 3. Deploy

```bash
agentlink deploy
```

## Configuration

Edit `agent.yaml` to customize:

```yaml
name: research-agent
description: Web research and information gathering agent
version: 1.0.0

tools:
  - web_search
  - content_extractor
  - summarizer

config:
  max_results: 10
  cache_duration: 3600
  rate_limit: 100/hour
```

## Usage

### Query the Agent

```bash
curl -X POST https://api.agentlink.io/agents/{agent_id}/run \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Latest developments in AI agents 2025"
  }'
```

### Response Format

```json
{
  "query": "Latest developments in AI agents 2025",
  "results": [
    {
      "title": "...",
      "url": "...",
      "summary": "...",
      "sources": ["..."]
    }
  ],
  "citations": ["..."],
  "processed_at": "2025-01-15T10:30:00Z"
}
```

## Customization

### Adding Custom Search Sources

Edit `src/search_providers.py`:

```python
class CustomSearchProvider:
    def search(self, query: str) -> List[Result]:
        # Your implementation
        pass
```

### Modifying Summarization

Edit `src/summarizer.py` to customize how content is summarized.

### Adding Filters

Edit `src/filters.py` to add content filtering logic.

## API Reference

### Endpoints

- `POST /run` - Execute research query
- `GET /status` - Check agent status
- `GET /cache/clear` - Clear result cache

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| query | string | Research query | required |
| max_results | integer | Max results to return | 10 |
| include_sources | boolean | Include source URLs | true |
| summarize | boolean | Summarize content | true |

## Examples

### Market Research

```python
response = agent.run({
    "query": "AI agent market size 2025",
    "max_results": 5,
    "include_sources": true
})
```

### Academic Research

```python
response = agent.run({
    "query": "multi-agent systems survey paper",
    "max_results": 10,
    "summarize": true
})
```

### Competitive Analysis

```python
response = agent.run({
    "query": "competitor product features comparison",
    "max_results": 20,
    "include_sources": true
})
```

## Testing

```bash
pytest tests/
```

## Deployment

### AgentLink Cloud

```bash
agentlink deploy --env production
```

### Self-Hosted

```bash
docker build -t research-agent .
docker run -p 8000:8000 research-agent
```

## Troubleshooting

### Rate Limiting

If you hit rate limits:
- Check your plan limits
- Implement request queuing
- Use caching more aggressively

### Search Quality

To improve results:
- Refine query patterns
- Add domain filters
- Use advanced search operators

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - See LICENSE file

## Support

- Documentation: https://docs.agentlink.io
- Community: https://discord.gg/agentlink
- Issues: https://github.com/agentlink/templates/issues
