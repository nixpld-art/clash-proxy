import db from "../db.js";
import { extractAuthUser } from "../auth-utils.js";

export const BUILTIN_TWEAKS = [
	{
		id: "tweak-speed-controller",
		name: "Game Speed Engine",
		description: "Scale physics, timer and animation speed from 0.25x to 5.0x",
		is_builtin: true,
		category: "gaming"
	},
	{
		id: "tweak-force-dark",
		name: "Smart Force Dark Mode",
		description: "High-contrast dark theme injection for any website or interface",
		is_builtin: true,
		category: "utility"
	},
	{
		id: "tweak-autoclicker",
		name: "Rapid Auto-Clicker",
		description: "Continuous rapid-fire cursor clicker for clicker and idle games",
		is_builtin: true,
		category: "gaming"
	},
	{
		id: "tweak-fps-hud",
		name: "Live FPS & Performance Monitor",
		description: "Compact in-game frame rate and memory counter overlay",
		is_builtin: true,
		category: "utility"
	}
];

export const PRESET_SCRIPTS = [
	{
		id: "preset-drive-mad",
		name: "Drive Mad Cyber Mod Menu (Fly & Skip Level)",
		match_pattern: "*drivemad*",
		description: "Ultimate Mod Menu: Fly Mode (F), Instant Skip Level (X), Anti-Flip Godmode, 4.5x Hyper Speed & Telemetry.",
		script_code: `// ==UserScript==
// @name         Drive Mad Cyber God Menu (Fly & Skip Level)
// @match        *drivemad*
// ==/UserScript==

(function() {
    // 0. Locate Game Window & Canvas (Works in top window, inside iframes, and in Tampermonkey)
    let gWin = window;
    let gDoc = document;
    let canvas = document.getElementById("canvas") || document.querySelector("canvas");

    if (!canvas || !gWin.Module) {
        const iframes = Array.from(document.querySelectorAll("iframe"));
        for (const ifr of iframes) {
            try {
                const w = ifr.contentWindow;
                const d = ifr.contentDocument || w.document;
                const c = d.getElementById("canvas") || d.querySelector("canvas");
                if (c || (w.Module && w.Module._mouse_updown) || (w.GLFW && w.GLFW.active)) {
                    gWin = w;
                    gDoc = d;
                    canvas = c;
                    break;
                }
            } catch(e) {}
        }
    }

    if (gDoc.getElementById("clash-dm-god-menu")) {
        const existing = gDoc.getElementById("clash-dm-god-menu");
        existing.style.display = existing.style.display === "none" ? "flex" : "none";
        return;
    }

    console.log("🚗 [Clash Tamper] Drive Mad God Menu Active!");

    let currentLevel = 1;

    // ==========================================
    // 1. EMBEDDED CLOCK SPEED ENGINE (STANDALONE HOOK)
    // ==========================================
    let currentSpeedMultiplier = 1.0;
    if (!gWin.__speedHookInstalled) {
        gWin.__speedHookInstalled = true;
        let virtualTime = performance.now();
        let lastRealTime = performance.now();

        const realPerfNow = performance.now.bind(performance);
        performance.now = function() {
            const realNow = realPerfNow();
            const delta = realNow - lastRealTime;
            lastRealTime = realNow;
            virtualTime += delta * currentSpeedMultiplier;
            return virtualTime;
        };

        const realDateNow = Date.now.bind(Date);
        let virtualDate = realDateNow();
        let lastRealDate = realDateNow();
        Date.now = function() {
            const realNow = realDateNow();
            const delta = realNow - lastRealDate;
            lastRealDate = realNow;
            virtualDate += delta * currentSpeedMultiplier;
            return Math.floor(virtualDate);
        };
    }

    function applySpeed(s) {
        currentSpeedMultiplier = Math.max(0.1, Math.min(10.0, s));
        if (typeof gWin.setClashSpeed === "function") {
            try { gWin.setClashSpeed(s); } catch(e) {}
        }
        gWin.__clashSpeed = s;

        const valEl = gDoc.getElementById("dm-speed-val");
        const slider = gDoc.getElementById("dm-slider");
        if (valEl) valEl.textContent = s.toFixed(2) + "x";
        if (slider) slider.value = s;
    }

    // ==========================================
    // 2. DISMISS PREVIEW DIALOG AUTOMATICALLY
    // ==========================================
    function dismissCard() {
        const c = canvas || gDoc.getElementById("canvas") || gDoc.querySelector("canvas");
        if (!c) return;
        const rect = c.getBoundingClientRect();
        const x = rect.left + rect.width * 0.52;
        const y = rect.top + rect.height * 0.77;

        if (gWin.Module && typeof gWin.Module._mouse_updown === "function") {
            try {
                gWin.Module._mouse_updown(0, x, y, 1);
                setTimeout(() => {
                    if (gWin.Module && gWin.Module._mouse_updown) {
                        gWin.Module._mouse_updown(0, x, y, 0);
                    }
                }, 30);
            } catch(e) {}
        }
    }

    // ==========================================
    // 3. SAFE HARDWARE-LEVEL GLFW INPUT ENGINE
    // ==========================================
    function sendKey(keyCode, isDown) {
        try {
            if (gWin.GLFW && typeof gWin.GLFW.onKeyChanged === "function") {
                gWin.GLFW.onKeyChanged(keyCode, isDown ? 1 : 0);
            }
        } catch(e) {}
    }

    function setDrive(dir, isDown) {
        const c = canvas || gDoc.getElementById("canvas") || gDoc.querySelector("canvas");
        const r = c ? c.getBoundingClientRect() : { left: 0, top: 0, width: 1280, height: 720 };

        if (dir === 1) { // GAS / FORWARD
            if (gWin.Module && typeof gWin.Module._mouse_updown === "function") {
                gWin.Module._mouse_updown(0, r.left + r.width * 0.75, r.top + r.height * 0.5, isDown ? 1 : 0);
            }
            sendKey(39, isDown); // ArrowRight
            sendKey(68, isDown); // D
            sendKey(88, isDown); // X
            if (!isDown) {
                sendKey(37, false);
                sendKey(65, false);
                sendKey(90, false);
            }
        } else if (dir === -1) { // BRAKE / REVERSE
            if (gWin.Module && typeof gWin.Module._mouse_updown === "function") {
                gWin.Module._mouse_updown(0, r.left + r.width * 0.25, r.top + r.height * 0.5, isDown ? 1 : 0);
            }
            sendKey(37, isDown); // ArrowLeft
            sendKey(65, isDown); // A
            sendKey(90, isDown); // Z
            if (!isDown) {
                sendKey(39, false);
                sendKey(68, false);
                sendKey(88, false);
            }
        } else { // RELEASE ALL
            if (gWin.Module && typeof gWin.Module._mouse_updown === "function") {
                gWin.Module._mouse_updown(0, 0, 0, 0);
            }
            sendKey(39, false);
            sendKey(68, false);
            sendKey(88, false);
            sendKey(37, false);
            sendKey(65, false);
            sendKey(90, false);
        }
    }

    // ==========================================
    // 4. FLOATING CYBER HUD
    // ==========================================
    const menu = gDoc.createElement("div");
    menu.id = "clash-dm-god-menu";
    menu.style.cssText = "position:fixed!important;top:20px!important;left:20px!important;width:280px!important;background:rgba(10,14,30,0.96)!important;border:2px solid #00f0ff!important;border-radius:14px!important;box-shadow:0 0 30px rgba(0,240,255,0.45),inset 0 0 15px rgba(0,240,255,0.12)!important;color:#ffffff!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace!important;font-size:12px!important;z-index:2147483647!important;backdrop-filter:blur(14px)!important;user-select:none!important;padding:12px!important;display:flex!important;flex-direction:column!important;gap:8px!important;pointer-events:auto!important;";

    menu.innerHTML = \`
        <div id="dm-header" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(0,240,255,0.3);padding-bottom:6px;cursor:move;">
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:15px;color:#00f0ff;">⚡</span>
                <span style="font-weight:900;color:#00f0ff;letter-spacing:0.5px;font-size:12px;">DRIVE MAD GOD MENU</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <span id="dm-fps" style="font-size:10px;color:#00ff88;font-weight:800;font-family:monospace;">60 FPS</span>
                <span id="dm-min" style="cursor:pointer;font-weight:bold;color:#a0aec0;padding:0 4px;" title="Minimize">_</span>
                <span id="dm-close" style="cursor:pointer;font-weight:bold;color:#ff4757;padding:0 4px;" title="Hide (Press H to restore)">&times;</span>
            </div>
        </div>

        <div id="dm-body" style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:6px;">
                <button id="dm-skip-btn" style="flex:1;background:linear-gradient(135deg,#fdcb6e,#e17055);color:#000;border:none;padding:10px 6px;border-radius:8px;cursor:pointer;font-weight:900;font-size:12px;box-shadow:0 0 14px rgba(225,112,85,0.4);transition:0.2s;" title="Instantly skip to the next level">⏭️ Skip Level (N)</button>
                <button id="dm-fly-btn" style="flex:1;background:linear-gradient(135deg,#00f0ff,#0984e3);color:#000;border:none;padding:10px 6px;border-radius:8px;cursor:pointer;font-weight:900;font-size:12px;box-shadow:0 0 14px rgba(0,240,255,0.4);transition:0.2s;" title="Toggle continuous flight hover">🛸 Fly Mode (F)</button>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:7px;padding:5px 8px;">
                <button id="dm-lvl-prev" style="background:#2d3436;color:#fff;border:none;border-radius:4px;padding:4px 9px;cursor:pointer;font-weight:bold;font-size:11px;" title="Previous Level (P)">◀ Prev</button>
                <div style="font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px;">
                    <span style="color:#a0aec0;">Level:</span>
                    <input type="number" id="dm-lvl-input" min="1" max="100" value="1" style="width:42px;background:#0f1423;border:1px solid #00f0ff;color:#00ff88;font-weight:900;font-size:11px;border-radius:4px;text-align:center;padding:2px;" />
                </div>
                <button id="dm-lvl-jump" style="background:linear-gradient(135deg,#6c5ce7,#a29bfe);color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-weight:bold;font-size:11px;">Jump</button>
                <button id="dm-lvl-next" style="background:#2d3436;color:#fff;border:none;border-radius:4px;padding:4px 9px;cursor:pointer;font-weight:bold;font-size:11px;" title="Next Level (N)">Next ▶</button>
            </div>

            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
                <button id="dm-gas-btn" style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:7px;border-radius:6px;cursor:pointer;font-weight:700;font-size:11px;">🚘 Auto-Gas</button>
                <button id="dm-hop-btn" style="background:#fd79a8;color:#fff;border:none;padding:7px;border-radius:6px;cursor:pointer;font-weight:700;font-size:11px;box-shadow:0 0 10px rgba(253,121,168,0.3);">🦘 Rocket Hop (Space)</button>
                <button id="dm-unlock-btn" style="background:linear-gradient(135deg,#6c5ce7,#a29bfe);color:#fff;border:none;padding:7px;border-radius:6px;cursor:pointer;font-weight:800;font-size:10.5px;">🔓 Unlock 100</button>
                <button id="dm-reset-btn" style="background:#ff7675;color:#fff;border:none;padding:7px;border-radius:6px;cursor:pointer;font-weight:700;font-size:11px;">🔄 Reset Car (R)</button>
            </div>

            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">
                <button id="dm-turbo" style="background:#6c5ce7;color:#fff;border:none;padding:6px 2px;border-radius:5px;cursor:pointer;font-weight:700;font-size:10px;">2.5x (T)</button>
                <button id="dm-hyper" style="background:#e84393;color:#fff;border:none;padding:6px 2px;border-radius:5px;cursor:pointer;font-weight:700;font-size:10px;">4.5x (Y)</button>
                <button id="dm-slow" style="background:#00cec9;color:#000;border:none;padding:6px 2px;border-radius:5px;cursor:pointer;font-weight:700;font-size:10px;">0.35x (S)</button>
                <button id="dm-norm" style="background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:6px 2px;border-radius:5px;cursor:pointer;font-weight:700;font-size:10px;">1x</button>
            </div>

            <div style="background:rgba(0,0,0,0.3);border-radius:6px;padding:6px 8px;">
                <div style="display:flex;justify-content:space-between;font-size:10px;color:#a0aec0;margin-bottom:3px;">
                    <span>Game Clock Multiplier</span>
                    <b id="dm-speed-val" style="color:#00f0ff;">1.00x</b>
                </div>
                <input type="range" id="dm-slider" min="0.2" max="5.0" step="0.1" value="1.0" style="width:100%;cursor:pointer;accent-color:#00f0ff;" />
            </div>

            <button id="dm-glow" style="background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:5px;border-radius:6px;cursor:pointer;font-weight:600;font-size:10px;">🌈 Rainbow Glow (G)</button>

            <div style="font-size:9.5px;color:#718096;text-align:center;line-height:1.4;">
                <b>F</b> Fly Mode | <b>N</b> Next Level | <b>P</b> Prev Level<br/>
                <b>Space</b> Rocket Hop | <b>T</b>/<b>Y</b> Speed | <b>R</b> Reset | <b>H</b> Hide
            </div>
        </div>
    \`;

    (gDoc.body || gDoc.documentElement).appendChild(menu);

    // ==========================================
    // 5. INSTANT SKIP & LEVEL SWITCHING
    // ==========================================
    const skipBtn = gDoc.getElementById("dm-skip-btn");
    const lvlInput = gDoc.getElementById("dm-lvl-input");

    function goToLevel(lvl) {
        currentLevel = Math.max(1, Math.min(100, lvl));
        if (lvlInput) lvlInput.value = currentLevel;

        dismissCard();

        if (gWin.Module && typeof gWin.Module._level_select_menu_start_level === "function") {
            gWin.Module._level_select_menu_start_level(currentLevel - 1);
            console.log("🎮 Jumped to Level " + currentLevel);
        }

        setTimeout(dismissCard, 100);
    }

    skipBtn.addEventListener("click", () => goToLevel(currentLevel + 1));
    gDoc.getElementById("dm-lvl-jump").addEventListener("click", () => goToLevel(parseInt(lvlInput.value, 10) || 1));
    gDoc.getElementById("dm-lvl-prev").addEventListener("click", () => goToLevel(currentLevel - 1));
    gDoc.getElementById("dm-lvl-next").addEventListener("click", () => goToLevel(currentLevel + 1));

    // ==========================================
    // 6. FLY MODE (JET GLIDE & LIFT)
    // ==========================================
    let isFlying = false;
    let flyLoop = null;
    const flyBtn = gDoc.getElementById("dm-fly-btn");

    function toggleFly() {
        isFlying = !isFlying;
        dismissCard();

        if (isFlying) {
            flyBtn.textContent = "🛸 FLYING: ACTIVE (F)";
            flyBtn.style.background = "linear-gradient(135deg, #00ff88, #00cec9)";
            flyBtn.style.boxShadow = "0 0 20px rgba(0, 255, 136, 0.7)";
            applySpeed(2.8);

            flyLoop = setInterval(() => {
                if (!isFlying) return;
                setDrive(1, true);
                setTimeout(() => {
                    if (!isFlying) return;
                    setDrive(1, false);
                    setDrive(-1, true);
                    setTimeout(() => {
                        setDrive(-1, false);
                    }, 12);
                }, 48);
            }, 75);
        } else {
            flyBtn.textContent = "🛸 Fly Mode (F)";
            flyBtn.style.background = "linear-gradient(135deg, #00f0ff, #0984e3)";
            flyBtn.style.boxShadow = "0 0 14px rgba(0, 240, 255, 0.4)";
            if (flyLoop) {
                clearInterval(flyLoop);
                flyLoop = null;
            }
            setDrive(0, false);
            applySpeed(1.0);
        }
    }
    flyBtn.addEventListener("click", toggleFly);

    // ==========================================
    // 7. ROCKET HOP (SUSPENSION POP)
    // ==========================================
    const hopBtn = gDoc.getElementById("dm-hop-btn");
    function doHop() {
        dismissCard();
        setDrive(-1, true);
        setTimeout(() => {
            setDrive(-1, false);
            setDrive(1, true);
            setTimeout(() => {
                setDrive(1, false);
            }, 90);
        }, 35);
    }
    hopBtn.addEventListener("click", doHop);

    // ==========================================
    // 8. AUTO-GAS
    // ==========================================
    const gasBtn = gDoc.getElementById("dm-gas-btn");
    let isGas = false;
    let gasInterval = null;

    function toggleGas() {
        isGas = !isGas;
        dismissCard();
        if (isGas) {
            gasBtn.style.background = "rgba(0, 255, 136, 0.25)";
            gasBtn.style.borderColor = "#00ff88";
            gasBtn.style.color = "#00ff88";
            gasBtn.textContent = "🟢 Gas: ON";
            setDrive(1, true);
            gasInterval = setInterval(() => {
                if (isGas) setDrive(1, true);
            }, 250);
        } else {
            gasBtn.style.background = "rgba(255,255,255,0.08)";
            gasBtn.style.borderColor = "rgba(255,255,255,0.2)";
            gasBtn.style.color = "#fff";
            gasBtn.textContent = "🚘 Auto-Gas";
            if (gasInterval) { clearInterval(gasInterval); gasInterval = null; }
            setDrive(0, false);
        }
    }
    gasBtn.addEventListener("click", toggleGas);

    // ==========================================
    // 9. RESET CAR
    // ==========================================
    const resetBtn = gDoc.getElementById("dm-reset-btn");
    function doReset() {
        sendKey(82, true);
        setTimeout(() => sendKey(82, false), 80);
    }
    resetBtn.addEventListener("click", doReset);

    // ==========================================
    // 10. UNLOCK ALL 100 LEVELS
    // ==========================================
    const unlockBtn = gDoc.getElementById("dm-unlock-btn");
    unlockBtn.addEventListener("click", () => {
        try {
            const prefix = (gWin.Storage && gWin.Storage.PREFIX) || "com.martinmagni.drivemad/data/";
            for (let i = 1; i <= 100; i++) {
                const b64 = "AQAAAAAAAAMAAA==";
                gWin.localStorage.setItem(prefix + "level_" + i, b64);
                gWin.localStorage.setItem(prefix + "stars_" + i, b64);
                gWin.localStorage.setItem("fancade_level_" + i, "1");
            }
            unlockBtn.textContent = "🔓 100 Unlocked!";
            unlockBtn.style.background = "#00b894";
            setTimeout(() => {
                unlockBtn.textContent = "🔓 Unlock 100";
                unlockBtn.style.background = "linear-gradient(135deg,#6c5ce7,#a29bfe)";
            }, 2000);
        } catch(e) {
            alert("Unlock notice: " + e.message);
        }
    });

    // ==========================================
    // 11. SPEED CONTROLS
    // ==========================================
    gDoc.getElementById("dm-turbo").addEventListener("click", () => applySpeed(2.5));
    gDoc.getElementById("dm-hyper").addEventListener("click", () => applySpeed(4.5));
    gDoc.getElementById("dm-slow").addEventListener("click", () => applySpeed(0.35));
    gDoc.getElementById("dm-norm").addEventListener("click", () => applySpeed(1.0));
    gDoc.getElementById("dm-slider").addEventListener("input", (e) => applySpeed(parseFloat(e.target.value)));

    // ==========================================
    // 12. RAINBOW GLOW
    // ==========================================
    const glowBtn = gDoc.getElementById("dm-glow");
    let isGlow = false, glowTimer = null, hue = 0;
    glowBtn.addEventListener("click", () => {
        isGlow = !isGlow;
        const c = canvas || gDoc.getElementById("canvas") || gDoc.querySelector("canvas");
        if (isGlow) {
            glowBtn.style.borderColor = "#fd79a8";
            glowBtn.style.color = "#fd79a8";
            glowTimer = setInterval(() => {
                hue = (hue + 2) % 360;
                if (c) c.style.boxShadow = "0 0 35px hsl(" + hue + ", 100%, 55%)";
            }, 30);
        } else {
            glowBtn.style.borderColor = "rgba(255,255,255,0.2)";
            glowBtn.style.color = "#fff";
            if (glowTimer) clearInterval(glowTimer);
            if (c) c.style.boxShadow = "none";
        }
    });

    // ==========================================
    // 13. MINIMIZE & CLOSE & DRAG
    // ==========================================
    let isMin = false;
    const minBtn = gDoc.getElementById("dm-min");
    const closeBtn = gDoc.getElementById("dm-close");
    const bodyEl = gDoc.getElementById("dm-body");
    minBtn.addEventListener("click", () => {
        isMin = !isMin;
        bodyEl.style.display = isMin ? "none" : "flex";
        minBtn.textContent = isMin ? "+" : "_";
    });
    closeBtn.addEventListener("click", () => { menu.style.display = "none"; });

    const header = gDoc.getElementById("dm-header");
    let isDragging = false, dragX = 0, dragY = 0;
    header.addEventListener("mousedown", (e) => {
        if (e.target === minBtn || e.target === closeBtn) return;
        isDragging = true;
        dragX = e.clientX - menu.offsetLeft;
        dragY = e.clientY - menu.offsetTop;
    });
    gDoc.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        menu.style.left = Math.max(0, Math.min(gWin.innerWidth - 280, e.clientX - dragX)) + "px";
        menu.style.top = Math.max(0, Math.min(gWin.innerHeight - 80, e.clientY - dragY)) + "px";
    });
    gDoc.addEventListener("mouseup", () => { isDragging = false; });

    // ==========================================
    // 14. SAFE SHORTCUTS (NO RECURSION, NO KEY STEALING)
    // ==========================================
    gWin.addEventListener("keydown", (e) => {
        if (!e.isTrusted) return; // CRITICAL: Never react to synthetic events!
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
        if (e.code === "KeyF") { e.preventDefault(); toggleFly(); }
        else if (e.code === "KeyN") { e.preventDefault(); goToLevel(currentLevel + 1); }
        else if (e.code === "KeyP") { e.preventDefault(); goToLevel(currentLevel - 1); }
        else if (e.code === "Space") { doHop(); }
        else if (e.code === "KeyT") applySpeed(2.5);
        else if (e.code === "KeyY") applySpeed(4.5);
        else if (e.code === "KeyS" && !e.ctrlKey) applySpeed(0.35);
        else if (e.code === "KeyR") doReset();
        else if (e.code === "KeyG") glowBtn.click();
        else if (e.code === "KeyH" || e.code === "KeyM") {
            menu.style.display = menu.style.display === "none" ? "flex" : "none";
        }
    });

    // ==========================================
    // 15. LIVE FPS
    // ==========================================
    let frames = 0, lastTime = performance.now();
    const fpsBadge = gDoc.getElementById("dm-fps");
    function fpsLoop() {
        frames++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
            const fps = Math.round((frames * 1000) / (now - lastTime));
            if (fpsBadge) {
                fpsBadge.textContent = fps + " FPS";
                fpsBadge.style.color = fps >= 50 ? "#00ff88" : fps >= 30 ? "#ffd700" : "#ff4757";
            }
            frames = 0;
            lastTime = now;
        }
        requestAnimationFrame(fpsLoop);
    }
    requestAnimationFrame(fpsLoop);
})();`
	},
	{
		id: "preset-cookie-god",
		name: "Cookie Clicker Auto-God",
		match_pattern: "*cookie*",
		description: "Auto-clicks the Big Cookie every 20ms and automatically clicks Golden Cookies as they spawn.",
		script_code: `// ==UserScript==
// @name         Cookie Clicker Auto-God
// @match        *cookie*
// ==/UserScript==

(function() {
    console.log("🍪 [Clash Tamper] Cookie Clicker Auto-God active!");
    const cookieTimer = setInterval(() => {
        const big = document.getElementById("bigCookie");
        if (big) big.click();
        const golden = document.getElementById("goldenCookie") || document.querySelector(".shimmer");
        if (golden) golden.click();
    }, 20);
    window.__cookieGodTimer = cookieTimer;
})();`
	},
	{
		id: "preset-fps-hud",
		name: "Live Game FPS Monitor",
		match_pattern: "*",
		description: "Floating neon FPS & performance gauge on any arcade game or website.",
		script_code: `// ==UserScript==
// @name         Live Game FPS Monitor
// @match        *
// ==/UserScript==

(function() {
    if (document.getElementById("clash-fps-badge")) return;
    const badge = document.createElement("div");
    badge.id = "clash-fps-badge";
    badge.style.cssText = "position:fixed!important;top:10px!important;right:10px!important;background:rgba(0,0,0,0.85)!important;border:1px solid #00ff88!important;box-shadow:0 0 10px rgba(0,255,136,0.3)!important;color:#00ff88!important;font-family:monospace!important;font-size:12px!important;font-weight:bold!important;padding:4px 10px!important;border-radius:6px!important;z-index:2147483647!important;pointer-events:none!important;";
    badge.textContent = "60 FPS";
    (document.body || document.documentElement).appendChild(badge);

    let frames = 0, last = performance.now();
    function loop() {
        frames++;
        const now = performance.now();
        if (now - last >= 1000) {
            const fps = Math.round((frames * 1000) / (now - last));
            badge.textContent = fps + " FPS";
            badge.style.color = fps >= 50 ? "#00ff88" : fps >= 30 ? "#ffd700" : "#ff4757";
            frames = 0;
            last = now;
        }
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
})();`
	}
];

export default async function scriptsRoutes(fastify, options) {
	// Middleware check for authenticated user
	fastify.addHook("preHandler", async (req, reply) => {
		if (req.url.startsWith("/api/scripts")) {
			const auth = extractAuthUser(req);
			if (!auth) {
				return reply.code(401).send({ error: "Please sign in to manage custom userscripts." });
			}
			req.authUser = auth;
		}
	});

	// GET /api/scripts/presets - List ready-to-use presets
	fastify.get("/api/scripts/presets", async (req, reply) => {
		return {
			success: true,
			presets: PRESET_SCRIPTS
		};
	});

	// POST /api/scripts/presets/install - Install a preset script directly
	fastify.post("/api/scripts/presets/install", async (req, reply) => {
		const { presetId } = req.body || {};
		const found = PRESET_SCRIPTS.find(p => p.id === presetId);
		if (!found) {
			return reply.code(404).send({ error: "Preset not found." });
		}

		// Check if user already has this script
		const existing = db.prepare("SELECT * FROM userscripts WHERE user_id = ? AND name = ?").get(req.authUser.id, found.name);
		let script;
		if (existing) {
			db.prepare("UPDATE userscripts SET script_code = ?, match_pattern = ?, is_enabled = 1, updated_at = ? WHERE id = ?")
				.run(found.script_code, found.match_pattern, new Date().toISOString(), existing.id);
			script = db.prepare("SELECT * FROM userscripts WHERE id = ?").get(existing.id);
		} else {
			const res = db.prepare(`
				INSERT INTO userscripts (user_id, name, match_pattern, script_code, is_enabled)
				VALUES (?, ?, ?, ?, 1)
			`).run(req.authUser.id, found.name, found.match_pattern, found.script_code);
			script = db.prepare("SELECT * FROM userscripts WHERE id = ?").get(res.lastInsertRowid);
		}

		return {
			success: true,
			message: `Preset "${found.name}" installed & activated!`,
			script
		};
	});

	// GET /api/scripts - List all custom scripts and builtin tweaks
	fastify.get("/api/scripts", async (req, reply) => {
		const customScripts = db.prepare(`
			SELECT id, name, match_pattern, script_code, is_enabled, created_at, updated_at
			FROM userscripts
			WHERE user_id = ?
			ORDER BY id ASC
		`).all(req.authUser.id);

		return {
			success: true,
			builtins: BUILTIN_TWEAKS,
			presets: PRESET_SCRIPTS,
			scripts: customScripts
		};
	});

	// POST /api/scripts - Create custom userscript
	fastify.post("/api/scripts", async (req, reply) => {
		const { name, matchPattern = "*", scriptCode } = req.body || {};

		if (!name || !name.trim()) {
			return reply.code(400).send({ error: "Script name is required." });
		}
		if (!scriptCode || !scriptCode.trim()) {
			return reply.code(400).send({ error: "Script code cannot be empty." });
		}

		const cleanName = String(name).trim().slice(0, 50);
		const cleanPattern = String(matchPattern).trim().slice(0, 100) || "*";
		const cleanCode = String(scriptCode).slice(0, 50000);

		const result = db.prepare(`
			INSERT INTO userscripts (user_id, name, match_pattern, script_code, is_enabled)
			VALUES (?, ?, ?, ?, 1)
		`).run(req.authUser.id, cleanName, cleanPattern, cleanCode);

		const script = db.prepare("SELECT * FROM userscripts WHERE id = ?").get(result.lastInsertRowid);

		return {
			success: true,
			message: `Script "${cleanName}" created!`,
			script
		};
	});

	// PATCH /api/scripts/:id - Toggle enabled or update script
	fastify.patch("/api/scripts/:id", async (req, reply) => {
		const scriptId = parseInt(req.params.id, 10);
		const { name, matchPattern, scriptCode, isEnabled } = req.body || {};

		const existing = db.prepare("SELECT * FROM userscripts WHERE id = ? AND user_id = ?").get(scriptId, req.authUser.id);
		if (!existing) {
			return reply.code(404).send({ error: "Script not found or unauthorized." });
		}

		const updates = [];
		const params = [];

		if (name !== undefined && name.trim()) {
			updates.push("name = ?");
			params.push(String(name).trim().slice(0, 50));
		}
		if (matchPattern !== undefined) {
			updates.push("match_pattern = ?");
			params.push(String(matchPattern).trim().slice(0, 100) || "*");
		}
		if (scriptCode !== undefined) {
			updates.push("script_code = ?");
			params.push(String(scriptCode).slice(0, 50000));
		}
		if (isEnabled !== undefined) {
			updates.push("is_enabled = ?");
			params.push(isEnabled ? 1 : 0);
		}

		updates.push("updated_at = ?");
		params.push(new Date().toISOString());

		params.push(scriptId, req.authUser.id);

		db.prepare(`UPDATE userscripts SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`).run(...params);

		const updated = db.prepare("SELECT * FROM userscripts WHERE id = ?").get(scriptId);

		return {
			success: true,
			message: "Script updated.",
			script: updated
		};
	});

	// DELETE /api/scripts/:id - Delete custom script
	fastify.delete("/api/scripts/:id", async (req, reply) => {
		const scriptId = parseInt(req.params.id, 10);
		const result = db.prepare("DELETE FROM userscripts WHERE id = ? AND user_id = ?").run(scriptId, req.authUser.id);

		if (result.changes === 0) {
			return reply.code(404).send({ error: "Script not found." });
		}

		return { success: true, message: "Script deleted." };
	});
}
