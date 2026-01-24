import JSZip from 'jszip';
import { derived, get, writable } from 'svelte/store';

export type ResourcePackEntry = {
	id: string;
	name: string;
	fileName: string;
	zip: JSZip;
	addedAt: number;
};

const createId = () =>
	`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const resourcePacks = writable<ResourcePackEntry[]>([]);
export const selectedResourcePackId = writable<string | null>(null);

export const selectedResourcePack = derived(
	[resourcePacks, selectedResourcePackId],
	([$resourcePacks, $selectedResourcePackId]) =>
		$selectedResourcePackId
			? $resourcePacks.find((pack) => pack.id === $selectedResourcePackId) ?? null
			: null
);

export async function addResourcePack(file: File) {
	const zip = await JSZip.loadAsync(file);
	const entry: ResourcePackEntry = {
		id: createId(),
		name: file.name.replace(/\.zip$/i, ''),
		fileName: file.name,
		zip,
		addedAt: Date.now()
	};

	resourcePacks.update((list) => [entry, ...list]);
	selectedResourcePackId.set(entry.id);
	return entry;
}

export function removeResourcePack(id: string) {
	resourcePacks.update((list) => list.filter((pack) => pack.id !== id));
	if (get(selectedResourcePackId) === id) {
		selectedResourcePackId.set(null);
	}
}

export const getSelectedResourcePackZip = () => get(selectedResourcePack)?.zip ?? null;
