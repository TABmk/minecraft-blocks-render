<script lang="ts">
	import Dropzone from 'svelte-file-dropzone/Dropzone.svelte';
	import { Icon, QuestionMarkCircle } from 'svelte-hero-icons';
	import type { handleDataType } from './types';

	export let handleData: handleDataType;

	const handleFileChange = async (event: Event) => {
		console.log(event.detail.acceptedFiles);
		const et = event.target as HTMLInputElement;

		if (event?.detail?.acceptedFiles?.length) {
			const file = event.detail.acceptedFiles[0];

			handleData(file);
		} else {
			alert('No files');
		}
	};

	const showTooltip = () => {
		document.getElementById('tooltip1')?.classList.remove('hidden');
	};
	const hideTooltip = (event: Event) => {
		const tooltip = document.getElementById('tooltip1');

		if (
			!tooltip ||
			!(event instanceof MouseEvent) ||
			!tooltip.contains(event.relatedTarget as Node)
		) {
			tooltip?.classList.add('hidden');
		}
	};
</script>

<Dropzone
	inputElement
	on:drop={handleFileChange}
	containerClasses="bg-slate-800 mt-14 lg:max-w-screen-lg mx-auto"
>
	Drop client .JAR here
</Dropzone>

<div class="flex justify-center mt-3">
	<div on:mouseover={showTooltip} on:focus={showTooltip} role="tooltip" class="flex">
		<span class="text-gray-500">How to find .jar</span>
		<div class="cursor-pointer">
			<Icon src={QuestionMarkCircle} class="text-gray-500 ml-1" size="25" />
		</div>
	</div>
	<div
		class="flex justify-center absolute focus:outline-none focus:ring-gray-300 rounded-full focus:ring-offset-2 focus:ring-2 focus:bg-gray-200 md:mt-0"
	>
		<div
			on:mouseout={hideTooltip}
			on:blur={hideTooltip}
			id="tooltip1"
			role="tooltip"
			class="z-20 absolute -mt-72 bg-slate-700 p-4 rounded hidden"
		>
			<p class="text-xm pb-2">
				Also check out official answer <a
					class="text-blue-300"
					target="_blank"
					rel="noopener noreferrer"
					href="https://help.minecraft.net/hc/en-us/articles/4409159214605-Managing-Data-and-Game-Storage-in-Minecraft-Java-Edition-"
					>here</a
				>
			</p>

			<table on:mouseenter={(event) => event.stopPropagation()}>
				<thead class="bg-slate-600 border-b">
					<tr>
						<th scope="col" class="text-sm font-medium px-6 py-4 text-left"> OS </th>
						<th scope="col" class="text-sm font-medium px-6 py-4 text-left"> path </th>
					</tr>
				</thead>
				<tbody>
					<tr class="bg-slate-500 border-b">
						<td class="px-6 py-4 text-sm font-medium">MacOS</td>
						<td class="text-sm font-light px-6 py-4">
							~/Library/Application\ Support/minecraft/versions
						</td>
					</tr>
					<tr class="bg-slate-400 border-b">
						<td class="px-6 py-4 text-sm font-medium">Windows</td>
						<td class="text-sm font-light px-6 py-4"> %AppData%/.minecraft/versions </td>
					</tr>
					<tr class="bg-slate-500 border-b">
						<td class="px-6 py-4 text-sm font-medium">Linux</td>
						<td class="text-sm font-light px-6 py-4"> ~/.minecraft/versions </td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</div>
