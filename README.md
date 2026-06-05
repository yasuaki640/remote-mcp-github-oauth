# remote-mcp-github-oauth

A remote [MCP](https://modelcontextprotocol.io/introduction) server that provides GitHub API tools with OAuth authentication, deployed on [Cloudflare Workers](https://developers.cloudflare.com/workers/).

Users connect via MCP clients (Claude Desktop, Cursor, etc.) and authenticate with their GitHub account. The server then provides tools for interacting with GitHub repositories, issues, pull requests, and more.

## Available Tools

| Category | Tool | Description |
|---|---|---|
| Repositories | `list_repos` | List repositories for the authenticated user |
| | `get_repo` | Get repository details |
| | `search_repos` | Search repositories |
| Issues | `list_issues` | List issues for a repository |
| | `get_issue` | Get issue details |
| | `create_issue` | Create a new issue |
| | `update_issue` | Update an issue |
| | `create_issue_comment` | Add a comment to an issue |
| | `list_issue_comments` | List comments on an issue |
| | `delete_issue_comment` | Delete a comment on an issue or pull request |
| | `search_issues` | Search issues and pull requests |
| Pull Requests | `list_pull_requests` | List pull requests |
| | `get_pull_request` | Get pull request details |
| | `get_pull_request_diff` | Get pull request diff |
| | `create_pull_request_review` | Create a review on a pull request |
| Files | `get_file_contents` | Get file or directory contents |
| | `search_code` | Search code across repositories |
| GraphQL | `graphql` | Execute any GitHub GraphQL query (fallback for features not covered above) |

## Setup

### 1. Create the project

```bash
npm create cloudflare@latest -- my-mcp-server --template=yasuaki640/remote-mcp-github-oauth
cd my-mcp-server
npm install
```

### 2. Create a GitHub OAuth App

Create a new [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app):

- **Homepage URL**: `https://<your-worker-name>.<your-subdomain>.workers.dev`
- **Authorization callback URL**: `https://<your-worker-name>.<your-subdomain>.workers.dev/callback`

Note your Client ID and generate a Client Secret.

### 3. Set secrets

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put COOKIE_ENCRYPTION_KEY  # e.g. openssl rand -hex 32
```

### 4. Set up Wrangler config

```bash
cp wrangler.jsonc.example wrangler.jsonc
```

Create a KV namespace and update the `id` in `wrangler.jsonc`:

```bash
npx wrangler kv namespace create "OAUTH_KV"
```

### 5. Deploy

```bash
npx wrangler deploy
```

## Connecting MCP Clients

### Claude Desktop

Settings -> Developer -> Edit Config:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://<your-worker-name>.<your-subdomain>.workers.dev/sse"
      ]
    }
  }
}
```

### Cursor

Type: "Command", Command: `npx mcp-remote https://<your-worker-name>.<your-subdomain>.workers.dev/sse`

### Other MCP Clients

Add the same JSON config as Claude Desktop to your client's MCP configuration file.

## Local Development

Create another GitHub OAuth App with:

- **Homepage URL**: `http://localhost:8788`
- **Authorization callback URL**: `http://localhost:8788/callback`

```bash
cp wrangler.jsonc.example wrangler.jsonc  # KV namespace ID is emulated locally, no real ID needed
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your development OAuth credentials
npx wrangler dev
```

## License

MIT
