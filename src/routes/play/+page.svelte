<script lang="ts">
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import CheerpJClient from '$lib/components/CheerpJClient.svelte';
	import type { VersionManifest } from '$lib/stores/versionStore';
	import { selectedVersionId, versions } from '$lib/stores/versionStore';
	import { page } from '$app/stores';

	const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';

	let loading = true;
	let error: string | null = null;
	let versionParam = '';

	onMount(() => {
		const version = get(page).url.searchParams.get('version');
		versionParam = version ?? '';
		loadManifest(versionParam);
	});

	async function loadManifest(versionId: string) {
		loading = true;
		error = null;
		try {
			const response = await fetch(MANIFEST_URL);
			if (!response.ok) {
				throw new Error(`Failed to fetch versions (${response.status})`);
			}
			const manifest: VersionManifest = await response.json();
			versions.set(manifest.versions ?? []);
			if (versionId) {
				selectedVersionId.set(versionId);
			} else {
				error = 'Missing version in query string.';
			}
		} catch (err) {
			console.error('Failed to load manifest for play route', err);
			error = 'Unable to load version manifest.';
			versions.set([]);
			selectedVersionId.set(null);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Play in browser</title>
</svelte:head>

<div class="p-4">
	<div class="mx-auto flex max-w-5xl flex-col gap-4">
		{#if loading}
			<div class="bg-base-300 text-base-content/70 rounded-xl p-6 text-sm">Preparing…</div>
		{:else if error}
			<div class="bg-error/10 border-error text-error rounded-xl border p-6 text-sm">
				{error}
			</div>
		{:else}
			<CheerpJClient autoShow={false} />
		{/if}
	</div>
</div>
