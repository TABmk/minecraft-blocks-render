<script lang="ts">
	import { goto } from '$app/navigation';
	import Model3D from '$lib/components/Model3D.svelte';
	import { studioModel } from '$lib/stores/studio';

	let exportSignal = 0;

	const handleBack = () => {
		studioModel.clear();
		goto('/');
	};

	const handleExport = () => {
		exportSignal += 1;
	};
</script>

<svelte:head>
	<title>Studio Editor</title>
</svelte:head>

<div class="bg-base-100 text-base-content grid h-screen grid-rows-[auto,1fr] overflow-hidden">
	<header class="bg-base-200/80 border-base-300 z-20 border-b backdrop-blur">
		<div class="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4">
			<div class="flex items-center gap-3">
				<button class="btn btn-sm btn-outline" type="button" on:click={handleBack}>
					← Back
				</button>
				<div class="text-base-content/70 text-xs font-semibold uppercase tracking-widest">
					Studio
				</div>
			</div>
			{#if $studioModel}
				<div class="flex items-center gap-3">
					<div class="text-base-content/70 hidden text-xs sm:block">
						Editing: {$studioModel.name}
					</div>
					<button class="btn btn-sm btn-primary" type="button" on:click={handleExport}>
						Export .glb
					</button>
				</div>
			{:else}
				<div class="text-base-content/60 text-xs">No model selected</div>
			{/if}
		</div>
	</header>

	<main class="flex w-full flex-col gap-6 overflow-hidden px-6 py-4 min-h-0">
		{#if $studioModel}
			<section class="bg-base-200 border-base-300 w-full flex-1 border p-0 shadow-none min-h-0">
				<Model3D
					model={$studioModel?.model}
					modelName={$studioModel?.name ?? null}
					useStudio
					fullHeight
					{exportSignal}
				/>
			</section>
		{:else}
			<section class="bg-base-200 border-base-300 w-full border p-10 text-center shadow-none">
				<h1 class="text-lg font-semibold">Pick a model to edit.</h1>
				<p class="text-base-content/70 mx-auto mt-2 max-w-md text-sm">
					Open any model from the library, then click "Open in editor" to start.
				</p>
				<button class="btn btn-sm btn-outline mt-5" type="button" on:click={handleBack}>
					Return to Library
				</button>
			</section>
		{/if}
	</main>
</div>
