import JSZip from 'jszip';
import { get, writable } from 'svelte/store';
import { buildItems, type ResolvedItem } from '$lib/models/buildItems';
import { ensureVersionDetails } from './versionStore';
import { getSelectedResourcePackZip, selectedResourcePackId } from './resourcePackStore';

export const items = writable<ResolvedItem[]>([]);
export const itemsLoading = writable(false);
export const itemsError = writable<string | null>(null);
export const itemsVersionId = writable<string | null>(null);
export const itemsPackId = writable<string | null>(null);

let activeRequestId = 0;

export async function loadItemsForVersion(versionId: string) {
	if (!versionId) {
		resetItems();
		return;
	}

	const requestId = ++activeRequestId;
	itemsLoading.set(true);
	itemsError.set(null);
	itemsVersionId.set(versionId);
	itemsPackId.set(get(selectedResourcePackId));
	items.set([]);

	try {
		const details: any = await ensureVersionDetails(versionId);
		const clientUrl: string | undefined = details?.downloads?.client?.url;
		if (!clientUrl) {
			throw new Error('Client jar URL missing for selected version.');
		}

		const response = await fetch(clientUrl);
		if (!response.ok) {
			throw new Error(`Failed to download client (${response.status})`);
		}

		const buffer = await response.arrayBuffer();
		if (requestId !== activeRequestId) return;

		const zip = await JSZip.loadAsync(buffer);
		const overrideZip = getSelectedResourcePackZip();
		const resolvedItems = await buildItems(zip, overrideZip);
		if (requestId !== activeRequestId) return;

		items.set(resolvedItems);
	} catch (error) {
		if (requestId !== activeRequestId) return;

		console.error('Failed to build items', error);
		items.set([]);
		itemsError.set('Unable to load items for this version.');
	} finally {
		if (requestId === activeRequestId) {
			itemsLoading.set(false);
		}
	}
}

export function resetItems() {
	activeRequestId += 1;
	items.set([]);
	itemsError.set(null);
	itemsLoading.set(false);
	itemsVersionId.set(null);
	itemsPackId.set(null);
}
