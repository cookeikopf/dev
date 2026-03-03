# AgentLink Agent Card Badge Specifications

## Overview

Agent Card Badges are visual indicators that developers can embed in their repositories, documentation, and profiles to showcase their agents. These badges serve as both social proof and a discovery mechanism for AgentLink.

---

## Badge Types

### 1. Status Badges

Indicate the current state of an agent.

| Badge | Color | Description |
|-------|-------|-------------|
| ![Live](https://img.shields.io/badge/AgentLink-Live-10B981) | Green (#10B981) | Agent is running and healthy |
| ![Beta](https://img.shields.io/badge/AgentLink-Beta-F59E0B) | Amber (#F59E0B) | Agent in testing phase |
| ![Building](https://img.shields.io/badge/AgentLink-Building-6366F1) | Indigo (#6366F1) | Agent under development |
| ![Archived](https://img.shields.io/badge/AgentLink-Archived-6B7280) | Gray (#6B7280) | Agent no longer maintained |

### 2. Capability Badges

Showcase agent features and capabilities.

| Badge | Color | Description |
|-------|-------|-------------|
| ![Web Search](https://img.shields.io/badge/AgentLink-Web%20Search-3B82F6) | Blue (#3B82F6) | Agent can search the web |
| ![LLM Powered](https://img.shields.io/badge/AgentLink-LLM%20Powered-8B5CF6) | Purple (#8B5CF6) | Uses language models |
| ![Multi-Agent](https://img.shields.io/badge/AgentLink-Multi--Agent-EC4899) | Pink (#EC4899) | Part of a crew/system |
| ![Integration](https://img.shields.io/badge/AgentLink-Integration-06B6D4) | Cyan (#06B6D4) | Connects to external services |

### 3. Achievement Badges

Recognize popular and notable agents.

| Badge | Color | Description |
|-------|-------|-------------|
| ![Popular](https://img.shields.io/badge/AgentLink-Popular-F59E0B) | Amber (#F59E0B) | 100+ deployments |
| ![Trending](https://img.shields.io/badge/AgentLink-Trending-EF4444) | Red (#EF4444) | Rapid growth in usage |
| ![Community Pick](https://img.shields.io/badge/AgentLink-Community%20Pick-10B981) | Green (#10B981) | Featured by community |
| ![Staff Pick](https://img.shields.io/badge/AgentLink-Staff%20Pick-6366F1) | Indigo (#6366F1) | Featured by AgentLink team |

---

## Badge Specifications

### SVG Badge Format

#### Standard Badge (120x20px)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="120" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <path fill="#555" d="M0 0h55v20H0z"/>
    <path fill="#6366F1" d="M55 0h65v20H55z"/>
    <path fill="url(#b)" d="M0 0h120v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="27.5" y="15" fill="#010101" fill-opacity=".3">AgentLink</text>
    <text x="27.5" y="14">AgentLink</text>
    <text x="87.5" y="15" fill="#010101" fill-opacity=".3">Live</text>
    <text x="87.5" y="14">Live</text>
  </g>
</svg>
```

#### Compact Badge (80x20px)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="80" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <path fill="#555" d="M0 0h25v20H0z"/>
    <path fill="#6366F1" d="M25 0h55v20H25z"/>
    <path fill="url(#b)" d="M0 0h80v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="12.5" y="15" fill="#010101" fill-opacity=".3">AL</text>
    <text x="12.5" y="14">AL</text>
    <text x="52.5" y="15" fill="#010101" fill-opacity=".3">Live</text>
    <text x="52.5" y="14">Live</text>
  </g>
</svg>
```

#### Large Badge (160x24px)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="24">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="160" height="24" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <path fill="#555" d="M0 0h75v24H0z"/>
    <path fill="#6366F1" d="M75 0h85v24H75z"/>
    <path fill="url(#b)" d="M0 0h160v24H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="12">
    <text x="37.5" y="17" fill="#010101" fill-opacity=".3">AgentLink</text>
    <text x="37.5" y="16">AgentLink</text>
    <text x="117.5" y="17" fill="#010101" fill-opacity=".3">Live</text>
    <text x="117.5" y="16">Live</text>
  </g>
</svg>
```

### Color Palette

```css
:root {
  /* Primary Colors */
  --agentlink-indigo: #6366F1;
  --agentlink-indigo-dark: #4F46E5;
  
  /* Status Colors */
  --status-live: #10B981;
  --status-beta: #F59E0B;
  --status-building: #6366F1;
  --status-archived: #6B7280;
  
  /* Capability Colors */
  --capability-web: #3B82F6;
  --capability-llm: #8B5CF6;
  --capability-multi: #EC4899;
  --capability-integration: #06B6D4;
  
  /* Achievement Colors */
  --achievement-popular: #F59E0B;
  --achievement-trending: #EF4444;
  --achievement-community: #10B981;
  --achievement-staff: #6366F1;
  
  /* Neutral Colors */
  --neutral-dark: #555555;
  --neutral-text: #FFFFFF;
  --neutral-shadow: rgba(0, 0, 0, 0.3);
}
```

---

## Badge Generation API

### Endpoint

```
GET /api/v1/badges/{agent_id}.svg
GET /api/v1/badges/{agent_id}.png
```

### Query Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| type | string | Badge type (status, capability, achievement) | status |
| variant | string | Badge variant (live, beta, web-search, etc.) | live |
| style | string | Badge style (flat, flat-square, plastic, for-the-badge) | flat |
| size | string | Badge size (small, medium, large) | medium |
| label | string | Left-side label | "AgentLink" |
| color | string | Custom color (hex) | auto |

### Examples

```bash
# Status badge
curl https://api.agentlink.io/api/v1/badges/agent_123.svg?type=status&variant=live

# Capability badge with custom label
curl https://api.agentlink.io/api/v1/badges/agent_123.svg?type=capability&variant=web-search&label=Powered%20By

# Achievement badge
curl https://api.agentlink.io/api/v1/badges/agent_123.svg?type=achievement&variant=popular

# Custom style
curl https://api.agentlink.io/api/v1/badges/agent_123.svg?style=for-the-badge
```

### Response

Returns SVG or PNG badge image with appropriate cache headers:

```http
HTTP/1.1 200 OK
Content-Type: image/svg+xml
Cache-Control: public, max-age=3600
ETag: "badge_v1_agent_123"
```

---

## Markdown Embed Code

### Basic Badge

```markdown
[![AgentLink](https://agentlink.io/badge/{agent_id}.svg)](https://agentlink.io/agents/{agent_id})
```

### With Alt Text

```markdown
[![AgentLink Status](https://agentlink.io/badge/{agent_id}.svg)](https://agentlink.io/agents/{agent_id} "View on AgentLink")
```

### Multiple Badges

```markdown
[![AgentLink](https://agentlink.io/badge/{agent_id}.svg)](https://agentlink.io/agents/{agent_id})
[![Web Search](https://agentlink.io/badge/{agent_id}/capability/web-search.svg)](https://agentlink.io/agents/{agent_id})
[![Popular](https://agentlink.io/badge/{agent_id}/achievement/popular.svg)](https://agentlink.io/agents/{agent_id})
```

### HTML Embed

```html
<a href="https://agentlink.io/agents/{agent_id}">
  <img src="https://agentlink.io/badge/{agent_id}.svg" alt="AgentLink" />
</a>
```

### reStructuredText

```rst
.. image:: https://agentlink.io/badge/{agent_id}.svg
   :target: https://agentlink.io/agents/{agent_id}
   :alt: AgentLink
```

---

## Social Sharing Metadata

### Open Graph Tags

```html
<meta property="og:title" content="{Agent Name} - AgentLink">
<meta property="og:description" content="{Agent description}">
<meta property="og:image" content="https://agentlink.io/cards/{agent_id}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://agentlink.io/agents/{agent_id}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AgentLink">
```

### Twitter Card Tags

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@agentlink">
<meta name="twitter:creator" content="@{creator_handle}">
<meta name="twitter:title" content="{Agent Name} - AgentLink">
<meta name="twitter:description" content="{Agent description}">
<meta name="twitter:image" content="https://agentlink.io/cards/{agent_id}.png">
<meta name="twitter:image:alt" content="{Agent Name} agent card">
```

### LinkedIn Tags

```html
<meta property="linkedin:card" content="summary_large_image">
<meta property="linkedin:title" content="{Agent Name} - AgentLink">
<meta property="linkedin:description" content="{Agent description}">
<meta property="linkedin:image" content="https://agentlink.io/cards/{agent_id}.png">
```

---

## Agent Card Design

### Card Layout (1200x630px)

```
+----------------------------------------------------------+
|                                                          |
|   [AgentLink Logo]                                       |
|                                                          |
|   +------------------+                                   |
|   |                  |   Agent Name                       |
|   |   Agent Icon     |   @creator                        |
|   |   (200x200)      |                                   |
|   |                  |   Description...                  |
|   +------------------+                                   |
|                                                          |
|   [Live] [Web Search] [LLM Powered] [100+ runs]         |
|                                                          |
|   agentlink.io/agents/{agent_id}                         |
|                                                          |
+----------------------------------------------------------+
```

### Card Elements

1. **Header**: AgentLink branding
2. **Agent Icon**: 200x200px agent avatar
3. **Agent Name**: Bold, prominent
4. **Creator**: @username or organization
5. **Description**: 2-3 line description
6. **Badges**: Status and capability indicators
7. **Stats**: Deployment count, rating
8. **URL**: Direct link to agent

### Card Color Schemes

#### Light Theme
- Background: #FFFFFF
- Text Primary: #111827
- Text Secondary: #6B7280
- Accent: #6366F1
- Border: #E5E7EB

#### Dark Theme
- Background: #1F2937
- Text Primary: #F9FAFB
- Text Secondary: #9CA3AF
- Accent: #818CF8
- Border: #374151

---

## Agent Registry/Directory

### Directory Structure

```
agentlink.io/agents/
├── featured/          # Featured agents
├── popular/           # Most popular agents
├── recent/            # Recently added
├── categories/        # By category
│   ├── research/
│   ├── support/
│   ├── automation/
│   └── integration/
└── creators/          # By creator
```

### Agent Listing Card

```html
<div class="agent-card">
  <div class="agent-header">
    <img src="{agent_icon}" alt="{agent_name}" class="agent-icon">
    <div class="agent-info">
      <h3 class="agent-name">{agent_name}</h3>
      <p class="agent-creator">@{creator}</p>
    </div>
    <span class="agent-status status-{status}">{status}</span>
  </div>
  <p class="agent-description">{description}</p>
  <div class="agent-badges">
    <span class="badge">{capability_1}</span>
    <span class="badge">{capability_2}</span>
  </div>
  <div class="agent-stats">
    <span>{deployments} deployments</span>
    <span>{rating} rating</span>
  </div>
</div>
```

### Search & Filter

- Search by name, description, creator
- Filter by status, capabilities, category
- Sort by popularity, recent, rating

---

## Implementation Notes

### Badge Caching

- Cache badges for 1 hour (3600 seconds)
- Use ETag for cache validation
- Invalidate cache on agent update

### Badge Analytics

Track badge impressions and clicks:
- Badge views
- Click-through rate
- Referrer sources
- Geographic distribution

### Accessibility

- Include alt text for all badges
- Ensure sufficient color contrast
- Support screen readers
- Keyboard navigation for interactive elements

### Performance

- SVG badges: < 5KB each
- PNG badges: < 20KB each
- Card images: < 100KB each
- Lazy load images below fold

---

## Badge Generator Tool

### Web Interface

```
agentlink.io/tools/badge-generator
```

Features:
- Preview badge in real-time
- Customize colors and text
- Select from templates
- Generate embed code
- Download SVG/PNG

### API Usage

```bash
# Generate custom badge
curl -X POST https://api.agentlink.io/api/v1/badges/generate \
  -H "Content-Type: application/json" \
  -d '{
    "label": "My Agent",
    "message": "Live",
    "color": "10B981",
    "style": "flat",
    "logo": "agentlink"
  }'
```

---

## Best Practices

### For Agent Creators

1. **Use appropriate badge type**: Match badge to agent status
2. **Keep README updated**: Ensure badge reflects current state
3. **Multiple badges**: Show capabilities alongside status
4. **Link to agent**: Always link badge to agent page
5. **Monitor performance**: Check badge is loading correctly

### For AgentLink Platform

1. **Fast badge generation**: < 100ms response time
2. **Reliable hosting**: 99.9% uptime for badge service
3. **Clear documentation**: Easy to understand and implement
4. **Flexible customization**: Support various use cases
5. **Respect privacy**: No tracking pixels in badges

---

## Examples

### README.md Example

```markdown
# My Research Agent

[![AgentLink](https://agentlink.io/badge/agent_123.svg)](https://agentlink.io/agents/agent_123)
[![Web Search](https://agentlink.io/badge/agent_123/capability/web-search.svg)](https://agentlink.io/agents/agent_123)
[![LLM Powered](https://agentlink.io/badge/agent_123/capability/llm.svg)](https://agentlink.io/agents/agent_123)

An AI-powered research agent that helps you gather and analyze information.

## Features

- Web search integration
- Content summarization
- Source citation

## Usage

```bash
curl https://api.agentlink.io/agents/agent_123/run -d '{"query": "..."}'
```
```

### Documentation Example

```markdown
## Deployment Status

This agent is currently:

[![Live](https://agentlink.io/badge/agent_123/status/live.svg)](https://agentlink.io/agents/agent_123)

Last deployed: 2025-01-15
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-15 | Initial specification |
