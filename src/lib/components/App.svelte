<script lang="ts">
	import JSZip from 'jszip';
	import { TextureLoader, NearestFilter, SRGBColorSpace } from 'three';
	import { onMount } from 'svelte';
	import { Icon, Sparkles, Cube, Stop, ArrowPath } from 'svelte-hero-icons';
	import Head from './head.svelte';
	import Drop from './drop.svelte';
	import Checkbox from './checkbox.svelte';
	import Versions from './versions.svelte';
	import Items from './items.svelte';
	import type { MaterialType, VersionType, handleDataType } from './types';

	/*
  Language: 
    version json ->
    assetIndex ->
    https://piston-meta.mojang.com/v1/packages/... ->
    https://resources.download.minecraft.net/3b/3b5615996abcd10488d247db7fd7fb1e16ff5de7
  */

	let versions: Array<VersionType> = [];
	let snapshots = false;
	let materialsLoad = false;
	let verSelected = false;
	let currVersion: VersionType;
	let Materials: Array<MaterialType> = [];

	let Models = [];

	let currItem = {};

	const handleSnapshots = () => {
		snapshots = !snapshots;
	};

	const updateVersions = async () => {
		const req = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
		const vers = await req.json();

		versions = vers.versions;
	};

	onMount(() => {
		updateVersions();
	});

	const handleData: handleDataType = async (file) => {
		verSelected = true;
		materialsLoad = false;
		Models = [];

		const data = await JSZip.loadAsync(file);

		const updMaterial = (regexp: RegExp, w: string, cb: Function) => {
			if (regexp.test(w)) {
				const match = w.match(regexp);
				if (match) {
					// const item = Materials.find((e) => e?.material_name === match[2].toUpperCase());
					// if (item) {
					cb(match[2]);
					// }
				}
			}
		};

		Object.keys(data.files).forEach(async (w) => {
			updMaterial(/(assets\/minecraft\/)?models\/block\/(.+)\.json/, w, async (item) => {
				const text = JSON.parse(await data.files[w].async('text'));

				Models = [
					...Models,
					{
						model: text,
						name: item
					}
				];
			});

			// updMaterial(
			// 	/(assets\/minecraft\/)?textures\/item\/(.+)\.png/,
			// 	w,
			// 	async (item: MaterialType) => {
			// 		item.icon = `data:image/png;base64, ${await data.files[w].async('base64')}`;
			// 		item.type = 'item';

			// 		Materials = [...Materials];
			// 	}
			// );

			// updMaterial(
			// 	/(assets\/minecraft\/)?textures\/block\/(.+)\.png/,
			// 	w,
			// 	async (item: MaterialType) => {
			// 		item.texture = `data:image/png;base64, ${await data.files[w].async('base64')}`;
			// 		item.threeTexture = new TextureLoader().load(item.texture);
			// 		item.threeTexture.magFilter = NearestFilter;
			// 		item.threeTexture.minFilter = NearestFilter;
			// 		item.threeTexture.colorSpace = SRGBColorSpace;
			// 		item.type = 'block';

			// 		Materials = [...Materials];
			// 	}
			// );
		});
	};

	const handleDL = async (event: Event) => {
		Materials = [];

		const et = event.target as HTMLInputElement;

		currVersion = versions.filter((e) => e.id === et?.value)[0];

		verSelected = true;
		materialsLoad = true;

		// const matReq = await fetch(
		// 	`https://jd.papermc.io/paper/${currVersion.id}/org/bukkit/Material.html`
		// );
		// const mats = await matReq.text();
		// let htmlObject = document.createElement('div');
		// htmlObject.innerHTML = mats;

		// htmlObject.querySelectorAll('.constants-summary .member-name-link').forEach(
		// 	(e) =>
		// 		(Materials = [
		// 			...Materials,
		// 			{
		// 				material_name: e.innerHTML
		// 			}
		// 		])
		// );

		const req = await fetch(currVersion.url);
		const data = await req.json();

		const verReq = await fetch(data.downloads.client.url);
		const buf = await verReq.arrayBuffer();

		materialsLoad = false;

		handleData(buf);
	};

	// const handleItemChoose = async (event) => {
	// 	const item = Materials.find((e) => e?.material_name === event.target.value);
	// 	currItem = item;
	// };

	// let ctx;

	// setInterval(() => {
	// 	console.log(ctx?.renderer?.domElement?.toDataURL());
	// }, 200);
</script>

<main class="bg-center bg-no-repeat bg-blend-multiply my-20">
	<Head />
	<div class="px-4 mx-auto max-w-screen-xl text-center">
		<h1 class="mt-10 text-4xl font-extrabold tracking-tight leading-none md:text-5xl lg:text-6xl">
			Try it
		</h1>
		<div class="flex justify-center">
			<Icon src={Stop} size="50" />
			<Icon src={Sparkles} size="50" />
			<Icon src={Cube} size="50" />
		</div>

		<Drop {handleData} />

		<h1 class="py-4 mb-3 text-3xl font-extrabold tracking-tight leading-none">
			Or select official client
		</h1>

		{#if !versions.length}
			<p class="py-4 mb-3 text-2xl flex items-center flex-col">
				Loading versions...
				<Icon src={ArrowPath} class="animate-spin" size="30" />
			</p>
		{:else}
			<Checkbox handler={handleSnapshots} text="Snapshots" />
			<Versions
				handler={handleDL}
				text="Select version"
				itemValue="id"
				itemText="id"
				items={versions.filter((e) => (snapshots ? e : e.type === 'release'))}
			/>
		{/if}

		{#if verSelected}
			{#if materialsLoad}
				<p class="py-4 mb-3 text-2xl flex items-center flex-col">
					Loading client...
					<Icon src={ArrowPath} class="animate-spin" size="30" />
				</p>
			{:else}
				<Items bind:Models />
			{/if}
		{/if}
	</div>
</main>
