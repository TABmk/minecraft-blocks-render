import type JSZip from 'jszip';

export type ResolvedTexture = {
	path: string;
	dataUrl: string | null;
	mcmeta: any | null;
};

export type ResolvedModel = {
	name: string;
	model: any;
	sourceModel: any;
	usedTextures: ResolvedTexture[];
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const MODEL_PATH = /(assets\/minecraft\/)?models\/block\/(.+)\.json/;

export async function buildModels(sourceZip: JSZip, overrideZip: JSZip | null = null) {
	const modelFiles = Object.keys(sourceZip.files).filter((path) => MODEL_PATH.test(path));

	const modelsMap = new Map<string, any>();
	for (const path of modelFiles) {
		const match = path.match(MODEL_PATH);
		if (!match) continue;
		const name = match[2];
		const content = JSON.parse(await sourceZip.files[path].async('text'));
		modelsMap.set(name, content);
	}

	const resolvedModelCache = new Map<string, any>();
	const texturePathCache = new Map<string, string | null>();
	const textureDataCache = new Map<string, string | null>();
	const textureMetaCache = new Map<string, any | null>();

	const resolveModel = (name: string, chain = new Set<string>()) => {
		if (resolvedModelCache.has(name)) {
			return resolvedModelCache.get(name);
		}

		if (chain.has(name)) {
			return null;
		}
		chain.add(name);

		const baseModel = modelsMap.get(name);
		if (!baseModel) {
			return null;
		}

		const model = clone(baseModel);

		if (model.parent) {
			let parentName = model.parent.replace(/^minecraft:/, '');
			if (parentName.startsWith('block/')) {
				parentName = parentName.slice('block/'.length);
			}
			const parentModel = resolveModel(parentName, chain);
			if (parentModel) {
				model.textures = {
					...(parentModel.textures || {}),
					...(model.textures || {})
				};
				if (!model.elements && parentModel.elements) {
					model.elements = clone(parentModel.elements);
				}
			}
		}

		resolvedModelCache.set(name, model);
		return model;
	};

	const resolveTexturePath = (
		textures: Record<string, string> = {},
		ref: string | null | undefined
	) => {
		if (!ref) return null;
		const cacheKey = `${ref}|${JSON.stringify(textures)}`;
		if (texturePathCache.has(cacheKey)) {
			return texturePathCache.get(cacheKey) ?? null;
		}

		const resolveRef = (value: string, visited = new Set<string>()) => {
			if (!value) return null;
			if (value.startsWith('#')) {
				const key = value.slice(1);
				if (visited.has(key)) return null;
				visited.add(key);
				return resolveRef(textures?.[key], visited);
			}

			let texturePath = value.replace(/^minecraft:/, '');
			if (!texturePath.startsWith('textures/')) {
				texturePath = `textures/${texturePath}`;
			}
			if (!/\.(png|jpg|jpeg)$/.test(texturePath)) {
				texturePath = `${texturePath}.png`;
			}

			return `assets/minecraft/${texturePath}`;
		};

		const resolved = resolveRef(ref);
		texturePathCache.set(cacheKey, resolved);
		return resolved;
	};

	const getTextureDataUrl = async (path: string | null) => {
		if (!path) return null;
		const entry =
			(overrideZip && overrideZip.files[path]
				? overrideZip.files[path]
				: sourceZip.files[path]) ?? null;
		if (!entry) return null;
		if (textureDataCache.has(path)) {
			return textureDataCache.get(path) ?? null;
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
		const entry =
			(overrideZip && overrideZip.files[metaPath]
				? overrideZip.files[metaPath]
				: sourceZip.files[metaPath]) ?? null;
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

	const resolvedModels: Array<ResolvedModel> = [];
	for (const name of modelsMap.keys()) {
		const resolvedModel = resolveModel(name);
		if (!resolvedModel) continue;

		const elements = resolvedModel.elements || [];
		const resolvedElements = [];
		const usedTextures = new Map<string, ResolvedTexture>();

		for (const element of elements) {
			const faces: Record<string, any> = {};
			const faceEntries = Object.entries(element.faces || {}) as Array<[string, any]>;

			await Promise.all(
				faceEntries.map(async ([faceName, faceDef]) => {
					const texturePath: string | null = resolveTexturePath(
						resolvedModel.textures || {},
						faceDef?.texture
					);
					const [textureDataUrl, textureMeta] = await Promise.all([
						getTextureDataUrl(texturePath),
						getTextureMeta(texturePath)
					]);
					if (typeof texturePath === 'string' && texturePath.length) {
						const resolvedPath: string = texturePath;
						if (!usedTextures.has(resolvedPath)) {
							usedTextures.set(resolvedPath, {
								path: resolvedPath,
								dataUrl: textureDataUrl,
								mcmeta: textureMeta
							});
						} else {
							const existing = usedTextures.get(resolvedPath);
							if (existing) {
								if (!existing.dataUrl && textureDataUrl) {
									existing.dataUrl = textureDataUrl;
								}
								if (!existing.mcmeta && textureMeta) {
									existing.mcmeta = textureMeta;
								}
							}
						}
					}
					faces[faceName] = {
						...faceDef,
						texturePath,
						textureDataUrl,
						textureMcmeta: textureMeta
					};
				})
			);

			resolvedElements.push({
				...element,
				faces
			});
		}

		resolvedModels.push({
			name,
			model: {
				...resolvedModel,
				elements: resolvedElements
			},
			sourceModel: clone(modelsMap.get(name)),
			usedTextures: Array.from(usedTextures.values())
		});
	}

	resolvedModels.sort((a, b) => a.name.localeCompare(b.name));
	return resolvedModels;
}
