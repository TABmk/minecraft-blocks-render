<script lang="ts">
	import { selectedVersionId } from '$lib/stores/versionStore';

	let iframeSrc = '';
	let lastVersion: string | null = null;
	let nonce = 0;

	$: {
		const id = $selectedVersionId;
		if (id && id !== lastVersion) {
			lastVersion = id;
			nonce += 1;
			iframeSrc = `./play?version=${encodeURIComponent(id)}&n=${nonce}`;
		} else if (!id) {
			iframeSrc = '';
			lastVersion = null;
		}
	}
</script>

{#if iframeSrc}
	<iframe
		key={`${nonce}-${lastVersion}`}
		title="Minecraft in browser (CheerpJ)"
		src={iframeSrc}
		class="h-[680px] w-full"
		referrerpolicy="no-referrer"
		loading="lazy"
	></iframe>
{:else}
	<div class="text-base-content/70 p-6 text-sm">
		Select a version in the left panel to launch the in-browser client.
	</div>
{/if}
