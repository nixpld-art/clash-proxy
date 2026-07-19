/**
 * Clash Proxy — Animated Particle Background
 * Canvas-based floating particles with connecting lines.
 * Performant: uses requestAnimationFrame and capped particle count.
 */
"use strict";

(function () {
	const canvas = document.getElementById("particle-canvas");
	if (!canvas) return;

	const ctx = canvas.getContext("2d");
	let width, height;
	let particles = [];
	let animationId;
	let mouse = { x: null, y: null };

	// --- Configuration ---
	const CONFIG = {
		particleCount: 80,
		particleMinRadius: 1,
		particleMaxRadius: 2.5,
		particleSpeed: 0.3,
		linkDistance: 150,
		linkOpacity: 0.12,
		particleColor: "162, 155, 254",    // --accent-light RGB
		linkColor: "108, 92, 231",          // --accent RGB
		mouseRadius: 200,
		mouseForce: 0.02,
	};

	// --- Resize handler ---
	function resize() {
		width = canvas.width = window.innerWidth;
		height = canvas.height = window.innerHeight;
	}

	// --- Particle class ---
	class Particle {
		constructor() {
			this.x = Math.random() * width;
			this.y = Math.random() * height;
			this.radius = CONFIG.particleMinRadius + Math.random() * (CONFIG.particleMaxRadius - CONFIG.particleMinRadius);
			this.vx = (Math.random() - 0.5) * CONFIG.particleSpeed * 2;
			this.vy = (Math.random() - 0.5) * CONFIG.particleSpeed * 2;
			this.opacity = 0.2 + Math.random() * 0.5;
		}

		update() {
			// Mouse interaction
			if (mouse.x !== null && mouse.y !== null) {
				const dx = this.x - mouse.x;
				const dy = this.y - mouse.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < CONFIG.mouseRadius) {
					const force = (CONFIG.mouseRadius - dist) / CONFIG.mouseRadius * CONFIG.mouseForce;
					this.vx += dx * force;
					this.vy += dy * force;
				}
			}

			// Damping
			this.vx *= 0.99;
			this.vy *= 0.99;

			this.x += this.vx;
			this.y += this.vy;

			// Wrap around edges
			if (this.x < -10) this.x = width + 10;
			if (this.x > width + 10) this.x = -10;
			if (this.y < -10) this.y = height + 10;
			if (this.y > height + 10) this.y = -10;
		}

		draw() {
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(${CONFIG.particleColor}, ${this.opacity})`;
			ctx.fill();
		}
	}

	// --- Initialize particles ---
	function initParticles() {
		particles = [];
		const count = Math.min(CONFIG.particleCount, Math.floor((width * height) / 15000));
		for (let i = 0; i < count; i++) {
			particles.push(new Particle());
		}
	}

	// --- Draw connecting lines ---
	function drawLinks() {
		for (let i = 0; i < particles.length; i++) {
			for (let j = i + 1; j < particles.length; j++) {
				const dx = particles[i].x - particles[j].x;
				const dy = particles[i].y - particles[j].y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < CONFIG.linkDistance) {
					const opacity = (1 - dist / CONFIG.linkDistance) * CONFIG.linkOpacity;
					ctx.beginPath();
					ctx.moveTo(particles[i].x, particles[i].y);
					ctx.lineTo(particles[j].x, particles[j].y);
					ctx.strokeStyle = `rgba(${CONFIG.linkColor}, ${opacity})`;
					ctx.lineWidth = 0.6;
					ctx.stroke();
				}
			}
		}
	}

	// --- Animation loop ---
	function animate() {
		ctx.clearRect(0, 0, width, height);

		particles.forEach((p) => {
			p.update();
			p.draw();
		});

		drawLinks();

		animationId = requestAnimationFrame(animate);
	}

	// --- Mouse tracking ---
	window.addEventListener("mousemove", (e) => {
		mouse.x = e.clientX;
		mouse.y = e.clientY;
	});

	window.addEventListener("mouseleave", () => {
		mouse.x = null;
		mouse.y = null;
	});

	// --- Start ---
	window.addEventListener("resize", () => {
		resize();
		initParticles();
	});

	resize();
	initParticles();
	animate();
})();
