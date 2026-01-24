var r = await fetch('/minecraft-blocks-render/lwjgl/libraries/liblwjgl.so');
var buf = await r.arrayBuffer();
export default {
	wasmModule: buf
};
