# Instructions

This project consists of a VS Code extension that serves as a **Universal HUD for AI Agents**.

## Prerequisites
- VS Code installed
- Node.js and npm installed (for the extension)
- Python 3 installed (for the test client)

## Running the Project

### 1. Start the VS Code Extension

1.  Open this project folder in VS Code.
2.  Run `npm install` to install dependencies.
3.  Press `F5` to start the Extension Development Host.
    - The status bar will show "Shisa-Kanko: Listening on port 3000".

### 2. Auto-Highlighting (Observer HUD)

Shisa-Kanko autonomously detects significant changes from **any** AI agent (Copilot, internal chat, etc.) and highlights them instantly.
- **Visuals**: Code is highlighted (Blue/Green/Yellow) and the "AI" icon appears in the explorer.
- **Hover**: Hover over any highlighted line to see the HUD observation reasoning.

### 3. Focus Mode & Lifecycle

To make the HUD your primary visualization tool and reduce IDE clutter:
- **Focus Mode**: Run the command **"Shisa-Kanko: Focus Mode (Hide Standard Gutter Diffs)"** from the Command Palette. This hides the default Git colors in the margin.
- **Auto-Clear**: Once you **Save** a file, Shisa-Kanko assumes your review is complete and clears the highlights for that file automatically.
- **Manual Clear**: Use **"Shisa-Kanko: Clear AI Highlights"** to clear everything instantly.

### 4. External Agent Test

You can also push plans manually from external scripts:
1.  Run the test script:
    ```bash
    python test.py
    ```
2.  The extension will receive the plan via WebSocket and apply highlights to the targeted files.

## Troubleshooting
-   Check the **Debug Console** for `[Shisa-Kanko]` logs to verify events.
-   Ensure no other service is occupying port 3000.
