import { derived, get, writable } from 'svelte/store';

export type VersionEntry = {
	id: string;
	type: string;
	url: string;
	time: string;
	releaseTime: string;
	sha1: string;
	complianceLevel: number;
};

export type VersionManifest = {
	latest?: {
		release?: string;
		snapshot?: string;
	};
	versions: VersionEntry[];
};

export const versions = writable<VersionEntry[]>([]);

export const selectedVersionId = writable<string | null>(null);

export const versionDetailsById = writable<Record<string, unknown>>({});

export const selectedVersion = derived(
	[versions, selectedVersionId],
	([$versions, $selectedVersionId]) =>
		$selectedVersionId ? $versions.find((version) => version.id === $selectedVersionId) ?? null : null
);

export const selectedVersionDetails = derived(
	[versionDetailsById, selectedVersionId],
	([$details, $selectedVersionId]) => ($selectedVersionId ? $details[$selectedVersionId] ?? null : null)
);

const pendingVersionDetails = new Map<string, Promise<unknown>>();

export async function ensureVersionDetails(id: string, signal?: AbortSignal): Promise<unknown> {
	const cached = get(versionDetailsById)[id];
	if (cached) return cached;

	const inFlight = pendingVersionDetails.get(id);
	if (inFlight) return inFlight;

	const entry = get(versions).find((version) => version.id === id);
	if (!entry) {
		throw new Error('Version metadata not found.');
	}

	const request = (async () => {
		const response = await fetch(entry.url, { signal });
		if (!response.ok) {
			throw new Error(`Failed to fetch manifest (${response.status})`);
		}

		const data = await response.json();
		versionDetailsById.update((cache) => ({ ...cache, [id]: data }));
		return data;
	})();

	pendingVersionDetails.set(id, request);

	try {
		return await request;
	} finally {
		pendingVersionDetails.delete(id);
	}
}
