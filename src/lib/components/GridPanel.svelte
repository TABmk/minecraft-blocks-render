<script lang="ts">
	import { ChevronDoubleRightIcon, MagnifyingGlassIcon } from 'heroicons-svelte/24/outline';
	import { ChevronDoubleLeftIcon } from 'heroicons-svelte/24/solid';
	import {
		models,
		modelsError,
		modelsLoading,
		modelsPackId,
		modelsVersionId,
		loadModelsForVersion,
		resetModels
	} from '$lib/stores/modelStore';
	import { selectedVersionId } from '$lib/stores/versionStore';
	import { selectedResourcePackId } from '$lib/stores/resourcePackStore';
	import { clearPreviewCache, getModelPreview } from '$lib/models/previewRenderer';
	import FileTreePanel from './FileTreePanel.svelte';
	import CheerpJIframe from './CheerpJIframe.svelte';
	import VersionDataPanel from './VersionDataPanel.svelte';
	import ModelDetailsModal from './ModelDetailsModal.svelte';
	import ItemsPanel from './ItemsPanel.svelte';
	import type { ResolvedModel } from '$lib/models/buildModels';

	const PAGE_SIZE = 20;

	let searchTerm = '';
	let currentPage = 1;
	let selectedModel: ResolvedModel | null = null;
	let modalOpen = false;
	let previewUrls: Record<string, string> = {};
	let previewPending = new Set<string>();
	let previewVersion: string | null = null;
	let lastVersionId: string | null = null;
	let lastPackId: string | null = null;

	$: normalizedQuery = searchTerm.trim().toLowerCase();
	$: filteredModels = $models.filter((model) => model.name.toLowerCase().includes(normalizedQuery));
	$: totalPages = Math.max(1, Math.ceil(filteredModels.length / PAGE_SIZE));
	$: currentPage = Math.min(Math.max(currentPage, 1), totalPages);
	$: pagedModels = filteredModels.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

	$: if ($selectedVersionId) {
		const versionChanged = $selectedVersionId !== lastVersionId;
		const packChanged = $selectedResourcePackId !== lastPackId;
		if (versionChanged || packChanged) {
			if (versionChanged) {
				currentPage = 1;
				searchTerm = '';
				modalOpen = false;
				selectedModel = null;
			}
			lastVersionId = $selectedVersionId;
			lastPackId = $selectedResourcePackId ?? null;
			void loadModelsForVersion($selectedVersionId);
		}
	} else {
		lastVersionId = null;
		lastPackId = null;
		resetModels();
		modalOpen = false;
		selectedModel = null;
	}

	$: if (`${$modelsVersionId ?? ''}|${$modelsPackId ?? ''}` !== previewVersion) {
		previewVersion = `${$modelsVersionId ?? ''}|${$modelsPackId ?? ''}`;
		previewUrls = {};
		previewPending = new Set();
		clearPreviewCache();
	}

	$: if (pagedModels?.length) {
		for (const model of pagedModels) {
			if (!previewUrls[model.name] && !previewPending.has(model.name)) {
				previewPending.add(model.name);
				void getModelPreview(model, 220).then((dataUrl) => {
					previewPending.delete(model.name);
					if (dataUrl) {
						previewUrls = { ...previewUrls, [model.name]: dataUrl };
					}
				});
			}
		}
	}

	function prevPage() {
		if (currentPage > 1) currentPage -= 1;
	}

	function nextPage() {
		if (currentPage < totalPages) currentPage += 1;
	}

	function openModel(model: ResolvedModel) {
		selectedModel = model;
		modalOpen = true;
	}
</script>

<div class="tabs tabs-box bg-base-300 w-full max-w-[1040px] p-4">
	<input type="radio" name="content_tabs" class="tab" aria-label="Models" checked={true} />
	<div class="tab-content bg-base-200">
		<div class="flex flex-1 flex-col gap-4 p-6">
			<div class="flex items-center gap-3">
				<label class="input bg-base-300 w-full border-none">
					<MagnifyingGlassIcon class="text-neutral w-6" />
					<input
						type="search"
						class="w-full"
						placeholder="Search models"
						bind:value={searchTerm}
						on:input={() => (currentPage = 1)}
						disabled={$modelsLoading || !$selectedVersionId}
					/>
				</label>

				<div class="join text-neutral">
					<button
						class="join-item bg-base-300 btn w-12"
						on:click={prevPage}
						disabled={$modelsLoading || currentPage <= 1 || !filteredModels.length}
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
						disabled={$modelsLoading || currentPage >= totalPages || !filteredModels.length}
						aria-label="Next page"
					>
						<ChevronDoubleRightIcon />
					</button>
				</div>
			</div>

			{#if !$selectedVersionId}
				<div class="bg-base-300 text-base-content/80 rounded-xl p-6 text-sm">
					Select a version to load models.
				</div>
			{:else if $modelsLoading}
				<div class="grid auto-rows-[140px] gap-4 md:grid-cols-3 lg:grid-cols-5">
					{#each Array(PAGE_SIZE).fill(0) as _, index (index)}
						<div class="skeleton h-full w-full rounded-xl"></div>
					{/each}
				</div>
			{:else if $modelsError}
				<div class="alert alert-error">
					<span class="text-sm">{$modelsError}</span>
				</div>
			{:else if !filteredModels.length}
				<div class="bg-base-300 text-base-content/80 rounded-xl p-6 text-sm">
					No models found. Try another search.
				</div>
			{:else}
				<div class="grid auto-rows-[140px] gap-4 md:grid-cols-3 lg:grid-cols-5">
					{#each pagedModels as model (model.name)}
						<button
							class="bg-base-300 text-base-content/90 rounded-xl p-3 text-left text-sm font-semibold h-full overflow-hidden flex flex-col"
							type="button"
							on:click={() => openModel(model)}
						>
							<div class="bg-base-200/80 mb-2 flex h-20 items-center justify-center rounded-lg">
								{#if previewUrls[model.name]}
									<img
										src={previewUrls[model.name]}
										alt={model.name}
										class="h-full w-full object-contain [image-rendering:pixelated]"
									/>
								{:else}
									<div class="bg-base-200/70 h-8 w-8 rounded-md"></div>
								{/if}
							</div>
							<div class="truncate">{model.name}</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<ModelDetailsModal bind:open={modalOpen} model={selectedModel} />

	<input type="radio" name="content_tabs" class="tab" aria-label="Items" />
	<div class="tab-content bg-base-200 border-base-300 p-0">
		<ItemsPanel />
	</div>

	<input type="radio" name="content_tabs" class="tab" aria-label="Version data" />
	<div class="tab-content bg-base-200 border-base-300 p-0">
		<VersionDataPanel />
	</div>

	<input type="radio" name="content_tabs" class="tab" aria-label="Play online" />
	<div class="tab-content bg-base-200 border-base-300 p-0">
		<CheerpJIframe />
	</div>

	<input type="radio" name="content_tabs" class="tab" aria-label="Files (client)" />
	<div class="tab-content bg-base-200 border-base-300 p-0">
		<FileTreePanel kind="client" />
	</div>

	<input type="radio" name="content_tabs" class="tab" aria-label="Files (server)" />
	<div class="tab-content bg-base-200 border-base-300 p-0">
		<FileTreePanel kind="server" />
	</div>
</div>
