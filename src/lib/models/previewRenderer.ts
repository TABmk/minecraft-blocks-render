import {
	Box3,
	ClampToEdgeWrapping,
	Color,
	DoubleSide,
	Group,
	Mesh,
	MeshLambertMaterial,
	OrthographicCamera,
	DirectionalLight,
	Scene,
	Texture,
	TextureLoader,
	CanvasTexture,
	Vector3,
	WebGLRenderer,
	BoxGeometry,
	NearestFilter,
	SRGBColorSpace
} from 'three';
import type { ResolvedModel } from '$lib/models/buildModels';

const fallbackColor = '#94a3b8';
const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'] as const;
const toRadians = (angle: number) => (angle * Math.PI) / 180;

type Vec3 = [number, number, number];
type DisplayTransform = {
	rotation: Vec3;
	translation: Vec3;
	scale: Vec3;
};

const DEFAULT_GUI_TRANSFORM_RAW = {
	rotation: [30, 225, 0] as Vec3,
	translation: [0, 0, 0] as Vec3,
	scale: [0.625, 0.625, 0.625] as Vec3
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

const multiplyVec3 = (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];

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
	const maxExtent = Math.max(size[0], size[1], size[2], 0.001);

	return {
		min: bounds.min,
		max: bounds.max,
		size,
		center,
		maxExtent
	};
};

let renderer: WebGLRenderer | null = null;
let canvas: HTMLCanvasElement | null = null;
let queue: Promise<unknown> = Promise.resolve();
let activeGeneration = 0;

const previewCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
const textureCache = new Map<string, Texture>();
const variantCache = new Map<string, Texture>();
const animatedFrameCache = new Map<string, Texture>();
const loader = new TextureLoader();

const getRenderer = (size: number) => {
	if (!renderer || !canvas) {
		canvas = document.createElement('canvas');
		renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
		renderer.outputColorSpace = SRGBColorSpace;
		renderer.setClearColor(0x000000, 0);
	}
	renderer.shadowMap.enabled = false;
	renderer.setSize(size, size, false);
	return renderer;
};

const enqueue = <T>(task: () => Promise<T>) => {
	const next = queue.then(task, task);
	queue = next.then(
		() => undefined,
		() => undefined
	);
	return next;
};

const loadTexture = async (dataUrl: string) => {
	const cached = textureCache.get(dataUrl);
	if (cached) return cached;
	const texture = await new Promise<Texture>((resolve, reject) => {
		loader.load(
			dataUrl,
			(loaded) => resolve(loaded),
			undefined,
			(error) => reject(error)
		);
	});
	texture.magFilter = NearestFilter;
	texture.minFilter = NearestFilter;
	texture.generateMipmaps = false;
	texture.colorSpace = SRGBColorSpace;
	texture.premultiplyAlpha = true;
	textureCache.set(dataUrl, texture);
	return texture;
};

const getFirstFrameTexture = async (dataUrl: string, meta: any | null | undefined) => {
	if (!meta?.animation) return loadTexture(dataUrl);

	const key = `${dataUrl}|${meta.animation.width ?? 'auto'}|${meta.animation.height ?? 'auto'}`;
	const cached = animatedFrameCache.get(key);
	if (cached) return cached;

	const baseTexture = await loadTexture(dataUrl);
	const image = baseTexture.image as { width?: number; height?: number };
	const width = image?.width ?? 0;
	const height = image?.height ?? 0;
	if (!width || !height) return baseTexture;

	const frameWidth = meta.animation.width ?? width;
	const frameHeight = meta.animation.height ?? frameWidth;
	if (!frameWidth || !frameHeight) return baseTexture;

	const canvas = document.createElement('canvas');
	canvas.width = frameWidth;
	canvas.height = frameHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) return baseTexture;

	ctx.clearRect(0, 0, frameWidth, frameHeight);
	ctx.drawImage(image as CanvasImageSource, 0, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);

	const texture = new CanvasTexture(canvas);
	texture.magFilter = NearestFilter;
	texture.minFilter = NearestFilter;
	texture.generateMipmaps = false;
	texture.colorSpace = SRGBColorSpace;
	texture.needsUpdate = true;
	animatedFrameCache.set(key, texture);
	return texture;
};

const applyUvTransform = (baseTexture: Texture, dataUrl: string, uv?: number[], rotation?: number) => {
	if (!uv) return baseTexture;
	const key = `${dataUrl}|${uv.join(',')}|${rotation ?? 0}`;
	const cached = variantCache.get(key);
	if (cached) return cached;

	let [u1, v1, u2, v2] = uv;
	if (rotation) {
		const rotatePoint = (u: number, v: number) => {
			switch (rotation) {
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

	const texture = baseTexture.clone();
	texture.repeat.set(repeatX, repeatY);
	texture.offset.set(offsetX, offsetY);
	texture.wrapS = ClampToEdgeWrapping;
	texture.wrapT = ClampToEdgeWrapping;
	texture.needsUpdate = true;
	variantCache.set(key, texture);
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

const getElementTransform = (element: any) => {
	const from = Array.isArray(element?.from) ? element.from : [0, 0, 0];
	const to = Array.isArray(element?.to) ? element.to : from;
	const dx = (to[0] - from[0]) / 16;
	const dy = (to[1] - from[1]) / 16;
	const dz = (to[2] - from[2]) / 16;
	const size: [number, number, number] = [
		Math.max(Math.abs(dx), 0.001),
		Math.max(Math.abs(dy), 0.001),
		Math.max(Math.abs(dz), 0.001)
	];
	const center: [number, number, number] = [
		(from[0] + to[0]) / 32 - 0.5,
		(from[1] + to[1]) / 32 - 0.5,
		(from[2] + to[2]) / 32 - 0.5
	];

	const rotation = element?.rotation;
	if (!rotation) {
		return { size, position: center, rotation: [0, 0, 0] as [number, number, number] };
	}

	const origin = rotation.origin || [8, 8, 8];
	const pivot: [number, number, number] = [
		origin[0] / 16 - 0.5,
		origin[1] / 16 - 0.5,
		origin[2] / 16 - 0.5
	];
	const angle = (rotation.angle || 0) * (Math.PI / 180);
	const axis = rotation.axis;
	const rotationVector: [number, number, number] = [0, 0, 0];
	if (axis === 'x') rotationVector[0] = angle;
	if (axis === 'y') rotationVector[1] = angle;
	if (axis === 'z') rotationVector[2] = angle;

	const meshPosition: [number, number, number] = [
		center[0] - pivot[0],
		center[1] - pivot[1],
		center[2] - pivot[2]
	];

	return { size, position: meshPosition, rotation: rotationVector, pivot };
};

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

const patchModel = (model: ResolvedModel) => {
	if (!model?.model?.elements?.length) return model;
	return {
		...model,
		model: {
			...model.model,
			elements: model.model.elements.map((element: any) => patchElementFaces(element))
		}
	};
};

const buildGroup = async (model: ResolvedModel) => {
	const group = new Group();
	const patched = patchModel(model);
	const elements = patched.model?.elements ?? [];

	for (const element of elements) {
		const transform = getElementTransform(element);
		const faceMaterials: MeshLambertMaterial[] = [];

		for (const face of faceOrder) {
			const faceData = element?.faces?.[face];
			if (!faceData?.textureDataUrl) {
				faceMaterials.push(
					new MeshLambertMaterial({
						color: new Color(fallbackColor),
						side: DoubleSide,
						transparent: true,
						opacity: 0,
						depthWrite: false
					})
				);
				continue;
			}

			try {
				const uv = faceData.uv ?? getDefaultUv(element, face);
				const textureSource = await getFirstFrameTexture(
					faceData.textureDataUrl,
					faceData.textureMcmeta
				);
				const texture = applyUvTransform(
					textureSource,
					faceData.textureDataUrl,
					uv,
					faceData.rotation
				);
				faceMaterials.push(
					new MeshLambertMaterial({
						map: texture,
						side: DoubleSide,
						transparent: false,
						alphaTest: 0.05,
						opacity: 1,
						depthWrite: true
					})
				);
			} catch {
				faceMaterials.push(
					new MeshLambertMaterial({
						color: new Color(fallbackColor),
						side: DoubleSide,
						transparent: true,
						opacity: 0,
						depthWrite: false
					})
				);
			}
		}

		const geometry = new BoxGeometry(transform.size[0], transform.size[1], transform.size[2]);
		const mesh = new Mesh(geometry, faceMaterials);
		mesh.castShadow = false;
		mesh.receiveShadow = false;
		mesh.position.set(transform.position[0], transform.position[1], transform.position[2]);
		if (transform.pivot) {
			const pivotGroup = new Group();
			pivotGroup.position.set(transform.pivot[0], transform.pivot[1], transform.pivot[2]);
			mesh.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);
			pivotGroup.add(mesh);
			group.add(pivotGroup);
		} else {
			mesh.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);
			group.add(mesh);
		}
	}

	return group;
};

const renderModelPreview = async (model: ResolvedModel, size: number, generation: number) => {
	const rendererInstance = getRenderer(size);
	const scene = new Scene();
	scene.background = null;
	const keyLight = new DirectionalLight(0xffffff, 3.5);
	keyLight.position.set(0, 1, 0);
	scene.add(keyLight);

	const fillLeft = new DirectionalLight(0xffffff, 1.2);
	fillLeft.position.set(-1, -1, 1);
	scene.add(fillLeft);

	const fillRight = new DirectionalLight(0xffffff, 0.25);
	fillRight.position.set(1, -1, 1);
	scene.add(fillRight);

	const camera = new OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0.1, 20);
	const group = await buildGroup(model);
	const display = getGuiDisplayTransform(model.model);
	const bounds = computeModelBounds(model.model);
	const groupPosition: Vec3 = bounds
		? (() => {
				const scaledCenter = multiplyVec3(bounds.center, display.scale);
				return [
					display.translation[0] - scaledCenter[0],
					display.translation[1] - scaledCenter[1],
					display.translation[2] - scaledCenter[2]
				];
			})()
		: ([...display.translation] as Vec3);
	group.position.set(groupPosition[0], groupPosition[1], groupPosition[2]);
	group.rotation.set(display.rotation[0], display.rotation[1], display.rotation[2]);
	group.scale.set(display.scale[0], display.scale[1], display.scale[2]);
	scene.add(group);
	camera.position.set(0, 0, 4);
	camera.lookAt(0, 0, 0);
	group.updateMatrixWorld(true);
	const renderBounds = new Box3().setFromObject(group);
	const renderSize = new Vector3();
	renderBounds.getSize(renderSize);
	const maxDim = Math.max(renderSize.x, renderSize.y, renderSize.z, 0.001);
	const padding = 1.35;
	camera.zoom = size / (maxDim * padding);
	camera.updateProjectionMatrix();

	rendererInstance.render(scene, camera);
	if (!canvas || generation !== activeGeneration) {
		return null;
	}

	const dataUrl = canvas.toDataURL('image/png');
	return dataUrl;
};

export const getModelPreview = (model: ResolvedModel, size = 180) => {
	if (typeof window === 'undefined') return Promise.resolve<string | null>(null);
	const key = `${model.name}|${size}`;
	const cached = previewCache.get(key);
	if (cached) return Promise.resolve(cached);
	const existing = inflight.get(key);
	if (existing) return existing;

	const generation = activeGeneration;
	const task = enqueue(async () => {
		try {
			const dataUrl = await renderModelPreview(model, size, generation);
			if (dataUrl && generation === activeGeneration) {
				previewCache.set(key, dataUrl);
			}
			return dataUrl;
		} catch (error) {
			console.warn('Preview render failed', error);
			return null;
		} finally {
			inflight.delete(key);
		}
	});

	inflight.set(key, task);
	return task;
};

export const clearPreviewCache = () => {
	activeGeneration += 1;
	previewCache.clear();
	inflight.clear();
	for (const texture of textureCache.values()) {
		texture.dispose();
	}
	for (const texture of variantCache.values()) {
		texture.dispose();
	}
	for (const texture of animatedFrameCache.values()) {
		texture.dispose();
	}
	textureCache.clear();
	variantCache.clear();
	animatedFrameCache.clear();
};
