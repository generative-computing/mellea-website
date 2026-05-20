---
title: "Using MCP Server Tools in Mellea"
date: "2026-05-22"
author: "Alex Bozarth"
excerpt: "Mellea now supports MCP server tools. Discover any MCP server's tools and call them directly from a Mellea agent."
tags: ["v0.6", "mcp", "tools"]
---

Mellea v0.6 adds support for tools served over the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP). Any MCP server's tools can now be discovered and called from a Mellea agent without writing an adapter.

MCP is a vendor-neutral protocol for a server to advertise tools to a model client. A growing list of services, IDEs, and local utilities publish MCP servers, and any MCP-aware client gets their tools for free.

## The API in three steps

Using `mellea.stdlib.tools.mcp` takes three steps:

1. **Connect.** Use the helper for your transport: `http_connection`, `sse_connection`, or `stdio_connection`.
2. **Discover.** Call `discover_mcp_tools(connection)` to get a list of `MCPToolSpec` objects, one per tool the server publishes.
3. **Convert.** Call `.as_mellea_tool()` on the specs you want. The result is a regular `MelleaTool`.

There are no long-lived sessions to manage, and no per-server adapters to write.

## Walking through an example

Mellea ships an end-to-end example, [`github_activity_summary.py`](https://github.com/generative-computing/mellea/blob/main/docs/examples/mcp/github_activity_summary.py), that summarizes your recent GitHub activity using the hosted GitHub MCP server.

The snippets below illustrate each step.

First, set up the connection. The GitHub MCP server uses streamable HTTP and authenticates with a personal access token:

```python
from mellea.stdlib.tools.mcp import discover_mcp_tools, http_connection

connection = http_connection(
    "https://api.githubcopilot.com/mcp/",
    api_key=os.environ["GITHUB_TOKEN"],
)
```

The connection object is a config dict, not a live connection. Pass it to `discover_mcp_tools()` to connect and pull the tool list:

```python
specs = await discover_mcp_tools(connection)
print(f"Discovered {len(specs)} tools on the GitHub MCP server")
```

MCP servers like GitHub's publish dozens of tools. Your agent only needs a few; the rest just get in the way. Filter to what it needs:

```python
TOOLS_NEEDED = {"get_me", "search_pull_requests"}
relevant = [s for s in specs if s.name in TOOLS_NEEDED]
tools = [s.as_mellea_tool() for s in relevant]
```

`as_mellea_tool()` returns a `MelleaTool`, which works anywhere Mellea takes tools, such as the `react()` agent loop:

```python
from mellea.stdlib.frameworks.react import react

result, _ = await react(
    goal=(
        f"Today is {today}. Find my GitHub username, then search for "
        f"pull requests I authored since {since}. List each with title, "
        "number, and repository."
    ),
    context=ChatContext(),
    backend=m.backend,
    tools=tools,
    loop_budget=6,
)
```

The agent loop drives the whole conversation: the model chooses tools, Mellea invokes them against the MCP server, and the results feed back into the next turn.

## Under the hood

Mellea handles two runtime details for you: MCP session lifetime and the async/sync boundary.

Each tool invocation opens its own short-lived MCP session. That keeps session lifetime out of the agent code, and stops a long-running agent from accumulating dead connections.

The MCP SDK is async, but Mellea currently invokes tools synchronously. MCP server tools run on Mellea's shared background event loop, so you don't have to manage executors yourself.

## Try it

Three steps, one example to copy from, and any MCP server is now an agent tool.

```bash
pip install 'mellea[tools]'
```

Start with the [GitHub activity example](https://github.com/generative-computing/mellea/blob/main/docs/examples/mcp/github_activity_summary.py). Bring a `GITHUB_TOKEN` with `repo` and `read:user` scopes, and you'll have a working MCP-backed agent in a single file.
