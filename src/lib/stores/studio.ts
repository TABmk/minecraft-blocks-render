import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { ModelEntry } from '$lib/types/models';

const STORAGE_KEY = 'studio:selected-model';

const loadInitialValue = (): ModelEntry | null => {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as ModelEntry) : null;
	} catch (error) {
		console.warn('Failed to read studio model from storage', error);
		return null;
	}
};

const internalStore = writable<ModelEntry | null>(loadInitialValue());

if (browser) {
	internalStore.subscribe((value) => {
		try {
			if (value) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
			} else {
				localStorage.removeItem(STORAGE_KEY);
			}
		} catch (error) {
			console.warn('Failed to persist studio model', error);
		}
	});
}

const clear = () => internalStore.set(null);

export const studioModel = {
	subscribe: internalStore.subscribe,
	set(value: ModelEntry | null) {
		internalStore.set(value);
	},
	clear
};
