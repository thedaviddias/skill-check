---
name: mcp-builder
description: "Use when building MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Covers defining tools, configuring transports, structuring server code, and creating evaluations. Activate for Python (FastMCP) or Node/TypeScript (MCP SDK) implementations."
license: Complete terms in LICENSE.txt
---

# MCP Server Development Guide

Build high-quality MCP servers that enable LLMs to effectively interact with external services. Quality is measured by how well the tools enable agents to accomplish real-world tasks.

## Phase 1: Research and Planning

### 1.1 Agent-Centric Design Principles

- **Build for workflows, not endpoints** — Consolidate related operations (e.g., `schedule_event` that checks availability and creates the event). Focus on complete tasks, not individual API calls
- **Optimize for limited context** — Return high-signal info, not data dumps. Offer "concise" vs "detailed" formats. Default to human-readable identifiers over IDs
- **Actionable errors** — Guide agents toward correct usage: "Try using filter='active_only' to reduce results"
- **Evaluation-driven development** — Create realistic eval scenarios early; iterate based on agent performance

### 1.2 Load Documentation

1. **MCP Protocol**: Fetch `https://modelcontextprotocol.io/llms-full.txt`
2. **Best Practices**: Read [📋 mcp_best_practices.md](./reference/mcp_best_practices.md)
3. **Language SDK** (load the one you need):
   - Python: Fetch `https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md` + read [🐍 Python Guide](./reference/python_mcp_server.md)
   - TypeScript: Fetch `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md` + read [⚡ TypeScript Guide](./reference/node_mcp_server.md)

### 1.3 Study the Target API

Read all available API docs: endpoints, auth, rate limits, pagination, error responses, data models. Use WebFetch as needed.

### 1.4 Create Implementation Plan

- **Tool selection**: List highest-value operations. Prioritize common workflows. Consider tool composition
- **Shared utilities**: API request helpers, pagination, formatting, error handling
- **I/O design**: Validation models (Pydantic / Zod), consistent response formats, character limits (~25k tokens), truncation strategies

## Phase 2: Implementation

### 2.1 Project Setup

**Python**: Single `.py` or module structure per [🐍 Python Guide](./reference/python_mcp_server.md). Pydantic models for validation.

**TypeScript**: Proper `package.json` + `tsconfig.json` per [⚡ TypeScript Guide](./reference/node_mcp_server.md). Zod schemas with `.strict()`.

### 2.2 Build Core Infrastructure First

Create shared utilities before tools: API request helper, error handler, response formatter, pagination helper, auth/token manager.

### 2.3 Implement Each Tool

For each tool:

1. **Input schema** — Pydantic/Zod with constraints, clear field descriptions, diverse examples
2. **Docstring** — One-line summary, parameter types with examples, return schema, usage examples, error documentation
3. **Logic** — Use shared utilities, async/await for I/O, support JSON + Markdown formats, respect pagination and character limits
4. **Annotations** — Set `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` appropriately

## Phase 3: Review and Test

**⚠️ MCP servers are long-running processes.** Running directly (e.g., `python server.py`) will hang. Use the evaluation harness, run in tmux, or use `timeout 5s`.

- **Python**: Verify syntax with `python -m py_compile server.py`. Then test via eval harness
- **TypeScript**: Run `npm run build`, verify `dist/index.js` is created. Then test via eval harness

Run the quality checklist from your language guide before moving on.

## Phase 4: Create Evaluations

Load [✅ Evaluation Guide](./reference/evaluation.md) for complete guidelines.

Create 10 evaluation questions that are: independent, read-only, complex (multi-tool), realistic, verifiable by string comparison, and stable over time.

Output format:

```xml
<evaluation>
  <qa_pair>
    <question>Your complex, realistic question here</question>
    <answer>Verifiable answer</answer>
  </qa_pair>
</evaluation>
```
