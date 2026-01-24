<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowPathRoundedSquareIcon, HashtagIcon } from 'heroicons-svelte/24/outline';
	import Dropzone from 'svelte-file-dropzone';
	import { selectedVersionId, versions } from '$lib/stores/versionStore';
	import type { VersionEntry, VersionManifest } from '$lib/stores/versionStore';
	import {
		addResourcePack,
		resourcePacks,
		selectedResourcePackId
	} from '$lib/stores/resourcePackStore';

	const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';

	let loadingVersions = true;
	let showSnapshots = false;
	let fetchError: string | null = null;
	let allVersions: VersionEntry[] = [];
	let filteredVersions: VersionEntry[] = [];
	let selectedId = '';
	let selectedPackId = '';
	let packError: string | null = null;
	let packLoading = false;

	const filterVersions = (list: VersionEntry[], includeSnapshots: boolean) =>
		includeSnapshots ? list : list.filter((version) => version.type !== 'snapshot');

	onMount(() => {
		loadVersions();
	});

	async function loadVersions() {
		loadingVersions = true;
		fetchError = null;

		try {
			const response = await fetch(MANIFEST_URL);
			if (!response.ok) {
				throw new Error(`Failed to fetch versions (${response.status})`);
			}

			const manifest: VersionManifest = await response.json();
			allVersions = manifest.versions ?? [];
			filteredVersions = filterVersions(allVersions, showSnapshots);

			const stillAvailable =
				selectedId && filteredVersions.some((version) => version.id === selectedId);
			selectedId = stillAvailable ? selectedId : '';
			versions.set(allVersions);
			selectedVersionId.set(selectedId || null);
		} catch (error) {
			console.error('Failed to fetch version manifest', error);
			fetchError = 'Unable to fetch versions right now.';
			allVersions = [];
			filteredVersions = [];
			selectedId = '';
			selectedVersionId.set(null);
		} finally {
			loadingVersions = false;
		}
	}

	$: filteredVersions = filterVersions(allVersions, showSnapshots);

	$: if (!loadingVersions && !showSnapshots && selectedId) {
		const stillVisible = filteredVersions.some((version) => version.id === selectedId);
		if (!stillVisible) {
			selectedId = '';
		}
	}

	$: selectedVersionId.set(selectedId || null);
	$: selectedPackId = $selectedResourcePackId ?? '';

	const handlePackDrop = async (event: CustomEvent) => {
		const { acceptedFiles, fileRejections } = event.detail ?? {};
		packError = null;
		const file = acceptedFiles?.[0] as File | undefined;
		if (!file) {
			if (fileRejections?.length) {
				packError = 'Only .zip resource packs are supported.';
			}
			return;
		}

		packLoading = true;
		try {
			await addResourcePack(file);
		} catch (error) {
			console.error('Failed to load resource pack', error);
			packError = 'Failed to load resource pack.';
		} finally {
			packLoading = false;
		}
	};

	const handlePackChange = () => {
		selectedResourcePackId.set(selectedPackId || null);
	};

</script>

<div class="flex w-full flex-col gap-4 md:max-w-[260px]">
	<div class="bg-base-300 rounded-2xl shadow-sm">
		<div class="flex flex-col gap-3 p-4">
			<div class="flex flex-row gap-2">
				<HashtagIcon class="text-base-content/70 h-4" />
				<div class="text-base-content/80 text-xs font-semibold">Version</div>
			</div>

			{#if loadingVersions}
				<span class="skeleton skeleton-text h-10 w-full rounded-lg text-sm"
					>fetching versions...</span
				>
			{:else}
				<select
					class="select select-bordered select-sm border-base-300/80 bg-base-200 w-full text-sm"
					bind:value={selectedId}
					aria-label="Select Minecraft version"
				>
					<option value="" disabled>Select version</option>
					{#if filteredVersions.length}
						{#each filteredVersions as version (version.id)}
							<option value={version.id}>{version.id}</option>
						{/each}
					{:else}
						<option value="" disabled>No versions available</option>
					{/if}
				</select>
			{/if}

			{#if fetchError}
				<div class="text-error text-xs">{fetchError}</div>
			{/if}

			<div class="text-base-content/70 mt-1 flex items-center justify-between text-xs">
				<span>Show Snapshots</span>
				<input
					type="checkbox"
					class="toggle toggle-sm toggle-neutral"
					aria-label="Toggle snapshots"
					bind:checked={showSnapshots}
				/>
			</div>

			<Dropzone
				inputElement
				containerClasses="!bg-base-300 cursor-pointer !text-center !text-sm !font-semibold !text-base-content !rounded-2xl !border-[1px] !border-dashed !border-base-content !px-4 !py-5 !tracking-tight"
			>
				or drop .jar here
			</Dropzone>
		</div>
	</div>

	<div class="bg-base-300 rounded-2xl shadow-sm">
		<div class="flex flex-col gap-3 p-4">
			<div class="flex flex-row gap-2">
				<ArrowPathRoundedSquareIcon class="text-base-content/70 h-4" />
				<div class="text-base-content/80 text-xs font-semibold">Resource pack</div>
			</div>

			<select
				class="select select-bordered select-sm border-base-300/80 bg-base-200 w-full text-sm"
				bind:value={selectedPackId}
				on:change={handlePackChange}
				disabled={packLoading}
			>
				<option value="">Default textures</option>
				{#if $resourcePacks.length}
					{#each $resourcePacks as pack (pack.id)}
						<option value={pack.id}>{pack.name}</option>
					{/each}
				{/if}
			</select>
			<Dropzone
				inputElement
				accept=".zip"
				multiple={false}
				on:drop={handlePackDrop}
				disabled={packLoading}
				containerClasses="!bg-base-300 cursor-pointer !text-center !text-sm !font-semibold !text-base-content !rounded-2xl !border-[1px] !border-dashed !border-base-content !px-4 !py-5 !tracking-tight"
			>
				{packLoading ? 'loading pack…' : 'drop .zip here'}
			</Dropzone>
			{#if packError}
				<div class="text-error text-xs">{packError}</div>
			{/if}
		</div>
	</div>
</div>
