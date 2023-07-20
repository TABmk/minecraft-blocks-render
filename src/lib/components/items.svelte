<script lang="ts">
	import Model3d from './model3d.svelte';

	export let Models: Array;

	let search: string;

	$: handleSearch = () => {
		if (search) {
			return Models.filter((e) => e.name.includes(search));
		}

		return Models;
	};
	let selected = '';

	let setSelected = (el) => {
		selected = el;
	};
</script>

<div class="flex justify-center items-center pt-4">
	<div class="h-96 w-full md:w-2/3 bg-slate-700 rounded-2xl flex">
		<div class="h-96 w-1/4 bg-slate-600 rounded-l-lg">
			<input
				type="text"
				bind:value={search}
				class="w-full h-14 bg-slate-500 rounded-tl-lg outline-none p-4"
				placeholder="Search..."
			/>

			<div class="h-80 overflow-y-auto overflow-x-hidden">
				{#each handleSearch() as mat}
					<div
						class="w-full h-10 outline-none p-2 text-center border-b-2 border-slate-500 cursor-pointer"
						on:click={() => setSelected(mat)}
					>
						{mat.name}
					</div>
				{/each}
			</div>
		</div>
		<div class="h-96 w-3/4 bg-slate-700 rounded-r-lg">
			<Model3d bind:Models bind:selected />
		</div>
	</div>
</div>
