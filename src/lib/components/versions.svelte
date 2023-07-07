<script lang="ts">
	import type { VersionType } from './types';

	export let handler: any;
	export let text: string;
	export let items: Array<VersionType>;
	export let itemValue: keyof VersionType = 'id';
	export let itemText: keyof VersionType = 'id';
</script>

<div class="flex justify-center items-center pt-3">
	<select
		on:change={handler}
		class="w-full
    md:w-1/3
    bg-gray-50
    border
    border-gray-300
    text-gray-900
    text-sm
    rounded-lg
    focus:ring-blue-500
    focus:border-blue-500
    p-2.5
    dark:bg-gray-700
    dark:border-gray-600
    dark:placeholder-gray-400
    dark:text-white
    dark:focus:ring-blue-500
    dark:focus:border-blue-500"
	>
		<option selected>{text}</option>
		{#each items as v}
			<option value={v[itemValue]}>{v[itemText]}</option>
		{/each}
	</select>
</div>
