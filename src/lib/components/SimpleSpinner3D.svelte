<script lang="ts">
	import { Canvas, T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { NearestFilter, SRGBColorSpace, TextureLoader, NoToneMapping } from 'three';

	export let texture: string;
</script>

<Canvas colorSpace={SRGBColorSpace} toneMapping={NoToneMapping}>
	<T.PerspectiveCamera makeDefault position={[1, 1.5, 1]}>
		<OrbitControls autoRotate enableZoom={false} />
	</T.PerspectiveCamera>
	<T.Mesh>
		<T.BoxGeometry />
		<T.MeshBasicMaterial
			map={new TextureLoader().load(texture, (t: any) => {
				t.magFilter = NearestFilter;
				t.minFilter = NearestFilter;
				t.colorSpace = SRGBColorSpace;
			})}
		/>
	</T.Mesh>
</Canvas>
