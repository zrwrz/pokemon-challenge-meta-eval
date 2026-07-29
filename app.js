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

function splitDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function formatDate(date, full = true) {
  const { year, month, day } = splitDate(date);
  return full ? `${year}年${month}月${day}日` : `${month}.${String(day).padStart(2, "0")}`;
}

function selectedEntry() {
  return state.data.dates.find((entry) => entry.date === state.date);
}

function availableForMode(entry, mode) {
  return Array.isArray(entry?.[mode]) && entry[mode].length > 0;
}

function renderDateControls() {
  elements.dateSelect.innerHTML = state.data.dates
    .map((entry) => {
      const dailyMark = availableForMode(entry, "daily") ? "" : "（无单日图）";
      return `<option value="${entry.date}">${formatDate(entry.date)}${dailyMark}</option>`;
    })
    .join("");

  elements.dateRail.innerHTML = state.data.dates
    .map((entry, index) => {
      const { year, month, day } = splitDate(entry.date);
      const hasDaily = availableForMode(entry, "daily");
      const hasCumulative = availableForMode(entry, "cumulative");
      const badge = hasDaily && hasCumulative ? "双模式" : hasDaily ? "单日" : "累计";
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
  elements.galleryTitle.textContent = isDaily ? "单日环境图集" : "累计环境图集";
  elements.galleryDescription.textContent = isDaily
    ? "四张战报同页呈现，点击任意图片可放大查看完整细节。"
    : `展示截至 ${formatDate(state.date)} 生成的累计分析图。`;

  const empty = figures.length === 0;
  elements.gallery.classList.toggle("is-hidden", empty);
  elements.emptyState.classList.toggle("is-hidden", !empty);

  if (empty) {
    elements.emptyTitle.textContent = isDaily
      ? "这一天还没有单日分析图"
      : "这一天还没有累计分析图";
    elements.emptyMessage.textContent = isDaily
      ? `请将图片放入 meta-analysis/${state.date}/figures 后重新部署。`
      : `请将图片放入 meta-analysis/cumulative/${state.date}/figures 后重新部署。`;
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
            aria-label="打开${figure.title}大图"
          >
            <img
              src="${figure.src}"
              alt="${formatDate(state.date)} ${figure.title}"
              ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
            />
            <span>查看大图 ↗</span>
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
    const response = await fetch("./site-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load site data: ${response.status}`);
    state.data = await response.json();
    if (!state.data.dates?.length) throw new Error("No dates available");

    state.date = state.data.dates[0].date;
    renderDateControls();
    setDate(state.date);
    setMode(state.mode);
    bindEvents();

    const updated = new Date(state.data.generatedAt);
    elements.updatedAt.textContent =
      `图集生成于 ${updated.toLocaleString("zh-CN", { hour12: false })}`;
    requestAnimationFrame(() => elements.loading.classList.add("is-ready"));
  } catch (error) {
    console.error(error);
    elements.loading.querySelector("p").textContent = "图集载入失败，请稍后重试。";
  }
}

initialize();
