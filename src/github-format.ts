// Helpers to slim down GitHub API responses before returning them to the MCP
// client. The raw payloads contain many nested fields (user, labels,
// reactions, etc.) that bloat the context window and waste tokens, especially
// on list operations with a large `per_page`. We keep only the fields that are
// useful for browsing/triage. Detail tools (e.g. `get_issue`) use the thicker
// `full*` formatters that additionally include the body (two-tier approach).

// biome-ignore lint/suspicious/noExplicitAny: GitHub API payloads are dynamic JSON.
type GitHubObject = any;

/** Slim representation of an issue for list views. */
export function slimIssue(i: GitHubObject) {
	return {
		number: i.number,
		title: i.title,
		state: i.state,
		labels: i.labels?.map((l: GitHubObject) => l.name) ?? [],
		assignees: i.assignees?.map((a: GitHubObject) => a.login) ?? [],
		url: i.html_url,
		updated_at: i.updated_at,
		// The `/issues` endpoint also returns PRs; this flag avoids mix-ups.
		is_pull_request: !!i.pull_request,
	};
}

/** Thicker representation of an issue for detail views (includes the body). */
export function fullIssue(i: GitHubObject) {
	return {
		number: i.number,
		title: i.title,
		state: i.state,
		state_reason: i.state_reason,
		body: i.body,
		labels: i.labels?.map((l: GitHubObject) => l.name) ?? [],
		assignees: i.assignees?.map((a: GitHubObject) => a.login) ?? [],
		user: i.user?.login,
		comments: i.comments,
		url: i.html_url,
		created_at: i.created_at,
		updated_at: i.updated_at,
		closed_at: i.closed_at,
		is_pull_request: !!i.pull_request,
	};
}

/** Slim representation of a repository for list views. */
export function slimRepo(r: GitHubObject) {
	return {
		full_name: r.full_name,
		private: r.private,
		description: r.description,
		language: r.language,
		stars: r.stargazers_count,
		forks: r.forks_count,
		open_issues: r.open_issues_count,
		default_branch: r.default_branch,
		url: r.html_url,
		updated_at: r.updated_at,
	};
}

/** Slim representation of a pull request for list views. */
export function slimPullRequest(p: GitHubObject) {
	return {
		number: p.number,
		title: p.title,
		state: p.state,
		draft: p.draft,
		labels: p.labels?.map((l: GitHubObject) => l.name) ?? [],
		assignees: p.assignees?.map((a: GitHubObject) => a.login) ?? [],
		user: p.user?.login,
		head: p.head?.ref,
		base: p.base?.ref,
		url: p.html_url,
		updated_at: p.updated_at,
	};
}

/** Slim representation of an issue/PR comment for list views. */
export function slimComment(c: GitHubObject) {
	return {
		id: c.id,
		user: c.user?.login,
		body: c.body,
		url: c.html_url,
		created_at: c.created_at,
		updated_at: c.updated_at,
	};
}
