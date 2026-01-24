<script lang="ts">
	import { setViewportHeightVar } from '$lib/utils';
	setViewportHeightVar();

	let { children } = $props();
</script>

<div class="text-base-content">
	{@render children?.()}
</div>
