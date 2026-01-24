var r = await fetch('/static_base_path/lwjgl/libraries/liblwjgl.so');
var buf = await r.arrayBuffer();
export default {
	wasmModule: buf
};
