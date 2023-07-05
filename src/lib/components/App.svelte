<script>
	import JSZip from 'jszip';
	import { T, Canvas } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { TextureLoader, NearestFilter, SRGBColorSpace, MeshBasicMaterial } from 'three';
	import { onMount } from 'svelte';

	let versions = [];
	let snapshots = false;
	let currVersion = '';
	let Materials = [];
	let currItem = {};

	let _x = 300;
	let _y = 240;
	let _z = 300;

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

	const handleData = async (file) => {
		const data = await JSZip.loadAsync(file);

		Object.keys(data.files).forEach(async (w) => {
			const modelRE = /(assets\/minecraft\/)?models\/item\/(.+)\.json/;
			if (modelRE.test(w)) {
				const item = Materials.find((e) => e?.material_name === w.match(modelRE)[2].toUpperCase());
				if (item) {
					item.model = JSON.parse(await data.files[w].async('text'));
					Materials = Materials;
				}
			}

			const itemRE = /(assets\/minecraft\/)?textures\/item\/(.+)\.png/;
			if (itemRE.test(w)) {
				const item = Materials.find((e) => e?.material_name === w.match(itemRE)[2].toUpperCase());
				if (item) {
					item.icon = `data:image/png;base64, ${await data.files[w].async('base64')}`;
					item.type = 'item';

					Materials = Materials;
				}
			}

			const blockRE = /(assets\/minecraft\/)?textures\/block\/(.+)\.png/;
			if (blockRE.test(w)) {
				const item = Materials.find((e) => e?.material_name === w.match(blockRE)[2].toUpperCase());
				if (item) {
					item.texture = `data:image/png;base64, ${await data.files[w].async('base64')}`;
					item.threeTexture = new TextureLoader().load(item.texture);
					item.threeTexture.magFilter = NearestFilter;
					item.threeTexture.minFilter = NearestFilter;
					item.threeTexture.colorSpace = SRGBColorSpace;
					item.type = 'block';

					Materials = Materials;
				}
			}
		});
	};

	const handleDL = async (event) => {
		currVersion = versions.filter((e) => e.id === event.target.value)[0];

		const matReq = await fetch(
			`https://jd.papermc.io/paper/${currVersion.id}/org/bukkit/Material.html`
		);
		const mats = await matReq.text();
		let htmlObject = document.createElement('div');
		htmlObject.innerHTML = mats;

		htmlObject.querySelectorAll('.constants-summary .member-name-link').forEach(
			(e) =>
				(Materials = [
					...Materials,
					{
						material_name: e.innerHTML
					}
				])
		);

		const req = await fetch(currVersion.url);
		const data = await req.json();

		const verReq = await fetch(data.downloads.client.url);
		const buf = await verReq.arrayBuffer();

		handleData(buf);
	};

	const handleFileChange = async (event) => {
		const file = event.target.files[0];

		handleData(file);
	};

	const handleItemChoose = async (event) => {
		const item = Materials.find((e) => e?.material_name === event.target.value);
		currItem = item;
	};

	let ctx;

	// setInterval(() => {
	// 	console.log(ctx?.renderer?.domElement?.toDataURL());
	// }, 200);
</script>

<main>
	<input type="file" on:change={handleFileChange} />
	<br />
	Snapshots
	<input type="checkbox" on:change={handleSnapshots} />
	<select on:change={handleDL}>
		<option selected>Select version</option>
		{#each versions.filter((e) => (snapshots ? e : e.type === 'release')) as v}
			<option value={v.id}>{v.id}</option>
		{/each}
	</select>
	<br />
	<select on:change={handleItemChoose}>
		<option selected>Select item</option>
		{#each Materials as mat}
			<option value={mat.material_name}>{mat.material_name}</option>
		{/each}
	</select>

	<br />
	<!-- <input type="number" bind:value={_x} id="" />
	<input type="number" bind:value={_y} id="" />
	<input type="number" bind:value={_z} id="" /> -->

	{#if currItem.material_name}
		<div>
			<span>{currItem.material_name}</span>
			<br />
			Icon: <img src={currItem.icon} alt="" width="64" height="64" />
			{#if currItem.texture}
				Texture: <img src={currItem.texture} alt="" width="64" height="64" />
			{/if}

			{#if currItem.type === 'block'}
				<Canvas
					size={{ width: 512, height: 512 }}
					rendererParameters={{ antialias: true, preserveDrawingBuffer: true }}
					bind:ctx
				>
					<T.OrthographicCamera
						rotation.order="YXZ"
						rotation.y={Math.PI / 4}
						rotation.x={-0.5}
						makeDefault
						position={[300, 240, 300]}
					>
						<!-- <OrbitControls /> -->
					</T.OrthographicCamera>

					<T.Mesh
						rotation={[Math.PI, Math.PI, Math.PI]}
						material={[
							(() => {
								// right
								const mat = new MeshBasicMaterial({ map: currItem.threeTexture });
								mat.color.r /= 2.5;
								mat.color.g /= 2.5;
								mat.color.b /= 2.5;

								return mat;
							})(),
							new MeshBasicMaterial({ map: currItem.threeTexture }),
							new MeshBasicMaterial({ map: currItem.threeTexture }),
							new MeshBasicMaterial({ map: currItem.threeTexture }),
							(() => {
								// left
								const mat = new MeshBasicMaterial({ map: currItem.threeTexture });
								mat.color.r /= 1.25;
								mat.color.g /= 1.25;
								mat.color.b /= 1.25;

								return mat;
							})(),
							new MeshBasicMaterial({ map: currItem.threeTexture })
						]}
					>
						<T.BoxGeometry args={[310, 310, 310]} />
					</T.Mesh>
				</Canvas>
			{/if}
		</div>
	{/if}
</main>

<style>
	main {
		text-align: center;
		margin: 0 auto;
	}

	img {
		image-rendering: optimizeSpeed;
		image-rendering: -moz-crisp-edges;
		image-rendering: -o-crisp-edges;
		image-rendering: -webkit-optimize-contrast;
		image-rendering: pixelated;
		image-rendering: optimize-contrast;
		-ms-interpolation-mode: nearest-neighbor;
	}
</style>
