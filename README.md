# Shisa-Kanko (Code Observer HUD)

**Shisa-Kanko** is a "Universal HUD for AI Agents". It is a pure visualization tool that highlights code changes proposed by AI agents, inspired by the Japanese safety practice of *pointing and calling*.

Unlike other AI extensions, **Shisa-Kanko is NOT an AI model**. It is an observer that visualizes the intentions of *other* agents (internal or external) in real-time.

## Features

### 1. Universal HUD (Observer Role)
- **Heads-Up Display**: Instantly see which files and lines an AI is about to change.
- **WebSocket Protocol**: Any agent (Python, Node.js, CLI apps) can connect to Shisa-Kanko via port 3000 to send modification plans.
- **Passive Integration**: Shisa-Kanko does not tamper with your AI chat workflows; it only visualizes the results.

### 2. Semantic Highlighting
Categorize AI changes with distinct colors:

| Type | Color | Meaning |
| :--- | :--- | :--- |
| **`logic_change`** | 🔵 **Blue** | Functional changes, bug fixes, logic updates. |
| **`refactor`** | 🟢 **Green** | Code optimization, cleanup, refactoring. |
| **`suggestion`** | 🟡 **Yellow** | General ideas, comments, or UI suggestions. |

### 3. Explorer Indicators
Modified files are marked in the File Explorer:
- **Badge**: `AI` (next to filename)
- **Color**: Distinctive light blue text (`#c7ddff`)

## Security & Authentication

To prevent unauthorized access, Shisa-Kanko uses a token-based authentication system.

1. **Get the Token**: runs the command `Shisa-Kanko: Show Connection Token` in VS Code.
2. **Connect**: When your external agent connects to the WebSocket (default port 3000), it MUST include the `x-shisa-token` header with this token value.

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000', {
    headers: {
        'x-shisa-token': 'YOUR_SECURE_TOKEN_HERE'
    }
});
```

## Configuration

| Setting | Default | Description |
| :--- | :--- | :--- |
| `shisa-kanko.port` | `3000` | The port number for the WebSocket server. |

## JSON Protocol

To highlight changes, simply send a JSON object to Shisa-Kanko's WebSocket server:

```json
{
  "planId": "unique-id",
  "status": "suggestion",
  "targets": [
    {
      "filePath": "/absolute/path/to/file.py",
      "lines": [10, 11, 12],
      "changeType": "logic_change", 
      "reason": "Optimize the loop."
    }
  ]
}
```

## Getting Started

1. **Install**: `npm install`
2. **Launch**: Press `F5` in VS Code to start the extension.
3. **Observe**: Once active, it will listen on port 3000 for any incoming plans.