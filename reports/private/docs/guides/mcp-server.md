> ## Documentation Index
> Fetch the complete documentation index at: https://dev-docs.multihopper.com/llms.txt
> Use this file to discover all available pages before exploring further.

# MCP Server

> Connect AI agents to MultiHopper's documentation via the Model Context Protocol

MultiHopper's documentation is available as a hosted **Model Context Protocol (MCP) server**. Connect any MCP-compatible AI client to search docs, read API references, and explore code examples in real time — without leaving your editor or agent workflow.

## Server URL

```
https://dev-docs.multihopper.com/mcp
```

Paste this URL into any MCP-compatible client to connect.

***

## Connect to your AI client

<AccordionGroup>
  <Accordion title="Claude Desktop" icon="comment">
    Open `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) and add:

    ```json theme={null}
    {
      "mcpServers": {
        "multihopper-docs": {
          "command": "npx",
          "args": ["-y", "mcp-remote", "https://dev-docs.multihopper.com/mcp"]
        }
      }
    }
    ```

    Restart Claude Desktop. The `search_multi_hopper` and `query_docs_filesystem_multi_hopper` tools will be available in every conversation.
  </Accordion>

  <Accordion title="Cursor" icon="arrow-pointer">
    Open **Cursor Settings → MCP** and add a new server:

    * **Name:** `multihopper-docs`
    * **URL:** `https://dev-docs.multihopper.com/mcp`

    Or run the Mintlify install command in your terminal:

    ```bash theme={null}
    npx mcp add dev-docs.multihopper.com
    ```
  </Accordion>

  <Accordion title="VS Code (Copilot)" icon="code">
    Add to your `.vscode/mcp.json` or user settings:

    ```json theme={null}
    {
      "servers": {
        "multihopper-docs": {
          "type": "sse",
          "url": "https://dev-docs.multihopper.com/mcp"
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="Any MCP client" icon="plug">
    The server uses the standard **SSE transport**. Point your client at:

    ```
    https://dev-docs.multihopper.com/mcp
    ```

    No authentication is required for public documentation pages.
  </Accordion>
</AccordionGroup>

***

## Available tools

### `search_multi_hopper`

Searches across the MultiHopper knowledge base to find relevant information, code examples, API references, and guides.

Use this tool for broad or conceptual queries — e.g. *"how does the orchestrator work"*, *"what is keeperFundingTx"*, or *"error MH\_039"*. Returns contextual snippets with titles and links to the source pages.

**Example prompts that trigger this tool:**

* "How do I estimate fees before creating a transfer?"
* "What is the broadcast order for prepared transactions?"
* "What does phase `recoverable` mean?"

***

### `query_docs_filesystem_multi_hopper`

Runs read-only shell-style queries against a virtualized filesystem containing all MultiHopper documentation pages and the OpenAPI spec.

Use this tool when you need **exact content** from a specific page, regex matches across the docs, or structural exploration.

**Supported commands:** `rg`, `grep`, `find`, `tree`, `ls`, `cat`, `head`, `tail`, `stat`, `wc`, `sort`, `uniq`, `cut`, `sed`, `awk`, `jq`

**Useful commands:**

```bash theme={null}
# See the full docs structure
tree / -L 2

# Read a specific page
head -100 /quickstart.mdx
cat /api-reference/transfers/prepare.mdx

# Search for a keyword across all docs
rg -il "keeperFundingTx" /

# Show lines around a match with context
rg -C 3 "MH_039" /api-reference/

# List all OpenAPI endpoints
cat /api-reference/openapi.json | jq '.paths | keys'

# Read multiple pages in one call
head -80 /quickstart.mdx /guides/agentic-integration.mdx
```

<Note>
  Each call is **stateless** — the working directory always resets to `/`. Chain commands with `&&` or use absolute paths if you need to navigate a subdirectory.
</Note>

***

## Example: agent workflow

Here's how an AI agent would use both tools to answer *"how do I sign and broadcast a prepared transfer?"*:

1. **`search_multi_hopper`** — `"sign broadcast prepared transactions"` → finds `/guides/agentic-integration` and `/api-reference/transfers/prepare`
2. **`query_docs_filesystem_multi_hopper`** — `head -150 /guides/agentic-integration.mdx` → reads the full signing code examples

The search tool narrows scope; the filesystem tool reads the full page. Use them together.

<Cards>
  <Card title="Agentic Integration Guide" icon="robot" href="/guides/agentic-integration">
    Full guide for autonomous agents — signing, broadcasting, and the complete TypeScript/Python loop.
  </Card>

  <Card title="API Reference" icon="terminal" href="/api-reference/introduction">
    All endpoints, error codes, and rate limits.
  </Card>
</Cards>
