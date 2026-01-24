<script lang="ts">
	import { render } from 'github-buttons';
	import { onMount } from 'svelte';

	let div: HTMLIFrameElement | HTMLSpanElement;

	onMount(() => {
		render(
			{
				href: 'https://github.com/TABmk/minecraft-blocks-render',
				'data-show-count': true,
				'data-text': ' Rate',
				'data-size': 'large'
			},
			function (el) {
				// eslint-disable-next-line
				div.appendChild(el);
			}
		);
	});
</script>

<div class="z-1 fixed left-4 top-4">
	<div bind:this={div}></div>
</div>
