<script>
	import { CubeTransparentIcon } from 'heroicons-svelte/24/outline';
	import SimpleSpinner3D from './SimpleSpinner3D.svelte';

	const BRICKS_TEXTURE =
		'data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA0UlEQVQ4y42SoQ4CMRBE95cw2BMESQKGD8CAwmDBYgjB4HA4JD/Bb5VMk2kme9texeSafb1NZ3btu1sl6LVdpNtxn36HTREZ+ft6GdUNAHqsh3zhvJznM+sR17qhcBpmWZ/nvZzxA6QcDchQhwzPhgDRAF/WlNW4eb94Vsuz8tzAe6Jf1DUTL3LT0OiLvjUTbUSeG/R4rt0Bt2jOmkuUieYy2oNoB2gv4qaeGZr3q5n4UG1qzlN7YvRYm3NrD8oYI8+9mRhn7KV70OLW49nfIYP+d4RKtAhLyaYAAAAASUVORK5CYII=';
</script>

<div class="flex items-center justify-center">
	<div class="card bg-base-300 w-[176px] items-center py-5 shadow-sm">
		<img src={BRICKS_TEXTURE} alt="Brick texture" class="h-[72px] w-[72px] object-contain" />
	</div>

	<div class="divider divider-horizontal before:w-[1px] after:w-[1px]">
		<CubeTransparentIcon class="w-6 shrink-0" />
	</div>

	<div class="card bg-base-300 flex w-[176px] items-center py-2 shadow-sm">
		<div class="h-24">
			<SimpleSpinner3D texture={BRICKS_TEXTURE} />
		</div>
	</div>
</div>
