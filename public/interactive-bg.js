/**
 * Aura OS 2.0 — Interactive Kinetic Background
 * High-performance animated cyber constellation with magnetic cursor warp & shockwave ripples.
 */
"use strict";

(function () {
	const canvas = document.createElement("canvas");
	canvas.id = "aura-interactive-canvas";
	canvas.className = "aura-interactive-canvas";
	document.body.prepend(canvas);

	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	let width = 0;
	let height = 0;
	let particles = [];
	let ripples = [];
	let animId = null;
	let isRunning = false;

	// Mouse state with smooth trailing
	const mouse = {
		x: -1000,
		y: -1000,
		targetX: -1000,
		targetY: -1000,
		isOver: false
	};

	// Configuration
	const CONFIG = {
		particleCount: 95,
		maxDistance: 130,
		mouseRadius: 180,
		mouseForce: 0.08,
		colors: [
			{ r: 0,   g: 242, b: 254 }, // Cyan #00f2fe
			{ r: 99,  g: 102, b: 241 }, // Indigo #6366f1
			{ r: 168, g: 85,  b: 247 }, // Violet #a855f7
			{ r: 56,  g: 189, b: 248 }  // Sky #38bdf8
		]
	};

	function resize() {
		width = canvas.width = window.innerWidth;
		height = canvas.height = window.innerHeight;
		initParticles();
	}

	class Particle {
		constructor() {
			this.reset(true);
		}

		reset(randomPosition = false) {
			this.x = randomPosition ? Math.random() * (width || window.innerWidth) : (Math.random() < 0.5 ? -10 : (width || window.innerWidth) + 10);
			this.y = randomPosition ? Math.random() * (height || window.innerHeight) : Math.random() * (height || window.innerHeight);
			this.vx = (Math.random() - 0.5) * 0.7;
			this.vy = (Math.random() - 0.5) * 0.7;
			this.radius = 1.2 + Math.random() * 1.8;
			this.baseRadius = this.radius;
			this.color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
			this.alpha = 0.25 + Math.random() * 0.5;
			this.pulsePhase = Math.random() * Math.PI * 2;
		}

		update() {
			this.pulsePhase += 0.02;

			// Ambient movement
			this.x += this.vx;
			this.y += this.vy;

			// Cursor interaction (gentle repulsion & orbital swirl)
			if (mouse.isOver) {
				const dx = mouse.x - this.x;
				const dy = mouse.y - this.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < CONFIG.mouseRadius && dist > 1) {
					const force = (1 - dist / CONFIG.mouseRadius) * CONFIG.mouseForce;
					// Repel
					this.vx -= (dx / dist) * force * 1.6;
					this.vy -= (dy / dist) * force * 1.6;
					// Subtle tangent swirl
					this.vx += (-dy / dist) * force * 0.5;
					this.vy += (dx / dist) * force * 0.5;
				}
			}

			// Shockwave ripples
			for (let i = 0; i < ripples.length; i++) {
				const r = ripples[i];
				const rdx = this.x - r.x;
				const rdy = this.y - r.y;
				const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
				const diff = Math.abs(rdist - r.radius);
				if (diff < 35) {
					const rForce = (1 - diff / 35) * r.strength * 4;
					this.vx += (rdx / (rdist || 1)) * rForce;
					this.vy += (rdy / (rdist || 1)) * rForce;
				}
			}

			// Velocity damping
			this.vx *= 0.985;
			this.vy *= 0.985;

			// Screen edge wrapping
			if (this.x < -30) this.x = width + 30;
			if (this.x > width + 30) this.x = -30;
			if (this.y < -30) this.y = height + 30;
			if (this.y > height + 30) this.y = -30;
		}

		draw() {
			const pulse = Math.sin(this.pulsePhase) * 0.3;
			const currentRadius = Math.max(0.8, this.baseRadius + pulse);
			const currentAlpha = Math.min(1, Math.max(0.1, this.alpha + pulse * 0.2));

			ctx.beginPath();
			ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${currentAlpha})`;
			ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.5)`;
			ctx.shadowBlur = 6;
			ctx.fill();
			ctx.shadowBlur = 0;
		}
	}

	function initParticles() {
		particles = [];
		const count = Math.min(CONFIG.particleCount, Math.floor((width * height) / 14000));
		for (let i = 0; i < count; i++) {
			particles.push(new Particle());
		}
	}

	// Shockwave ring class
	class Shockwave {
		constructor(x, y) {
			this.x = x;
			this.y = y;
			this.radius = 5;
			this.maxRadius = Math.min(width, height) * 0.45;
			this.strength = 1.0;
			this.alpha = 0.6;
		}

		update() {
			this.radius += 7;
			this.strength *= 0.96;
			this.alpha *= 0.95;
		}

		draw() {
			if (this.alpha <= 0.01) return;
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
			ctx.strokeStyle = `rgba(0, 242, 254, ${this.alpha * 0.4})`;
			ctx.lineWidth = 2;
			ctx.stroke();
		}
	}

	function render() {
		if (!isRunning) return;

		// Smooth mouse position trailing
		mouse.x += (mouse.targetX - mouse.x) * 0.15;
		mouse.y += (mouse.targetY - mouse.y) * 0.15;

		ctx.clearRect(0, 0, width, height);

		// Update and draw shockwaves
		for (let i = ripples.length - 1; i >= 0; i--) {
			const r = ripples[i];
			r.update();
			r.draw();
			if (r.alpha <= 0.02 || r.radius > r.maxRadius) {
				ripples.splice(i, 1);
			}
		}

		// Update particles
		for (let i = 0; i < particles.length; i++) {
			particles[i].update();
			particles[i].draw();
		}

		// Draw connecting proximity lines
		const maxDistSq = CONFIG.maxDistance * CONFIG.maxDistance;
		for (let i = 0; i < particles.length; i++) {
			const p1 = particles[i];
			for (let j = i + 1; j < particles.length; j++) {
				const p2 = particles[j];
				const dx = p1.x - p2.x;
				const dy = p1.y - p2.y;
				const distSq = dx * dx + dy * dy;

				if (distSq < maxDistSq) {
					const dist = Math.sqrt(distSq);
					const alpha = (1 - dist / CONFIG.maxDistance) * 0.14;
					ctx.beginPath();
					ctx.moveTo(p1.x, p1.y);
					ctx.lineTo(p2.x, p2.y);
					ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
					ctx.lineWidth = 1;
					ctx.stroke();
				}
			}

			// Proximity line to mouse
			if (mouse.isOver) {
				const mdx = p1.x - mouse.x;
				const mdy = p1.y - mouse.y;
				const mDistSq = mdx * mdx + mdy * mdy;
				const mMaxDistSq = (CONFIG.mouseRadius * 0.9) * (CONFIG.mouseRadius * 0.9);
				if (mDistSq < mMaxDistSq) {
					const mDist = Math.sqrt(mDistSq);
					const mAlpha = (1 - mDist / (CONFIG.mouseRadius * 0.9)) * 0.28;
					ctx.beginPath();
					ctx.moveTo(p1.x, p1.y);
					ctx.lineTo(mouse.x, mouse.y);
					ctx.strokeStyle = `rgba(0, 242, 254, ${mAlpha})`;
					ctx.lineWidth = 1.2;
					ctx.stroke();
				}
			}
		}

		animId = requestAnimationFrame(render);
	}

	function start() {
		if (isRunning) return;
		// Check performance settings
		if (localStorage.getItem("aura_perf_staticbg") === "true") {
			canvas.style.display = "none";
			return;
		}
		canvas.style.display = "block";
		isRunning = true;
		animId = requestAnimationFrame(render);
	}

	function stop() {
		isRunning = false;
		if (animId) {
			cancelAnimationFrame(animId);
			animId = null;
		}
	}

	// Mouse listeners
	window.addEventListener("pointermove", (e) => {
		mouse.targetX = e.clientX;
		mouse.targetY = e.clientY;
		mouse.isOver = true;
	}, { passive: true });

	window.addEventListener("pointerleave", () => {
		mouse.isOver = false;
		mouse.targetX = -1000;
		mouse.targetY = -1000;
	});

	window.addEventListener("pointerdown", (e) => {
		if (ripples.length < 5) {
			ripples.push(new Shockwave(e.clientX, e.clientY));
		}
	}, { passive: true });

	// Resize & visibility
	window.addEventListener("resize", () => {
		resize();
	}, { passive: true });

	document.addEventListener("visibilitychange", () => {
		if (document.hidden) stop();
		else start();
	});

	// Global trigger to reload background if user toggles performance settings
	window.updateAuraBackgroundState = function () {
		if (localStorage.getItem("aura_perf_staticbg") === "true") {
			stop();
			canvas.style.display = "none";
		} else {
			canvas.style.display = "block";
			start();
		}
	};

	// Initialize
	resize();
	start();
})();
