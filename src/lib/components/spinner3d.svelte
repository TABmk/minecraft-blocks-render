<script lang="ts">
	import { Canvas, T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { NearestFilter, SRGBColorSpace, TextureLoader } from 'three';

	export let texture: string;
</script>

<Canvas size={{ width: 200, height: 200 }}>
	<T.PerspectiveCamera makeDefault position={[1, 1.5, 1]}>
		<OrbitControls autoRotate enableZoom={false} />
	</T.PerspectiveCamera>
	<T.Mesh>
		<T.BoxGeometry args={[1, 1, 1]} />
		<T.MeshBasicMaterial
			map={new TextureLoader().load(texture, (t) => {
				t.magFilter = NearestFilter;
				t.minFilter = NearestFilter;
				t.colorSpace = SRGBColorSpace;
			})}
		/>
	</T.Mesh>
</Canvas>
