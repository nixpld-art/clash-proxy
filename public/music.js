"use strict";

/* ===== Toast Notification Utility ===== */
function toast(message) {
	let container = document.getElementById("toast-container");
	if (!container) {
		container = document.createElement("div");
		container.id = "toast-container";
		container.style.cssText = "position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 999999; display: flex; flex-direction: column; gap: 8px; pointer-events: none;";
		document.body.appendChild(container);
	}
	const toastEl = document.createElement("div");
	toastEl.style.cssText = "background: rgba(10, 10, 18, 0.95); border: 1px solid rgba(108, 92, 231, 0.4); color: #fff; padding: 10px 20px; border-radius: 999px; font-size: 13px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.5); opacity: 0; transition: opacity 0.3s, transform 0.3s; transform: translateY(10px); backdrop-filter: blur(8px);";
	toastEl.textContent = message;
	container.appendChild(toastEl);
	
	setTimeout(() => {
		toastEl.style.opacity = "1";
		toastEl.style.transform = "translateY(0)";
	}, 10);
	
	setTimeout(() => {
		toastEl.style.opacity = "0";
		toastEl.style.transform = "translateY(10px)";
		setTimeout(() => toastEl.remove(), 300);
	}, 2500);
}

/* ===== Music Player (YouTube IFrame API) ===== */
var musicQueue = [];
var musicIndex = -1;
var musicMinimized = true;
var musicHidden = true;
var shuffleOn = false;
var repeatOn = false;
var ytPlayer = null;
var ytReady = false;
var ytLoadAttempted = false;
var progressInterval = null;
var isPlaying = false;

var musicEl = document.getElementById("music-player");
var musicThumb = document.getElementById("music-thumb");
var musicTitle = document.getElementById("music-title");
var musicAuthor = document.getElementById("music-author");
var musicSearchInput = document.getElementById("music-search-input");
var musicResults = document.getElementById("music-results");
var musicSearchToggle = document.getElementById("music-search-toggle");
var musicSearchArea = document.getElementById("music-search-area");
var musicToggleBtn = document.getElementById("music-toggle-btn");
var musicToggleIcon = document.getElementById("music-toggle-icon");
var musicQueueList = document.getElementById("music-queue-list");
var musicQueueCount = document.getElementById("music-queue-count");
var frogMusicBtn = document.getElementById("frog-music-btn");
var playPauseBtn = document.getElementById("music-play-pause");
var prevBtn = document.getElementById("music-prev");
var nextBtn = document.getElementById("music-next");
var shuffleBtn = document.getElementById("music-shuffle");
var repeatBtn = document.getElementById("music-repeat");
var volumeBtn = document.getElementById("music-volume-btn");
var volumeSlider = document.getElementById("music-volume-slider");
var musicSeek = document.getElementById("music-seek");
var musicTimeCurrent = document.getElementById("music-time-current");
var musicTimeTotal = document.getElementById("music-time-total");

function formatTime(t) {
	if (!t || isNaN(t)) return "0:00";
	var m = Math.floor(t / 60);
	var s = Math.floor(t % 60);
	return m + ":" + (s < 10 ? "0" : "") + s;
}

function loadYouTubeAPI() {
	if (ytLoadAttempted) return;
	ytLoadAttempted = true;
	if (typeof YT !== "undefined" && YT.Player) { onYouTubeIframeAPIReady(); return; }
	var tag = document.createElement("script");
	// Try loading through the Scramjet proxy first, fallback directly to YouTube
	tag.src = "/proxy/" + encodeURIComponent("https://www.youtube.com/iframe_api");
	tag.onerror = function () {
		tag.src = "https://www.youtube.com/iframe_api";
		tag.onerror = function () { 
			setTimeout(function () { ytLoadAttempted = false; loadYouTubeAPI(); }, 5000); 
		};
	};
	var first = document.getElementsByTagName("script")[0];
	first.parentNode.insertBefore(tag, first);
}

// Global YouTube API Ready Callback
window.onYouTubeIframeAPIReady = function() {
	var container = document.getElementById("music-youtube-player");
	if (!container) return;
	ytPlayer = new YT.Player("music-youtube-player", {
		height: "0", width: "0",
		playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, playsinline: 1, rel: 0, iv_load_policy: 3 },
		events: {
			onReady: onPlayerReady,
			onStateChange: onPlayerStateChange,
			onError: onPlayerError
		}
	});
};

function onPlayerReady() {
	ytReady = true;
	if (ytPlayer && ytPlayer.setVolume) {
		ytPlayer.setVolume(parseInt(volumeSlider.value));
	}
	if (musicIndex >= 0 && musicIndex < musicQueue.length) { playCurrent(); }
}

function onPlayerStateChange(e) {
	if (e.data === YT.PlayerState.PLAYING) {
		isPlaying = true;
		playPauseBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
		startProgressTimer();
	} else if (e.data === YT.PlayerState.PAUSED) {
		isPlaying = false;
		playPauseBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
		stopProgressTimer();
	} else if (e.data === YT.PlayerState.ENDED) {
		isPlaying = false;
		playPauseBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
		stopProgressTimer();
		if (repeatOn) { 
			ytPlayer.seekTo(0); 
			ytPlayer.playVideo(); 
		} else if (musicIndex < musicQueue.length - 1) { 
			musicIndex++; 
			playCurrent(); 
		} else if (shuffleOn) { 
			musicIndex = Math.floor(Math.random() * musicQueue.length); 
			playCurrent(); 
		}
	}
}

function onPlayerError() {
	if (musicQueue.length > 1) { playNext(); }
}

function updateProgressDisplay() {
	if (!ytPlayer || !ytPlayer.getCurrentTime) return;
	var current = ytPlayer.getCurrentTime();
	var dur = ytPlayer.getDuration();
	if (dur > 0) { musicSeek.value = Math.min(100, (current / dur) * 100); }
	musicTimeCurrent.textContent = formatTime(current);
	musicTimeTotal.textContent = formatTime(dur);
}

function startProgressTimer() {
	if (progressInterval) clearInterval(progressInterval);
	progressInterval = setInterval(updateProgressDisplay, 500);
}

function stopProgressTimer() {
	if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
}

function playSong(videoId, title, author, thumbnail, durationSec) {
	var existingIdx = musicQueue.findIndex(function (t) { return t.id === videoId; });
	if (existingIdx >= 0) { 
		musicIndex = existingIdx; 
	} else { 
		musicQueue.push({ id: videoId, title: title, author: author, thumbnail: thumbnail, durationSec: durationSec }); 
		musicIndex = musicQueue.length - 1; 
	}
	if (!ytReady) { 
		loadYouTubeAPI(); 
		updateThumb(musicQueue[musicIndex]); 
		updateQueueUI(); 
		if (musicMinimized) toggleMinimize(); 
		showPlayer(); 
		return; 
	}
	playCurrent();
	updateQueueUI();
	if (musicMinimized) toggleMinimize();
	showPlayer();
}

function playCurrent() {
	if (musicIndex < 0 || musicIndex >= musicQueue.length) return;
	var track = musicQueue[musicIndex];
	updateThumb(track);
	updateQueueUI();
	if (ytReady && ytPlayer && ytPlayer.loadVideoById) { 
		ytPlayer.loadVideoById(track.id); 
		ytPlayer.playVideo(); 
		isPlaying = true; 
	}
}

function updateThumb(track) {
	var thumb = track.thumbnail || "https://i.ytimg.com/vi/" + track.id + "/mqdefault.jpg";
	musicThumb.src = thumb;
	musicThumb.onerror = function () { 
		musicThumb.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="22" fill="%23222"/%3E%3Cpath d="M18 14v20l16-10z" fill="%23888"/%3E%3C/svg%3E'; 
	};
	musicTitle.textContent = track.title;
	musicAuthor.textContent = track.author;
}

function playNext() {
	if (musicQueue.length === 0) return;
	if (shuffleOn) { 
		var next; 
		do { 
			next = Math.floor(Math.random() * musicQueue.length); 
		} while (next === musicIndex && musicQueue.length > 1); 
		musicIndex = next; 
	} else if (musicIndex < musicQueue.length - 1) { 
		musicIndex++; 
	} else if (repeatOn) { 
		musicIndex = 0; 
	} else { 
		return; 
	}
	playCurrent();
}

function playPrev() {
	if (musicQueue.length === 0) return;
	if (ytPlayer && ytPlayer.getCurrentTime && ytPlayer.getCurrentTime() > 3) { ytPlayer.seekTo(0); return; }
	if (musicIndex > 0) { 
		musicIndex--; 
		playCurrent(); 
	} else if (repeatOn && musicQueue.length > 0) { 
		musicIndex = musicQueue.length - 1; 
		playCurrent(); 
	}
}

function toggleMinimize() {
	musicMinimized = !musicMinimized;
	musicEl.classList.toggle("music-minimized", musicMinimized);
	musicToggleIcon.innerHTML = musicMinimized ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>';
	musicToggleBtn.title = musicMinimized ? "Maximize" : "Minimize";
}

function toggleMusicVisibility() {
	musicHidden = !musicHidden;
	musicEl.classList.toggle("music-hidden", musicHidden);
	frogMusicBtn.classList.toggle("active", !musicHidden);
	if (!musicHidden && ytLoadAttempted === false) {
		loadYouTubeAPI();
	}
}

/* Music search */
var searchTimeout = null;
musicSearchInput.addEventListener("input", function () {
	clearTimeout(searchTimeout);
	var q = musicSearchInput.value.trim();
	if (q.length < 2) { musicResults.innerHTML = ""; return; }
	searchTimeout = setTimeout(function () { doMusicSearch(q); }, 300);
});

async function doMusicSearch(q) {
	musicResults.innerHTML = '<div class="music-loading"><span></span><span></span><span></span></div>';
	try {
		var res = await fetch("/api/music/search?q=" + encodeURIComponent(q));
		if (!res.ok) throw new Error("Search failed");
		var data = await res.json();
		renderMusicResults(data.results || []);
	} catch (err) {
		musicResults.innerHTML = "<div style='padding:8px;color:#ff6b6b;font-size:12px'>Search failed</div>";
	}
}

function escapeHtml(val) { 
	return String(val)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;"); 
}

function renderMusicResults(results) {
	if (results.length === 0) { 
		musicResults.innerHTML = "<div style='padding:8px;color:rgba(255,255,255,0.4);font-size:12px'>No results found</div>"; 
		return; 
	}
	musicResults.innerHTML = results.map(function (r) {
		var parts = (r.duration || "0:00").split(":").map(Number);
		var durSec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] || 0;
		return '<div class="music-result-item" data-id="' + r.id + '" data-title="' + escapeHtml(r.title) + '" data-author="' + escapeHtml(r.author) + '" data-thumb="' + r.thumbnail + '" data-dur="' + durSec + '">' +
			'<img src="' + r.thumbnail + '" alt="" loading="lazy" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="22" fill="%23222"/%3E%3Cpath d="M18 14v20l16-10z" fill="%23888"/%3E%3C/svg%3E\'" />' +
			'<div class="r-info"><div class="r-title">' + escapeHtml(r.title) + '</div><div class="r-meta">' + escapeHtml(r.author) + ' \u00b7 ' + r.duration + '</div></div>' +
			'<button class="r-play-btn" title="Play now">\u25b6</button>' +
			'<button class="r-add-btn" title="Add to queue">+</button></div>';
	}).join("");
	
	musicResults.querySelectorAll(".music-result-item").forEach(function (el) {
		var id = el.dataset.id, title = el.dataset.title, author = el.dataset.author, thumb = el.dataset.thumb, dur = parseInt(el.dataset.dur) || 0;
		el.querySelector(".r-play-btn").addEventListener("click", function (e) {
			e.stopPropagation();
			playSong(id, title, author, thumb, dur);
			musicSearchInput.value = "";
			musicResults.innerHTML = "";
			musicSearchArea.classList.add("music-hidden");
		});
		el.querySelector(".r-add-btn").addEventListener("click", function (e) {
			e.stopPropagation();
			queueSong(id, title, author, thumb, dur);
			toast("Added to queue");
		});
	});
}

function queueSong(videoId, title, author, thumbnail, durationSec) {
	if (musicQueue.findIndex(function (t) { return t.id === videoId; }) >= 0) return;
	musicQueue.push({ id: videoId, title: title, author: author, thumbnail: thumbnail, durationSec: durationSec });
	if (musicIndex < 0) musicIndex = 0;
	updateQueueUI();
	showPlayer();
}

function updateQueueUI() {
	musicQueueList.innerHTML = musicQueue.map(function (t, i) {
		return '<div class="music-qitem ' + (i === musicIndex ? "active" : "") + '" data-idx="' + i + '">' +
			'<img src="' + (t.thumbnail || "https://i.ytimg.com/vi/" + t.id + "/mqdefault.jpg") + '" alt="" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="22" fill="%23222"/%3E%3Cpath d="M18 14v20l16-10z" fill="%23888"/%3E%3C/svg%3E\'" />' +
			'<span class="q-title">' + escapeHtml(t.title) + '</span>' +
			'<button class="q-remove" data-idx="' + i + '">\u00d7</button></div>';
	}).join("");
	musicQueueCount.textContent = musicQueue.length + " song" + (musicQueue.length !== 1 ? "s" : "");
	
	musicQueueList.querySelectorAll(".music-qitem").forEach(function (el) {
		el.addEventListener("click", function (e) {
			if (e.target.classList.contains("q-remove")) return;
			musicIndex = parseInt(el.dataset.idx);
			playCurrent();
			if (musicMinimized) toggleMinimize();
		});
	});
	
	musicQueueList.querySelectorAll(".q-remove").forEach(function (btn) {
		btn.addEventListener("click", function (e) {
			e.stopPropagation();
			var idx = parseInt(btn.dataset.idx);
			musicQueue.splice(idx, 1);
			if (idx < musicIndex) musicIndex--;
			else if (idx === musicIndex) {
				if (musicQueue.length === 0) { 
					musicIndex = -1; 
					if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo(); 
				} else { 
					if (musicIndex >= musicQueue.length) musicIndex = musicQueue.length - 1; 
					playCurrent(); 
				}
			}
			updateQueueUI();
		});
	});
}

function showPlayer() {
	musicHidden = false;
	musicEl.classList.remove("music-hidden");
	frogMusicBtn.classList.add("active");
}

/* Event listeners */
prevBtn.addEventListener("click", playPrev);
playPauseBtn.addEventListener("click", function () {
	if (!ytReady || musicIndex < 0) { if (musicQueue.length > 0) playCurrent(); return; }
	var state = ytPlayer.getPlayerState();
	if (state === YT.PlayerState.PLAYING) { ytPlayer.pauseVideo(); } else { ytPlayer.playVideo(); }
});
nextBtn.addEventListener("click", playNext);

shuffleBtn.addEventListener("click", function () {
	shuffleOn = !shuffleOn;
	shuffleBtn.classList.toggle("active", shuffleOn);
	toast(shuffleOn ? "Shuffle on" : "Shuffle off");
});
repeatBtn.addEventListener("click", function () {
	repeatOn = !repeatOn;
	repeatBtn.classList.toggle("active", repeatOn);
	toast(repeatOn ? "Repeat on" : "Repeat off");
});

musicSeek.addEventListener("input", function () {
	if (!ytReady || !ytPlayer || !ytPlayer.getDuration) return;
	var dur = ytPlayer.getDuration();
	if (dur <= 0) return;
	ytPlayer.seekTo(dur * (parseInt(musicSeek.value) / 100));
});

volumeSlider.addEventListener("input", function () {
	var v = parseInt(volumeSlider.value) / 100;
	if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(parseInt(volumeSlider.value));
	volumeBtn.innerHTML = v === 0
		? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
		: v < 0.5
			? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'
			: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
});

musicToggleBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMinimize(); });
document.getElementById("music-header").addEventListener("click", function (e) {
	if (e.target.closest("button")) return;
	if (musicMinimized) toggleMinimize();
});
musicSearchToggle.addEventListener("click", function () {
	musicSearchArea.classList.toggle("music-hidden");
	if (!musicSearchArea.classList.contains("music-hidden")) musicSearchInput.focus();
});

frogMusicBtn.addEventListener("click", toggleMusicVisibility);

document.getElementById("music-queue-toggle").addEventListener("click", function () {
	var q = document.getElementById("music-queue");
	q.style.display = q.style.display === "none" ? "" : "none";
});

/* Keyboard shortcuts */
document.addEventListener("keydown", function (e) {
	if (musicHidden) return;
	var tag = e.target.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "SELECT") return;
	if (e.key === "Escape" && !musicSearchArea.classList.contains("music-hidden")) { 
		musicSearchArea.classList.add("music-hidden"); 
	}
	if (e.key === " " || e.key === "Spacebar") { 
		e.preventDefault(); 
		playPauseBtn.click(); 
	}
});
