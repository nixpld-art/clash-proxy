import { Socket } from "node:net";
import { lookup } from "node:dns/promises";

const SOCKS_HOST = "127.0.0.1";
const SOCKS_PORT = 40000;
const HANDSHAKE_TIMEOUT = 15000;

const WARP_SUFFIXES = [
	"youtube.com",
	"googlevideo.com",
	"ytimg.com",
	"ggpht.com",
	"googleapis.com",
	"gstatic.com",
	"google.com",
	"googleusercontent.com",
	"googleadservices.com",
	"googlesyndication.com",
	"google-analytics.com",
	"gvt1.com",
	"doubleclick.net",
];

function viaWarp(hostname) {
	const h = String(hostname).toLowerCase();
	return WARP_SUFFIXES.some((s) => h === s || h.endsWith("." + s));
}

class AsyncQueue {
	constructor(max_size) {
		this.max_size = max_size;
		this.queue = [];
		this.put_callbacks = [];
		this.get_callbacks = [];
	}
	put_now(data) {
		this.queue.push(data);
		this.get_callbacks.shift()?.();
	}
	async put(data) {
		if (this.size <= this.max_size) {
			this.put_now(data);
			return;
		}
		await new Promise((resolve) => {
			this.put_callbacks.push(resolve);
		});
		this.put_now(data);
	}
	get_now() {
		this.put_callbacks.shift()?.();
		return this.queue.shift();
	}
	async get() {
		if (this.size > 0) {
			return this.get_now();
		}
		await new Promise((resolve) => {
			this.get_callbacks.push(resolve);
		});
		return this.get_now();
	}
	close() {
		this.queue = [];
		let callback;
		while ((callback = this.get_callbacks.shift())) callback();
		while ((callback = this.put_callbacks.shift())) callback();
	}
	get size() {
		return this.queue.length;
	}
}

export class WarpTCPSocket {
	constructor(hostname, port) {
		this.hostname = hostname;
		this.port = port;
		this.recv_buffer_size = 128;

		this.socket = null;
		this.paused = false;
		this.connected = false;
		this.bytesIn = 0;
		this.bytesOut = 0;
		this.data_queue = new AsyncQueue(this.recv_buffer_size);
		this.handshake_acc = Buffer.alloc(0);
	}

	async connect() {
		if (viaWarp(this.hostname)) {
			return await this.connect_via_warp();
		}
		return await this.connect_direct();
	}

	async connect_direct() {
		const r = await lookup(this.hostname, { all: false, order: "verbatim" });
		const ip = typeof r === "string" ? r : r.address;
		await new Promise((resolve, reject) => {
			this.socket = new Socket();
			this.socket.setKeepAlive(true, 15000);
			this.socket.setNoDelay(true);
			this.socket.on("connect", () => {
				this.connected = true;
				resolve();
			});
			this.socket.on("data", (data) => {
				this.bytesIn += data.length;
				this.data_queue.put(data);
			});
			this.socket.on("close", (hadError) => {
				console.log(`[SOCK-CLOSE] ${this.hostname}:${this.port} via=direct in=${this.bytesIn} hadError=${hadError} local=${!!this.localClosed}`);
				if (hadError && !this.connected) {
					this.data_queue.close();
					reject();
				} else {
					this.data_queue.close();
				}
				this.socket = null;
			});
			this.socket.on("error", (e) => {
				console.log(`[SOCK-ERR] ${this.hostname}:${this.port} via=direct err=${e && e.message} in=${this.bytesIn}`);
			});
			this.socket.on("end", () => {
				console.log(`[SOCK-FIN] ${this.hostname}:${this.port} via=direct in=${this.bytesIn}`);
				if (!this.socket) return;
				this.socket.destroy();
				this.socket = null;
			});
			this.socket.connect({
				host: ip,
				port: this.port,
			});
		});
	}

	async connect_via_warp() {
		await new Promise((resolve, reject) => {
			const sock = new Socket();
			this.socket = sock;
			sock.setNoDelay(true);
			sock.setKeepAlive(true, 15000);
			let done = false;

			const fail = (err) => {
				if (done) return;
				done = true;
				clearTimeout(timer);
				this.connected = false;
				this.data_queue.close();
				sock.destroy();
				this.socket = null;
				reject(err || new Error("warp socks handshake failed"));
			};

			const timer = setTimeout(() => fail(new Error("warp socks handshake timeout")), HANDSHAKE_TIMEOUT);

			sock.on("data", (data) => {
				this.bytesIn += data.length;
				this.data_queue.put(data);
			});
			sock.on("connect", async () => {
				try {
					await this.socks5_handshake(sock);
					if (done) return;
					done = true;
					clearTimeout(timer);
					this.connected = true;
					console.log(`[WARP] ${this.hostname}:${this.port} via socks5`);
					resolve();
				} catch (e) {
					fail(e);
				}
			});
			sock.on("close", () => {
				if (!done) {
					fail(new Error("warp socks closed during handshake"));
					return;
				}
				console.log(`[SOCK-CLOSE] ${this.hostname}:${this.port} via=warp in=${this.bytesIn} local=${!!this.localClosed}`);
				this.data_queue.close();
				this.socket = null;
			});
			sock.on("error", (e) => {
				if (!done) {
					fail(e);
					return;
				}
				console.log(`[SOCK-ERR] ${this.hostname}:${this.port} via=warp err=${e && e.message} in=${this.bytesIn}`);
			});
			sock.on("end", () => {
				console.log(`[SOCK-FIN] ${this.hostname}:${this.port} via=warp in=${this.bytesIn} local=${!!this.localClosed}`);
				if (this.socket) {
					this.socket.destroy();
					this.socket = null;
				}
				this.data_queue.close();
			});

			sock.connect({ host: SOCKS_HOST, port: SOCKS_PORT });
		});
	}

	async hs_read(n) {
		while (this.handshake_acc.length < n) {
			const chunk = await this.data_queue.get();
			if (chunk == null) throw new Error("warp socks closed during handshake");
			this.handshake_acc = Buffer.concat([this.handshake_acc, chunk]);
		}
		const out = this.handshake_acc.subarray(0, n);
		this.handshake_acc = this.handshake_acc.subarray(n);
		return out;
	}

	async socks5_handshake(sock) {
		sock.write(Buffer.from([0x05, 0x01, 0x00]));
		const greet = await this.hs_read(2);
		if (greet[0] !== 0x05 || greet[1] !== 0x00) {
			throw new Error(`socks5 auth rejected (method ${greet[1]})`);
		}
		const host = Buffer.from(String(this.hostname), "utf8");
		if (host.length > 255) throw new Error("hostname too long for socks5");
		const req = Buffer.alloc(7 + host.length);
		req[0] = 0x05;
		req[1] = 0x01;
		req[2] = 0x00;
		req[3] = 0x03;
		req[4] = host.length;
		host.copy(req, 5);
		req.writeUInt16BE(Number(this.port) & 0xffff, 5 + host.length);
		sock.write(req);
		const head = await this.hs_read(4);
		if (head[0] !== 0x05) throw new Error("invalid socks5 reply");
		if (head[1] !== 0x00) throw new Error(`socks5 connect failed: code ${head[1]}`);
		const atyp = head[3];
		if (atyp === 0x01) {
			await this.hs_read(6);
		} else if (atyp === 0x03) {
			const len = (await this.hs_read(1))[0];
			await this.hs_read(len + 2);
		} else if (atyp === 0x04) {
			await this.hs_read(18);
		} else {
			throw new Error(`socks5 bad atyp ${atyp}`);
		}
	}

	async recv() {
		if (this.handshake_acc.length > 0) {
			const out = this.handshake_acc;
			this.handshake_acc = Buffer.alloc(0);
			return out;
		}
		return await this.data_queue.get();
	}

	async send(data) {
		this.bytesOut += (data && data.length) || 0;
		await new Promise((resolve) => {
			if (!this.socket) {
				resolve();
				return;
			}
			this.socket.write(data, resolve);
		});
	}

	async close() {
		this.localClosed = true;
		if (!this.socket) return;
		this.socket.end();
		this.socket = null;
	}

	pause() {
		if (this.data_queue.size >= this.data_queue.max_size && this.socket) {
			this.socket.pause();
			this.paused = true;
		}
	}

	resume() {
		if (!this.socket) return;
		if (this.paused) {
			this.socket.resume();
			this.paused = false;
		}
	}
}
