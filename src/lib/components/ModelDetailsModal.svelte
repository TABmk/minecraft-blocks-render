<script lang="ts">
	import { tick } from 'svelte';
	import hljs from 'highlight.js/lib/common';
	import type { ResolvedModel } from '$lib/models/buildModels';
	import Model3D from '$lib/components/Model3D.svelte';
	import { studioModel } from '$lib/stores/studio';
	import { goto } from '$app/navigation';

	export let open = false;
	export let model: ResolvedModel | null = null;

	let codeBlock: HTMLElement | null = null;
	let exportSignal = 0;
	let textureSeed = 0;
	let lastModelName: string | null = null;

	$: modelJson = model ? JSON.stringify(model, null, 2) : '';
	$: textures = model?.usedTextures ?? [];
	$: if (model?.name && model.name !== lastModelName) {
		lastModelName = model.name;
		textureSeed += 1;
	}

	$: if (open && codeBlock && modelJson) {
		tick().then(() => {
			if (codeBlock) {
				hljs.highlightElement(codeBlock);
			}
		});
	}

	const getFilename = (path: string) => {
		const parts = path.split('/');
		return parts[parts.length - 1] ?? path;
	};

	const getFolder = (path: string) => {
		const normalized = path.replace(/^assets\/minecraft\//, '');
		const parts = normalized.split('/');
		parts.pop();
		return parts.join('/');
	};

	const escapeHtml = (value: string) =>
		value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');

	const openTexturePreview = (event: MouseEvent, previewSrc: string | null, label: string) => {
		event.preventDefault();
		event.stopPropagation();

		if (typeof window === 'undefined' || !previewSrc) return;

		const newWindow = window.open('', '_blank');
		if (!newWindow) return;

		const safeLabel = escapeHtml(label);
		newWindow.document.open();
		newWindow.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeLabel}</title>
<style>
	body {
		margin: 0;
		min-height: 100vh;
		background: #0f172a;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	img {
		image-rendering: optimizeSpeed;
		image-rendering: -moz-crisp-edges;
		image-rendering: -o-crisp-edges;
		image-rendering: -webkit-optimize-contrast;
		image-rendering: pixelated;
		image-rendering: optimize-contrast;
		-ms-interpolation-mode: nearest-neighbor;
		max-width: 100vw;
		max-height: 100vh;
		object-fit: contain;
	}
</style>
</head>
<body>
<img src="${previewSrc}" alt="${safeLabel}" />
</body>
</html>`);
		newWindow.document.close();
	};

	function closeModal() {
		open = false;
	}

	const handleOpenEditor = async () => {
		if (!model) return;
		studioModel.set(model);
		await goto('./editor');
	};
</script>

{#if open}
	<div class="modal modal-open items-start overflow-y-auto py-6">
		<div
			class="modal-box bg-base-200 !max-h-none min-h-[calc(100vh-3rem)] max-w-4xl !overflow-visible"
		>
			<button class="btn btn-sm btn-ghost absolute right-6" type="button" on:click={closeModal}
				>close</button
			>
			<div class="flex items-start justify-between gap-4">
				<div class="grow text-center">
					<h1 class="font-minecraft text-4xl">{model?.name ?? 'Model details'}</h1>
					<p class="text-base-content/60 text-xs">
						Detailed model information sourced from the original game files
					</p>
				</div>
			</div>

			<div class="mt-10 grid gap-2 sm:grid-cols-2">
				<button
					class="btn btn-sm btn-outline w-full"
					type="button"
					on:click={handleOpenEditor}
					disabled={!model}
				>
					Open in editor
				</button>
				<button
					class="btn btn-sm btn-outline w-full"
					type="button"
					on:click={() => {
						exportSignal += 1;
					}}
					disabled={!model}
				>
					Export .glb
				</button>
			</div>

			<div class="text-base-content/70 mt-6 text-xs font-semibold uppercase tracking-wide">
				Preview
			</div>
			{#if model}
				<div class="mt-3 h-96 w-full">
					<Model3D
						model={model?.model}
						modelName={model?.name ?? null}
						preset="interactive"
						{textureSeed}
						{exportSignal}
					/>
				</div>
			{:else}
				<div class="bg-base-300/60 text-base-content/60 mt-3 rounded-xl p-4 text-xs">
					No model selected.
				</div>
			{/if}

			<div class="text-base-content/70 mt-4 text-xs font-semibold uppercase tracking-wide">
				Textures
			</div>
			{#if textures.length}
				<div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{#each textures as texture (texture.path)}
						<button
							type="button"
							class="bg-base-300/80 hover:bg-base-300 cursor-pointer rounded-xl p-3 text-left transition"
							on:click={(event) => openTexturePreview(event, texture.dataUrl, texture.path)}
						>
							<div class="flex items-center gap-3">
								<div class="bg-base-200 h-12 w-12 overflow-hidden rounded-lg">
									{#if texture.dataUrl}
										<img
											src={texture.dataUrl}
											alt={texture.path}
											class="h-full w-full object-contain [image-rendering:pixelated]"
										/>
									{:else}
										<div class="bg-base-200/80 h-full w-full"></div>
									{/if}
								</div>
								<div class="min-w-0">
									<div class="text-base-content/90 truncate text-sm font-semibold">
										{getFilename(texture.path)}
									</div>
									<div class="text-base-content/60 truncate text-xs">
										{getFolder(texture.path)}
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{:else}
				<div class="bg-base-300/60 text-base-content/60 mt-4 rounded-xl p-4 text-xs">
					No textures listed for this model.
				</div>
			{/if}

			<div class="text-base-content/70 mt-6 text-xs font-semibold uppercase tracking-wide">
				Resolved model data
			</div>
			<details class="collapse-arrow bg-base-300 collapse mt-4">
				<summary class="collapse-title text-sm font-semibold">Resolved Model Data</summary>
				<div class="collapse-content">
					<div class="mockup-code !bg-neutral">
						{#if modelJson}
							<pre class="!font-mono text-sm leading-relaxed">
								<code class="hljs language-json ml-5 block whitespace-pre-wrap font-mono" bind:this={codeBlock}
									>{modelJson}
								</code>
							</pre>
						{:else}
							<div class="p-6 text-sm text-white">No model data to display.</div>
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
		color: #a5b4fc;
	}
</style>
