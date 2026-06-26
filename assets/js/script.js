const fsDocButton = document.getElementById("fs-doc-button");
const videoPlayer = document.getElementById("videoPlayer");
const playlistDiv = document.getElementById("playlist");
const queueDiv = document.getElementById("queue");
const nowPlayingBox = document.getElementById("nowPlayingBox");
const codeInput = document.getElementById("songCodeInput");
const reserveMarquee = document.getElementById("reserveMarquee");
const reserveDigits = document.getElementById("reserveDigits");
const reserveTitle = document.getElementById("reserveTitle");

let playlist = [];
let queue = [];
let currentPlaying = null;
let selectedIndex = -1;
let reservationBuffer = "";

function formatVideoName(filename) {
  const name = filename.replace(/\.[^/.]+$/, "");
  const parts = name.split(/[-_•|]/).map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return {
      artist: parts[0],
      song: parts.slice(1).join(" - "),
    };
  }

  return {
    artist: "Unknown Artist",
    song: name.trim(),
  };
}

function formatSongCode(number) {
  return String(number).padStart(5, "0");
}

function showReservationMarquee(show) {
  if (!reserveMarquee) return;
  reserveMarquee.classList.toggle("hidden", !show);
}

function updateReservationCode(value = "") {
  const digits = value.replace(/\D/g, "").slice(0, 5);
  reservationBuffer = digits;
  showReservationMarquee(digits.length > 0);

  if (digits.length > 0) {
    reserveDigits.textContent = formatSongCode(Number(digits));
    const index = Number(digits) - 1;
    selectedIndex = index >= 0 && index < playlist.length ? index : -1;
    if (selectedIndex >= 0) {
      reserveTitle.textContent = formatVideoName(playlist[selectedIndex].name).song;
    } else {
      reserveTitle.textContent = "No selection";
    }
  } else {
    selectedIndex = -1;
    reserveTitle.textContent = "No selection";
  }

  renderPlaylist();
}

function queueSongByCode(codeValue) {
  const source = codeValue || reservationBuffer || (codeInput ? codeInput.value : "");
  const digits = source.replace(/\D/g, "");
  if (!digits) return;

  const index = Number(digits) - 1;
  if (index >= 0 && index < playlist.length) {
    addToQueue(playlist[index]);
    // remove from playlist view so it's not selectable again
    playlist.splice(index, 1);
    reservationBuffer = "";
    selectedIndex = -1;
    if (codeInput) {
      codeInput.value = "";
    }
    // hide marquee after queuing
    showReservationMarquee(false);
    // update title to indicate queued
    reserveTitle.textContent = "Queued";
    renderPlaylist();
    renderQueue();
    // after short timeout, clear the reserveTitle to default
    setTimeout(() => {
      reserveTitle.textContent = "No selection";
    }, 1200);
    return;
  }

  updateReservationCode(digits);
}

async function pickFolder() {
  try {
    const dirHandle = await window.showDirectoryPicker();
    playlist = [];
    queue = [];
    currentPlaying = null;
    selectedIndex = -1;
    reservationBuffer = "";
    renderNowPlaying();
    renderQueue();

    for await (const entry of dirHandle.values()) {
      if (entry.kind !== "file") continue;
      if (!entry.name.toLowerCase().endsWith(".mp4")) continue;
      playlist.push(entry);
    }

    renderPlaylist();
    if (codeInput) {
      codeInput.value = "";
    }
    showReservationMarquee(false);
  } catch (error) {
    console.log("Folder selection canceled or unavailable", error);
  }
}

function renderPlaylist() {
  playlistDiv.innerHTML = "";

  if (playlist.length === 0) {
    playlistDiv.innerHTML = `<div class="empty-state">No karaoke tracks loaded yet. Click "Pick Folder" to add offline MP4 files.</div>`;
    return;
  }

  playlist.forEach((entry, index) => {
    const meta = formatVideoName(entry.name);
    const active = index === selectedIndex;
    const card = document.createElement("button");
    card.className = `video-card${active ? " active" : ""}`;
    card.type = "button";
    card.onclick = () => {
      selectedIndex = index;
      reservationBuffer = String(index + 1);
      if (codeInput) codeInput.value = reservationBuffer;
      updateReservationCode(reservationBuffer);
      // selecting from playlist does not auto-queue; pressing Enter will queue
    };
    card.innerHTML = `
      <div class="card-banner">
        <span class="playlist-number">${formatSongCode(index + 1)}</span>
        <i class="bx bx-music"></i>
      </div>
      <div class="card-body">
        <div class="card-title">${meta.song}</div>
        <div class="card-subtitle">${meta.artist}</div>
        <div class="card-meta"><i class="bx bx-plus"></i> Code ${formatSongCode(index + 1)}</div>
      </div>
    `;
    playlistDiv.appendChild(card);
  });
}

function addToQueue(fileHandle) {
  if (!currentPlaying) {
    currentPlaying = fileHandle;
    renderNowPlaying();
    playVideo(fileHandle);
    return;
  }

  queue.push(fileHandle);
  renderQueue();
}

async function playVideo(fileHandle) {
  const file = await fileHandle.getFile();
  const url = URL.createObjectURL(file);
  videoPlayer.src = url;
  await videoPlayer.play().catch(() => {
    console.log("Video autoplay prevented, user interaction required.");
  });
}

function renderNowPlaying() {
  if (!currentPlaying) {
    nowPlayingBox.textContent = "🎤 No song playing";
    return;
  }

  const meta = formatVideoName(currentPlaying.name);
  nowPlayingBox.textContent = `🎤 Now playing: ${meta.song} — ${meta.artist}`;
}

function renderQueue() {
  queueDiv.innerHTML = "";

  if (queue.length === 0) {
    queueDiv.innerHTML = `<div class="empty-state">Queue is empty. Add songs from the playlist to build your setlist.</div>`;
    return;
  }

  queue.forEach((file, index) => {
    const meta = formatVideoName(file.name);
    const item = document.createElement("div");
    item.className = "queue-card";
    item.innerHTML = `
      <div class="card-banner">
        <span class="queue-number">${formatSongCode(index + 1)}</span>
        <i class="bx bx-play"></i>
      </div>
      <div class="card-body">
        <div class="queue-title">${meta.song}</div>
        <div class="queue-subtitle">${meta.artist}</div>
      </div>
      <div class="queue-actions">
        <button class="btn-icon btn-remove" onclick="removeQueue(${index})" aria-label="Remove"><i class="bx bx-trash"></i></button>
        <button class="btn-icon btn-skip" onclick="skipVideo()" aria-label="Skip"><i class="bx bx-skip-next"></i></button>
      </div>
    `;
    queueDiv.appendChild(item);
  });
}

function removeQueue(index) {
  queue.splice(index, 1);
  renderQueue();
}

function skipVideo() {
  playNext();
}

function navigateSelection(step) {
  if (playlist.length === 0) return;
  if (selectedIndex < 0) selectedIndex = 0;
  selectedIndex = Math.max(0, Math.min(playlist.length - 1, selectedIndex + step));
  reservationBuffer = String(selectedIndex + 1);
  if (codeInput) codeInput.value = reservationBuffer;
  updateReservationCode(reservationBuffer);
}

function appendReservationDigit(digit) {
  reservationBuffer = (reservationBuffer + digit).slice(0, 5);
  if (codeInput) codeInput.value = reservationBuffer;
  updateReservationCode(reservationBuffer);
}


function playNext() {
  if (queue.length === 0) {
    currentPlaying = null;
    videoPlayer.src = "";
    renderNowPlaying();
    renderQueue();
    return;
  }

  currentPlaying = queue.shift();
  renderQueue();
  renderNowPlaying();
  playVideo(currentPlaying);
}

if (codeInput) {
  codeInput.addEventListener("input", (event) => {
    const raw = event.target.value.replace(/\D/g, "").slice(0, 5);
    event.target.value = raw;
    updateReservationCode(raw);
  });

  codeInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    queueSongByCode();
  });
}

function getRemoteKey(event) {
  const key = event.key;
  const code = event.keyCode;

  if (/^[0-9]$/.test(key)) return key;
  if (code >= 48 && code <= 57) return String(code - 48);

  if (key === "Enter" || key === "OK" || code === 13 || code === 10004) return "Enter";
  if (key === "ArrowUp" || code === 38) return "ArrowUp";
  if (key === "ArrowDown" || code === 40) return "ArrowDown";
  if (key === "ArrowLeft" || code === 37) return "ArrowLeft";
  if (key === "ArrowRight" || code === 39) return "ArrowRight";
  if (key === "Backspace" || code === 8) return "Backspace";
  if (key === "Escape" || code === 461 || code === 10009) return "Escape";

  return null;
}

document.addEventListener("keydown", (event) => {
  const remoteKey = getRemoteKey(event);
  if (!remoteKey) return;

  event.preventDefault();

  if (/^[0-9]$/.test(remoteKey)) {
    appendReservationDigit(remoteKey);
    return;
  }

  if (remoteKey === "Backspace") {
    reservationBuffer = reservationBuffer.slice(0, -1);
    if (codeInput) codeInput.value = reservationBuffer;
    updateReservationCode(reservationBuffer);
    return;
  }

  if (remoteKey === "Escape") {
    reservationBuffer = "";
    if (codeInput) codeInput.value = "";
    showReservationMarquee(false);
    renderPlaylist();
    return;
  }

  if (remoteKey === "Enter") {
    queueSongByCode();
    return;
  }

  if (remoteKey === "ArrowDown" || remoteKey === "ArrowRight") {
    navigateSelection(1);
    return;
  }

  if (remoteKey === "ArrowUp" || remoteKey === "ArrowLeft") {
    navigateSelection(-1);
    return;
  }
});

videoPlayer.addEventListener("ended", playNext);

if (fsDocButton) {
  fsDocButton.addEventListener("click", function (e) {
    e.preventDefault();
    requestFullscreen(document.documentElement);
  });
}

document.body.setAttribute("tabindex", "-1");
document.body.focus();

function requestFullscreen(ele) {
  if (ele.requestFullscreen) {
    ele.requestFullscreen();
  } else if (ele.webkitRequestFullscreen) {
    ele.webkitRequestFullscreen();
  } else if (ele.mozRequestFullScreen) {
    ele.mozRequestFullScreen();
  } else if (ele.msRequestFullscreen) {
    ele.msRequestFullscreen();
  } else {
    console.log("Fullscreen API is not supported.");
  }
}
