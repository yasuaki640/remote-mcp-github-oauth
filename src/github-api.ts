const GITHUB_API_BASE = "https://api.github.com";

export async function githubRequest(
	path: string,
	token: string,
	options?: {
		method?: string;
		body?: unknown;
		accept?: string;
	},
): Promise<Response> {
	const {
		method = "GET",
		body,
		accept = "application/vnd.github+json",
	} = options ?? {};

	return fetch(`${GITHUB_API_BASE}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			"User-Agent": "github-mcp-server",
			Accept: accept,
			...(body ? { "Content-Type": "application/json" } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
}

/** A single ProjectV2 membership + Status for an issue. */
export type IssueProjectStatus = {
	project: string;
	project_number: number;
	status: string | null;
};

type IssueProjectNode = {
	number: number;
	projectItems?: {
		nodes?: Array<{
			project?: { title?: string; number?: number } | null;
			status?: { name?: string } | null;
		} | null>;
	} | null;
} | null;

/**
 * Fetch ProjectV2 membership and the "Status" field for the given issues in a
 * single GraphQL request, keyed by issue number. The REST issues endpoints do
 * not expose project data, so this is used to join it on demand. Issue numbers
 * that are not on any project (or are pull requests) simply map to an empty
 * array. Returns an empty map if the lookup fails for any reason so the caller
 * can still return the underlying issue data.
 */
export async function fetchProjectStatuses(
	token: string,
	owner: string,
	repo: string,
	issueNumbers: number[],
): Promise<Map<number, IssueProjectStatus[]>> {
	const result = new Map<number, IssueProjectStatus[]>();
	if (issueNumbers.length === 0) return result;

	const aliases = issueNumbers
		.map((n) => `i${n}: issue(number: ${n}) { ...ProjectStatus }`)
		.join("\n");
	const query = `query($owner: String!, $repo: String!) {
		repository(owner: $owner, name: $repo) {
			${aliases}
		}
	}
	fragment ProjectStatus on Issue {
		number
		projectItems(first: 20) {
			nodes {
				project { title number }
				status: fieldValueByName(name: "Status") {
					... on ProjectV2ItemFieldSingleSelectValue { name }
				}
			}
		}
	}`;

	const res = await githubRequest("/graphql", token, {
		method: "POST",
		body: { query, variables: { owner, repo } },
	});
	const json = (await res.json()) as {
		data?: { repository?: Record<string, IssueProjectNode> | null } | null;
	};
	const repository = json.data?.repository;
	if (!repository) return result;

	for (const node of Object.values(repository)) {
		if (!node) continue;
		const statuses = (node.projectItems?.nodes ?? [])
			.filter((item): item is NonNullable<typeof item> => item != null)
			.map((item) => ({
				project: item.project?.title ?? "",
				project_number: item.project?.number ?? 0,
				status: item.status?.name ?? null,
			}));
		result.set(node.number, statuses);
	}
	return result;
}
