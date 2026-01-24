<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { ensureVersionDetails, selectedVersionId } from '$lib/stores/versionStore';
	import '$lib/css/play.css';

	type VersionDetails = {
		mainClass?: string;
		type?: string;
		minecraftArguments?: string;
		arguments?: { game?: VersionArg[] };
		assets?: string;
		assetIndex?: { id?: string; url?: string };
		downloads?: { client?: { url?: string } };
		libraries?: Array<{
			name?: string;
			downloads?: { artifact?: { path?: string; url?: string; size?: number } };
		}>;
	};

	type VersionArg =
		| string
		| {
				value?: string | string[];
				rules?: Array<{ action?: 'allow' | 'disallow'; os?: { name?: string; version?: string } }>;
		  };

	let launching = false;
	let cheerpJReady = false;
	let displayHost: HTMLDivElement | null = null;
	let progressEl: HTMLProgressElement | null = null;
	let showProgress = false;
	let downloadProgress: { received: number; total: number | null } | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let lastVersionId: string | null = null;
	let cheerpJInitPromise: Promise<void> | null = null;
	export let autoShow = false;
	let showGame = autoShow;
	let launchAbortController: AbortController | null = null;

	$: if ($selectedVersionId && $selectedVersionId !== lastVersionId) {
		terminateCheerpJ();
		launching = false;
		showProgress = false;
		downloadProgress = null;
		lastVersionId = $selectedVersionId;
		cheerpJReady = false;
	}

	const pathJarMinecraft = '/files/client.jar';
	const libsRoot = '/files';
	const PRELOAD_RESOURCES: Record<string, number[]> = {
		'/lt/8/jre/lib/rt.jar': [
			0, 131072, 1310720, 1572864, 4456448, 4849664, 5111808, 5505024, 7995392, 8126464, 9699328,
			9830400, 9961472, 11534336, 11665408, 12189696, 12320768, 12582912, 13238272, 13369344,
			15073280, 15335424, 15466496, 15597568, 15990784, 16121856, 16252928, 16384000, 16777216,
			16908288, 17039360, 17563648, 17694720, 17825792, 17956864, 18087936, 18219008, 18612224,
			18743296, 18874368, 19005440, 19136512, 19398656, 19791872, 20054016, 20709376, 20840448,
			21757952, 21889024, 26869760
		],
		'/lt/etc/users': [0, 131072],
		'/lt/etc/localtime': [],
		'/lt/8/jre/lib/cheerpj-awt.jar': [0, 131072],
		'/lt/8/lib/ext/meta-index': [0, 131072],
		'/lt/8/lib/ext': [],
		'/lt/8/lib/ext/index.list': [],
		'/lt/8/lib/ext/localedata.jar': [],
		'/lt/8/jre/lib/jsse.jar': [0, 131072, 786432, 917504],
		'/lt/8/jre/lib/jce.jar': [0, 131072],
		'/lt/8/jre/lib/charsets.jar': [0, 131072, 1703936, 1835008],
		'/lt/8/jre/lib/resources.jar': [0, 131072, 917504, 1179648],
		'/lt/8/jre/lib/javaws.jar': [0, 131072, 1441792, 1703936],
		'/lt/8/lib/ext/sunjce_provider.jar': [],
		'/lt/8/lib/security/java.security': [0, 131072],
		'/lt/8/jre/lib/meta-index': [0, 131072],
		'/lt/8/jre/lib': [],
		'/lt/8/lib/accessibility.properties': [],
		'/lt/8/lib/fonts/LucidaSansRegular.ttf': [],
		'/lt/8/lib/currency.data': [0, 131072],
		'/lt/8/lib/currency.properties': [],
		'/lt/libraries/libGLESv2.so.1': [0, 262144],
		'/lt/libraries/libEGL.so.1': [0, 262144],
		'/lt/8/lib/fonts/badfonts.txt': [],
		'/lt/8/lib/fonts': [],
		'/lt/etc/hosts': [],
		'/lt/etc/resolv.conf': [0, 131072],
		'/lt/8/lib/fonts/fallback': [],
		'/lt/fc/fonts/fonts.conf': [0, 131072],
		'/lt/fc/ttf': [],
		'/lt/fc/cache/e21edda6a7db77f35ca341e0c3cb2a22-le32d8.cache-7': [0, 131072],
		'/lt/fc/ttf/LiberationSans-Regular.ttf': [0, 131072, 262144, 393216],
		'/lt/8/lib/jaxp.properties': [],
		'/lt/etc/timezone': [],
		'/lt/8/lib/tzdb.dat': [0, 131072]
	};

	declare global {
		interface Window {
			cheerpjInit?: (options?: Record<string, unknown>) => Promise<unknown>;
			cheerpjRunMain?: (
				mainClass: string,
				classpath: string,
				...args: string[]
			) => Promise<unknown>;
			cheerpjCreateDisplay?: (
				width: number,
				height: number,
				host?: HTMLElement | null
			) => Promise<unknown>;
			cheerpOSOpen?: (fds: number[], path: string, mode: string, cb: (fd: number) => void) => void;
			cheerpOSWrite?: (
				fds: number[],
				fd: number,
				bytes: Uint8Array,
				offset: number,
				length: number,
				cb: (written: number) => void
			) => void;
			cheerpOSClose?: (fds: number[], fd: number, cb: () => void) => void;
			cheerpOSCreateDir?: (path: string, fileRef: unknown, mode: number, cb: () => void) => void;
		}
	}

	onMount(() => {
		setupResizeSync();
		if (autoShow) {
			showGame = true;
		}
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		terminateCheerpJ();
	});

	function revealGame() {
		showGame = true;
		setupResizeSync();
	}

	async function launchClient() {
		const id = $selectedVersionId;
		if (!id || launching) return;

		cancelActiveLaunch();
		const abortController = new AbortController();
		launchAbortController = abortController;

		if (id !== lastVersionId) {
			terminateCheerpJ();
			cheerpJReady = false;
			lastVersionId = id;
		}

		launching = true;
		showProgress = false;
		downloadProgress = null;

		try {
			const details = (await ensureVersionDetails(id)) as VersionDetails;
			const downloadUrl = details?.downloads?.client?.url;
			if (!downloadUrl) {
				throw new Error('Client download URL not found in manifest.');
			}

			const mainClass = details?.mainClass || 'net.minecraft.client.main.Main';

			await startCheerpJ();
			const libPaths = await downloadLibraries(details, abortController.signal);
			const clientPath = await downloadFileToCheerpJ(
				downloadUrl,
				pathJarMinecraft,
				true,
				details.downloads?.client?.sha1,
				abortController.signal
			);
			const allPaths = [...libPaths, clientPath].map(normalizeClasspathEntry);
			const classpath = allPaths.join(':');

			const args = buildLaunchArgs(details, id);
			await window.cheerpjRunMain?.(mainClass, classpath, ...args);
		} catch (err) {
			if (isAbortError(err)) return;
			console.error('Failed to launch client via CheerpJ', err);
			showProgress = false;
		} finally {
			launching = false;
			launchAbortController = null;
		}
	}

	function cancelActiveLaunch() {
		launchAbortController?.abort();
		launchAbortController = null;
	}

	function isAbortError(err: unknown) {
		return err instanceof DOMException && err.name === 'AbortError';
	}

	async function downloadLibraries(details: VersionDetails, signal: AbortSignal) {
		const libs = details.libraries ?? [];
		const paths: string[] = [];
		for (const lib of libs) {
			const artifact = lib.downloads?.artifact;
			if (!artifact?.url || !artifact?.path) continue;
			const dest = `${libsRoot}/${artifact.path}`;
			await downloadFileToCheerpJ(artifact.url, dest, false, artifact.sha1, signal);
			paths.push(dest);
		}
		return paths;
	}

	async function downloadFileToCheerpJ(
		url: string,
		virtualName = pathJarMinecraft,
		trackProgress = true,
		expectedSha1?: string,
		signal?: AbortSignal
	) {
		const bytes = await fetchBinary(url, trackProgress, signal);
		if (expectedSha1) {
			const actual = await sha1Hex(bytes);
			if (actual !== expectedSha1) {
				throw new Error(
					`Hash mismatch for ${virtualName}: expected ${expectedSha1}, got ${actual}`
				);
			}
		}
		await writeBytesToCheerpJ(bytes, virtualName);
		return virtualName;
	}

	async function fetchBinary(url: string, trackProgress = true, signal?: AbortSignal) {
		if (!window.cheerpOSOpen || !window.cheerpOSWrite || !window.cheerpOSClose) {
			throw new Error('CheerpJ filesystem APIs not available.');
		}

		const response = await fetch(url, { signal });
		if (!response.ok || !response.body) {
			throw new Error(`Failed to download (${response.status})`);
		}

		const total = Number(response.headers.get('Content-Length')) || null;
		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let received = 0;
		if (trackProgress) {
			showProgress = true;
			if (progressEl) {
				progressEl.value = 0;
				progressEl.max = total ?? 1;
			}
		}

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (value) {
					chunks.push(value);
					received += value.length;
					if (trackProgress) {
						downloadProgress = { received, total };
						if (progressEl) {
							progressEl.value = received;
							progressEl.max = total ?? received;
						}
					}
				}
			}
		} finally {
			if (trackProgress) {
				showProgress = false;
				downloadProgress = null;
			}
		}

		const combined = new Uint8Array(received);
		let offset = 0;
		for (const chunk of chunks) {
			combined.set(chunk, offset);
			offset += chunk.length;
		}

		return combined;
	}

	async function sha1Hex(bytes: Uint8Array) {
		const digest = await crypto.subtle.digest('SHA-1', bytes);
		const view = new DataView(digest);
		let hex = '';
		for (let i = 0; i < view.byteLength; i++) {
			const b = view.getUint8(i);
			hex += b.toString(16).padStart(2, '0');
		}
		return hex;
	}

	async function ensureDirectories(filePath: string) {
		if (!window.cheerpOSCreateDir) return;
		const segments = filePath.split('/').filter(Boolean);
		let current = '';
		for (let i = 0; i < segments.length - 1; i++) {
			current += `/${segments[i]}`;
			await new Promise<void>((resolve) => {
				window.cheerpOSCreateDir?.(current, {}, 0o777, () => resolve());
			});
		}
	}

	async function writeBytesToCheerpJ(bytes: Uint8Array, virtualName: string) {
		if (!window.cheerpOSOpen || !window.cheerpOSWrite || !window.cheerpOSClose) {
			throw new Error('CheerpJ filesystem APIs not available.');
		}

		await ensureDirectories(virtualName);

		await new Promise<void>((resolve) => {
			const fds: number[] = [];
			window.cheerpOSOpen?.(fds, virtualName, 'w', (fd) => {
				window.cheerpOSWrite?.(fds, fd, bytes, 0, bytes.length, () => {
					window.cheerpOSClose?.(fds, fd, () => resolve());
				});
			});
		});
	}

	async function startCheerpJ() {
		if (!cheerpJInitPromise) {
			if ((window as Record<string, unknown>).cj3Module) {
				cheerpJInitPromise = Promise.resolve();
			} else {
				cheerpJInitPromise = window
					.cheerpjInit({
						version: 8,
						enableX11: true,
						javaProperties: ['java.library.path=/app/static_base_path/lwjgl/libraries/'],
						libraries: { 'libGL.so.1': '/app/static_base_path/lwjgl/libraries/gl4es.wasm' },
						preloadResources: PRELOAD_RESOURCES
					})
					.catch((err) => {
						if (err instanceof Error && err.message.includes('Already initialized')) {
							return;
						}
						throw err;
					});
			}
		}

		await cheerpJInitPromise;

		await window.cheerpjCreateDisplay(-1, -1, displayHost);
		cheerpJReady = true;
		setupResizeSync();
	}

	function setupResizeSync() {
		if (!displayHost) return;
		applyNormalSize();
		resizeObserver?.disconnect();
		resizeObserver = new ResizeObserver(() => {
			applyNormalSize();
		});
		resizeObserver.observe(displayHost);
	}

	function getGameCanvas() {
		if (!displayHost) return null;
		return (
			displayHost.querySelector<HTMLElement>('div.cjWindow div div div canvas:last-of-type') ??
			displayHost.querySelector<HTMLElement>('div.cjWindow canvas:last-of-type') ??
			displayHost.querySelector<HTMLElement>('#cheerpjDisplay')
		);
	}

	const normalizeClasspathEntry = (path: string) =>
		path.startsWith('filesystem:') ? path : `filesystem:${path}`;

	function buildLaunchArgs(details: VersionDetails, versionId: string | null) {
		const replacements: Record<string, string> = {
			auth_player_name: 'Player',
			auth_session: 'no_session',
			auth_access_token: '',
			auth_xuid: '',
			auth_uuid: '00000000-0000-0000-0000-000000000000',
			user_properties: '{}',
			user_type: 'legacy',
			version_name: versionId ?? 'offline',
			version_type: details.type ?? 'release',
			game_directory: '/files',
			game_assets: '/files/assets',
			assets_root: '/files/assets',
			assets_index_name: details.assetIndex?.id ?? details.assets ?? 'legacy',
			resolution_width: '854',
			resolution_height: '480'
		};

		const replaceTokens = (token: string) =>
			token.replace(/\$\{([^}]+)\}/g, (_, key) => replacements[key] ?? '');

		if (details.minecraftArguments) {
			return details.minecraftArguments.split(/\s+/).map(replaceTokens).filter(Boolean);
		}

		const gameArgs = details.arguments?.game;
		if (!gameArgs) return [];

		const args: string[] = [];
		for (const entry of gameArgs) {
			if (typeof entry === 'string') {
				args.push(replaceTokens(entry));
				continue;
			}

			if (entry?.rules && entry.rules.length > 0) {
				continue;
			}

			const values = entry?.value;
			if (!values) continue;

			const chosenValues = typeof values === 'string' ? [values] : values;
			for (const v of chosenValues) {
				const replaced = replaceTokens(v);
				if (replaced) args.push(replaced);
			}
		}

		return args;
	}

	function applyNormalSize() {
		if (!displayHost) return;
		const rect = displayHost.getBoundingClientRect();
		const display = displayHost.querySelector<HTMLElement>('#cheerpjDisplay');
		const win = displayHost.querySelector<HTMLElement>('.cjWindow');
		if (rect && display) {
			display.style.position = 'relative';
			display.style.width = `${rect.width}px`;
			display.style.height = `${rect.height}px`;
			display.style.left = '0';
			display.style.top = '0';
		}
		if (rect && win) {
			win.style.left = '0px';
			win.style.top = '0px';
			win.style.width = `${rect.width}px`;
			win.style.height = `${rect.height}px`;
		}
		const canvas = getGameCanvas();
		if (canvas && rect) {
			canvas.style.width = '100%';
			canvas.style.height = '100%';
		}
	}

	function terminateCheerpJ() {
		cancelActiveLaunch();
		document.querySelectorAll('#cheerpjDisplay').forEach((el) => el.remove());
		if (displayHost) {
			displayHost.innerHTML = '';
		}
		cheerpJReady = false;
	}
</script>

<div class="flex h-full flex-col gap-4 rounded-2xl p-4">
	{#if showGame}
		<button
			class="btn btn-secondary w-full"
			on:click={launchClient}
			disabled={!$selectedVersionId || launching}
		>
			{#if launching}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
			<span>
				{cheerpJReady
					? $selectedVersionId
						? `Now playing ${$selectedVersionId}`
						: 'Now playing'
					: $selectedVersionId
						? `Load & play ${$selectedVersionId}`
						: 'Load & play'}
			</span>
		</button>

		<progress
			bind:this={progressEl}
			class:hidden={!showProgress}
			class="progress w-full"
			value={downloadProgress?.received ?? 0}
			max={downloadProgress?.total ?? 1}
		></progress>

		<div class="game-container">
			<div
				bind:this={displayHost}
				class="display relative {!cheerpJReady ? 'skeleton h-96 w-full' : ''}"
			></div>
		</div>
	{:else}
		<div class="prose prose-sm text-base-content max-w-none">
			<p>
				This product is not affiliated with Minecraft; all rights and trademarks belong to Mojang.
				The project is just for educational purpose.
			</p>
			<p>
				It works only with disabled CORS. For example, you can use this extension
				<a
					href="https://chromewebstore.google.com/detail/cors-unblock/hadoojkfknbjgoppkecpgamiajljiief"
					target="_blank"
					rel="noreferrer"
				>
					CORS Unblock
				</a>
				. But do not forget to turn it off after using.
			</p>
			<p>
				This feature is in beta and works only with some versions. Versions between a1.0.4 and 1.5.2
				should work.
			</p>
			<p>
				It is powered by
				<a href="https://cheerpj.com/" target="_blank" rel="noreferrer">CheerpJ</a>
				and some libs taken from the
				<a href="https://github.com/leaningtech/browsercraft" target="_blank" rel="noreferrer">
					browsercraft demo
				</a>
				, check it out.
			</p>
			<p>
				This feature may be buggy. You can check console for more info. Feel free to make a pull
				request (<a
					href="https://github.com/TABmk/minecraft-blocks-render/pulls"
					target="_blank"
					rel="noreferrer">link</a
				>) if you know how to add support for any version.
			</p>
			<p>
				By clicking the play button below you agree to use it only for educational purpose and
				accept the
				<a href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">Minecraft EULA</a
				>.
			</p>
		</div>

		<button class="btn btn-primary w-full" on:click={revealGame}>Play</button>
	{/if}
</div>
