<script lang="ts">
	import { tick } from 'svelte';
	import hljs from 'highlight.js/lib/common';
	import {
		ensureVersionDetails,
		selectedVersionDetails,
		selectedVersionId
	} from '$lib/stores/versionStore';

	let versionJson = '';
	let versionDataError: string | null = null;
	let versionDataLoading = false;
	let codeBlock: HTMLElement | null = null;
	let activeRequestId = 0;

	$: if (!$selectedVersionId) {
		versionJson = '';
		versionDataError = null;
		versionDataLoading = false;
	}

	$: if ($selectedVersionId) {
		void loadVersionDetails($selectedVersionId);
	}

	$: if ($selectedVersionDetails && $selectedVersionId) {
		versionJson = JSON.stringify($selectedVersionDetails, null, 2);
	}

	$: if (codeBlock && versionJson) {
		tick().then(() => {
			if (codeBlock) {
				hljs.highlightElement(codeBlock);
			}
		});
	}

	async function loadVersionDetails(id: string) {
		const requestId = ++activeRequestId;
		versionDataLoading = true;
		versionDataError = null;
		versionJson = '';

		try {
			const data = await ensureVersionDetails(id);
			if (requestId !== activeRequestId) return;

			versionJson = JSON.stringify(data, null, 2);
		} catch (error) {
			if (requestId !== activeRequestId) return;
			console.error('Failed to fetch version data', error);
			versionDataError = 'Unable to fetch version details right now.';
		} finally {
			if (requestId === activeRequestId) {
				versionDataLoading = false;
			}
		}
	}
</script>

<div class="relative">
	<div class="mockup-code !bg-neutral">
		{#if versionDataLoading}
			<div class="skeleton h-60 rounded-none"></div>
		{:else if versionDataError}
			<div class="alert alert-error m-4">
				<span class="text-sm">{versionDataError}</span>
			</div>
		{:else if versionJson}
			<pre class="!font-mono text-sm leading-relaxed">
				<code class="hljs language-json ml-5 block whitespace-pre-wrap font-mono" bind:this={codeBlock}
					>{versionJson}</code
				>
			</pre>
		{:else}
			<div class="p-6 text-sm text-white">Select a version to view its manifest.</div>
		{/if}
	</div>
</div>

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
