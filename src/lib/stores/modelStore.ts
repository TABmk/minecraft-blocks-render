import JSZip from 'jszip';
import { get, writable } from 'svelte/store';
import { buildModels, type ResolvedModel } from '$lib/models/buildModels';
import { ensureVersionDetails } from './versionStore';
import { getSelectedResourcePackZip, selectedResourcePackId } from './resourcePackStore';

export const models = writable<ResolvedModel[]>([]);
export const modelsLoading = writable(false);
export const modelsError = writable<string | null>(null);
export const modelsVersionId = writable<string | null>(null);
export const modelsPackId = writable<string | null>(null);

let activeRequestId = 0;

export async function loadModelsForVersion(versionId: string) {
	if (!versionId) {
		resetModels();
		return;
	}

	const requestId = ++activeRequestId;
	modelsLoading.set(true);
	modelsError.set(null);
	modelsVersionId.set(versionId);
	modelsPackId.set(get(selectedResourcePackId));
	models.set([]);

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
		const resolvedModels = await buildModels(zip, overrideZip);
		if (requestId !== activeRequestId) return;

		models.set(resolvedModels);
	} catch (error) {
		if (requestId !== activeRequestId) return;

		console.error('Failed to build models', error);
		models.set([]);
		modelsError.set('Unable to load models for this version.');
	} finally {
		if (requestId === activeRequestId) {
			modelsLoading.set(false);
		}
	}
}

export function resetModels() {
	activeRequestId += 1;
	models.set([]);
	modelsError.set(null);
	modelsLoading.set(false);
	modelsVersionId.set(null);
	modelsPackId.set(null);
}
