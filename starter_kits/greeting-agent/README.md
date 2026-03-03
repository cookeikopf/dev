# Greeting Agent Template

A personalized welcome and onboarding agent for applications.

## Features

- Personalized welcome messages
- User preference collection
- Onboarding flow guidance
- Multi-language support
- Context-aware responses

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/agentlink/templates/greeting-agent.git
cd greeting-agent
pip install -r requirements.txt
```

### 2. Configure

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
# Edit .env with your keys
```

### 3. Customize Welcome Flow

Edit `src/onboarding_flow.py`:

```python
ONBOARDING_STEPS = [
    {
        "id": "welcome",
        "message": "Welcome to {app_name}! 👋",
        "collect_input": False
    },
    {
        "id": "name",
        "message": "What's your name?",
        "collect_input": True,
        "field": "user_name"
    },
    {
        "id": "purpose",
        "message": "What brings you here today?",
        "collect_input": True,
        "field": "purpose",
        "options": ["Work", "Personal", "Learning"]
    }
]
```

### 4. Deploy

```bash
agentlink deploy
```

## Configuration

Edit `agent.yaml`:

```yaml
name: greeting-agent
description: Welcome and onboarding agent
version: 1.0.0

tools:
  - user_profile
  - message_sender
  - preference_store

config:
  app_name: "Your App"
  default_language: "en"
  supported_languages: ["en", "es", "fr", "de"]
  onboarding_enabled: true
  follow_up_delay: 86400  # 24 hours
```

## Usage

### Initialize Greeting

```bash
curl -X POST https://api.agentlink.io/agents/{agent_id}/greet \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "context": {
      "source": "signup",
      "plan": "free"
    }
  }'
```

### Response Format

```json
{
  "message": "Welcome to Your App! 👋",
  "personalized": true,
  "next_step": {
    "action": "collect_input",
    "field": "user_name",
    "prompt": "What's your name?"
  },
  "suggestions": [
    "Take a tour",
    "Watch tutorial",
    "Start project"
  ]
}
```

### Continue Onboarding

```bash
curl -X POST https://api.agentlink.io/agents/{agent_id}/onboard \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "step": "name",
    "input": "John Doe"
  }'
```

## Customization

### Personalization Rules

Edit `src/personalization.py`:

```python
def personalize_message(user_profile, message_template):
    """Personalize message based on user profile"""
    return message_template.format(
        name=user_profile.get('name', 'there'),
        plan=user_profile.get('plan', 'free'),
        last_active=user_profile.get('last_active', 'recently')
    )
```

### Multi-Language Support

Add translations in `locales/`:

```yaml
# locales/es.yaml
welcome: "¡Bienvenido a {app_name}! 👋"
name_prompt: "¿Cómo te llamas?"
purpose_prompt: "¿Qué te trae por aquí hoy?"
```

### Context-Aware Responses

```python
CONTEXT_RULES = {
    "signup": {
        "message": "Welcome! Let's get you started...",
        "actions": ["tour", "tutorial", "skip"]
    },
    "returning": {
        "message": "Welcome back! Here's what's new...",
        "actions": ["updates", "continue", "help"]
    },
    "upgrade": {
        "message": "Thanks for upgrading! Here's what you can do now...",
        "actions": ["explore_features", "setup", "support"]
    }
}
```

## Integration Examples

### SaaS Onboarding

```python
# When user signs up
response = greeting_agent.greet(
    user_id=new_user.id,
    context={
        "source": "signup",
        "plan": new_user.plan,
        "referral": new_user.referral_code
    }
)

# Send welcome email with personalized content
send_email(
    to=new_user.email,
    subject=response.personalized_subject,
    body=response.welcome_message
)
```

### Discord Bot

```python
@bot.event
async def on_member_join(member):
    response = greeting_agent.greet(
        user_id=str(member.id),
        context={
            "source": "discord",
            "server": member.guild.name
        }
    )
    await member.send(response.message)
```

### Slack Welcome

```python
@app.event("team_join")
def handle_team_join(event):
    response = greeting_agent.greet(
        user_id=event['user']['id'],
        context={
            "source": "slack",
            "team": event['user']['team_id']
        }
    )
    # Post to welcome channel
    client.chat_postMessage(
        channel="#welcome",
        text=response.message,
        blocks=response.suggestion_blocks
    )
```

## API Reference

### Endpoints

- `POST /greet` - Send personalized greeting
- `POST /onboard` - Continue onboarding flow
- `GET /profile/{user_id}` - Get user profile
- `POST /profile/{user_id}` - Update user profile
- `POST /message` - Send contextual message

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| user_id | string | Unique user identifier | required |
| context | object | Context information | {} |
| language | string | Preferred language | "en" |
| step | string | Onboarding step ID | null |
| input | string | User input for current step | null |

## Testing

```bash
pytest tests/
```

## Deployment

### AgentLink Cloud

```bash
agentlink deploy --env production
```

### Webhook Integration

```python
# Your app webhook
@app.post("/webhooks/user-signup")
def handle_signup(user_data):
    # Trigger greeting agent
    requests.post(
        f"{AGENTLINK_URL}/agents/{AGENT_ID}/greet",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"user_id": user_data["id"]}
    )
```

## Troubleshooting

### Messages Not Personalizing

- Check user profile data is being passed
- Verify personalization rules are configured
- Review context object structure

### Onboarding Flow Issues

- Ensure step IDs match configuration
- Check input validation rules
- Review state management

## Contributing

Contributions welcome! See CONTRIBUTING.md

## License

MIT License

## Support

- Docs: https://docs.agentlink.io/templates/greeting-agent
- Discord: https://discord.gg/agentlink
