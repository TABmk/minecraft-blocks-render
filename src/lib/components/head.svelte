<script>
	import { Canvas, T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { ChevronDown, ChevronRight, Icon } from 'svelte-hero-icons';
	import { NearestFilter, SRGBColorSpace, TextureLoader } from 'three';
	import Spinner3d from './spinner3d.svelte';
	const BRICKS_TEXTURE =
		'data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA0UlEQVQ4y42SoQ4CMRBE95cw2BMESQKGD8CAwmDBYgjB4HA4JD/Bb5VMk2kme9texeSafb1NZ3btu1sl6LVdpNtxn36HTREZ+ft6GdUNAHqsh3zhvJznM+sR17qhcBpmWZ/nvZzxA6QcDchQhwzPhgDRAF/WlNW4eb94Vsuz8tzAe6Jf1DUTL3LT0OiLvjUTbUSeG/R4rt0Bt2jOmkuUieYy2oNoB2gv4qaeGZr3q5n4UG1qzlN7YvRYm3NrD8oYI8+9mRhn7KV70OLW49nfIYP+d4RKtAhLyaYAAAAASUVORK5CYII=';

	let rotation = 0;
	let innerWidth = 0;

	setInterval(() => {
		rotation += 0.01;
	}, 10);
</script>

<svelte:window bind:innerWidth />

<div class="px-4 mx-auto max-w-screen-xl text-center">
	<h1 class="mb-4 text-6xl font-extrabold tracking-tight leading-none">MBR</h1>
	<p class="mb-8 text-lg font-normal text-gray-300 lg:text-xl sm:px-16 lg:px-48">
		Renders 3D-like icon from 2D sprite, now with web UI
	</p>
	<div class="flex flex-col sm:flex-row sm:justify-center items-center">
		<img src={BRICKS_TEXTURE} width="150" height="150" alt="Bricks" class="mt-4 sm:ml-4" />

		<Icon src={innerWidth < 640 ? ChevronDown : ChevronRight} class=" mt-4 sm:ml-4" size="50" />

		<Spinner3d texture={BRICKS_TEXTURE} />
	</div>
</div>
