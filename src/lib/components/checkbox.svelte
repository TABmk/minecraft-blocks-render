<script lang="ts">
	export let handler: any;
	export let text: string;
</script>

<label class="items-center relative w-max cursor-pointer">
	<span class="text-lg font-bold mr-3">{text}</span>
	<input
		type="checkbox"
		on:change={handler}
		class="appearance-none
      outline-none
      transition-colors
      cursor-pointer
      w-12
      h-5
    bg-red-500"
	/>
	<span
		class="w-5
    h-5
    scale-125
    right-7
    absolute
    transform
    transition-transform
  bg-gray-200"
	/>
</label>

<style>
	input:checked {
		background-color: #22c55e;
	}

	input:checked ~ span:last-child {
		--tw-translate-x: 1.75rem;
	}
</style>
