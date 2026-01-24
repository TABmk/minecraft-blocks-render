<script lang="ts">
	import { BrickShowcase, ControlsPanel, DownloadBadge, GridPanel, TitleLockup } from '$lib';
	import GithubRate from '$lib/components/GithubRate.svelte';
	import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
</script>

<svelte:head>
	<title>Minecraft Blocks Render</title>
</svelte:head>

<GithubRate />

<ThemeSwitch />

<section class="min-h-screen w-full">
	<div class="mx-auto flex max-w-[1366px] flex-col items-center gap-6 px-6 pb-12 pt-10">
		<DownloadBadge />
		<TitleLockup />
		<BrickShowcase />

		<div class="divider before:opacity-100 after:h-[1px]"></div>

		<div class="flex w-full flex-col gap-6 md:flex-row md:items-start">
			<ControlsPanel />
			<GridPanel />
		</div>
	</div>
</section>

<style>
	section {
		--dot-bg: var(--color-base-200);
		--dot-color: var(--color-base-content);
		--dot-size: 1px;
		--dot-space: 20px;

		position: relative;
		isolation: isolate;

		background:
			linear-gradient(90deg, var(--dot-bg) calc(var(--dot-space) - var(--dot-size)), transparent 1%)
				center / var(--dot-space) var(--dot-space),
			linear-gradient(var(--dot-bg) calc(var(--dot-space) - var(--dot-size)), transparent 1%)
				center / var(--dot-space) var(--dot-space),
			var(--dot-color);
	}
</style>
