<script lang="ts">
	import { ChevronDoubleRightIcon, MagnifyingGlassIcon } from 'heroicons-svelte/24/outline';
	import { ChevronDoubleLeftIcon } from 'heroicons-svelte/24/solid';
	import {
		items,
		itemsError,
		itemsLoading,
		itemsPackId,
		itemsVersionId,
		loadItemsForVersion,
		resetItems
	} from '$lib/stores/itemStore';
	import { models } from '$lib/stores/modelStore';
	import { selectedVersionId } from '$lib/stores/versionStore';
	import { selectedResourcePackId } from '$lib/stores/resourcePackStore';
	import { clearPreviewCache, getModelPreview } from '$lib/models/previewRenderer';
	import ItemDetailsModal from './ItemDetailsModal.svelte';
	import type { ResolvedItem } from '$lib/models/buildItems';

	const PAGE_SIZE = 20;

	let searchTerm = '';
	let currentPage = 1;
	let selectedItem: ResolvedItem | null = null;
	let modalOpen = false;
	let previewUrls: Record<string, string> = {};
	let previewPending = new Set<string>();
	let previewVersion: string | null = null;
	let lastVersionId: string | null = null;
	let lastPackId: string | null = null;
	let modelMap = new Map<string, any>();

	$: normalizedQuery = searchTerm.trim().toLowerCase();
	$: filteredItems = $items.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
	$: totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
	$: currentPage = Math.min(Math.max(currentPage, 1), totalPages);
	$: pagedItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

	$: if ($selectedVersionId) {
		const versionChanged = $selectedVersionId !== lastVersionId;
		const packChanged = $selectedResourcePackId !== lastPackId;
		if (versionChanged || packChanged) {
			if (versionChanged) {
				currentPage = 1;
				searchTerm = '';
				modalOpen = false;
				selectedItem = null;
			}
			lastVersionId = $selectedVersionId;
			lastPackId = $selectedResourcePackId ?? null;
			void loadItemsForVersion($selectedVersionId);
		}
	} else {
		lastVersionId = null;
		lastPackId = null;
		resetItems();
		modalOpen = false;
		selectedItem = null;
	}

	$: if (`${$itemsVersionId ?? ''}|${$itemsPackId ?? ''}` !== previewVersion) {
		previewVersion = `${$itemsVersionId ?? ''}|${$itemsPackId ?? ''}`;
		previewUrls = {};
		previewPending = new Set();
		clearPreviewCache();
	}

	$: modelMap = new Map($models.map((model) => [model.name, model]));

	$: if (pagedItems?.length) {
		for (const item of pagedItems) {
			if (item.preview.type !== 'model') continue;
			if (!item.preview.modelName) continue;
			if (previewUrls[item.name] || previewPending.has(item.name)) continue;
			const modelEntry = modelMap.get(item.preview.modelName);
			if (!modelEntry) continue;
			previewPending.add(item.name);
			void getModelPreview(modelEntry, 220).then((dataUrl) => {
				previewPending.delete(item.name);
				if (dataUrl) {
					previewUrls = { ...previewUrls, [item.name]: dataUrl };
				}
			});
		}
	}

	function prevPage() {
		if (currentPage > 1) currentPage -= 1;
	}

	function nextPage() {
		if (currentPage < totalPages) currentPage += 1;
	}

	function openItem(item: ResolvedItem) {
		selectedItem = item;
		modalOpen = true;
	}
</script>

<div class="flex flex-1 flex-col gap-4 p-6">
	<div class="flex items-center gap-3">
		<label class="input bg-base-300 w-full border-none">
			<MagnifyingGlassIcon class="text-neutral w-6" />
			<input
				type="search"
				class="w-full"
				placeholder="Search items"
				bind:value={searchTerm}
				on:input={() => (currentPage = 1)}
				disabled={$itemsLoading || !$selectedVersionId}
			/>
		</label>

		<div class="join text-neutral">
			<button
				class="join-item bg-base-300 btn w-12"
				on:click={prevPage}
				disabled={$itemsLoading || currentPage <= 1 || !filteredItems.length}
				aria-label="Previous page"
			>
				<ChevronDoubleLeftIcon />
			</button>
			<button class="join-item bg-base-300 btn text-neutral/70" disabled={true}>
				{currentPage}/{totalPages}
			</button>
			<button
				class="join-item bg-base-300 btn w-12"
				on:click={nextPage}
				disabled={$itemsLoading || currentPage >= totalPages || !filteredItems.length}
				aria-label="Next page"
			>
				<ChevronDoubleRightIcon />
			</button>
		</div>
	</div>

	{#if !$selectedVersionId}
		<div class="bg-base-300 text-base-content/80 rounded-xl p-6 text-sm">
			Select a version to load items.
		</div>
	{:else if $itemsLoading}
		<div class="grid auto-rows-[140px] gap-4 md:grid-cols-3 lg:grid-cols-5">
			{#each Array(PAGE_SIZE).fill(0) as _, index (index)}
				<div class="skeleton h-full w-full rounded-xl"></div>
			{/each}
		</div>
	{:else if $itemsError}
		<div class="alert alert-error">
			<span class="text-sm">{$itemsError}</span>
		</div>
	{:else if !filteredItems.length}
		<div class="bg-base-300 text-base-content/80 rounded-xl p-6 text-sm">
			No items found. Try another search.
		</div>
	{:else}
		<div class="grid auto-rows-[140px] gap-4 md:grid-cols-3 lg:grid-cols-5">
			{#each pagedItems as item (item.name)}
				<button
					class="bg-base-300 text-base-content/90 rounded-xl p-3 text-left text-sm font-semibold h-full overflow-hidden flex flex-col"
					type="button"
					on:click={() => openItem(item)}
				>
					<div class="bg-base-200/80 mb-2 flex h-20 items-center justify-center rounded-lg">
						{#if item.preview.type === 'model'}
							{#if previewUrls[item.name]}
								<img
									src={previewUrls[item.name]}
									alt={item.name}
									class="h-full w-full object-contain [image-rendering:pixelated]"
								/>
							{:else if item.preview.textureDataUrl}
								<img
									src={item.preview.textureDataUrl}
									alt={item.name}
									class="h-full w-full object-contain [image-rendering:pixelated]"
								/>
							{:else}
								<div class="bg-base-200/70 h-8 w-8 rounded-md"></div>
							{/if}
						{:else if item.preview.textureDataUrl}
							<img
								src={item.preview.textureDataUrl}
								alt={item.name}
								class="h-full w-full object-contain [image-rendering:pixelated]"
							/>
						{:else}
							<div class="bg-base-200/70 h-8 w-8 rounded-md"></div>
						{/if}
					</div>
					<div class="truncate">{item.name}</div>
				</button>
			{/each}
		</div>
	{/if}

	<ItemDetailsModal bind:open={modalOpen} item={selectedItem} />
</div>
