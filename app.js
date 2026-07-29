const elements = {
  loading: document.querySelector("#loading"),
  dateSelect: document.querySelector("#dateSelect"),
  dateRail: document.querySelector("#dateRail"),
  selectedDateLabel: document.querySelector("#selectedDateLabel"),
  gallery: document.querySelector("#gallery"),
  galleryEyebrow: document.querySelector("#galleryEyebrow"),
  galleryTitle: document.querySelector("#galleryTitle"),
  galleryDescription: document.querySelector("#galleryDescription"),
  emptyState: document.querySelector("#emptyState"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyMessage: document.querySelector("#emptyMessage"),
  updatedAt: document.querySelector("#updatedAt"),
  lightbox: document.querySelector("#lightbox"),
  lightboxTitle: document.querySelector("#lightboxTitle"),
  lightboxImage: document.querySelector("#lightboxImage"),
};

const state = {
  data: null,
  date: null,
  mode: "daily",
};

const repository = {
  manifest:
    "https://raw.githubusercontent.com/zrwrz/pokemon-challenge-meta-eval/main/gallery-manifest.json",
};

function splitDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function formatDate(date, full = true) {
  const { year, month, day } = splitDate(date);
  const value = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    month: full ? "long" : "short",
    day: "numeric",
    ...(full ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(value);
}

function selectedEntry() {
  return state.data.dates.find((entry) => entry.date === state.date);
}

function availableForMode(entry, mode) {
  return Array.isArray(entry?.[mode]) && entry[mode].length > 0;
}

async function discoverRemoteGallery() {
  const response = await fetch(`${repository.manifest}?v=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Gallery manifest request failed: ${response.status}`);
  }
  return response.json();
}

function renderDateControls() {
  elements.dateSelect.innerHTML = state.data.dates
    .map((entry) => {
      const dailyMark = availableForMode(entry, "daily") ? "" : " (no daily figures)";
      return `<option value="${entry.date}">${formatDate(entry.date)}${dailyMark}</option>`;
    })
    .join("");

  elements.dateRail.innerHTML = state.data.dates
    .map((entry, index) => {
      const { year, month, day } = splitDate(entry.date);
      const hasDaily = availableForMode(entry, "daily");
      const hasCumulative = availableForMode(entry, "cumulative");
      const badge = hasDaily && hasCumulative ? "Both" : hasDaily ? "Daily" : "Cumulative";
      return `
        <button
          class="date-chip${index === 0 ? " is-active" : ""}"
          type="button"
          data-date="${entry.date}"
          aria-pressed="${index === 0}"
        >
          <i aria-hidden="true"></i>
          <span>
            <strong>${month}.${String(day).padStart(2, "0")}</strong>
            <small>${year} · ${badge}</small>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderGallery() {
  const entry = selectedEntry();
  const figures = entry?.[state.mode] ?? [];
  const isDaily = state.mode === "daily";

  elements.galleryEyebrow.textContent = isDaily
    ? "DAILY FIELD REPORT"
    : "CUMULATIVE FIELD REPORT";
  elements.galleryTitle.textContent = isDaily
    ? "Daily meta gallery"
    : "Cumulative meta gallery";
  elements.galleryDescription.textContent = isDaily
    ? "All four reports are shown together. Select any image to inspect it at full size."
    : `Cumulative reports generated through ${formatDate(state.date)}.`;

  const empty = figures.length === 0;
  elements.gallery.classList.toggle("is-hidden", empty);
  elements.emptyState.classList.toggle("is-hidden", !empty);

  if (empty) {
    elements.emptyTitle.textContent = isDaily
      ? "No daily report for this date"
      : "No cumulative report for this date";
    elements.emptyMessage.textContent = isDaily
      ? `Add figures to meta-analysis/${state.date}/figures and push the update.`
      : "Add the matching cumulative figures and push the update.";
    elements.gallery.innerHTML = "";
    return;
  }

  elements.gallery.innerHTML = figures
    .map(
      (figure, index) => `
        <article class="report-card">
          <header>
            <span class="report-index">0${index + 1}</span>
            <div>
              <h3>${figure.title}</h3>
              <p>${figure.caption}</p>
            </div>
          </header>
          <button
            class="image-button"
            type="button"
            data-image="${figure.src}"
            data-title="${figure.title} · ${formatDate(state.date)}"
            aria-label="Open ${figure.title} at full size"
          >
            <img
              src="${figure.src}"
              alt="${formatDate(state.date)} ${figure.title}"
              ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
            />
            <span>View full size ↗</span>
          </button>
        </article>
      `,
    )
    .join("");
}

function setDate(date) {
  state.date = date;
  elements.dateSelect.value = date;
  elements.selectedDateLabel.textContent = formatDate(date);

  document.querySelectorAll(".date-chip").forEach((button) => {
    const active = button.dataset.date === date;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderGallery();
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-button").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderGallery();
}

function openLightbox(button) {
  elements.lightboxTitle.textContent = button.dataset.title;
  elements.lightboxImage.src = button.dataset.image;
  elements.lightboxImage.alt = button.dataset.title;
  elements.lightbox.showModal();
}

function bindEvents() {
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  elements.dateSelect.addEventListener("change", (event) => setDate(event.target.value));
  elements.dateRail.addEventListener("click", (event) => {
    const button = event.target.closest(".date-chip");
    if (button) setDate(button.dataset.date);
  });
  elements.gallery.addEventListener("click", (event) => {
    const button = event.target.closest(".image-button");
    if (button) openLightbox(button);
  });
  document.querySelector(".lightbox-close").addEventListener("click", () => {
    elements.lightbox.close();
  });
  elements.lightbox.addEventListener("click", (event) => {
    if (event.target === elements.lightbox) elements.lightbox.close();
  });
}

async function initialize() {
  try {
    try {
      state.data = await discoverRemoteGallery();
    } catch (remoteError) {
      console.warn("Remote discovery unavailable; using bundled gallery data.", remoteError);
      const response = await fetch("./site-data.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load site data: ${response.status}`);
      state.data = await response.json();
    }
    if (!state.data.dates?.length) throw new Error("No dates available");

    state.date = state.data.dates[0].date;
    renderDateControls();
    setDate(state.date);
    setMode(state.mode);
    bindEvents();

    elements.updatedAt.textContent =
      `Data available through ${formatDate(state.data.dates[0].date)}`;
    requestAnimationFrame(() => elements.loading.classList.add("is-ready"));
  } catch (error) {
    console.error(error);
    elements.loading.querySelector("p").textContent =
      "The gallery could not be loaded. Please try again.";
  }
}

initialize();
