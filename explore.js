// explore.js - Interactive engine for "What Does Music Look Like? Explore"
(function() {
  let albums = [];
  let currentFilter = {
    genre: "all",
    decade: "all",
    colorFamily: "all",
    sort: "year-asc",
    search: ""
  };
  let selectedAlbum = null;
  let activeColorFamily = "Blue";
  let activeFingerprintGenre = "Rock";
  let compareGenres = ["Rock", "Jazz"];
  let commonGenres = ["Rock", "Metal", "Alternative"];
  let timelineDecade = "1970s";

  // Precomputed correlation stats from the real 1,602-album dataset
  const STATS = {
    correlations: {
      colorfulness_year: { r: 0.026, p: "0.292", interp: "Virtually uncorrelated across time. Colorfulness does not monotonically increase or decrease." },
      brightness_year: { r: -0.016, p: "0.523", interp: "No linear trend toward darker or brighter covers over 70 years." },
      saturation_year: { r: 0.031, p: "0.218", interp: "Saturation remains balanced across decades with subtle era fluctuations." }
    },
    ml_experiment: {
      num_classes: 23,
      baseline_acc: 4.35,
      actual_acc: 9.43,
      feature_importances: [
        { name: "Hasler-Süsstrunk Colorfulness", val: 14.1 },
        { name: "HSV Saturation", val: 11.0 },
        { name: "Green Channel Mean", val: 10.3 },
        { name: "Red Channel Mean", val: 10.2 },
        { name: "Blue Channel Mean", val: 10.2 },
        { name: "Dark Pixel % (<0.20)", val: 9.8 },
        { name: "Light Pixel % (>0.80)", val: 9.4 },
        { name: "Perceived Brightness", val: 9.2 },
        { name: "Warm Hue Ratio", val: 9.1 },
        { name: "Cool Hue Ratio", val: 6.6 }
      ]
    }
  };

  function init() {
    if (window.ALBUM_FEATURES && window.ALBUM_FEATURES.length > 0) {
      albums = window.ALBUM_FEATURES;
      setupUI();
    } else {
      fetch("data/album_features.json")
        .then(res => res.json())
        .then(data => {
          albums = data;
          setupUI();
        })
        .catch(err => {
          console.error("Failed to load album features:", err);
        });
    }
  }

  function setupUI() {
    renderAlbumWall();
    setupWallControls();
    renderColorOfMusic();
    setupColorSelector();
    renderVisualFingerprints();
    renderCompareSection();
    renderCorrelationsSection();
    renderTimelineSection();
    renderCommonSection();
    renderMLSection();
  }

  // ==========================================
  // SECTION 2: THE GIANT ALBUM WALL
  // ==========================================
  function renderAlbumWall() {
    const grid = document.getElementById("wall-grid");
    const countEl = document.getElementById("wall-count");
    if (!grid) return;

    let filtered = albums.filter(a => {
      if (currentFilter.genre !== "all" && a.genre !== currentFilter.genre) return false;
      if (currentFilter.decade !== "all" && a.decade !== currentFilter.decade) return false;
      if (currentFilter.colorFamily !== "all" && a.color_family !== currentFilter.colorFamily) return false;
      if (currentFilter.search) {
        const q = currentFilter.search.toLowerCase();
        const matchTitle = (a.title || "").toLowerCase().includes(q);
        const matchArtist = (a.artist || "").toLowerCase().includes(q);
        if (!matchTitle && !matchArtist) return false;
      }
      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (currentFilter.sort === "year-asc") return a.year - b.year;
      if (currentFilter.sort === "year-desc") return b.year - a.year;
      if (currentFilter.sort === "bright-desc") return b.brightness - a.brightness;
      if (currentFilter.sort === "bright-asc") return a.brightness - b.brightness;
      if (currentFilter.sort === "sat-desc") return b.saturation - a.saturation;
      if (currentFilter.sort === "sat-asc") return a.saturation - b.saturation;
      if (currentFilter.sort === "color-desc") return b.colorfulness - a.colorfulness;
      return 0;
    });

    if (countEl) {
      countEl.textContent = `Displaying ${filtered.length} of ${albums.length} albums`;
    }

    // Render first 120 items for snappy performance, with "load more" if filtered is large
    const displaySlice = filtered.slice(0, 150);
    grid.innerHTML = "";

    displaySlice.forEach(album => {
      const card = document.createElement("div");
      card.className = "wall-card";
      card.innerHTML = `
        <img src="${album.cover_url}" alt="${escapeHtml(album.title)}" loading="lazy">
        <div class="wall-overlay">
          <div class="wall-swatch" style="background-color: ${album.dominant_color}"></div>
          <div class="wall-title">${escapeHtml(album.title)}</div>
          <div class="wall-artist">${escapeHtml(album.artist)}</div>
          <div class="wall-meta">${album.year} &bull; ${escapeHtml(album.genre)}</div>
          <div class="wall-stats">
            <span>B: ${Math.round(album.brightness * 100)}%</span>
            <span>S: ${Math.round(album.saturation * 100)}%</span>
            <span>C: ${album.colorfulness}</span>
          </div>
        </div>
      `;
      card.addEventListener("click", () => openAlbumModal(album));
      grid.appendChild(card);
    });
  }

  function setupWallControls() {
    const genreSelect = document.getElementById("wall-genre-filter");
    const decadeSelect = document.getElementById("wall-decade-filter");
    const colorSelect = document.getElementById("wall-color-filter");
    const sortSelect = document.getElementById("wall-sort");
    const searchInput = document.getElementById("wall-search");

    if (genreSelect) {
      const genres = Array.from(new Set(albums.map(a => a.genre))).sort();
      genres.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g;
        genreSelect.appendChild(opt);
      });
      genreSelect.addEventListener("change", e => {
        currentFilter.genre = e.target.value;
        renderAlbumWall();
      });
    }

    if (decadeSelect) {
      decadeSelect.addEventListener("change", e => {
        currentFilter.decade = e.target.value;
        renderAlbumWall();
      });
    }

    if (colorSelect) {
      colorSelect.addEventListener("change", e => {
        currentFilter.colorFamily = e.target.value;
        renderAlbumWall();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", e => {
        currentFilter.sort = e.target.value;
        renderAlbumWall();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", e => {
        currentFilter.search = e.target.value;
        renderAlbumWall();
      });
    }

    // Modal close
    const modalClose = document.getElementById("modal-close-btn");
    const modalBackdrop = document.getElementById("album-modal-container");
    if (modalClose && modalBackdrop) {
      modalClose.addEventListener("click", () => {
        modalBackdrop.style.display = "none";
      });
      modalBackdrop.addEventListener("click", e => {
        if (e.target === modalBackdrop) modalBackdrop.style.display = "none";
      });
    }
  }

  function openAlbumModal(album) {
    selectedAlbum = album;
    const modal = document.getElementById("album-modal-container");
    if (!modal) return;

    document.getElementById("modal-cover").src = album.cover_url;
    document.getElementById("modal-title").textContent = album.title;
    document.getElementById("modal-artist").textContent = album.artist;
    document.getElementById("modal-genre-year").textContent = `${album.year} • ${album.genre} • ${album.decade}`;
    
    document.getElementById("modal-dominant-swatch").style.backgroundColor = album.dominant_color;
    document.getElementById("modal-dominant-hex").textContent = album.dominant_color;
    document.getElementById("modal-color-family").textContent = album.color_family;

    document.getElementById("modal-brightness-val").textContent = `${Math.round(album.brightness * 100)}%`;
    document.getElementById("modal-brightness-bar").style.width = `${Math.round(album.brightness * 100)}%`;

    document.getElementById("modal-saturation-val").textContent = `${Math.round(album.saturation * 100)}%`;
    document.getElementById("modal-saturation-bar").style.width = `${Math.round(album.saturation * 100)}%`;

    document.getElementById("modal-colorfulness-val").textContent = album.colorfulness;
    document.getElementById("modal-colorfulness-bar").style.width = `${Math.min(100, album.colorfulness)}%`;

    document.getElementById("modal-dark-val").textContent = `${album.pct_dark}%`;
    document.getElementById("modal-light-val").textContent = `${album.pct_light}%`;
    document.getElementById("modal-warmth-val").textContent = `${Math.round(album.warm_ratio * 100)}% Warm / ${Math.round(album.cool_ratio * 100)}% Cool`;

    const findSimilarBtn = document.getElementById("modal-find-similar-btn");
    if (findSimilarBtn) {
      findSimilarBtn.onclick = () => {
        modal.style.display = "none";
        triggerFindSimilar(album);
      };
    }

    modal.style.display = "flex";
  }

  // ==========================================
  // SECTION 3: THE COLOR OF MUSIC
  // ==========================================
  function setupColorSelector() {
    const swatches = document.querySelectorAll(".color-choice-pill");
    swatches.forEach(btn => {
      btn.addEventListener("click", () => {
        swatches.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeColorFamily = btn.getAttribute("data-color");
        renderColorOfMusic();
      });
    });
  }

  function renderColorOfMusic() {
    const colorAlbums = albums.filter(a => a.color_family.toLowerCase() === activeColorFamily.toLowerCase());
    const total = albums.length;
    const count = colorAlbums.length;
    const pct = ((count / total) * 100).toFixed(1);

    document.getElementById("color-name-display").textContent = activeColorFamily.toUpperCase();
    document.getElementById("color-summary-stats").innerHTML = `
      <strong>${count}</strong> albums (${pct}% of the 1,602-album archive) feature a dominant <strong>${activeColorFamily}</strong> palette.
    `;

    // Genre distribution for this color
    const genreCounts = {};
    colorAlbums.forEach(a => {
      genreCounts[a.genre] = (genreCounts[a.genre] || 0) + 1;
    });
    const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const genreListEl = document.getElementById("color-genre-breakdown");
    if (genreListEl) {
      genreListEl.innerHTML = sortedGenres.map(([g, c]) => {
        const p = ((c / count) * 100).toFixed(1);
        return `
          <div class="bar-row">
            <span class="bar-label">${g}</span>
            <div class="bar-track"><div class="bar-fill" style="width: ${p}%"></div></div>
            <span class="bar-val">${c} (${p}%)</span>
          </div>
        `;
      }).join("");
    }

    // Decade distribution for this color
    const decadeCounts = {};
    colorAlbums.forEach(a => {
      decadeCounts[a.decade] = (decadeCounts[a.decade] || 0) + 1;
    });
    const sortedDecades = Object.entries(decadeCounts).sort((a, b) => b[1] - a[1]);
    const decadeListEl = document.getElementById("color-decade-breakdown");
    if (decadeListEl) {
      decadeListEl.innerHTML = sortedDecades.map(([d, c]) => {
        const p = ((c / count) * 100).toFixed(1);
        return `
          <div class="bar-row">
            <span class="bar-label">${d}</span>
            <div class="bar-track"><div class="bar-fill" style="width: ${p}%"></div></div>
            <span class="bar-val">${c} (${p}%)</span>
          </div>
        `;
      }).join("");
    }

    // Averages for this color
    if (count > 0) {
      const avgB = (colorAlbums.reduce((sum, a) => sum + a.brightness, 0) / count * 100).toFixed(1);
      const avgS = (colorAlbums.reduce((sum, a) => sum + a.saturation, 0) / count * 100).toFixed(1);
      const avgC = (colorAlbums.reduce((sum, a) => sum + a.colorfulness, 0) / count).toFixed(1);

      document.getElementById("color-avg-brightness").textContent = `${avgB}%`;
      document.getElementById("color-avg-saturation").textContent = `${avgS}%`;
      document.getElementById("color-avg-colorfulness").textContent = `${avgC}`;
    }

    // Example albums
    const examplesGrid = document.getElementById("color-example-albums");
    if (examplesGrid) {
      examplesGrid.innerHTML = "";
      colorAlbums.slice(0, 8).forEach(a => {
        const el = document.createElement("div");
        el.className = "color-example-card";
        el.innerHTML = `
          <img src="${a.cover_url}" alt="${escapeHtml(a.title)}" loading="lazy">
          <div class="color-example-info">
            <strong>${escapeHtml(a.title)}</strong>
            <small>${escapeHtml(a.artist)} (${a.year})</small>
          </div>
        `;
        el.addEventListener("click", () => openAlbumModal(a));
        examplesGrid.appendChild(el);
      });
    }
  }

  // ==========================================
  // SECTION 4: VISUAL FINGERPRINTS
  // ==========================================
  function renderVisualFingerprints() {
    const selector = document.getElementById("fingerprint-genre-select");
    const container = document.getElementById("fingerprint-display");
    if (!selector || !container) return;

    const genres = Array.from(new Set(albums.map(a => a.genre))).sort();
    selector.innerHTML = "";
    genres.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      if (g === activeFingerprintGenre) opt.selected = true;
      selector.appendChild(opt);
    });

    selector.addEventListener("change", e => {
      activeFingerprintGenre = e.target.value;
      updateFingerprintView();
    });

    updateFingerprintView();
  }

  function updateFingerprintView() {
    const genreAlbums = albums.filter(a => a.genre === activeFingerprintGenre);
    if (!genreAlbums.length) return;

    const count = genreAlbums.length;
    const avgB = (genreAlbums.reduce((s, a) => s + a.brightness, 0) / count * 100).toFixed(1);
    const avgS = (genreAlbums.reduce((s, a) => s + a.saturation, 0) / count * 100).toFixed(1);
    const avgC = (genreAlbums.reduce((s, a) => s + a.colorfulness, 0) / count).toFixed(1);
    const avgDark = (genreAlbums.reduce((s, a) => s + a.pct_dark, 0) / count).toFixed(1);
    const avgLight = (genreAlbums.reduce((s, a) => s + a.pct_light, 0) / count).toFixed(1);
    const avgWarm = (genreAlbums.reduce((s, a) => s + a.warm_ratio, 0) / count * 100).toFixed(1);
    const avgCool = (genreAlbums.reduce((s, a) => s + a.cool_ratio, 0) / count * 100).toFixed(1);

    // Color distribution
    const colorDist = {};
    genreAlbums.forEach(a => {
      colorDist[a.color_family] = (colorDist[a.color_family] || 0) + 1;
    });
    const topColors = Object.entries(colorDist).sort((a, b) => b[1] - a[1]);

    const titleEl = document.getElementById("fingerprint-genre-title");
    if (titleEl) titleEl.textContent = `${activeFingerprintGenre.toUpperCase()} (${count} Analyzed Albums)`;

    document.getElementById("fp-val-bright").textContent = `${avgB}%`;
    document.getElementById("fp-bar-bright").style.width = `${avgB}%`;

    document.getElementById("fp-val-sat").textContent = `${avgS}%`;
    document.getElementById("fp-bar-sat").style.width = `${avgS}%`;

    document.getElementById("fp-val-color").textContent = `${avgC}`;
    document.getElementById("fp-bar-color").style.width = `${Math.min(100, avgC)}%`;

    document.getElementById("fp-val-dark").textContent = `${avgDark}%`;
    document.getElementById("fp-bar-dark").style.width = `${avgDark}%`;

    document.getElementById("fp-val-light").textContent = `${avgLight}%`;
    document.getElementById("fp-bar-light").style.width = `${avgLight}%`;

    document.getElementById("fp-val-warmth").textContent = `${avgWarm}% Warm / ${avgCool}% Cool`;
    document.getElementById("fp-bar-warmth").style.width = `${avgWarm}%`;

    const colorsEl = document.getElementById("fp-top-colors");
    if (colorsEl) {
      colorsEl.innerHTML = topColors.map(([name, c]) => {
        const pct = ((c / count) * 100).toFixed(1);
        return `<span class="tag-pill">${name}: ${pct}%</span>`;
      }).join(" ");
    }

    // Exemplar albums
    const galleryEl = document.getElementById("fp-exemplar-covers");
    if (galleryEl) {
      galleryEl.innerHTML = "";
      genreAlbums.slice(0, 6).forEach(a => {
        const img = document.createElement("img");
        img.src = a.cover_url;
        img.alt = a.title;
        img.title = `${a.title} - ${a.artist}`;
        img.onclick = () => openAlbumModal(a);
        galleryEl.appendChild(img);
      });
    }
  }

  // ==========================================
  // SECTION 5: COMPARE MUSIC
  // ==========================================
  function renderCompareSection() {
    const sel1 = document.getElementById("compare-genre-1");
    const sel2 = document.getElementById("compare-genre-2");
    if (!sel1 || !sel2) return;

    const genres = Array.from(new Set(albums.map(a => a.genre))).sort();
    [sel1, sel2].forEach(sel => {
      sel.innerHTML = "";
      genres.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g;
        sel.appendChild(opt);
      });
    });

    sel1.value = compareGenres[0] || "Rock";
    sel2.value = compareGenres[1] || "Jazz";

    const updateCompare = () => {
      compareGenres = [sel1.value, sel2.value];
      executeComparison();
    };

    sel1.addEventListener("change", updateCompare);
    sel2.addEventListener("change", updateCompare);

    executeComparison();
  }

  function executeComparison() {
    const g1 = compareGenres[0];
    const g2 = compareGenres[1];
    const list1 = albums.filter(a => a.genre === g1);
    const list2 = albums.filter(a => a.genre === g2);
    if (!list1.length || !list2.length) return;

    const stat = list => {
      const n = list.length;
      return {
        brightness: list.reduce((s, a) => s + a.brightness, 0) / n,
        saturation: list.reduce((s, a) => s + a.saturation, 0) / n,
        colorfulness: list.reduce((s, a) => s + a.colorfulness, 0) / n,
        pct_dark: list.reduce((s, a) => s + a.pct_dark, 0) / n,
        pct_light: list.reduce((s, a) => s + a.pct_light, 0) / n,
        warm_ratio: list.reduce((s, a) => s + a.warm_ratio, 0) / n
      };
    };

    const s1 = stat(list1);
    const s2 = stat(list2);

    const container = document.getElementById("compare-results");
    if (!container) return;

    // Calculate shared traits and differences mathematically
    const diffs = [];
    const shared = [];

    const checkMetric = (label, v1, v2, unit, threshold) => {
      const diff = Math.abs(v1 - v2);
      if (diff < threshold) {
        shared.push(`<strong>${label}</strong> is remarkably similar (${(v1*unit).toFixed(1)} vs ${(v2*unit).toFixed(1)}).`);
      } else {
        const higher = v1 > v2 ? g1 : g2;
        const lower = v1 > v2 ? g2 : g1;
        const delta = Math.abs(v1 - v2) * unit;
        diffs.push(`<strong>${higher}</strong> has higher ${label.toLowerCase()} (+${delta.toFixed(1)}${unit === 100 ? '%' : ''}) than <strong>${lower}</strong>.`);
      }
    };

    checkMetric("Average Brightness", s1.brightness, s2.brightness, 100, 0.04);
    checkMetric("Saturation", s1.saturation, s2.saturation, 100, 0.04);
    checkMetric("Colorfulness", s1.colorfulness, s2.colorfulness, 1, 4.0);
    checkMetric("Dark Pixel Proportion", s1.pct_dark, s2.pct_dark, 1, 6.0);
    checkMetric("Warm Tone Ratio", s1.warm_ratio, s2.warm_ratio, 100, 0.08);

    container.innerHTML = `
      <div class="comparison-grid">
        <div class="compare-card">
          <h4>${g1.toUpperCase()}</h4>
          <p class="text-muted">${list1.length} albums sampled</p>
          <div class="metric-row"><span>Brightness:</span> <strong>${(s1.brightness*100).toFixed(1)}%</strong></div>
          <div class="metric-row"><span>Saturation:</span> <strong>${(s1.saturation*100).toFixed(1)}%</strong></div>
          <div class="metric-row"><span>Colorfulness:</span> <strong>${s1.colorfulness.toFixed(1)}</strong></div>
          <div class="metric-row"><span>Dark Pixels:</span> <strong>${s1.pct_dark.toFixed(1)}%</strong></div>
          <div class="metric-row"><span>Warmth Ratio:</span> <strong>${(s1.warm_ratio*100).toFixed(1)}%</strong></div>
        </div>

        <div class="compare-card">
          <h4>${g2.toUpperCase()}</h4>
          <p class="text-muted">${list2.length} albums sampled</p>
          <div class="metric-row"><span>Brightness:</span> <strong>${(s2.brightness*100).toFixed(1)}%</strong></div>
          <div class="metric-row"><span>Saturation:</span> <strong>${(s2.saturation*100).toFixed(1)}%</strong></div>
          <div class="metric-row"><span>Colorfulness:</span> <strong>${s2.colorfulness.toFixed(1)}</strong></div>
          <div class="metric-row"><span>Dark Pixels:</span> <strong>${s2.pct_dark.toFixed(1)}%</strong></div>
          <div class="metric-row"><span>Warmth Ratio:</span> <strong>${(s2.warm_ratio*100).toFixed(1)}%</strong></div>
        </div>
      </div>

      <div class="compare-analysis">
        <div class="analysis-box shared-box">
          <h5><i class="bi bi-intersect"></i> What They Have in Common</h5>
          <ul>${shared.length ? shared.map(s => `<li>${s}</li>`).join("") : "<li>These genres show distinct divergence across core image metrics.</li>"}</ul>
        </div>
        <div class="analysis-box diff-box">
          <h5><i class="bi bi-arrows-expand"></i> Measurable Differences</h5>
          <ul>${diffs.map(d => `<li>${d}</li>`).join("")}</ul>
        </div>
      </div>
    `;
  }

  // ==========================================
  // SECTION 6: COLOR CORRELATIONS
  // ==========================================
  function renderCorrelationsSection() {
    const list = document.getElementById("correlation-facts-list");
    if (!list) return;

    list.innerHTML = `
      <div class="corr-item">
        <div class="corr-header">
          <strong>Colorfulness ↔ Release Year</strong>
          <span class="badge-corr">r = +0.026 (p = 0.29)</span>
        </div>
        <p>Across the 7-decade span (1950s to 2020s), there is virtually zero linear correlation between the release year and album cover colorfulness. Contrary to popular assumptions that digital printing and screen aesthetics made modern album artwork dramatically more colorful, the mean colorfulness has stayed surprisingly steady.</p>
      </div>

      <div class="corr-item">
        <div class="corr-header">
          <strong>Cover Brightness ↔ Release Year</strong>
          <span class="badge-corr">r = -0.016 (p = 0.52)</span>
        </div>
        <p>Similarly, perceived cover brightness exhibits no significant monotonic drift over time. Album artwork has not become systematically brighter or darker across decades; instead, each decade maintains its own internal range of dark and light covers.</p>
      </div>

      <div class="corr-item">
        <div class="corr-header">
          <strong>Genre ↔ Cover Brightness</strong>
          <span class="badge-corr">Significant (ANOVA p < 0.001)</span>
        </div>
        <p>Genre is strongly associated with cover brightness. <strong>Metal</strong> has the lowest mean brightness (0.342) and highest dark-pixel percentage (44.6%), while <strong>Punk</strong> (0.496) and <strong>Folk</strong> (0.487) skew substantially brighter, featuring exposed paper, stark high-key whites, and outdoor natural light.</p>
      </div>

      <div class="corr-item">
        <div class="corr-header">
          <strong>Genre ↔ Saturation</strong>
          <span class="badge-corr">Significant (ANOVA p < 0.001)</span>
        </div>
        <p><strong>Disco</strong> achieves the highest saturation across all 23 genres (0.504), reflecting high-energy neon dancefloor culture, whereas <strong>Techno</strong> (0.274) and <strong>Rock</strong> (0.291) heavily favor desaturated, industrial, and monochrome visual treatments.</p>
      </div>
    `;
  }

  // ==========================================
  // SECTION 7: MUSIC THROUGH TIME
  // ==========================================
  function renderTimelineSection() {
    const decadeButtons = document.querySelectorAll(".decade-scrub-btn");
    decadeButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        decadeButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        timelineDecade = btn.getAttribute("data-decade");
        updateTimelineView();
      });
    });

    updateTimelineView();
  }

  function updateTimelineView() {
    const decAlbums = albums.filter(a => a.decade === timelineDecade);
    const count = decAlbums.length;
    if (!count) return;

    const avgB = (decAlbums.reduce((s, a) => s + a.brightness, 0) / count * 100).toFixed(1);
    const avgS = (decAlbums.reduce((s, a) => s + a.saturation, 0) / count * 100).toFixed(1);
    const avgC = (decAlbums.reduce((s, a) => s + a.colorfulness, 0) / count).toFixed(1);

    document.getElementById("timeline-decade-label").textContent = timelineDecade;
    document.getElementById("timeline-count").textContent = `${count} albums in archive`;
    document.getElementById("timeline-avg-b").textContent = `${avgB}%`;
    document.getElementById("timeline-avg-s").textContent = `${avgS}%`;
    document.getElementById("timeline-avg-c").textContent = `${avgC}`;

    // Top genres in this decade
    const gCounts = {};
    decAlbums.forEach(a => gCounts[a.genre] = (gCounts[a.genre] || 0) + 1);
    const topG = Object.entries(gCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const topGEl = document.getElementById("timeline-top-genres");
    if (topGEl) {
      topGEl.innerHTML = topG.map(([g, c]) => `<span class="tag-pill">${g} (${c})</span>`).join(" ");
    }

    // Cover gallery for this decade
    const gallery = document.getElementById("timeline-covers-gallery");
    if (gallery) {
      gallery.innerHTML = "";
      decAlbums.slice(0, 14).forEach(a => {
        const item = document.createElement("div");
        item.className = "timeline-cover-card";
        item.innerHTML = `
          <img src="${a.cover_url}" alt="${escapeHtml(a.title)}" loading="lazy">
          <div class="timeline-cover-info">
            <strong>${escapeHtml(a.title)}</strong>
            <span>${escapeHtml(a.artist)} (${a.year})</span>
          </div>
        `;
        item.addEventListener("click", () => openAlbumModal(a));
        gallery.appendChild(item);
      });
    }
  }

  // ==========================================
  // SECTION 8: WHAT DO THEY HAVE IN COMMON?
  // ==========================================
  function renderCommonSection() {
    const checkboxes = document.querySelectorAll(".common-genre-chk");
    checkboxes.forEach(chk => {
      chk.addEventListener("change", () => {
        const checked = Array.from(document.querySelectorAll(".common-genre-chk:checked")).map(c => c.value);
        if (checked.length >= 2) {
          commonGenres = checked;
          calculateCommonalities();
        } else {
          document.getElementById("common-results").innerHTML = `<p class="alert-hint">Please select at least 2 genres to analyze their visual commonalities.</p>`;
        }
      });
    });

    calculateCommonalities();
  }

  function calculateCommonalities() {
    const resBox = document.getElementById("common-results");
    if (!resBox) return;

    const genreData = commonGenres.map(g => {
      const list = albums.filter(a => a.genre === g);
      const n = list.length || 1;
      return {
        genre: g,
        count: list.length,
        b: list.reduce((s, a) => s + a.brightness, 0) / n,
        s: list.reduce((s, a) => s + a.saturation, 0) / n,
        c: list.reduce((s, a) => s + a.colorfulness, 0) / n,
        dark: list.reduce((s, a) => s + a.pct_dark, 0) / n,
        warm: list.reduce((s, a) => s + a.warm_ratio, 0) / n
      };
    });

    const bRange = Math.max(...genreData.map(d => d.b)) - Math.min(...genreData.map(d => d.b));
    const sRange = Math.max(...genreData.map(d => d.s)) - Math.min(...genreData.map(d => d.s));
    const cRange = Math.max(...genreData.map(d => d.c)) - Math.min(...genreData.map(d => d.c));
    const darkRange = Math.max(...genreData.map(d => d.dark)) - Math.min(...genreData.map(d => d.dark));

    const findings = [];
    if (bRange <= 0.05) {
      const avg = (genreData.reduce((s, d) => s + d.b, 0) / genreData.length * 100).toFixed(1);
      findings.push(`<strong>Tight Brightness Alignment:</strong> All selected genres converge within a 5% spread in average cover brightness (cluster mean: ~${avg}%).`);
    }
    if (sRange <= 0.06) {
      const avg = (genreData.reduce((s, d) => s + d.s, 0) / genreData.length * 100).toFixed(1);
      findings.push(`<strong>Consistent Saturation:</strong> Saturation variance is low across this cluster (mean saturation: ~${avg}%).`);
    }
    if (cRange <= 5.0) {
      findings.push(`<strong>Comparable Color Complexity:</strong> Average Hasler-Süsstrunk colorfulness scores remain within 5 units across all selected genres.`);
    }
    if (darkRange <= 8.0) {
      const avg = (genreData.reduce((s, d) => s + d.dark, 0) / genreData.length).toFixed(1);
      findings.push(`<strong>Shared Dark Aesthetic:</strong> All chosen genres devote ~${avg}% of their pixel surface to deep shadows and dark tones.`);
    }

    if (!findings.length) {
      findings.push(`<strong>High Visual Divergence:</strong> The selected genres span contrasting ends of the visual spectrum with minimal overlap in brightness, saturation, and color complexity.`);
    }

    resBox.innerHTML = `
      <div class="common-summary-card">
        <h5>Cluster: ${commonGenres.join(" + ")}</h5>
        <ul>${findings.map(f => `<li>${f}</li>`).join("")}</ul>
      </div>
    `;
  }

  // ==========================================
  // SECTION 10: FIND VISUALLY SIMILAR
  // ==========================================
  function triggerFindSimilar(targetAlbum) {
    const similarContainer = document.getElementById("similar-section-anchor");
    if (similarContainer) {
      similarContainer.scrollIntoView({ behavior: "smooth" });
    }

    const titleEl = document.getElementById("similar-target-title");
    const targetCard = document.getElementById("similar-target-display");
    const resultsGrid = document.getElementById("similar-matches-grid");
    if (!targetCard || !resultsGrid) return;

    if (titleEl) titleEl.textContent = `Visually Similar to "${targetAlbum.title}" (${targetAlbum.artist})`;

    targetCard.innerHTML = `
      <div class="similar-anchor-card">
        <img src="${targetAlbum.cover_url}" alt="${escapeHtml(targetAlbum.title)}">
        <div class="similar-card-info">
          <h6>${escapeHtml(targetAlbum.title)}</h6>
          <small>${escapeHtml(targetAlbum.artist)}</small>
          <div><span class="tag-pill">${targetAlbum.genre}</span> <span class="tag-pill">${targetAlbum.year}</span></div>
          <div class="similar-mini-stats">
            <span>B: ${Math.round(targetAlbum.brightness*100)}%</span>
            <span>S: ${Math.round(targetAlbum.saturation*100)}%</span>
            <span>C: ${targetAlbum.colorfulness}</span>
          </div>
        </div>
      </div>
    `;

    // Calculate Euclidean distance in normalized feature space:
    // features: brightness, saturation, colorfulness/100, r_mean, g_mean, b_mean, warm_ratio
    const scored = albums
      .filter(a => a.id !== targetAlbum.id)
      .map(a => {
        const db = targetAlbum.brightness - a.brightness;
        const ds = targetAlbum.saturation - a.saturation;
        const dc = (targetAlbum.colorfulness - a.colorfulness) / 100.0;
        const dr = (targetAlbum.r_mean || 0) - (a.r_mean || 0);
        const dg = (targetAlbum.g_mean || 0) - (a.g_mean || 0);
        const d_b = (targetAlbum.b_mean || 0) - (a.b_mean || 0);
        const dw = targetAlbum.warm_ratio - a.warm_ratio;

        const dist = Math.sqrt(
          (db * db * 2.0) +
          (ds * ds * 1.5) +
          (dc * dc * 1.0) +
          (dr * dr * 1.5) +
          (dg * dg * 1.5) +
          (d_b * d_b * 1.5) +
          (dw * dw * 1.0)
        );
        return { album: a, distance: dist };
      });

    scored.sort((a, b) => a.distance - b.distance);
    const topMatches = scored.slice(0, 6);

    resultsGrid.innerHTML = "";
    topMatches.forEach(({ album, distance }) => {
      const matchScore = Math.max(0, Math.round((1 - (distance / 1.5)) * 100));
      const el = document.createElement("div");
      el.className = "similar-result-card";
      el.innerHTML = `
        <div class="match-badge">${matchScore}% Visual Match</div>
        <img src="${album.cover_url}" alt="${escapeHtml(album.title)}" loading="lazy">
        <div class="similar-result-info">
          <strong>${escapeHtml(album.title)}</strong>
          <span>${escapeHtml(album.artist)}</span>
          <div class="similar-sub"><span class="badge-genre">${album.genre}</span> &bull; ${album.year}</div>
        </div>
      `;
      el.addEventListener("click", () => openAlbumModal(album));
      resultsGrid.appendChild(el);
    });
  }

  // ==========================================
  // SECTION 11: MACHINE LEARNING EXPERIMENT
  // ==========================================
  function renderMLSection() {
    const tableBody = document.getElementById("ml-feature-table");
    if (!tableBody) return;

    tableBody.innerHTML = STATS.ml_experiment.feature_importances.map(f => `
      <tr>
        <td><strong>${f.name}</strong></td>
        <td>
          <div class="bar-track"><div class="bar-fill" style="width: ${f.val * 5}%"></div></div>
        </td>
        <td><strong>${f.val}%</strong></td>
      </tr>
    `).join("");
  }

  // Utility
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // DOM ready check
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
