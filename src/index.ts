import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { githubRequest } from "./github-api";
import {
	fullIssue,
	slimComment,
	slimIssue,
	slimPullRequest,
	slimRepo,
} from "./github-format";
import { GitHubHandler } from "./github-handler";

type Props = {
	login: string;
	name: string;
	email: string;
	accessToken: string;
};

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "GitHub MCP Server",
		version: "1.0.0",
	});

	async init() {
		const token = this.props?.accessToken;
		if (!token) {
			throw new Error("accessToken is not available");
		}

		// --- Repository tools ---

		this.server.registerTool(
			"list_repos",
			{
				description: "List repositories for the authenticated user",
				inputSchema: {
					sort: z
						.enum(["created", "updated", "pushed", "full_name"])
						.optional()
						.describe("Sort field"),
					per_page: z
						.number()
						.optional()
						.describe("Results per page (max 100)"),
					page: z.number().optional().describe("Page number"),
				},
			},
			async ({ sort, per_page, page }) => {
				const params = new URLSearchParams();
				if (sort) params.set("sort", sort);
				if (per_page) params.set("per_page", String(per_page));
				if (page) params.set("page", String(page));
				const query = params.toString();
				const res = await githubRequest(
					`/user/repos${query ? `?${query}` : ""}`,
					token,
				);
				const data = (await res.json()) as unknown[];
				const slim = Array.isArray(data) ? data.map(slimRepo) : data;
				return {
					content: [{ type: "text", text: JSON.stringify(slim, null, 2) }],
				};
			},
		);

		this.server.registerTool(
			"get_repo",
			{
				description: "Get details of a repository",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
				},
			},
			async ({ owner, repo }) => {
				const res = await githubRequest(`/repos/${owner}/${repo}`, token);
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);

		this.server.registerTool(
			"search_repos",
			{
				description: "Search repositories",
				inputSchema: {
					q: z.string().describe("Search query"),
					sort: z
						.enum(["stars", "forks", "help-wanted-issues", "updated"])
						.optional()
						.describe("Sort field"),
					order: z.enum(["asc", "desc"]).optional().describe("Sort order"),
					per_page: z
						.number()
						.optional()
						.describe("Results per page (max 100)"),
					page: z.number().optional().describe("Page number"),
				},
			},
			async ({ q, sort, order, per_page, page }) => {
				const params = new URLSearchParams({ q });
				if (sort) params.set("sort", sort);
				if (order) params.set("order", order);
				if (per_page) params.set("per_page", String(per_page));
				if (page) params.set("page", String(page));
				const res = await githubRequest(
					`/search/repositories?${params}`,
					token,
				);
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);

		// --- Issue tools ---

		this.server.registerTool(
			"list_issues",
			{
				description: "List issues for a repository",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					state: z
						.enum(["open", "closed", "all"])
						.optional()
						.describe("Issue state filter"),
					sort: z
						.enum(["created", "updated", "comments"])
						.optional()
						.describe("Sort field"),
					direction: z
						.enum(["asc", "desc"])
						.optional()
						.describe("Sort direction"),
					per_page: z
						.number()
						.optional()
						.describe("Results per page (max 100)"),
					page: z.number().optional().describe("Page number"),
				},
			},
			async ({ owner, repo, state, sort, direction, per_page, page }) => {
				const params = new URLSearchParams();
				if (state) params.set("state", state);
				if (sort) params.set("sort", sort);
				if (direction) params.set("direction", direction);
				if (per_page) params.set("per_page", String(per_page));
				if (page) params.set("page", String(page));
				const query = params.toString();
				const res = await githubRequest(
					`/repos/${owner}/${repo}/issues${query ? `?${query}` : ""}`,
					token,
				);
				const data = (await res.json()) as unknown[];
				const slim = Array.isArray(data) ? data.map(slimIssue) : data;
				return {
					content: [{ type: "text", text: JSON.stringify(slim, null, 2) }],
				};
			},
		);

		this.server.registerTool(
			"get_issue",
			{
				description: "Get details of a specific issue",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					issue_number: z.number().describe("Issue number"),
				},
			},
			async ({ owner, repo, issue_number }) => {
				const res = await githubRequest(
					`/repos/${owner}/${repo}/issues/${issue_number}`,
					token,
				);
				const data = await res.json();
				return {
					content: [
						{ type: "text", text: JSON.stringify(fullIssue(data), null, 2) },
					],
				};
			},
		);

		this.server.registerTool(
			"create_issue",
			{
				description: "Create a new issue",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					title: z.string().describe("Issue title"),
					body: z.string().optional().describe("Issue body"),
					labels: z.array(z.string()).optional().describe("Labels to add"),
					assignees: z
						.array(z.string())
						.optional()
						.describe("Usernames to assign"),
				},
			},
			async ({ owner, repo, title, body, labels, assignees }) => {
				const res = await githubRequest(
					`/repos/${owner}/${repo}/issues`,
					token,
					{
						method: "POST",
						body: { title, body, labels, assignees },
					},
				);
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);

		this.server.registerTool(
			"create_issue_comment",
			{
				description: "Add a comment to an issue",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					issue_number: z.number().describe("Issue number"),
					body: z.string().describe("Comment body"),
				},
			},
			async ({ owner, repo, issue_number, body }) => {
				const res = await githubRequest(
					`/repos/${owner}/${repo}/issues/${issue_number}/comments`,
					token,
					{ method: "POST", body: { body } },
				);
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);

		this.server.registerTool(
			"update_issue",
			{
				description:
					"Update an issue (close, reopen, edit title/body, change labels/assignees)",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					issue_number: z.number().describe("Issue number"),
					title: z.string().optional().describe("New title"),
					body: z.string().optional().describe("New body"),
					state: z.enum(["open", "closed"]).optional().describe("State to set"),
					state_reason: z
						.enum(["completed", "not_planned", "reopened"])
						.optional()
						.describe("Reason for state change (use with state)"),
					labels: z
						.array(z.string())
						.optional()
						.describe("Labels to set (replaces all)"),
					assignees: z
						.array(z.string())
						.optional()
						.describe("Assignees to set (replaces all)"),
				},
			},
			async ({
				owner,
				repo,
				issue_number,
				title,
				body,
				state,
				state_reason,
				labels,
				assignees,
			}) => {
				const payload: Record<string, unknown> = {};
				if (title !== undefined) payload.title = title;
				if (body !== undefined) payload.body = body;
				if (state !== undefined) payload.state = state;
				if (state_reason !== undefined) payload.state_reason = state_reason;
				if (labels !== undefined) payload.labels = labels;
				if (assignees !== undefined) payload.assignees = assignees;
				const res = await githubRequest(
					`/repos/${owner}/${repo}/issues/${issue_number}`,
					token,
					{ method: "PATCH", body: payload },
				);
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);

		this.server.registerTool(
			"list_issue_comments",
			{
				description: "List comments on an issue",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					issue_number: z.number().describe("Issue number"),
					per_page: z
						.number()
						.optional()
						.describe("Results per page (max 100)"),
					page: z.number().optional().describe("Page number"),
				},
			},
			async ({ owner, repo, issue_number, per_page, page }) => {
				const params = new URLSearchParams();
				if (per_page) params.set("per_page", String(per_page));
				if (page) params.set("page", String(page));
				const query = params.toString();
				const res = await githubRequest(
					`/repos/${owner}/${repo}/issues/${issue_number}/comments${query ? `?${query}` : ""}`,
					token,
				);
				const data = (await res.json()) as unknown[];
				const slim = Array.isArray(data) ? data.map(slimComment) : data;
				return {
					content: [{ type: "text", text: JSON.stringify(slim, null, 2) }],
				};
			},
		);

		this.server.registerTool(
			"search_issues",
			{
				description: "Search issues and pull requests across repositories",
				inputSchema: {
					q: z
						.string()
						.describe("Search query (e.g. 'bug repo:owner/repo is:open')"),
					sort: z
						.enum([
							"comments",
							"reactions",
							"reactions-+1",
							"reactions--1",
							"reactions-smile",
							"reactions-thinking_face",
							"reactions-heart",
							"reactions-tada",
							"interactions",
							"created",
							"updated",
						])
						.optional()
						.describe("Sort field"),
					order: z.enum(["asc", "desc"]).optional().describe("Sort order"),
					per_page: z
						.number()
						.optional()
						.describe("Results per page (max 100)"),
					page: z.number().optional().describe("Page number"),
				},
			},
			async ({ q, sort, order, per_page, page }) => {
				const params = new URLSearchParams({ q });
				if (sort) params.set("sort", sort);
				if (order) params.set("order", order);
				if (per_page) params.set("per_page", String(per_page));
				if (page) params.set("page", String(page));
				const res = await githubRequest(`/search/issues?${params}`, token);
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);

		// --- Pull Request tools ---

		this.server.registerTool(
			"list_pull_requests",
			{
				description: "List pull requests for a repository",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					state: z
						.enum(["open", "closed", "all"])
						.optional()
						.describe("PR state filter"),
					sort: z
						.enum(["created", "updated", "popularity", "long-running"])
						.optional()
						.describe("Sort field"),
					direction: z
						.enum(["asc", "desc"])
						.optional()
						.describe("Sort direction"),
					per_page: z
						.number()
						.optional()
						.describe("Results per page (max 100)"),
					page: z.number().optional().describe("Page number"),
				},
			},
			async ({ owner, repo, state, sort, direction, per_page, page }) => {
				const params = new URLSearchParams();
				if (state) params.set("state", state);
				if (sort) params.set("sort", sort);
				if (direction) params.set("direction", direction);
				if (per_page) params.set("per_page", String(per_page));
				if (page) params.set("page", String(page));
				const query = params.toString();
				const res = await githubRequest(
					`/repos/${owner}/${repo}/pulls${query ? `?${query}` : ""}`,
					token,
				);
				const data = (await res.json()) as unknown[];
				const slim = Array.isArray(data) ? data.map(slimPullRequest) : data;
				return {
					content: [{ type: "text", text: JSON.stringify(slim, null, 2) }],
				};
			},
		);

		this.server.registerTool(
			"get_pull_request",
			{
				description: "Get details of a specific pull request",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					pull_number: z.number().describe("Pull request number"),
				},
			},
			async ({ owner, repo, pull_number }) => {
				const res = await githubRequest(
					`/repos/${owner}/${repo}/pulls/${pull_number}`,
					token,
				);
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);

		this.server.registerTool(
			"get_pull_request_diff",
			{
				description: "Get the diff of a pull request",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					pull_number: z.number().describe("Pull request number"),
				},
			},
			async ({ owner, repo, pull_number }) => {
				const res = await githubRequest(
					`/repos/${owner}/${repo}/pulls/${pull_number}`,
					token,
					{ accept: "application/vnd.github.diff" },
				);
				const diff = await res.text();
				return { content: [{ type: "text", text: diff }] };
			},
		);

		this.server.registerTool(
			"create_pull_request_review",
			{
				description: "Create a review on a pull request",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					pull_number: z.number().describe("Pull request number"),
					body: z.string().optional().describe("Review body"),
					event: z
						.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"])
						.describe("Review action"),
					commit_id: z
						.string()
						.optional()
						.describe("SHA of the commit to review (defaults to latest)"),
					comments: z
						.array(
							z.object({
								path: z.string().describe("Relative file path to comment on"),
								position: z
									.number()
									.optional()
									.describe(
										"Line position in the diff (deprecated, use line instead)",
									),
								line: z
									.number()
									.optional()
									.describe("Line number in the file to comment on"),
								side: z
									.enum(["LEFT", "RIGHT"])
									.optional()
									.describe("Side of the diff (LEFT or RIGHT)"),
								start_line: z
									.number()
									.optional()
									.describe("Start line for multi-line comment"),
								start_side: z
									.enum(["LEFT", "RIGHT"])
									.optional()
									.describe("Start side for multi-line comment"),
								body: z.string().describe("Comment body"),
							}),
						)
						.optional()
						.describe("Inline review comments"),
				},
			},
			async ({
				owner,
				repo,
				pull_number,
				body,
				event,
				commit_id,
				comments,
			}) => {
				const payload: Record<string, unknown> = { event };
				if (body !== undefined) payload.body = body;
				if (commit_id !== undefined) payload.commit_id = commit_id;
				if (comments !== undefined) payload.comments = comments;
				const res = await githubRequest(
					`/repos/${owner}/${repo}/pulls/${pull_number}/reviews`,
					token,
					{ method: "POST", body: payload },
				);
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);

		// --- File tools ---

		this.server.registerTool(
			"get_file_contents",
			{
				description: "Get the contents of a file or directory in a repository",
				inputSchema: {
					owner: z.string().describe("Repository owner"),
					repo: z.string().describe("Repository name"),
					path: z.string().describe("File or directory path"),
					ref: z.string().optional().describe("Git ref (branch, tag, or SHA)"),
				},
			},
			async ({ owner, repo, path, ref }) => {
				const params = new URLSearchParams();
				if (ref) params.set("ref", ref);
				const query = params.toString();
				const res = await githubRequest(
					`/repos/${owner}/${repo}/contents/${path}${query ? `?${query}` : ""}`,
					token,
				);
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);

		this.server.registerTool(
			"search_code",
			{
				description: "Search for code across GitHub repositories",
				inputSchema: {
					q: z
						.string()
						.describe(
							"Search query (e.g. 'addClass in:file language:js repo:owner/repo')",
						),
					per_page: z
						.number()
						.optional()
						.describe("Results per page (max 100)"),
					page: z.number().optional().describe("Page number"),
				},
			},
			async ({ q, per_page, page }) => {
				const params = new URLSearchParams({ q });
				if (per_page) params.set("per_page", String(per_page));
				if (page) params.set("page", String(page));
				const res = await githubRequest(`/search/code?${params}`, token);
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);
		// --- GraphQL tool ---

		this.server.registerTool(
			"graphql",
			{
				description:
					"Execute a GitHub GraphQL API query. Use this as a fallback when no other specialized tool can fulfill the request. Supports all GitHub API features including Projects, Discussions, Sponsors, and any other GitHub data.",
				inputSchema: {
					query: z.string().describe("GraphQL query string"),
					variables: z
						.record(z.string(), z.unknown())
						.optional()
						.describe("GraphQL variables as a JSON object"),
				},
			},
			async ({ query, variables }) => {
				const res = await githubRequest("/graphql", token, {
					method: "POST",
					body: { query, variables },
				});
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
				};
			},
		);
	}
}

export default new OAuthProvider({
	apiHandler: MyMCP.serve("/mcp"),
	apiRoute: "/mcp",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: GitHubHandler as unknown as ExportedHandler,
	tokenEndpoint: "/token",
});
