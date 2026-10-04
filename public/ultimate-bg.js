/**
 * Clash Proxy — Ultimate Layout: Interactive Monochrome Background
 * High-performance, clean, minimalist interactive wave/matrix field.
 * NOT constellations — no connecting star lines!
 * Fluid ripple physics with cursor interaction.
 */
"use strict";

(function () {
	const canvas = document.getElementById("ultimate-canvas");
	if (!canvas) return;

	const ctx = canvas.getContext("2d");
	let width, height;
	let points = [];
	let animationId = null;
	let running = false;
	let time = 0;

	// Mouse tracking with velocity & click ripples
	const mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000, isOver: false };
	const ripples = []; // expanding click shockwaves

	// Color palette mapping for all 12 presets
	const PALETTES = {
		"monochrome":    { r: 255, g: 255, b: 255, bgR: 200, bgG: 200, bgB: 200 },
		"sky-blue":      { r: 56,  g: 189, b: 248, bgR: 2,   bgG: 132, b: 199 },
		"neon-emerald":  { r: 16,  g: 185, b: 129, bgR: 5,   bgG: 150, b: 105 },
		"crimson-red":   { r: 244, g: 63,  b: 94,  bgR: 225, bgG: 29,  b: 72  },
		"sunset-amber":  { r: 245, g: 158, b: 11,  bgR: 217, bgG: 119, b: 6   },
		"cyber-violet":  { r: 139, g: 92,  b: 246, bgR: 124, bgG: 58,  b: 237 },
		"hot-pink":      { r: 236, g: 72,  b: 153, bgR: 219, bgG: 39,  b: 119 },
		"electric-gold": { r: 234, g: 179, b: 8,   bgR: 202, bgG: 138, b: 4   },
		"deep-sapphire": { r: 59,  g: 130, b: 246, bgR: 29,  bgG: 78,  b: 216 },
		"toxic-lime":    { r: 132, g: 204, b: 22,  bgR: 101, bgG: 163, b: 13  },
		"arctic-cyan":   { r: 6,   g: 182, b: 212, bgR: 8,   bgG: 145, b: 178 },
		"blood-orange":  { r: 249, g: 115, b: 22,  bgR: 234, bgG: 88,  b: 12  }
	};

	let currentColor = PALETTES["monochrome"];

	// Spacing & Grid settings
	const SPACING = 38; // px between points
	const INTERACTION_RADIUS = 160;

	class GridPoint {
		constructor(baseX, baseY) {
			this.baseX = baseX;
			this.baseY = baseY;
			this.x = baseX;
			this.y = baseY;
			this.vx = 0;
			this.vy = 0;
			this.phase = (baseX * 0.008) + (baseY * 0.008);
			this.size = 1.4;
			this.intensity = 0;
		}

		update() {
			// Ambient sinusoidal breathing wave
			const waveX = Math.sin(time * 0.03 + this.phase) * 3;
			const waveY = Math.cos(time * 0.025 + this.phase) * 3;
			const targetX = this.baseX + waveX;
			const targetY = this.baseY + waveY;

			// Mouse displacement interaction
			if (mouse.isOver) {
				const dx = this.x - mouse.x;
				const dy = this.y - mouse.y;
				const distSq = dx * dx + dy * dy;
				const maxDistSq = INTERACTION_RADIUS * INTERACTION_RADIUS;

				if (distSq < maxDistSq && distSq > 0.01) {
					const dist = Math.sqrt(distSq);
					const force = (1 - dist / INTERACTION_RADIUS) * 7.5;
					this.vx += (dx / dist) * force;
					this.vy += (dy / dist) * force;
					this.intensity = Math.min(1, this.intensity + (1 - dist / INTERACTION_RADIUS) * 0.5);
				}
			}

			// Click shockwave interaction
			for (let i = 0; i < ripples.length; i++) {
				const r = ripples[i];
				const rdx = this.x - r.x;
				const rdy = this.y - r.y;
				const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
				const diff = Math.abs(rdist - r.radius);
				if (diff < 40) {
					const rForce = (1 - diff / 40) * (r.strength * 6);
					this.vx += (rdx / (rdist || 1)) * rForce;
					this.vy += (rdy / (rdist || 1)) * rForce;
					this.intensity = Math.min(1, this.intensity + 0.6);
				}
			}

			// Spring return force towards ambient target
			const spring = 0.08;
			const damp = 0.82;
			this.vx += (targetX - this.x) * spring;
			this.vy += (targetY - this.y) * spring;
			this.vx *= damp;
			this.vy *= damp;

			this.x += this.vx;
			this.y += this.vy;

			// Intensity decay
			this.intensity *= 0.94;
		}

		draw() {
			const alpha = 0.12 + (this.intensity * 0.65);
			const radius = this.size + (this.intensity * 1.6);

			ctx.beginPath();
			ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, ${alpha.toFixed(3)})`;
			ctx.fill();

			// Extra minimalist micro-cross on high intensity
			if (this.intensity > 0.35) {
				const crossSize = 2 + (this.intensity * 2.5);
				ctx.beginPath();
				ctx.moveTo(this.x - crossSize, this.y);
				ctx.lineTo(this.x + crossSize, this.y);
				ctx.moveTo(this.x, this.y - crossSize);
				ctx.lineTo(this.x, this.y + crossSize);
				ctx.strokeStyle = `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, ${(this.intensity * 0.5).toFixed(3)})`;
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		}
	}

	function resize() {
		width = canvas.width = window.innerWidth;
		height = canvas.height = window.innerHeight;
		initGrid();
	}

	function initGrid() {
		points = [];
		const cols = Math.ceil(width / SPACING) + 2;
		const rows = Math.ceil(height / SPACING) + 2;
		const offsetX = (width - (cols - 1) * SPACING) / 2;
		const offsetY = (height - (rows - 1) * SPACING) / 2;

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				points.push(new GridPoint(offsetX + c * SPACING, offsetY + r * SPACING));
			}
		}
	}

	function renderStatic() {
		ctx.clearRect(0, 0, width, height);
		points.forEach((p) => {
			ctx.beginPath();
			ctx.arc(p.baseX, p.baseY, 1.4, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, 0.14)`;
			ctx.fill();
		});
	}

	function animate() {
		if (!running) {
			animationId = null;
			return;
		}

		time++;

		// Smooth mouse interpolation
		mouse.x += (mouse.targetX - mouse.x) * 0.25;
		mouse.y += (mouse.targetY - mouse.y) * 0.25;

		// Update & clean click ripples
		for (let i = ripples.length - 1; i >= 0; i--) {
			const r = ripples[i];
			r.radius += 7;
			r.strength *= 0.94;
			if (r.strength < 0.02 || r.radius > Math.max(width, height)) {
				ripples.splice(i, 1);
			}
		}

		ctx.clearRect(0, 0, width, height);

		// Cursor subtle ambient aura
		if (mouse.isOver) {
			const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, INTERACTION_RADIUS * 1.2);
			grad.addColorStop(0, `rgba(${currentColor.r}, ${currentColor.g}, ${currentColor.b}, 0.07)`);
			grad.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, width, height);
		}

		// Update and draw all points — strictly geometric points, NO LINES
		for (let i = 0; i < points.length; i++) {
			points[i].update();
			points[i].draw();
		}

		animationId = requestAnimationFrame(animate);
	}

	// --- Global control API ---
	window.clashSetUltimateBg = function (active) {
		const isBarebones = document.documentElement.classList.contains("barebones-mode");
		if (active && !isBarebones) {
			canvas.classList.remove("hidden");
			if (!running) {
				running = true;
				animate();
			}
		} else {
			running = false;
			if (animationId) {
				cancelAnimationFrame(animationId);
				animationId = null;
			}
			if (active && isBarebones) {
				canvas.classList.remove("hidden");
				renderStatic(); // 0% CPU static render for Barebones
			} else {
				canvas.classList.add("hidden");
				ctx.clearRect(0, 0, width, height);
			}
		}
	};

	window.clashSetUltimateColor = function (colorKey) {
		if (PALETTES[colorKey]) {
			currentColor = PALETTES[colorKey];
			if (document.documentElement.classList.contains("barebones-mode")) {
				renderStatic();
			}
		}
	};

	// --- Event Listeners ---
	window.addEventListener("mousemove", (e) => {
		mouse.targetX = e.clientX;
		mouse.targetY = e.clientY;
		mouse.isOver = true;
	});

	window.addEventListener("mouseleave", () => {
		mouse.isOver = false;
		mouse.targetX = -1000;
		mouse.targetY = -1000;
	});

	window.addEventListener("click", (e) => {
		if (!running) return;
		ripples.push({
			x: e.clientX,
			y: e.clientY,
			radius: 10,
			strength: 1.0
		});
	});

	window.addEventListener("resize", () => {
		resize();
		if (!running && document.documentElement.classList.contains("barebones-mode") && document.documentElement.classList.contains("ultimate-layout")) {
			renderStatic();
		}
	});

	// Initial check
	resize();
	try {
		const savedColor = localStorage.getItem("clash_ultimate_color") || "monochrome";
		if (PALETTES[savedColor]) currentColor = PALETTES[savedColor];
		const isUltimate = localStorage.getItem("clash_ultimate_layout") === "true";
		if (isUltimate) {
			window.clashSetUltimateBg(true);
		}
	} catch (e) {}
})();
