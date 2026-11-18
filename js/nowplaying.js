// js/nowplaying.js — RadioBOSS metadata
const nowPlayingBox = document.getElementById("nowPlayingBox");
const APP_BASE = new URL("./", document.baseURI);
const resolveAsset = path => /^https?:\/\//i.test(path || "")
    ? path
    : new URL(String(path || "").replace(/^\/+/, ""), APP_BASE).href;
const DEFAULT_COVER = new URL("default-cover.png", APP_BASE).href;
const SLOGAN = "Música y contenido en sintonía con el evangelio de Cristo";
const NOWPLAYING_URL = "https://puragracia-radio-preview-vercel-pre.vercel.app/api/radioboss-nowplaying";
let currentTrack = null;
let programsList = [];
let lastActiveProgram = null;
let progressTimer = null;
let progressTrackId = "";
let progressPosition = 0;
let progressDuration = 0;
let progressUpdatedAt = 0;

const asText = value => typeof value === "string" ? value.trim() : (value == null ? "" : String(value).trim());

async function loadPrograms() {
    try {
        const response = await fetch(new URL("data/programs.json", APP_BASE));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        programsList = (Array.isArray(data.programs) ? data.programs : [])
            .map(program => ({ ...program, artwork: program.artwork ? resolveAsset(program.artwork) : "" }));
        console.log("Catálogo de programas cargado:", programsList.length);
    } catch (err) {
        console.error("No se pudo cargar el catálogo de programas:", err);
    }
}

function updateNowPlaying(metadata) {
    if (!nowPlayingBox) return;

    // Los IDs, jingles y otros elementos de producción no deben reemplazar
    // la canción/programa ni su carátula en la tarjeta.
    if (metadata?.isProduction) {
        if (currentTrack !== null) return;
        metadata = { title: "Pura Gracia Radio", artist: SLOGAN, album: "", coverArt: "" };
    }

    let title = asText(metadata?.title) || "Pura Gracia Radio";
    const rawArtist = asText(metadata?.artist);
    const album = asText(metadata?.album);
    const artist = (title === "Pura Gracia Radio" || !rawArtist) ? SLOGAN : rawArtist;

    let prog = programsList.find(p =>
        title.toLowerCase().includes(asText(p.name).toLowerCase()) ||
        asText(p.name).toLowerCase().includes(title.toLowerCase()) ||
        (album && album.toLowerCase().includes(asText(p.name).toLowerCase())) ||
        (album && asText(p.name).toLowerCase().includes(album.toLowerCase()))
    );

    if (!prog && title === "Pura Gracia Radio" && lastActiveProgram) {
        prog = lastActiveProgram;
        title = prog.name;
    } else if (prog) {
        lastActiveProgram = prog;
    } else if (title === "Pura Gracia Radio") {
        lastActiveProgram = null;
    }

    const coverArt = asText(metadata?.coverArt) || prog?.artwork || DEFAULT_COVER;
    const newTrackId = `${title}_${artist}_${album}_${coverArt}`.toLowerCase();

    // RadioBOSS reutiliza una misma URL para la carátula; versionarla al cambiar
    // de pista evita que el navegador conserve la imagen anterior en caché.
    let displayCoverArt = coverArt;
    if (coverArt !== DEFAULT_COVER) {
        try {
            const versionedCover = new URL(coverArt, document.baseURI);
            versionedCover.searchParams.set("v", String(Date.now()));
            displayCoverArt = versionedCover.href;
        } catch (_) {}
    }

    let card = nowPlayingBox.querySelector(".now-card");
    if (!card) {
        card = document.createElement("div");
        card.className = "now-card";
        nowPlayingBox.appendChild(card);
    }

    if (currentTrack === newTrackId && card.querySelector("img") && card.querySelector(".now-info")) return;
    currentTrack = newTrackId;

    let coverImg = card.querySelector("img");
    if (!coverImg) {
        coverImg = document.createElement("img");
        card.prepend(coverImg);
    }
    coverImg.onerror = () => {
        if (coverImg.src !== DEFAULT_COVER) coverImg.src = DEFAULT_COVER;
    };
    coverImg.src = displayCoverArt;
    coverImg.alt = "Carátula de lo que está sonando";
    coverImg.style.cursor = "pointer";
    coverImg.onclick = ejecutarCompartir;

    let infoDiv = card.querySelector(".now-info");
    if (!infoDiv) {
        infoDiv = document.createElement("div");
        infoDiv.className = "now-info";
        card.appendChild(infoDiv);
    }

    const isSlogan = artist === SLOGAN;
    infoDiv.innerHTML = `
        <div class="np-meta-viewport">
            <div class="marquee-container"><div class="np-line title marquee">${title}</div></div>
            <div class="np-line artist ${isSlogan ? "slogan-text" : ""}">${artist}</div>
            ${album ? `<div class="np-line album">${album}</div>` : ""}
        </div>
        <div class="track-progress" id="trackProgress" hidden>
            <div class="track-progress-times"><span id="trackElapsed">0:00</span><span id="trackRemaining">-0:00</span></div>
            <div class="track-progress-track"><div class="track-progress-fill" id="trackProgressFill"></div></div>
        </div>
    `;

    if ("mediaSession" in navigator && "MediaMetadata" in window) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title, artist, album,
            artwork: [{ src: displayCoverArt, sizes: "512x512", type: "image/jpeg" }]
        });
    }
}


function toSeconds(value) {
    if (value == null || value === "") return 0;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const raw = String(value).trim();
    if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
    const parts = raw.split(":").map(Number);
    if (parts.some(part => !Number.isFinite(part))) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
}
function formatClock(seconds) {
    const value = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;
    return hours ? `${hours}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}` : `${minutes}:${String(secs).padStart(2,"0")}`;
}
function updateTrackProgress(metadata) {
    const duration = toSeconds(metadata?.len ?? metadata?.duration ?? metadata?.length);
    const position = toSeconds(metadata?.pos ?? metadata?.position ?? metadata?.elapsed);
    const panel = document.getElementById("trackProgress");
    if (!panel) return;
    if (!(duration > 0) || !Number.isFinite(duration)) {
        panel.hidden = true;
        progressDuration = 0;
        return;
    }
    const trackId = `${metadata?.title || ""}|${metadata?.artist || ""}|${duration}`;
    if (trackId !== progressTrackId) progressTrackId = trackId;
    progressDuration = duration;
    progressPosition = Math.min(position, duration);
    progressUpdatedAt = Date.now();
    panel.hidden = false;
    renderTrackProgress();
    if (!progressTimer) progressTimer = setInterval(renderTrackProgress, 1000);
}
function renderTrackProgress() {
    const panel = document.getElementById("trackProgress");
    if (!panel || panel.hidden || !(progressDuration > 0)) return;
    const elapsed = Math.min(progressDuration, progressPosition + Math.max(0, (Date.now() - progressUpdatedAt) / 1000));
    const remaining = Math.max(0, progressDuration - elapsed);
    const fill = document.getElementById("trackProgressFill");
    const left = document.getElementById("trackElapsed");
    const right = document.getElementById("trackRemaining");
    if (fill) fill.style.width = `${Math.min(100, elapsed / progressDuration * 100)}%`;
    if (left) left.textContent = formatClock(elapsed);
    if (right) right.textContent = `-${formatClock(remaining)}`;
}

async function fetchNowPlaying() {
    try {
        const res = await fetch(`${NOWPLAYING_URL}?cb=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const metadata = data?.nowPlaying || data?.data?.nowPlaying || data?.data || data;
        if (!metadata || typeof metadata !== "object") throw new Error("Respuesta de metadata vacía");
        updateNowPlaying(metadata);
        updateTrackProgress(metadata);
    } catch (err) {
        console.error("No se pudo obtener metadata de RadioBOSS:", err);
        updateNowPlaying({ title: "Pura Gracia Radio" });
    }
}

loadPrograms().finally(fetchNowPlaying);
setInterval(fetchNowPlaying, 15000);

async function ejecutarCompartir() {
    const title = document.querySelector(".np-line.title")?.innerText || "Programación";
    const artist = document.querySelector(".np-line.artist")?.innerText || "";
    const trackInfo = artist ? `${title} - ${artist}` : title;
    const shareData = {
        title: "Pura Gracia Radio",
        text: `Estoy escuchando "${trackInfo}" en Pura Gracia Radio:`,
        url: window.location.href.split("#")[0]
    };
    try {
        if (navigator.share) await navigator.share(shareData);
        else {
            await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
            alert("Enlace copiado al portapapeles");
        }
    } catch (err) {
        console.log("Error al compartir:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const btnCompartir = document.getElementById("btnCompartirDinamico");
    if (btnCompartir) btnCompartir.addEventListener("click", ejecutarCompartir);
});
