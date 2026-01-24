<script lang="ts">
	import { get } from 'svelte/store';
	import { onDestroy, onMount, tick } from 'svelte';
	import JSZip from 'jszip';
	import jQuery from 'jquery';
	import 'jstree/dist/themes/default/style.min.css';
	import { ensureVersionDetails, selectedVersionId } from '$lib/stores/versionStore';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	export let kind: 'client' | 'server' = 'client';

	type VersionDetails = {
		downloads?: {
			client?: { url?: string };
			server?: { url?: string };
		};
		[key: string]: unknown;
	};

	type TreeNode = {
		id: string;
		parent: string;
		text: string;
		icon?: string;
	};

	let treeContainer: HTMLDivElement | null = null;
	let treeData: TreeNode[] = [];
	let treeError: string | null = null;
	let treeLoading = false;
	let activeRequest = 0;
	let hideClassFiles = true;
	let hideEmptyFolders = true;
	let fileFilterMode: 'all' | 'png' | 'json' = 'all';
	let jsTreeReady = false;
	let jsTreeLoader: Promise<unknown> | null = null;
	let fetchController: AbortController | null = null;
	let hasAttemptedLoad = kind === 'client';

	const treeCache: Record<string, TreeNode[]> = {};
	const zipFilesById: Record<string, Record<string, JSZip.JSZipObject>> = {};
	const cacheKey = (id: string) => `${kind}:${id}`;
	const kindLabel = kind === 'server' ? 'server' : 'client';

	let baseNodes: TreeNode[] = [];

	$: baseNodes = $selectedVersionId ? (treeCache[cacheKey($selectedVersionId)] ?? []) : [];
	let previewPath: string | null = null;
	let previewContent: string | null = null;
	let previewImageUrl: string | null = null;
	let previewError: string | null = null;
	let previewLoading = false;
	let previewDownloading = false;

	onMount(() => {
		const unsubscribe = selectedVersionId.subscribe((id) => {
			clearPreview();

			if (!id) {
				hasAttemptedLoad = kind === 'client';
				resetTree();
				return;
			}

			if (kind === 'client') {
				hasAttemptedLoad = true;
				void loadFileTree(id);
			} else {
				hasAttemptedLoad = false;
				resetTree();
			}
		});

		return () => {
			unsubscribe();
			destroyTree();
		};
	});

	async function loadFileTree(id: string) {
		hasAttemptedLoad = true;
		const { requestId, signal } = beginRequest();
		treeError = null;
		clearPreview();

		const key = cacheKey(id);
		const cached = treeCache[key];
		if (cached) {
			treeData = applyFilter(cached);
			treeLoading = false;
			await tick();
			await ensureJsTree();
			renderTree();
			return;
		}

		treeLoading = true;

		try {
			const details = (await ensureVersionDetails(id, signal)) as VersionDetails;
			if (requestId !== activeRequest) return;

			const downloadUrl =
				kind === 'server' ? details?.downloads?.server?.url : details?.downloads?.client?.url;
			if (!downloadUrl) {
				throw new Error(`${kindLabel} download URL not found in manifest.`);
			}

			const jarResponse = await fetch(downloadUrl, { signal });
			if (!jarResponse.ok) {
				throw new Error(`Failed to fetch ${kindLabel} JAR (${jarResponse.status})`);
			}

			const buf = await jarResponse.arrayBuffer();
			const zip = await JSZip.loadAsync(buf);
			if (requestId !== activeRequest) return;

			zipFilesById[key] = zip.files;
			const nodes = buildTreeData(zip.files);
			treeCache[key] = nodes;
			treeData = applyFilter(nodes);

			treeLoading = false;

			await tick();
			await ensureJsTree();
			await waitForContainer();
			renderTree();
		} catch (error) {
			if (requestId !== activeRequest) return;
			if ((error as Error).name === 'AbortError') return;
			console.error(`Failed to load ${kindLabel} files`, error);
			treeData = [];
			treeError =
				error instanceof Error
					? error.message
					: `Unable to load ${kindLabel} files for this version.`;
			destroyTree();
		} finally {
			if (requestId === activeRequest) {
				treeLoading = false;
				fetchController = null;
			}
		}
	}

	function resetTree() {
		cancelActiveRequest();
		treeLoading = false;
		treeData = [];
		treeError = null;
		clearPreview();
		destroyTree();
	}

	function buildTreeData(files: Record<string, JSZip.JSZipObject>): TreeNode[] {
		const nodes = new SvelteMap<string, TreeNode>();

		Object.values(files).forEach((file) => {
			const parts = file.name.split('/').filter(Boolean);
			if (!parts.length) return;

			let parentId = '#';
			let currentPath = '';

			parts.forEach((part, index) => {
				const isLast = index === parts.length - 1;
				const isDir = !isLast || file.dir;
				currentPath = currentPath ? `${currentPath}/${part}` : part;
				const nodeId = currentPath;

				if (!nodes.has(nodeId)) {
					nodes.set(nodeId, {
						id: nodeId,
						parent: parentId,
						text: isDir ? `${part}/` : part,
						icon: isDir ? 'jstree-folder' : 'jstree-file'
					});
				}

				parentId = nodeId;
			});
		});

		return Array.from(nodes.values());
	}

	async function openFile(path: string) {
		const versionId = get(selectedVersionId);
		if (!versionId) return;

		const entry = zipFilesById[cacheKey(versionId)]?.[path];
		if (!entry || entry.dir) return;

		previewLoading = true;
		previewError = null;
		previewContent = null;
		revokePreviewImage();
		previewImageUrl = null;
		previewPath = path;

		try {
			const lowerPath = path.toLowerCase();
			if (lowerPath.endsWith('.png')) {
				const blob = await entry.async('blob');
				if (versionId !== get(selectedVersionId)) return;
				if (previewPath !== path) return;
				previewImageUrl = URL.createObjectURL(blob);
			} else {
				if (isTooLargeForPreview(entry)) {
					previewError = 'File is too big for preview. You can still download it.';
					return;
				}

				const text = await entry.async('text');
				if (versionId !== get(selectedVersionId)) return;
				if (previewPath !== path) return;
				previewContent = text;
			}
		} catch (error) {
			console.error('Failed to open file', error);
			previewError = error instanceof Error ? error.message : 'Unable to open this file.';
		} finally {
			previewLoading = false;
		}
	}

	async function downloadPreview() {
		const versionId = get(selectedVersionId);
		if (!versionId || !previewPath) return;

		const entry = zipFilesById[cacheKey(versionId)]?.[previewPath];
		if (!entry || entry.dir) {
			previewError = 'File not available to download.';
			return;
		}

		try {
			previewDownloading = true;
			const data = await entry.async('uint8array');
			// @ts-expect-error todo
			const blob = new Blob([data]);
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = previewPath.split('/').pop() || 'file';
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Failed to download file', error);
			previewError = error instanceof Error ? error.message : 'Unable to download this file.';
		} finally {
			previewDownloading = false;
		}
	}

	function renderTree() {
		if (!treeContainer) {
			return;
		}
		if (!jsTreeReady) {
			return;
		}

		const $tree = jQuery(treeContainer);
		const existing = $tree.jstree(true);
		if (existing) {
			existing.destroy();
		}

		if (!treeData.length) return;

		$tree.off('.file-open');
		$tree.jstree({
			core: {
				data: treeData,
				themes: {
					name: 'default',
					icons: true
				}
			}
			// plugins: ['types']
		});

		$tree.on('select_node.jstree.file-open', (_event, data) => {
			const node = data?.node;
			if (!node) return;
			if (isDirectoryNode(node)) return;
			void openFile(node.id as string);
		});
	}

	function destroyTree() {
		if (!treeContainer) return;
		if (!jsTreeReady) return;

		const $tree = jQuery(treeContainer);
		$tree.off('.file-open');
		const instance = $tree.jstree(true);
		instance?.destroy();
	}

	function applyFilter(nodes: TreeNode[]) {
		const parentById = new Map<string, string>(nodes.map((node) => [node.id, node.parent]));

		const fileIds = new Set(
			nodes.filter((node) => isFileNode(node) && filePassesFilters(node)).map((node) => node.id)
		);

		if (!hideEmptyFolders) {
			return nodes.filter((node) => (isFileNode(node) ? fileIds.has(node.id) : true));
		}

		const keepIds = new SvelteSet<string>();

		const addWithParents = (id: string) => {
			let current: string | undefined = id;
			while (current && current !== '#') {
				if (keepIds.has(current)) break;
				keepIds.add(current);
				current = parentById.get(current);
			}
		};

		fileIds.forEach(addWithParents);

		return nodes.filter((node) => keepIds.has(node.id));
	}

	function filePassesFilters(node: TreeNode) {
		const path = node.id.toLowerCase();
		if (hideClassFiles && (path.endsWith('.class') || node.text.endsWith('.class'))) {
			return false;
		}

		if (fileFilterMode === 'png') {
			return path.endsWith('.png');
		}
		if (fileFilterMode === 'json') {
			return path.endsWith('.json');
		}

		return true;
	}

	function isDirectoryNode(node: { icon?: string; original?: { icon?: string }; text?: string }) {
		const icon = node.icon ?? node.original?.icon;
		if (icon === 'jstree-folder') return true;
		return (node.text ?? '').endsWith('/');
	}

	function isFileNode(node: TreeNode) {
		return node.icon === 'jstree-file' || !node.text.endsWith('/');
	}

	function clearPreview() {
		revokePreviewImage();
		previewPath = null;
		previewContent = null;
		previewImageUrl = null;
		previewError = null;
		previewLoading = false;
		previewDownloading = false;
	}

	function closePreview() {
		clearPreview();
		deselectTreeSelection();
	}

	function revokePreviewImage() {
		if (previewImageUrl) {
			URL.revokeObjectURL(previewImageUrl);
		}
	}

	function isTooLargeForPreview(entry: JSZip.JSZipObject) {
		// @ts-expect-error _data is internal; used only for size hints.
		const size: number | undefined = entry._data?.uncompressedSize ?? entry._data?.compressedSize;
		if (size === undefined) return false;
		const limit = 1024 * 1024;
		return size > limit;
	}

	async function ensureJsTree() {
		if (jsTreeReady || typeof window === 'undefined') return;

		(window as typeof window & { jQuery?: typeof jQuery; $?: typeof jQuery }).jQuery = jQuery;
		(window as typeof window & { jQuery?: typeof jQuery; $?: typeof jQuery }).$ = jQuery;

		if (!jsTreeLoader) {
			// @ts-expect-error it won't load types, idk why
			jsTreeLoader = import('jstree');
		}

		await jsTreeLoader;
		jsTreeReady = true;
	}

	async function waitForContainer(maxTries = 5) {
		let tries = 0;
		while (!treeContainer && tries < maxTries) {
			tries += 1;
			await tick();
		}
	}

	function handleFetchClick() {
		const id = get(selectedVersionId);
		if (!id) return;
		void loadFileTree(id);
	}

	async function refreshFilteredTree() {
		const id = get(selectedVersionId);
		if (!id) return;
		const base = treeCache[cacheKey(id)];
		if (!base) return;

		destroyTree();
		clearPreview();
		treeData = applyFilter(base);
		await tick();
		await ensureJsTree();
		renderTree();
	}

	onDestroy(() => {
		cancelActiveRequest();
		clearPreview();
		destroyTree();
	});

	function beginRequest() {
		cancelActiveRequest();
		fetchController = new AbortController();
		return { requestId: activeRequest, signal: fetchController.signal };
	}

	function cancelActiveRequest() {
		fetchController?.abort();
		fetchController = null;
		activeRequest += 1;
	}

	function deselectTreeSelection() {
		if (!treeContainer || !jsTreeReady) return;
		const instance = jQuery(treeContainer).jstree(true);
		instance?.deselect_all(true);
	}
</script>

<div class="w-full">
	{#if !$selectedVersionId}
		<div class="text-base-content/70 p-6 text-sm">Select a version to load {kindLabel} files.</div>
	{:else if treeLoading}
		<div class="text-base-content/70 flex items-center gap-2 p-6 text-sm">
			<span class="loading loading-spinner loading-sm"></span>
			<span>Downloading {kindLabel} package and building file tree...</span>
		</div>
	{:else if treeError}
		<div class="alert alert-error m-4">
			<span class="text-sm">{treeError}</span>
		</div>
	{:else if treeData.length || baseNodes.length}
		<div class="flex flex-col gap-2 p-3">
			{#if kind === 'server'}
				<div class="flex items-center gap-2 px-1">
					<button
						class="btn btn-sm"
						on:click={handleFetchClick}
						disabled={!$selectedVersionId || treeLoading}
					>
						{#if treeLoading}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						<span>Fetch server data</span>
					</button>
				</div>
			{/if}

			<div class="text-base-content/80 flex flex-wrap items-center gap-4 px-1 text-sm">
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						class="checkbox checkbox-xs"
						bind:checked={hideClassFiles}
						on:change={refreshFilteredTree}
					/>
					<span>Hide .class files</span>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						class="checkbox checkbox-xs"
						bind:checked={hideEmptyFolders}
						on:change={refreshFilteredTree}
					/>
					<span>Hide empty folders</span>
				</label>
			</div>

			<div class="text-base-content/80 flex flex-wrap gap-4 px-1 text-sm">
				<label class="flex items-center gap-2">
					<input
						type="radio"
						name="file-filter-mode"
						class="radio radio-xs"
						value="all"
						bind:group={fileFilterMode}
						on:change={refreshFilteredTree}
					/>
					<span>Show all files</span>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="radio"
						name="file-filter-mode"
						class="radio radio-xs"
						value="png"
						bind:group={fileFilterMode}
						on:change={refreshFilteredTree}
					/>
					<span>Show only PNG files</span>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="radio"
						name="file-filter-mode"
						class="radio radio-xs"
						value="json"
						bind:group={fileFilterMode}
						on:change={refreshFilteredTree}
					/>
					<span>Show only JSON files</span>
				</label>
			</div>

			{#if treeData.length}
				<div class="rounded-box border-base-300 bg-base-200 border p-2">
					<div bind:this={treeContainer}></div>
				</div>
			{:else}
				<div
					class="rounded-box border-base-300 bg-base-200 text-base-content/70 border p-4 text-sm"
				>
					No files match the current filters.
				</div>
			{/if}
		</div>
	{:else if kind === 'server'}
		<div class="flex flex-col gap-3 p-6">
			<div class="flex items-center gap-2">
				<button
					class="btn btn-sm"
					on:click={handleFetchClick}
					disabled={!$selectedVersionId || treeLoading}
				>
					{#if treeLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					<span>Fetch server data</span>
				</button>
				{#if !$selectedVersionId}
					<span class="text-base-content/60 text-xs">Select a version first.</span>
				{/if}
			</div>
			{#if hasAttemptedLoad}
				<div class="text-base-content/70 text-sm">No files found in this server package.</div>
			{:else}
				<div class="text-base-content/70 text-sm">
					Click "Fetch server data" to load server files for this version.
				</div>
			{/if}
		</div>
	{:else}
		<div class="text-base-content/70 p-6 text-sm">No files found in this {kindLabel} package.</div>
	{/if}
</div>

{#if previewPath}
	<div class="modal modal-open">
		<div class="modal-box max-w-4xl">
			<div class="flex items-center justify-between gap-4">
				<div class="text-base-content/70 truncate text-sm">{previewPath}</div>
				<div class="flex items-center gap-2">
					<button
						class="btn btn-sm"
						type="button"
						on:click={downloadPreview}
						disabled={previewDownloading || previewLoading}
					>
						{#if previewDownloading}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						<span>Download</span>
					</button>
					<button class="btn btn-sm btn-ghost" aria-label="Close preview" on:click={closePreview}>
						✕
					</button>
				</div>
			</div>

			<div class="mt-4 min-h-[6rem]">
				{#if previewLoading}
					<div class="text-base-content/70 flex items-center gap-2 text-sm">
						<span class="loading loading-spinner loading-sm"></span>
						<span>Opening file...</span>
					</div>
				{:else if previewError}
					<div class="alert alert-error text-sm">{previewError}</div>
				{:else if previewImageUrl}
					<img
						src={previewImageUrl}
						alt={previewPath}
						class="rounded-box max-h-[70vh] w-full object-contain"
					/>
				{:else}
					<pre
						class="rounded-box border-base-300 bg-base-200 text-base-content/80 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words border p-3 text-xs">{previewContent}</pre>
				{/if}
			</div>

			<div class="modal-action">
				<button class="btn" on:click={closePreview}>Close</button>
			</div>
		</div>
		<div class="modal-backdrop" on:click={closePreview}></div>
	</div>
{/if}
