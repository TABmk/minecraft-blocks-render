<script lang="ts">
	import { Canvas, T } from '@threlte/core';
	import { Studio } from '@threlte/studio';
	import { onDestroy, onMount } from 'svelte';
	import type { ComponentType } from 'svelte';
	import { OrbitControls, TransformControls } from '@threlte/extras';
	import {
		TextureLoader,
		NearestFilter,
		SRGBColorSpace,
		Texture,
		NoToneMapping,
		DoubleSide,
		ClampToEdgeWrapping,
		MeshBasicMaterial,
		MeshLambertMaterial
	} from 'three';
	import type { Group, PerspectiveCamera } from 'three';
	import type { GLTFExporter as GLTFExporterType } from 'three/examples/jsm/exporters/GLTFExporter.js';
	import Passthrough from './Passthrough.svelte';

	export let selected: { name?: string; model?: any } | null = null;
	export let model: any = null;
	export let modelName: string | null = null;
	export let textureSeed = 0;
	export let preset: 'interactive' | 'inventory' = 'interactive';
	export let useStudio = false;
	export let exportSignal = 0;
	export let fullHeight = false;
	const fallbackColor = '#94a3b8';
	let StudioWrapper: ComponentType;
	let studioWrapperProps: Record<string, any> = {};
	let showRotationHelper = false;
	const STUDIO_TOOLBAR_OFFSET = 60;
	let studioKickRotation = false;
	let orbitAutoRotate = true;

	$: StudioWrapper = useStudio ? Studio : Passthrough;
	$: studioWrapperProps = useStudio ? {} : {};

	const syncStudioCamera = (kickRotation = false) => {
		if (!useStudio || !studioControlsRef || !studioCameraRef) return;
		studioCameraRef.position.set(
			editorCameraPosition[0],
			editorCameraPosition[1],
			editorCameraPosition[2]
		);
		studioCameraRef.lookAt(editorCameraTarget[0], editorCameraTarget[1], editorCameraTarget[2]);
		studioControlsRef.object.position.copy(studioCameraRef.position);
		studioControlsRef.target.set(
			editorCameraTarget[0],
			editorCameraTarget[1],
			editorCameraTarget[2]
		);
		studioControlsRef.update?.();
		if (kickRotation) {
			studioKickRotation = true;
			requestAnimationFrame(() => {
				studioKickRotation = false;
			});
		}
	};

	let studioCameraSyncSignature: string | null = null;
	let studioCameraNeedsSync = false;
	let removeControlsListener: (() => void) | null = null;

	$: {
		removeControlsListener?.();
		if (studioControlsRef?.addEventListener) {
			const handleStart = () => {
				studioCameraNeedsSync = false;
				studioKickRotation = false;
			};
			studioControlsRef.addEventListener('start', handleStart);
			removeControlsListener = () => {
				studioControlsRef?.removeEventListener?.('start', handleStart);
			};
		}
	}

	$: if (useStudio) {
		const signature = `${modelName ?? selected?.name ?? ''}|${studioTarget.join(',')}`;
		if (signature !== studioCameraSyncSignature) {
			studioCameraSyncSignature = signature;
			studioCameraNeedsSync = true;
			initStudioEnvironment(studioTarget, true);
		}
	}

	$: if (useStudio && studioCameraNeedsSync && studioControlsRef && studioCameraRef) {
		syncStudioCamera(true);
		studioCameraNeedsSync = false;
	}

	const loader = new TextureLoader();
	const textureCache = new Map<string, Texture>();
	const textureVariantCache = new Map<string, Texture>();
	const animatedTextureControllers = new Map<string, AnimatedTextureController>();
	let lastTextureSeed = textureSeed;

	const disposeTexture = (texture: Texture | null | undefined) => {
		if (texture && typeof texture.dispose === 'function') {
			texture.dispose();
		}
	};

	const clearTextureCaches = () => {
		for (const texture of textureCache.values()) {
			disposeTexture(texture);
		}
		for (const texture of textureVariantCache.values()) {
			disposeTexture(texture);
		}
		textureCache.clear();
		textureVariantCache.clear();
		animatedTextureControllers.clear();
	};

	type RawTextureMeta = {
		animation?: {
			frametime?: number;
			interpolate?: boolean;
			frames?: Array<number | { index: number; time?: number }>;
			width?: number;
			height?: number;
		};
	};

	type AnimationFrame = {
		index: number;
		durationMs: number;
	};

	type AnimatedTextureController = {
		dataUrl: string;
		meta: RawTextureMeta | null;
		textures: Set<Texture>;
		frameCount: number;
		frameWidth: number;
		frameHeight: number;
		frames: AnimationFrame[];
		currentFrame: number;
		frameElapsedMs: number;
		initialized: boolean;
		interpolate: boolean;
	};

	type Vec3 = [number, number, number];

	type DisplayTransform = {
		rotation: Vec3;
		translation: Vec3;
		scale: Vec3;
	};

	const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'] as const;
	const EPSILON = 1e-5;
	const toRadians = (angle: number) => (angle * Math.PI) / 180;
	let showTextures = true;
	let showAxesHelper = false;
	let autoRotate = true;
	let autoRotateEffective = true;
	const studioCameraPosition: Vec3 = [4.2, 2.6, 4.0];
	const studioCameraRotation: Vec3 = [toRadians(-47), toRadians(34), toRadians(31)];

	let editorCameraPosition: Vec3 = [1, 1.5, 1];
	let editorCameraRotation: Vec3 = [0, 0, 0];
	let editorCameraTarget: Vec3 = [0, 1, 0];
	let studioTarget: Vec3 = [0, 1, 0];
	let studioCameraRef: PerspectiveCamera | null = null;
	let studioControlsRef: any = null;
	let toolbarObserver: MutationObserver | null = null;
	let offsetsInitialized = false;
	let lastExportSignal = exportSignal;

	$: autoRotateEffective = autoRotate && !useStudio;
	$: orbitAutoRotate = useStudio
		? studioKickRotation && !showRotationHelper
		: autoRotateEffective && !showRotationHelper;
	$: editorCameraPosition = useStudio ? studioCameraPosition : [1, 1.5, 1];
	$: editorCameraRotation = useStudio ? studioCameraRotation : [0, 0, 0];

	const offsetStudioToolbar = () => {
		if (typeof document === 'undefined') return;
		const toolbarRoot = document.querySelector('#toolbar-items-wrapper');
		if (!toolbarRoot) return;
		const pane = toolbarRoot.closest('.tp-dfwv');
		if (!pane) return;
		(pane as HTMLElement).style.top = `${STUDIO_TOOLBAR_OFFSET}px`;
	};

	const initStudioEnvironment = (target: Vec3, force = false) => {
		if (typeof window === 'undefined' || !useStudio) return;
		if (!force && offsetsInitialized) return;
		offsetsInitialized = true;
		const ensureSetting = (key: string, value: any) => {
			window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
		};
		ensureSetting('default/editor-camera:enabled', 'true');
		ensureSetting('default/editor-camera:mode', '"Perspective"');
		ensureSetting('default/editor-camera:position', studioCameraPosition);
		ensureSetting('default/editor-camera:rotation', studioCameraRotation);
		ensureSetting('default/editor-camera:target', target);
		ensureSetting('default/editor-camera:defaultCamera.enabled', 'false');
		offsetStudioToolbar();
		if (typeof MutationObserver !== 'undefined') {
			toolbarObserver?.disconnect();
			toolbarObserver = new MutationObserver(() => {
				offsetStudioToolbar();
			});
			toolbarObserver.observe(document.body, { childList: true, subtree: true });
		}
	};

onMount(() => {
	readTheme();
	if (typeof MutationObserver !== 'undefined') {
		themeObserver?.disconnect();
		themeObserver = new MutationObserver(() => readTheme());
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme', 'class']
		});
	}

	if (!useStudio) return;
	initStudioEnvironment(studioTarget);
	return () => {
		toolbarObserver?.disconnect();
		toolbarObserver = null;
		offsetsInitialized = false;
	};
});

onDestroy(() => {
	removeControlsListener?.();
	themeObserver?.disconnect();
	themeObserver = null;
	if (colorProbe?.parentElement) {
		colorProbe.parentElement.removeChild(colorProbe);
	}
	colorProbe = null;
});

let darkBackground = false;
let canvasBackground = '#f8fafc';
let themeBase100 = '#f8fafc';
let themeBase200 = '#e2e8f0';
let themeBase300 = '#cbd5e1';
let themeObserver: MutationObserver | null = null;
let colorProbe: HTMLDivElement | null = null;
	let modelData: any = null;
	let patchedModel: any = null;
	let modelRoot: Group | undefined;
let isInventoryPreset = false;

const getCssVar = (name: string) => {
	if (typeof window === 'undefined') return '';
	const rootStyles = getComputedStyle(document.documentElement);
	let value = rootStyles.getPropertyValue(name).trim();
	if (!value && document.body) {
		value = getComputedStyle(document.body).getPropertyValue(name).trim();
	}
	return value;
};

const toRgb = (value: string) => {
	if (typeof document === 'undefined') return '';
	if (!colorProbe) {
		colorProbe = document.createElement('div');
		colorProbe.style.display = 'none';
		document.body.appendChild(colorProbe);
	}
	colorProbe.style.color = value;
	return getComputedStyle(colorProbe).color;
};

const isDarkTheme = (baseColor: string) => {
	const rgb = toRgb(baseColor);
	const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
	if (!match) return false;
	const r = Number(match[1]) / 255;
	const g = Number(match[2]) / 255;
	const b = Number(match[3]) / 255;
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return luminance < 0.5;
};

const readTheme = () => {
	if (typeof window === 'undefined') return;
	themeBase100 = getCssVar('--color-base-100') || themeBase100;
	themeBase200 = getCssVar('--color-base-200') || themeBase200;
	themeBase300 = getCssVar('--color-base-300') || themeBase300;
	darkBackground = isDarkTheme(themeBase100);
};

$: canvasBackground = isInventoryPreset
	? themeBase200
	: darkBackground
		? themeBase300
		: themeBase100;
	let exporter: GLTFExporterType | null = null;
	let isExporting = false;
	let exportError: string | null = null;
	let lastSelectedName: string | undefined;

	const getExporter = async () => {
		if (typeof window === 'undefined') return null;
		if (!exporter) {
			const module = await import('three/examples/jsm/exporters/GLTFExporter.js');
			exporter = new module.GLTFExporter();
		}
		return exporter;
	};

	const revokeUrlLater = (url: string) => {
		window.setTimeout(() => {
			URL.revokeObjectURL(url);
		}, 1500);
	};

	const exportGlb = async () => {
		const root = modelRoot;
		if (!root || typeof window === 'undefined') return;
		const exporterInstance = await getExporter();
		if (!exporterInstance) return;

		isExporting = true;
		exportError = null;
		const hiddenMeshes: Array<{ mesh: any; visible: boolean }> = [];

		try {
			root.traverse((object: any) => {
				if (!object?.isMesh) return;
				const materials = Array.isArray(object.material)
					? object.material
					: [object.material];
				const hasMap = materials.some((mat: any) => !!mat?.map);
				if (!hasMap) {
					hiddenMeshes.push({ mesh: object, visible: object.visible });
					object.visible = false;
				}
			});

			const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
				const options = {
					binary: true,
					includeCustomExtensions: true,
					onlyVisible: true,
					truncateDrawRange: false,
					embedImages: true
				};

				exporterInstance.parse(
					root,
					(result) => {
						if (result instanceof ArrayBuffer) {
							resolve(result);
						} else if (result instanceof Blob) {
							result.arrayBuffer().then(resolve).catch(reject);
						} else {
							reject(new Error('Unexpected exporter result'));
						}
					},
					(error) => {
						reject(
							error instanceof Error
								? error
								: new Error(typeof error === 'string' ? error : 'Export failed')
						);
					},
					options
				);
			});

			const resolvedName = modelName ?? selected?.name;
			const fileNameBase = resolvedName ? resolvedName.replace(/\s+/g, '_') : 'model';
			const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
			const link = document.createElement('a');
			const url = URL.createObjectURL(blob);
			link.href = url;
			link.download = `${fileNameBase}.glb`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			revokeUrlLater(url);
		} catch (error) {
			console.error('Failed to export GLB', error);
			exportError =
				error instanceof Error ? error.message : 'Something went wrong while exporting.';
		} finally {
			for (const entry of hiddenMeshes) {
				entry.mesh.visible = entry.visible;
			}
			isExporting = false;
		}
	};

	$: if (exportSignal !== lastExportSignal) {
		lastExportSignal = exportSignal;
		if (modelData) {
			exportGlb();
		}
	}

	const configureTexture = (texture: Texture | null) => {
		if (!texture) return texture;
		texture.magFilter = NearestFilter;
		texture.minFilter = NearestFilter;
		texture.generateMipmaps = false;
		texture.colorSpace = SRGBColorSpace;
		texture.premultiplyAlpha = true;
		if (texture.image) {
			texture.needsUpdate = true;
		}
		return texture;
	};

	const clampFrameIndex = (index: number, max: number) => {
		if (!Number.isFinite(index) || max <= 0) return 0;
		const normalized = Math.round(index);
		if (normalized < 0) return ((normalized % max) + max) % max;
		if (normalized >= max) return normalized % max;
		return normalized;
	};

	const ticksToMs = (ticks: number | undefined, fallbackTicks: number) => {
		const value = typeof ticks === 'number' && Number.isFinite(ticks) ? ticks : fallbackTicks;
		const sanitized = Math.max(1, value);
		return sanitized * 50;
	};

	const normalizeFrames = (
		rawFrames: Array<number | { index?: number; time?: number }> | undefined,
		defaultFrameCount: number,
		defaultFrameTimeTicks: number
	): AnimationFrame[] => {
		const frames: AnimationFrame[] = [];
		if (rawFrames?.length) {
			for (const entry of rawFrames) {
				if (typeof entry === 'number') {
					frames.push({
						index: clampFrameIndex(entry, defaultFrameCount),
						durationMs: ticksToMs(undefined, defaultFrameTimeTicks)
					});
				} else if (entry && typeof entry === 'object') {
					frames.push({
						index: clampFrameIndex(entry.index ?? 0, defaultFrameCount),
						durationMs: ticksToMs(entry.time, defaultFrameTimeTicks)
					});
				}
			}
		}

		if (!frames.length) {
			for (let index = 0; index < Math.max(1, defaultFrameCount); index += 1) {
				frames.push({
					index,
					durationMs: ticksToMs(undefined, defaultFrameTimeTicks)
				});
			}
		}

		return frames;
	};

	const getImageDimensions = (image: any) => {
		if (!image) {
			return { width: 0, height: 0 };
		}
		const widthCandidates = [image.width, image.naturalWidth, image.videoWidth, image.image?.width];
		const heightCandidates = [
			image.height,
			image.naturalHeight,
			image.videoHeight,
			image.image?.height
		];

		const width = widthCandidates.find((value) => typeof value === 'number' && value > 0) ?? 0;
		const height = heightCandidates.find((value) => typeof value === 'number' && value > 0) ?? 0;

		return { width, height };
	};

	const ensureAnimationController = (dataUrl: string, meta: RawTextureMeta | null | undefined) => {
		if (!meta?.animation) return null;
		let controller = animatedTextureControllers.get(dataUrl);
		if (!controller) {
			controller = {
				dataUrl,
				meta,
				textures: new Set(),
				frameCount: 0,
				frameWidth: 0,
				frameHeight: 0,
				frames: [],
				currentFrame: 0,
				frameElapsedMs: 0,
				initialized: false,
				interpolate: !!meta.animation?.interpolate
			};
			animatedTextureControllers.set(dataUrl, controller);
		} else {
			controller.meta = meta;
			controller.interpolate = !!meta.animation?.interpolate;
		}
		return controller;
	};

	const setupTextureBase = (texture: Texture, controller: AnimatedTextureController) => {
		const userData = texture.userData ?? {};
		const animationData = userData.__mcAnimation ?? {
			baseOffsetX: texture.offset.x,
			baseOffsetY: texture.offset.y,
			baseRepeatX: texture.repeat.x,
			baseRepeatY: texture.repeat.y,
			currentFrameIndex: -1
		};

		animationData.frameCount = controller.frameCount;
		userData.__mcAnimation = animationData;
		texture.userData = userData;

		const expectedRepeatY =
			controller.frameCount > 0
				? animationData.baseRepeatY / controller.frameCount
				: animationData.baseRepeatY;

		if (Math.abs(texture.repeat.y - expectedRepeatY) > EPSILON) {
			texture.repeat.y = expectedRepeatY;
			texture.needsUpdate = true;
		}

		return animationData;
	};

	const applyAnimationFrame = (controller: AnimatedTextureController, forceUpdate = false) => {
		if (!controller.initialized || !controller.frames.length) return;
		const frame = controller.frames[controller.currentFrame];

		for (const texture of controller.textures) {
			const animationData = setupTextureBase(texture, controller);
			const frameCount = controller.frameCount || 1;
			const baseRepeatY = animationData.baseRepeatY ?? texture.repeat.y * frameCount;
			const baseOffsetY = animationData.baseOffsetY ?? texture.offset.y;
			const perFrame = frameCount > 0 ? baseRepeatY / frameCount : baseRepeatY;
			const newOffsetY = baseOffsetY + baseRepeatY - perFrame * (frame.index + 1);

			if (
				forceUpdate ||
				animationData.currentFrameIndex !== frame.index ||
				Math.abs(texture.offset.y - newOffsetY) > EPSILON
			) {
				texture.offset.y = newOffsetY;
				texture.needsUpdate = true;
				animationData.currentFrameIndex = frame.index;
			}
		}
	};

	const registerTextureWithController = (
		controller: AnimatedTextureController,
		texture: Texture
	) => {
		if (controller.textures.has(texture)) return;
		controller.textures.add(texture);
		if (controller.initialized) {
			setupTextureBase(texture, controller);
			applyAnimationFrame(controller, true);
		}
	};

	const initializeController = (controller: AnimatedTextureController, texture: Texture | null) => {
		if (!controller || controller.initialized || !texture) return;
		const { width, height } = getImageDimensions(texture.image);
		if (!width || !height) return;

		const animation = controller.meta?.animation ?? {};
		const frameWidth = animation.width ?? width;
		const frameHeight = animation.height ?? frameWidth;

		const frameCount = Math.max(1, Math.floor(height / Math.max(1, frameHeight)));
		const frameTimeTicks = animation.frametime ?? 1;
		const frames = normalizeFrames(animation.frames, frameCount, frameTimeTicks);

		controller.frameCount = frameCount;
		controller.frameWidth = frameWidth;
		controller.frameHeight = frameHeight;
		controller.frames = frames;
		controller.currentFrame = 0;
		controller.frameElapsedMs = 0;
		controller.initialized = true;

		for (const registeredTexture of controller.textures) {
			setupTextureBase(registeredTexture, controller);
		}
		applyAnimationFrame(controller, true);
	};

	const registerAnimatedVariant = (dataUrl: string | undefined, texture: Texture | null) => {
		if (!texture || !dataUrl) return;
		const controller = animatedTextureControllers.get(dataUrl);
		if (!controller) return;
		registerTextureWithController(controller, texture);
		if (texture.image) {
			initializeController(controller, texture);
		}
	};

	const loadTexture = (dataUrl: string | null | undefined, meta?: RawTextureMeta | null) => {
		if (!dataUrl) return null;
		if (textureCache.has(dataUrl)) {
			const cachedTexture = textureCache.get(dataUrl) ?? null;
			if (meta?.animation && cachedTexture) {
				const controller = ensureAnimationController(dataUrl, meta);
				if (controller) {
					registerTextureWithController(controller, cachedTexture);
					if (cachedTexture.image) {
						initializeController(controller, cachedTexture);
					}
				}
			}
			return configureTexture(cachedTexture);
		}

		const controller = meta?.animation ? ensureAnimationController(dataUrl, meta) : null;

		const texture = loader.load(
			dataUrl,
			(loadedTexture) => {
				configureTexture(loadedTexture);
				if (controller) {
					registerTextureWithController(controller, loadedTexture);
					initializeController(controller, loadedTexture);
				}
			},
			undefined,
			(error) => {
				console.warn(`Failed to load texture ${dataUrl}`, error);
			}
		);
		configureTexture(texture);

		if (controller) {
			registerTextureWithController(controller, texture);
			if (texture.image) {
				initializeController(controller, texture);
			}
		}

		textureCache.set(dataUrl, texture);
		return texture;
	};

	type FaceMaterial = {
		texture: Texture | null;
		hasTexture: boolean;
	};

	const getUvTransformKey = (textureDataUrl: string | undefined, uv: number[] | undefined) => {
		const base = textureDataUrl ?? 'unknown';
		if (!uv) return `${base}|full`;
		return `${base}|${uv.join(',')}`;
	};

	const applyUvTransform = (baseTexture: Texture | null, faceData: any) => {
		if (!baseTexture) return null;

		const key = getUvTransformKey(faceData.textureDataUrl, faceData.uv);
		if (textureVariantCache.has(key)) {
			const cachedVariant = textureVariantCache.get(key) ?? null;
			if (cachedVariant && faceData?.textureDataUrl) {
				registerAnimatedVariant(faceData.textureDataUrl, cachedVariant);
			}
			return configureTexture(cachedVariant);
		}

		let texture = baseTexture;

		if (faceData.uv) {
			let [u1, v1, u2, v2] = faceData.uv;
			if (faceData.rotation) {
				const rotatePoint = (u: number, v: number) => {
					switch (faceData.rotation) {
						case 90:
							return [v, 16 - u] as [number, number];
						case 180:
							return [16 - u, 16 - v] as [number, number];
						case 270:
							return [16 - v, u] as [number, number];
						default:
							return [u, v] as [number, number];
					}
				};
				[u1, v1] = rotatePoint(u1, v1);
				[u2, v2] = rotatePoint(u2, v2);
			}
			const uMin = Math.min(u1, u2);
			const uMax = Math.max(u1, u2);
			const vMin = Math.min(v1, v2);
			const vMax = Math.max(v1, v2);
			let repeatX = (uMax - uMin) / 16;
			let repeatY = (vMax - vMin) / 16;
			let offsetX = uMin / 16;
			let offsetY = 1 - vMax / 16;
			const flipX = u1 > u2;
			const flipY = v1 > v2;
			if (flipX) {
				repeatX *= -1;
				offsetX += Math.abs(repeatX);
			}
			if (flipY) {
				repeatY *= -1;
				offsetY += Math.abs(repeatY);
			}

			texture = baseTexture.clone();
			texture.repeat.set(repeatX, repeatY);
			texture.offset.set(offsetX, offsetY);
			texture.wrapS = ClampToEdgeWrapping;
			texture.wrapT = ClampToEdgeWrapping;
			configureTexture(texture);
			texture.flipY = baseTexture.flipY;
			texture.generateMipmaps = baseTexture.generateMipmaps;
			texture.needsUpdate = true;
			if (faceData?.textureDataUrl) {
				registerAnimatedVariant(faceData.textureDataUrl, texture);
			}
		}

		textureVariantCache.set(key, texture);
		return texture;
	};

	const getDefaultUv = (element: any, face: string) => {
		const from = Array.isArray(element?.from) ? element.from : [0, 0, 0];
		const to = Array.isArray(element?.to) ? element.to : from;

		switch (face) {
			case 'north':
				return [from[0], 16 - to[1], to[0], 16 - from[1]];
			case 'south':
				return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]];
			case 'west':
				return [from[2], 16 - to[1], to[2], 16 - from[1]];
			case 'east':
				return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]];
			case 'up':
				return [from[0], from[2], to[0], to[2]];
			case 'down':
				return [from[0], 16 - to[2], to[0], 16 - from[2]];
			default:
				return undefined;
		}
	};

	const getFaceMaterials = (element: any, _seed: number): FaceMaterial[] => {
		return faceOrder.map((face) => {
			const faceData = element?.faces?.[face];
			if (!faceData?.textureDataUrl) {
				return { texture: null, hasTexture: false };
			}
			const baseTexture = loadTexture(faceData.textureDataUrl, faceData.textureMcmeta);
			const resolvedFace =
				faceData.uv || faceData.rotation
					? faceData
					: { ...faceData, uv: getDefaultUv(element, face) };
			const texture = applyUvTransform(baseTexture, resolvedFace);
			return {
				texture,
				hasTexture: !!texture
			};
		});
	};

	const updateAnimatedTextures = (deltaMs: number) => {
		for (const controller of animatedTextureControllers.values()) {
			if (!controller.initialized || controller.frames.length <= 1) continue;
			const frames = controller.frames;
			let currentFrameDuration =
				frames[controller.currentFrame]?.durationMs ?? ticksToMs(undefined, 1);
			currentFrameDuration = Math.max(1, currentFrameDuration);
			controller.frameElapsedMs += deltaMs;

			let iterations = 0;
			while (controller.frameElapsedMs >= currentFrameDuration && iterations < frames.length * 4) {
				controller.frameElapsedMs -= currentFrameDuration;
				controller.currentFrame = (controller.currentFrame + 1) % frames.length;
				applyAnimationFrame(controller, false);
				currentFrameDuration =
					frames[controller.currentFrame]?.durationMs ?? ticksToMs(undefined, 1);
				currentFrameDuration = Math.max(1, currentFrameDuration);
				iterations += 1;
			}
		}
	};

	let animationFrameHandle: number | null = null;
	let lastAnimationTimestamp: number | null = null;

	const animationStep = (timestamp: number) => {
		if (lastAnimationTimestamp === null) {
			lastAnimationTimestamp = timestamp;
		}

		const delta = timestamp - lastAnimationTimestamp;
		lastAnimationTimestamp = timestamp;
		updateAnimatedTextures(delta);
		animationFrameHandle = window.requestAnimationFrame(animationStep);
	};

	onMount(() => {
		animationFrameHandle = window.requestAnimationFrame(animationStep);
	});

	onDestroy(() => {
		if (animationFrameHandle !== null) {
			window.cancelAnimationFrame(animationFrameHandle);
		}
		animationFrameHandle = null;
		lastAnimationTimestamp = null;
	});

	const DEFAULT_GUI_TRANSFORM_RAW = {
		rotation: [30, 225, 0] as [number, number, number],
		translation: [0, 0, 0] as [number, number, number],
		scale: [0.625, 0.625, 0.625] as [number, number, number]
	} as const;

	const DEFAULT_GUI_TRANSFORM: DisplayTransform = {
		rotation: DEFAULT_GUI_TRANSFORM_RAW.rotation.map(toRadians) as Vec3,
		translation: DEFAULT_GUI_TRANSFORM_RAW.translation.map((value) => value / 16) as Vec3,
		scale: [...DEFAULT_GUI_TRANSFORM_RAW.scale] as Vec3
	};

	const coerceVec3 = (value: any, fallback: Vec3): Vec3 => {
		if (!Array.isArray(value) || value.length < 3) {
			return [...fallback] as Vec3;
		}
		return [
			typeof value[0] === 'number' && Number.isFinite(value[0]) ? value[0] : fallback[0],
			typeof value[1] === 'number' && Number.isFinite(value[1]) ? value[1] : fallback[1],
			typeof value[2] === 'number' && Number.isFinite(value[2]) ? value[2] : fallback[2]
		] as Vec3;
	};

	const getGuiDisplayTransform = (model: any): DisplayTransform => {
		const display = model?.display?.gui;

		if (!display) {
			return { ...DEFAULT_GUI_TRANSFORM };
		}

		const rotationRaw = coerceVec3(display.rotation, DEFAULT_GUI_TRANSFORM_RAW.rotation as Vec3);
		const translationRaw = coerceVec3(
			display.translation,
			DEFAULT_GUI_TRANSFORM_RAW.translation as Vec3
		);
		const scaleRaw = coerceVec3(display.scale, DEFAULT_GUI_TRANSFORM_RAW.scale as Vec3);

		return {
			rotation: rotationRaw.map(toRadians) as Vec3,
			translation: translationRaw.map((value) => value / 16) as Vec3,
			scale: scaleRaw as Vec3
		};
	};

	let inventoryTransform: DisplayTransform = { ...DEFAULT_GUI_TRANSFORM };
	type ModelBounds = {
		min: Vec3;
		max: Vec3;
		size: Vec3;
		center: Vec3;
		maxExtent: number;
	};

	const INITIAL_MIN: Vec3 = [
		Number.POSITIVE_INFINITY,
		Number.POSITIVE_INFINITY,
		Number.POSITIVE_INFINITY
	];
	const INITIAL_MAX: Vec3 = [
		Number.NEGATIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		Number.NEGATIVE_INFINITY
	];

	const mergeBounds = (bounds: { min: Vec3; max: Vec3 }, element: any) => {
		const from = Array.isArray(element?.from) ? element.from : [0, 0, 0];
		const to = Array.isArray(element?.to) ? element.to : from;
		for (let axis = 0; axis < 3; axis += 1) {
			const minCoord = Math.min(from[axis] ?? 0, to[axis] ?? 0) / 16 - 0.5;
			const maxCoord = Math.max(from[axis] ?? 0, to[axis] ?? 0) / 16 - 0.5;
			bounds.min[axis] = Math.min(bounds.min[axis], minCoord);
			bounds.max[axis] = Math.max(bounds.max[axis], maxCoord);
		}
		return bounds;
	};

	const computeModelBounds = (model: any): ModelBounds | null => {
		const elements = model?.elements;
		if (!elements?.length) return null;
		const bounds = elements.reduce(
			(current: { min: Vec3; max: Vec3 }, element: any) => mergeBounds(current, element),
			{ min: [...INITIAL_MIN] as Vec3, max: [...INITIAL_MAX] as Vec3 }
		);

		if (!Number.isFinite(bounds.min[0]) || !Number.isFinite(bounds.max[0])) {
			return null;
		}

		const size = [
			bounds.max[0] - bounds.min[0],
			bounds.max[1] - bounds.min[1],
			bounds.max[2] - bounds.min[2]
		] as Vec3;
		const center = [
			(bounds.min[0] + bounds.max[0]) / 2,
			(bounds.min[1] + bounds.max[1]) / 2,
			(bounds.min[2] + bounds.max[2]) / 2
		] as Vec3;
		const maxExtent = Math.max(size[0], size[1], size[2], EPSILON);

		return {
			min: bounds.min,
			max: bounds.max,
			size,
			center,
			maxExtent: maxExtent > EPSILON ? maxExtent : EPSILON
		};
	};

	const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

	let modelBounds: ModelBounds | null = null;
	let inventoryGroupPosition: Vec3 = [0, 0, 0];
	let studioGroupPosition: Vec3 = [0, 0, 0];

	$: isInventoryPreset = preset === 'inventory';
	$: modelBounds = patchedModel ? computeModelBounds(patchedModel) : null;
	$: studioTarget = modelBounds?.center ?? [0, 1, 0];

	$: studioGroupPosition =
		useStudio && modelBounds ? multiplyVec3(modelBounds.center, [-1, -1, -1]) : [0, 0, 0];
	$: editorCameraTarget = useStudio ? studioTarget : [0, 1, 0];

	$: inventoryGroupPosition = (() => {
		if (!isInventoryPreset) return [0, 0, 0] as Vec3;
		if (!modelBounds)
			return [
				inventoryTransform.translation[0],
				inventoryTransform.translation[1],
				inventoryTransform.translation[2]
			] as Vec3;
		const scaledCenter = multiplyVec3(modelBounds.center, inventoryTransform.scale);
		return [
			inventoryTransform.translation[0] - scaledCenter[0],
			inventoryTransform.translation[1] - scaledCenter[1],
			inventoryTransform.translation[2] - scaledCenter[2]
		] as Vec3;
	})();
	$: {
		if (isInventoryPreset) {
			inventoryTransform = getGuiDisplayTransform(selected?.model);
			if (autoRotate) {
				autoRotate = false;
			}
			if (showAxesHelper) {
				showAxesHelper = false;
			}
			if (showRotationHelper) {
				showRotationHelper = false;
			}
		} else {
			inventoryTransform = { ...DEFAULT_GUI_TRANSFORM };
		}
	}

	const getElementRawSize = (element: any): Vec3 => {
		const dx = ((element?.to?.[0] ?? 0) - (element?.from?.[0] ?? 0)) / 16;
		const dy = ((element?.to?.[1] ?? 0) - (element?.from?.[1] ?? 0)) / 16;
		const dz = ((element?.to?.[2] ?? 0) - (element?.from?.[2] ?? 0)) / 16;

		return [dx, dy, dz];
	};

	const getPlaneDimensions = (axis: 'x' | 'y' | 'z', size: Vec3) => {
		if (axis === 'x') {
			return {
				width: size[2] || 0.001,
				height: size[1] || 0.001
			};
		}
		if (axis === 'y') {
			return {
				width: size[0] || 0.001,
				height: size[2] || 0.001
			};
		}

		return {
			width: size[0] || 0.001,
			height: size[1] || 0.001
		};
	};

	const getPlaneBaseRotation = (axis: 'x' | 'y' | 'z'): Vec3 => {
		if (axis === 'x') return [0, Math.PI / 2, 0];
		if (axis === 'y') return [-Math.PI / 2, 0, 0];
		return [0, 0, 0];
	};

	const getCenterPosition = (element: any): Vec3 => {
		const cx = ((element?.from?.[0] ?? 0) + (element?.to?.[0] ?? 0)) / 32;
		const cy = ((element?.from?.[1] ?? 0) + (element?.to?.[1] ?? 0)) / 32;
		const cz = ((element?.from?.[2] ?? 0) + (element?.to?.[2] ?? 0)) / 32;

		return [cx - 0.5, cy - 0.5, cz - 0.5];
	};

	const getElementTransform = (element: any) => {
		const rawSize = getElementRawSize(element);
		const absSize: Vec3 = rawSize.map((value) => Math.abs(value)) as Vec3;
		const zeroMask = absSize.map((value) => value <= EPSILON);
		const zeroCount = zeroMask.filter(Boolean).length;
		const geometry: 'box' | 'plane' | 'line' =
			zeroCount === 1 ? 'plane' : zeroCount >= 2 ? 'line' : 'box';
		const size: Vec3 =
			geometry === 'box'
				? (absSize.map((value) => (value > EPSILON ? value : 0.001)) as Vec3)
				: absSize;
		const planeAxis =
			geometry === 'plane'
				? (['x', 'y', 'z'][zeroMask.findIndex((flag) => flag)] as 'x' | 'y' | 'z')
				: null;
		const planeDimensions = planeAxis ? getPlaneDimensions(planeAxis, absSize) : null;
		const baseRotation = planeAxis ? getPlaneBaseRotation(planeAxis) : ([0, 0, 0] as Vec3);
		const center = getCenterPosition(element);
		const rotation = element?.rotation;

		if (!rotation) {
			if (geometry === 'line') {
				return {
					size,
					geometry,
					planeAxis,
					planeDimensions,
					baseRotation,
					useGroup: false,
					meshPosition: center,
					groupPosition: [0, 0, 0] as Vec3,
					rotation: [0, 0, 0] as Vec3
				};
			}

			return {
				size,
				geometry,
				planeAxis,
				planeDimensions,
				baseRotation,
				useGroup: false,
				meshPosition: center,
				groupPosition: [0, 0, 0] as Vec3,
				rotation: [0, 0, 0] as Vec3
			};
		}

		const origin = rotation.origin || [8, 8, 8];
		const pivot: Vec3 = [origin[0] / 16 - 0.5, origin[1] / 16 - 0.5, origin[2] / 16 - 0.5];
		const axis = rotation.axis;
		const angle = toRadians(rotation.angle || 0);
		const meshPosition: Vec3 = [center[0] - pivot[0], center[1] - pivot[1], center[2] - pivot[2]];

		const rotationVector: Vec3 = [0, 0, 0];
		if (axis === 'x') rotationVector[0] = angle;
		if (axis === 'y') rotationVector[1] = angle;
		if (axis === 'z') rotationVector[2] = angle;

		return {
			size,
			geometry,
			planeAxis,
			planeDimensions,
			baseRotation,
			useGroup: true,
			meshPosition,
			groupPosition: pivot,
			rotation: rotationVector
		};
	};

	const addVec3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
	const scaleVec3 = (a: Vec3, scalar: number): Vec3 => [
		a[0] * scalar,
		a[1] * scalar,
		a[2] * scalar
	];
	const multiplyVec3 = (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];

const getPlaneMaterial = (materials: FaceMaterial[]) =>
	materials.find((material) => material.hasTexture) ??
	({ texture: null, hasTexture: false } as FaceMaterial);

	const cloneFace = (face: any) => {
		if (!face) return face;
		return {
			...face,
			uv: face?.uv ? [...face.uv] : face?.uv,
			transform: face?.transform ? { ...face.transform } : face?.transform
		};
	};

	const patchElementFaces = (element: any) => {
		if (!element?.faces) return element;
		const patched = {
			...element,
			faces: { ...element.faces }
		};

		const { faces } = patched;

		const ensureFace = (source: keyof typeof faces, target: keyof typeof faces) => {
			if (!faces[target] && faces[source]) {
				const sourceFace = cloneFace(faces[source]);
				if (sourceFace) {
					delete sourceFace.cullface;
					faces[target] = sourceFace;
				}
			}
		};

		ensureFace('east', 'north');
		ensureFace('west', 'south');
		ensureFace('north', 'east');
		ensureFace('south', 'west');

		return patched;
	};

	const patchModel = (model: any) => {
		if (!model) return model;
		if (!model?.elements?.length) return model;
		return {
			...model,
			elements: model.elements.map((element: any) => patchElementFaces(element))
		};
	};

	const resolveSelectedModel = () => {
		const candidate = model ?? (selected as any)?.model ?? selected;
		if (!candidate?.elements?.length) return null;
		return candidate;
	};

	$: modelData = resolveSelectedModel();
	$: patchedModel = patchModel(modelData);
	$: if (!modelData) {
		modelRoot = undefined;
	}
	$: if (selected?.name !== lastSelectedName) {
		lastSelectedName = selected?.name;
		exportError = null;
	}
	$: if (textureSeed !== lastTextureSeed) {
		lastTextureSeed = textureSeed;
		clearTextureCaches();
	}

const makeMaterialsArray = (faceMaterials: FaceMaterial[], useShadedMaterials: boolean) => {
	const six = Array.from(
		{ length: 6 },
		(_, i) => faceMaterials[i] ?? { texture: null, hasTexture: false }
	);

	return six.map((fm) =>
		useShadedMaterials
			? new MeshLambertMaterial({
					map: fm.hasTexture ? fm.texture : undefined,
					color: fm.hasTexture ? undefined : fallbackColor,
					alphaTest: fm.hasTexture ? 0.05 : 0,
					side: DoubleSide,
					transparent: !fm.hasTexture,
					opacity: fm.hasTexture ? 1 : 0,
					depthWrite: fm.hasTexture
				})
			: new MeshBasicMaterial({
					map: fm.hasTexture ? fm.texture : undefined,
					color: fm.hasTexture ? undefined : fallbackColor,
					alphaTest: fm.hasTexture ? 0.05 : 0,
					side: DoubleSide,
					transparent: !fm.hasTexture,
					opacity: fm.hasTexture ? 1 : 0,
					depthWrite: fm.hasTexture
				})
	);
};
</script>

<div
	class={`model3d-container ${darkBackground ? 'is-dark' : 'is-light'} ${
		fullHeight ? 'is-full-height' : ''
	} h-full w-full`}
	style={`background:${canvasBackground};`}
>
	<Canvas colorSpace={SRGBColorSpace} toneMapping={NoToneMapping}>
		<svelte:component this={StudioWrapper} {...studioWrapperProps}>
			{#if isInventoryPreset}
				<T.OrthographicCamera makeDefault position={[0, 0, 4]} zoom={260} near={0.1} far={20} />
				<T.DirectionalLight
					position={[0, 1, 0]}
					intensity={3.5}
					color="#ffffff"
					castShadow={false}
				/>
				<T.DirectionalLight
					position={[-1, -1, 1]}
					intensity={1.2}
					color="#ffffff"
					castShadow={false}
				/>

				<T.DirectionalLight
					position={[1, -1, 1]}
					intensity={0.25}
					color="#ffffff"
					castShadow={false}
				/>
			{:else}
				<T.PerspectiveCamera
					bind:ref={studioCameraRef}
					makeDefault
					oncreate={(ref) => {
						const target = useStudio ? editorCameraTarget : [0, 1, 0];
						ref.lookAt(target[0], target[1], target[2]);
						setTimeout(() => {
							ref.rotation.set(...editorCameraRotation);
							ref.position.set(...editorCameraPosition);
						}, 0);
					}}
				>
					{#if useStudio}
						<OrbitControls
							bind:ref={studioControlsRef}
							autoRotate={orbitAutoRotate}
							enableZoom={true}
						/>
					{:else}
						<OrbitControls autoRotate={orbitAutoRotate} enableZoom={true} />
					{/if}
				</T.PerspectiveCamera>

				{#if showAxesHelper}
					<T.AxesHelper args={[1.5]} />
				{/if}
			{/if}

			{#if patchedModel}
				<T.Group
					bind:ref={modelRoot}
					position={isInventoryPreset ? inventoryGroupPosition : studioGroupPosition}
					rotation={isInventoryPreset ? inventoryTransform.rotation : [0, 0, 0]}
					scale={isInventoryPreset ? inventoryTransform.scale : [1, 1, 1]}
				>
					<!-- <T.Mesh position.y={-2} rotation.x={-Math.PI / 2} receiveShadow>
					<T.CircleGeometry args={[20, 10]} />
					<T.MeshStandardMaterial color="white" />
				</T.Mesh> -->
					{#if patchedModel.elements}
						{#each patchedModel.elements as el}
							{@const transform = getElementTransform(el)}
							{@const faceMaterials = getFaceMaterials(el, 0)}
							{@const planeMaterial = getPlaneMaterial(faceMaterials)}
							{@const useShadedMaterials = isInventoryPreset}
							{#if transform.geometry === 'plane'}
								{#if transform.useGroup}
									<T.Group position={transform.groupPosition}>
										<T.Mesh
											position={transform.meshPosition}
											rotation={addVec3(transform.rotation, transform.baseRotation)}
										>
											<T.PlaneGeometry
												args={[
													transform?.planeDimensions?.width ?? 0.001,
													transform?.planeDimensions?.height ?? 0.001
												]}
											/>
											{#if useShadedMaterials}
												<T.MeshLambertMaterial
													map={planeMaterial.hasTexture
														? (planeMaterial.texture ?? undefined)
														: undefined}
													color={planeMaterial.hasTexture ? undefined : fallbackColor}
													alphaTest={planeMaterial.hasTexture ? 0.05 : 0}
													side={DoubleSide}
													visible={planeMaterial.hasTexture}
												/>
											{:else}
												<T.MeshBasicMaterial
													map={planeMaterial.hasTexture
														? (planeMaterial.texture ?? undefined)
														: undefined}
													color={planeMaterial.hasTexture ? undefined : fallbackColor}
													alphaTest={planeMaterial.hasTexture ? 0.05 : 0}
													side={DoubleSide}
													visible={planeMaterial.hasTexture}
												/>
											{/if}
										</T.Mesh>
									</T.Group>
								{:else}
									<T.Mesh
										position={transform.meshPosition}
										rotation={addVec3(transform.rotation, transform.baseRotation)}
										visible={showTextures}
									>
										<T.PlaneGeometry
											args={[
												transform?.planeDimensions?.width ?? 0.001,
												transform?.planeDimensions?.height ?? 0.001
											]}
										/>
										{#if useShadedMaterials}
											<T.MeshLambertMaterial
												map={planeMaterial.hasTexture
													? (planeMaterial.texture ?? undefined)
													: undefined}
												color={planeMaterial.hasTexture ? undefined : fallbackColor}
												alphaTest={planeMaterial.hasTexture ? 0.05 : 0}
												side={DoubleSide}
												visible={planeMaterial.hasTexture}
											/>
										{:else}
											<T.MeshBasicMaterial
												map={planeMaterial.hasTexture
													? (planeMaterial.texture ?? undefined)
													: undefined}
												color={planeMaterial.hasTexture ? undefined : fallbackColor}
												alphaTest={planeMaterial.hasTexture ? 0.05 : 0}
												side={DoubleSide}
												visible={planeMaterial.hasTexture}
											/>
										{/if}
									</T.Mesh>
								{/if}
							{:else if transform.useGroup}
								<T.Group position={transform.groupPosition}>
									{#key faceMaterials}
										{@const materialsArray = makeMaterialsArray(faceMaterials, useShadedMaterials)}
										<T.Mesh
											position={transform.meshPosition}
											rotation={transform.rotation}
											visible={showTextures}
											material={materialsArray}
										>
											<T.BoxGeometry args={transform.size} />
										</T.Mesh>
									{/key}
								</T.Group>
							{:else}
								{#key faceMaterials}
									{@const materialsArray = makeMaterialsArray(faceMaterials, useShadedMaterials)}
									<T.Mesh
										position={transform.meshPosition}
										visible={showTextures}
										material={materialsArray}
									>
										<T.BoxGeometry args={transform.size} />
									</T.Mesh>
								{/key}
							{/if}
						{/each}
					{/if}
				</T.Group>
			{/if}

			{#if showRotationHelper && modelRoot && !isInventoryPreset}
				<TransformControls mode="rotate" object={modelRoot} />
			{/if}
		</svelte:component>
	</Canvas>

	{#if !isInventoryPreset && !useStudio}
		<div class="model3d-controls pointer-events-none">
			<div
				class="controls-panel pointer-events-auto bg-base-200/90 border-base-300 rounded-xl border p-3 shadow-lg backdrop-blur"
			>
				<!-- <label class="model3d-toggle">
					<input type="checkbox" class="toggle toggle-xs" bind:checked={showTextures} />
					<span>Textures</span>
				</label> -->
				<label class="model3d-toggle">
					<input type="checkbox" class="toggle toggle-xs" bind:checked={autoRotate} />
					<span>Auto rotate</span>
				</label>
				<label class="model3d-toggle">
					<input type="checkbox" class="toggle toggle-xs" bind:checked={showAxesHelper} />
					<span>Axes helper</span>
				</label>
				<label class="model3d-toggle">
					<input type="checkbox" class="toggle toggle-xs" bind:checked={showRotationHelper} />
					<span>Rotation helper</span>
				</label>
				<label class="model3d-toggle">
					<input type="checkbox" class="toggle toggle-xs" bind:checked={darkBackground} />
					<span>{darkBackground ? 'Dark bg' : 'Light bg'}</span>
				</label>
				{#if exportError}
					<span class="text-error text-xs" aria-live="polite">{exportError}</span>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.model3d-container {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 1rem;
		overflow: hidden;
		box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.35);
	}

	.model3d-container :global(canvas) {
		border-radius: 1rem;
	}

	.model3d-container.is-full-height {
		height: 100%;
		aspect-ratio: auto;
	}

	.model3d-controls {
		z-index: 999;
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: flex;
		align-items: flex-start;
		justify-content: flex-end;
	}

	.controls-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.model3d-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		line-height: 1rem;
		color: var(--color-base-content);
		text-transform: uppercase;
		letter-spacing: 0.07em;
		opacity: 0.85;
	}

	.model3d-toggle span {
		cursor: pointer;
	}

	.model3d-toggle input:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.controls-panel {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 0.4rem;
		}

		.control-chip {
			font-size: 0.7rem;
		}
	}
</style>
