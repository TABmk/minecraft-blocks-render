import type JSZip from 'jszip';

export type ItemPreview = {
	type: 'model' | 'texture' | 'missing';
	modelName?: string | null;
	texturePath?: string | null;
	textureDataUrl?: string | null;
	textureMcmeta?: any | null;
};

export type ResolvedItem = {
	name: string;
	definition: any;
	modelReference: string | null;
	preview: ItemPreview;
};

const ITEM_PATH = /(assets\/minecraft\/)?items\/(.+)\.json/;

const normalizeModelRef = (value: string | null) =>
	value ? value.replace(/^minecraft:/, '') : null;

const findModelReference = (node: any): string | null => {
	if (!node || typeof node !== 'object') return null;
	if (node.type === 'minecraft:model' && typeof node.model === 'string') {
		return node.model;
	}

	if (node.fallback) {
		const fallbackFound = findModelReference(node.fallback);
		if (fallbackFound) return fallbackFound;
	}

	if (Array.isArray(node.cases)) {
		for (const entry of node.cases) {
			const found = findModelReference(entry?.model ?? entry);
			if (found) return found;
		}
	}

	if (Array.isArray(node.entries)) {
		for (const entry of node.entries) {
			const found = findModelReference(entry?.model ?? entry);
			if (found) return found;
		}
	}

	if (Array.isArray(node)) {
		for (const entry of node) {
			const found = findModelReference(entry);
			if (found) return found;
		}
		return null;
	}

	for (const value of Object.values(node)) {
		const found = findModelReference(value);
		if (found) return found;
	}

	return null;
};

export async function buildItems(sourceZip: JSZip, overrideZip: JSZip | null = null) {
	const sourceNames = Object.keys(sourceZip.files)
		.map((path) => path.match(ITEM_PATH))
		.filter(Boolean)
		.map((match) => (match as RegExpMatchArray)[2]);

	const overrideNames = overrideZip
		? Object.keys(overrideZip.files)
				.map((path) => path.match(ITEM_PATH))
				.filter(Boolean)
				.map((match) => (match as RegExpMatchArray)[2])
		: [];

	const itemNames = Array.from(new Set([...sourceNames, ...overrideNames])).sort();

	const textureDataCache = new Map<string, string | null>();
	const textureMetaCache = new Map<string, any | null>();

	const getEntry = (path: string) =>
		(overrideZip && overrideZip.files[path] ? overrideZip.files[path] : sourceZip.files[path]) ??
		null;

	const getTextureDataUrl = async (path: string | null) => {
		if (!path) return null;
		if (textureDataCache.has(path)) {
			return textureDataCache.get(path) ?? null;
		}

		const entry = getEntry(path);
		if (!entry) {
			textureDataCache.set(path, null);
			return null;
		}

		const base64 = await entry.async('base64');
		const dataUrl = `data:image/png;base64,${base64}`;
		textureDataCache.set(path, dataUrl);
		return dataUrl;
	};

	const getTextureMeta = async (path: string | null) => {
		if (!path) return null;
		if (textureMetaCache.has(path)) {
			return textureMetaCache.get(path) ?? null;
		}

		const metaPath = `${path}.mcmeta`;
		const entry = getEntry(metaPath);
		if (!entry) {
			textureMetaCache.set(path, null);
			return null;
		}

		try {
			const metaText = await entry.async('text');
			const parsed = JSON.parse(metaText);
			textureMetaCache.set(path, parsed);
			return parsed;
		} catch (error) {
			console.warn(`Failed to parse texture metadata for ${path}`, error);
			textureMetaCache.set(path, null);
			return null;
		}
	};

	const resolvedItems: ResolvedItem[] = [];

	for (const name of itemNames) {
		const itemPath = `assets/minecraft/items/${name}.json`;
		const entry = getEntry(itemPath);
		if (!entry) continue;

		let definition: any = null;
		try {
			definition = JSON.parse(await entry.async('text'));
		} catch (error) {
			console.warn(`Failed to parse item definition ${itemPath}`, error);
			continue;
		}

		const modelReference = findModelReference(definition?.model ?? definition);
		const normalized = normalizeModelRef(modelReference);
		const isBlockModel = normalized?.startsWith('block/');
		const itemTextureName = normalized?.startsWith('item/')
			? normalized.slice('item/'.length)
			: name;
		const texturePath = `assets/minecraft/textures/item/${itemTextureName}.png`;
		const [textureDataUrl, textureMcmeta] = await Promise.all([
			getTextureDataUrl(texturePath),
			getTextureMeta(texturePath)
		]);

		const preview: ItemPreview = isBlockModel
			? {
					type: 'model',
					modelName: normalized?.replace(/^block\//, '') ?? null,
					texturePath,
					textureDataUrl,
					textureMcmeta
				}
			: textureDataUrl
				? {
						type: 'texture',
						modelName: null,
						texturePath,
						textureDataUrl,
						textureMcmeta
					}
				: {
						type: 'missing',
						modelName: null,
						texturePath,
						textureDataUrl,
						textureMcmeta
					};

		resolvedItems.push({
			name,
			definition,
			modelReference: normalized,
			preview
		});
	}

	return resolvedItems;
}
