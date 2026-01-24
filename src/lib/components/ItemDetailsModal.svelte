<script lang="ts">
	import { tick } from 'svelte';
	import hljs from 'highlight.js/lib/common';
	import type { ResolvedItem } from '$lib/models/buildItems';
	import { getModelPreview } from '$lib/models/previewRenderer';
import { models, modelsPackId, modelsVersionId } from '$lib/stores/modelStore';

	export let open = false;
	export let item: ResolvedItem | null = null;

	let codeBlock: HTMLElement | null = null;
	let modelPreviewUrl: string | null = null;
	let lastPreviewKey: string | null = null;

	$: itemJson = item ? JSON.stringify(item.definition, null, 2) : '';
	$: previewTextureUrl = item?.preview?.textureDataUrl ?? null;
	$: previewIsModel = item?.preview?.type === 'model';

	$: if (open && codeBlock && itemJson) {
		tick().then(() => {
			if (codeBlock) {
				hljs.highlightElement(codeBlock);
			}
		});
	}

	$: if (open && previewIsModel) {
		const modelName = item?.preview?.modelName ?? null;
		const modelEntry = modelName ? $models.find((entry) => entry.name === modelName) ?? null : null;
		const key = modelName
			? `${modelName}|${$modelsVersionId ?? ''}|${$modelsPackId ?? ''}`
			: null;
		if (key && key !== lastPreviewKey) {
			lastPreviewKey = key;
			modelPreviewUrl = null;
			if (modelEntry) {
				void getModelPreview(modelEntry, 420).then((dataUrl) => {
					if (open && lastPreviewKey === key) {
						modelPreviewUrl = dataUrl;
					}
				});
			}
		}
	} else if (!previewIsModel) {
		lastPreviewKey = null;
		modelPreviewUrl = null;
	}

	function closeModal() {
		open = false;
	}
</script>

{#if open}
	<div class="modal modal-open items-start overflow-y-auto py-6">
		<div
			class="modal-box bg-base-200 !max-h-none min-h-[calc(100vh-3rem)] max-w-3xl !overflow-visible"
		>
			<button class="btn btn-sm btn-ghost absolute right-6" type="button" on:click={closeModal}
				>close</button
			>
			<div class="flex items-start justify-between gap-4">
				<div class="grow text-center">
					<h1 class="font-minecraft text-4xl">{item?.name ?? 'Item details'}</h1>
					<p class="text-base-content/60 text-xs">
						Item definitions and preview sourced from the original game files
					</p>
				</div>
			</div>

			<div class="text-base-content/70 mt-6 text-xs font-semibold uppercase tracking-wide">
				Preview
			</div>
			<div class="bg-base-300/60 mt-3 flex h-80 w-full items-center justify-center rounded-2xl">
				{#if previewIsModel}
					{#if modelPreviewUrl}
						<img
							src={modelPreviewUrl}
							alt={item?.name ?? 'Item preview'}
							class="h-full w-full object-contain [image-rendering:pixelated]"
						/>
					{:else if previewTextureUrl}
						<img
							src={previewTextureUrl}
							alt={item?.name ?? 'Item preview'}
							class="h-full w-full object-contain [image-rendering:pixelated]"
						/>
					{:else}
						<div class="text-base-content/60 text-xs">No preview available.</div>
					{/if}
				{:else if previewTextureUrl}
					<img
						src={previewTextureUrl}
						alt={item?.name ?? 'Item preview'}
						class="h-full w-full object-contain [image-rendering:pixelated]"
					/>
				{:else}
					<div class="text-base-content/60 text-xs">No preview available.</div>
				{/if}
			</div>

			<div class="text-base-content/70 mt-6 text-xs font-semibold uppercase tracking-wide">
				Resolved item data
			</div>
			<details class="collapse-arrow bg-base-300 collapse mt-4">
				<summary class="collapse-title text-sm font-semibold">Resolved Item Data</summary>
				<div class="collapse-content">
					<div class="mockup-code !bg-neutral">
						{#if itemJson}
							<pre class="!font-mono text-sm leading-relaxed">
								<code class="hljs language-json ml-5 block whitespace-pre-wrap font-mono" bind:this={codeBlock}
									>{itemJson}
								</code>
							</pre>
						{:else}
							<div class="p-6 text-sm text-white">No item data to display.</div>
						{/if}
					</div>
				</div>
			</details>
		</div>

		<form class="modal-backdrop" method="dialog">
			<button type="button" on:click={closeModal}>close</button>
		</form>
	</div>
{/if}

<style>
	:global(.hljs) {
		background: transparent;
		color: #e2e8f0;
	}

	:global(.hljs-attr) {
		color: #38bdf8;
	}

	:global(.hljs-string) {
		color: #4ade80;
	}

	:global(.hljs-number),
	:global(.hljs-literal) {
		color: #f9a8d4;
	}

	:global(.hljs-keyword),
	:global(.hljs-built_in) {
		color: #facc15;
	}

	:global(.hljs-punctuation),
	:global(.hljs-symbol),
	:global(.hljs-operator) {
		color: #bae6fd;
	}
</style>
