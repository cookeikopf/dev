# Webhook Handler Template

A robust webhook processing agent with signature verification, routing, and retry logic.

## Features

- Webhook signature verification
- Event type routing
- Retry logic with exponential backoff
- Dead letter queue
- Event logging
- Rate limiting

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/agentlink/templates/webhook-handler.git
cd webhook-handler
pip install -r requirements.txt
```

### 2. Configure

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Add your webhook secrets:

```env
# GitHub webhook secret
GITHUB_WEBHOOK_SECRET=your_github_secret

# Stripe webhook secret
STRIPE_WEBHOOK_SECRET=your_stripe_secret

# Custom webhook secret
CUSTOM_WEBHOOK_SECRET=your_custom_secret
```

### 3. Define Event Handlers

Edit `src/handlers.py`:

```python
from agentlink import handler

@handler("github.push")
def handle_github_push(event):
    """Handle GitHub push events"""
    repo = event.payload["repository"]["name"]
    branch = event.payload["ref"].split("/")[-1]
    commits = event.payload["commits"]
    
    # Trigger CI/CD, notifications, etc.
    trigger_deployment(repo, branch, commits)
    
    return {"status": "processed", "commits": len(commits)}

@handler("stripe.payment_intent.succeeded")
def handle_payment_success(event):
    """Handle successful payments"""
    payment = event.payload["data"]["object"]
    
    # Update order status, send confirmation, etc.
    process_order(payment)
    
    return {"status": "processed", "payment_id": payment["id"]}
```

### 4. Deploy

```bash
agentlink deploy
```

## Configuration

Edit `agent.yaml`:

```yaml
name: webhook-handler
description: Webhook processing agent
version: 1.0.0

tools:
  - event_router
  - retry_manager
  - dead_letter_queue
  - event_logger

config:
  # Verification settings
  verify_signatures: true
  
  # Retry settings
  max_retries: 3
  retry_delays: [5, 25, 125]  # Exponential backoff in seconds
  
  # Rate limiting
  rate_limit: 100/minute
  
  # Dead letter queue
  dlq_enabled: true
  dlq_retention: 7d
  
  # Logging
  log_level: info
  log_payloads: false  # Don't log sensitive data
```

## Usage

### Webhook Endpoint

Your deployed agent provides a webhook endpoint:

```
https://api.agentlink.io/agents/{agent_id}/webhook
```

### Configure Source Service

**GitHub Example**:
1. Go to Repository Settings > Webhooks
2. Add webhook URL: `https://api.agentlink.io/agents/{agent_id}/webhook`
3. Set content type: `application/json`
4. Add secret: Your `GITHUB_WEBHOOK_SECRET`
5. Select events to receive

**Stripe Example**:
1. Go to Developers > Webhooks
2. Add endpoint: `https://api.agentlink.io/agents/{agent_id}/webhook`
3. Select events to listen for
4. Copy signing secret to env

### Testing Webhooks

```bash
# Test with curl
curl -X POST https://api.agentlink.io/agents/{agent_id}/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256={signature}" \
  -d '{
    "ref": "refs/heads/main",
    "repository": {"name": "my-repo"},
    "commits": [{"id": "abc123", "message": "Test commit"}]
  }'
```

## Event Routing

### Route Configuration

Edit `src/routes.py`:

```python
ROUTES = {
    # GitHub events
    "github.push": "handlers.handle_github_push",
    "github.pull_request": "handlers.handle_pull_request",
    "github.issues": "handlers.handle_issue",
    
    # Stripe events
    "stripe.payment_intent.succeeded": "handlers.handle_payment_success",
    "stripe.payment_intent.failed": "handlers.handle_payment_failure",
    "stripe.invoice.paid": "handlers.handle_invoice_paid",
    
    # Custom events
    "custom.user_action": "handlers.handle_user_action",
    "custom.data_update": "handlers.handle_data_update",
}
```

### Dynamic Routing

```python
@handler("*")  # Catch-all handler
def handle_unknown(event):
    """Handle unconfigured event types"""
    logger.warning(f"Unhandled event type: {event.type}")
    
    # Option 1: Send to DLQ
    dead_letter_queue.send(event)
    
    # Option 2: Forward to default handler
    return default_handler.process(event)
```

## Security

### Signature Verification

```python
from agentlink.webhooks import verify_signature

def verify_github_signature(payload, signature, secret):
    """Verify GitHub webhook signature"""
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(
        f"sha256={expected}",
        signature
    )
```

### IP Allowlisting

```python
ALLOWED_IPS = {
    "github": ["140.82.112.0/20", "143.55.64.0/20"],
    "stripe": ["3.18.0.0/16", "3.130.0.0/16"],
}

def verify_ip(source, client_ip):
    """Verify request comes from allowed IP range"""
    allowed = ALLOWED_IPS.get(source, [])
    return any(
        ipaddress.ip_address(client_ip) in ipaddress.ip_network(ip_range)
        for ip_range in allowed
    )
```

## Retry Logic

### Exponential Backoff

```python
@retry(
    max_attempts=3,
    backoff_factor=2,
    exceptions=(TransientError,)
)
def process_event(event):
    """Process event with automatic retry"""
    result = handler.process(event)
    
    if result.needs_retry:
        raise TransientError("Processing failed, will retry")
    
    return result
```

### Dead Letter Queue

```python
@handler("github.push")
def handle_github_push(event):
    try:
        return process_push(event)
    except PermanentError as e:
        # Send to DLQ, don't retry
        dead_letter_queue.send(event, reason=str(e))
        return {"status": "failed", "sent_to_dlq": True}
```

## Monitoring

### Event Metrics

```python
# Track event processing
events_processed = Counter("webhook_events_total", ["event_type", "status"])
processing_duration = Histogram("webhook_processing_seconds", ["event_type"])

@handler("github.push")
def handle_github_push(event):
    with processing_duration.labels("github.push").time():
        try:
            result = process_push(event)
            events_processed.labels("github.push", "success").inc()
            return result
        except Exception as e:
            events_processed.labels("github.push", "failure").inc()
            raise
```

### Health Checks

```python
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "queue_depth": dead_letter_queue.size(),
        "recent_events": event_logger.recent_count(minutes=5)
    }
```

## API Reference

### Endpoints

- `POST /webhook` - Receive webhooks
- `GET /health` - Health check
- `GET /events` - Event log (with filters)
- `GET /dlq` - Dead letter queue
- `POST /dlq/retry` - Retry DLQ items

### Response Format

```json
{
  "status": "processed",
  "event_id": "evt_123",
  "handler": "github.push",
  "duration_ms": 150,
  "result": {...}
}
```

## Testing

```bash
# Run tests
pytest tests/

# Test specific handler
pytest tests/test_github_handler.py

# Load test
locust -f load_test.py
```

## Deployment

### AgentLink Cloud

```bash
agentlink deploy --env production
```

### Docker

```bash
docker build -t webhook-handler .
docker run -p 8000:8000 \
  -e GITHUB_WEBHOOK_SECRET=$GITHUB_SECRET \
  webhook-handler
```

## Troubleshooting

### Webhooks Not Received

- Verify endpoint URL is correct
- Check firewall/network settings
- Review service webhook logs
- Verify signature configuration

### Processing Failures

- Check handler logs
- Review DLQ for failed events
- Verify handler implementation
- Check rate limiting

## Contributing

See CONTRIBUTING.md

## License

MIT License

## Support

- Docs: https://docs.agentlink.io/templates/webhook-handler
- Discord: https://discord.gg/agentlink
