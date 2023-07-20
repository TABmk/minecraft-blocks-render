<script lang="ts">
	import { Canvas, T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';

	export let Models: Array;
	export let selected: string;

	$: modelData = () => {
		if (!selected) {
			return null;
		}

		const getMesh = (el) => {
			console.log('>>>', el);

			if (!el?.model?.elements && el?.model?.parent) {
				return getMesh(
					Models.find(
						(e) => e.name === el?.model?.parent?.replace('minecraft:', '')?.replace('block/', '')
					)
				);
			}

			return el?.model;
		};

		const mesh = getMesh(selected);

		console.log(mesh);

		return mesh || null;
	};
</script>

<Canvas size={{ width: 300, height: 300 }}>
	<T.PerspectiveCamera makeDefault position={[0, 10, 30]}>
		<OrbitControls autoRotate enableZoom={false} />
	</T.PerspectiveCamera>
	{#if modelData()}
		{#if modelData().elements}
			{#each modelData().elements as el}
				<T.Mesh position.y={el.from[1] + (el.to[1] - el.from[1]) / 2 - 7}>
					<T.BoxGeometry
						args={[el.from[0] - el.to[0], el.from[1] - el.to[1], el.from[2] - el.to[2]]}
					/>

					<T.MeshBasicMaterial
						color={'#' + ((Math.random() * 0xffffff) << 0).toString(16).padStart(6, '0')}
					/>
				</T.Mesh>
			{/each}
		{/if}
	{/if}
	<!-- <T.Mesh rotation.y={rotation}>
		<T.BoxGeometry args={[1, 1, 1]} />
		<T.MeshBasicMaterial
			map={new TextureLoader().load(texture, (t) => {
				t.magFilter = NearestFilter;
				t.minFilter = NearestFilter;
				t.colorSpace = SRGBColorSpace;
			})}
		/>
	</T.Mesh> -->
</Canvas>
