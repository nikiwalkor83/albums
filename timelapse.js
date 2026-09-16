// Timelapse Background Engine for Album Covers
(function () {
  // Wait until DOM is ready
  document.addEventListener("DOMContentLoaded", initTimelapse);

  function initTimelapse() {
    // Check if album data is passed from Quarto / R
    const albums = window.ALBUM_DATA || [];
    if (!albums || albums.length === 0) return;

    // Create background container structure
    const bg = document.createElement("div");
    bg.id = "timelapse-bg";

    const layerDeep = document.createElement("div");
    layerDeep.className = "bg-layer layer-deep";

    const layerMid = document.createElement("div");
    layerMid.className = "bg-layer layer-mid";

    const layerFront = document.createElement("div");
    layerFront.className = "bg-layer layer-front";

    const overlay = document.createElement("div");
    overlay.className = "timelapse-overlay";

    const decadeIndicator = document.createElement("div");
    decadeIndicator.id = "decade-indicator";
    decadeIndicator.textContent = "1960s";

    // Detail modal for clicked album
    const modal = document.createElement("div");
    modal.id = "album-detail-modal";
    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
        <span id="modal-decade" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; background:rgba(255,255,255,0.15); padding:2px 8px; border-radius:4px;">Decade</span>
        <button id="modal-close" style="background:transparent; border:none; color:#aaa; font-size:1.2rem; cursor:pointer;">&times;</button>
      </div>
      <img id="modal-img" src="" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; margin-bottom:12px; box-shadow:0 6px 18px rgba(0,0,0,0.5);">
      <h4 id="modal-title" style="margin:0 0 4px 0; font-size:1.1rem;">Title</h4>
      <p id="modal-artist" style="margin:0 0 4px 0; color:#ddd; font-size:0.95rem;">Artist</p>
      <p id="modal-meta" style="margin:0; color:#888; font-size:0.85rem;">Year &bull; Genre</p>
    `;

    bg.appendChild(layerDeep);
    bg.appendChild(layerMid);
    bg.appendChild(layerFront);
    document.body.prepend(bg);
    document.body.appendChild(overlay);
    document.body.appendChild(decadeIndicator);
    document.body.appendChild(modal);

    modal.querySelector("#modal-close").addEventListener("click", () => {
      modal.classList.remove("active");
    });

    // Close modal when clicking outside
    document.addEventListener("click", (e) => {
      if (!modal.contains(e.target) && !e.target.closest(".album-card")) {
        modal.classList.remove("active");
      }
    });

    // Group albums by decade
    const decades = [...new Set(albums.map((a) => a.decade || "Unknown"))].sort();
    let currentDecadeIndex = 0;

    // Timelapse timer: advance decade every 10 seconds
    setInterval(() => {
      if (decades.length > 0) {
        currentDecadeIndex = (currentDecadeIndex + 1) % decades.length;
        const currentDecade = decades[currentDecadeIndex];
        decadeIndicator.style.opacity = "0";
        setTimeout(() => {
          decadeIndicator.textContent = currentDecade;
          decadeIndicator.style.opacity = "0.3";
        }, 500);
      }
    }, 10000);

    // Initial decade label
    if (decades.length > 0) {
      decadeIndicator.textContent = decades[0];
    }

    // Determine card limit based on screen width for smooth performance
    const isMobile = window.innerWidth < 768;
    const maxActiveCards = isMobile ? 8 : 18;
    const layers = [
      { el: layerDeep, speedMultiplier: 0.45, size: isMobile ? 80 : 130 },
      { el: layerMid, speedMultiplier: 0.75, size: isMobile ? 110 : 170 },
      { el: layerFront, speedMultiplier: 1.1, size: isMobile ? 140 : 220 },
    ];

    let activeCards = [];

    // Helper: Pick an album favoring the current timelapse decade
    function getNextAlbum() {
      const activeDecade = decades[currentDecadeIndex];
      const decadeFiltered = albums.filter((a) => a.decade === activeDecade);
      // 70% chance from current decade for timelapse feel, 30% random mix
      if (decadeFiltered.length > 0 && Math.random() < 0.7) {
        return decadeFiltered[Math.floor(Math.random() * decadeFiltered.length)];
      }
      return albums[Math.floor(Math.random() * albums.length)];
    }

    // Spawn an animated floating card
    function spawnCard() {
      if (activeCards.length >= maxActiveCards) return;

      const album = getNextAlbum();
      if (!album || !album.cover_url) return;

      // Assign to one of the 3 parallax layers
      const layerIndex = Math.floor(Math.random() * layers.length);
      const layerConfig = layers[layerIndex];

      const card = document.createElement("div");
      card.className = "album-card";

      // Random starting coordinates (drift upward from bottom or distributed on initial load)
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cardSize = layerConfig.size + (Math.random() * 20 - 10);
      const posX = Math.random() * (w - cardSize);
      let posY = h + Math.random() * 80; // start slightly below screen
      const rotation = (Math.random() * 12 - 6).toFixed(1); // subtle tilt: -6deg to +6deg
      const speed = (0.35 + Math.random() * 0.4) * layerConfig.speedMultiplier;

      card.style.width = `${cardSize}px`;
      card.style.height = `${cardSize}px`;
      card.style.transform = `translate3d(${posX}px, ${posY}px, 0) rotate(${rotation}deg)`;

      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = album.cover_url;
      img.alt = `${album.title} - ${album.artist}`;
      card.appendChild(img);

      // Card click: open preview
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        modal.querySelector("#modal-img").src = album.cover_url;
        modal.querySelector("#modal-title").textContent = album.title;
        modal.querySelector("#modal-artist").textContent = album.artist;
        modal.querySelector("#modal-meta").innerHTML = `${album.year} &bull; ${album.genre}`;
        modal.querySelector("#modal-decade").textContent = album.decade || `${album.year}s`;
        modal.classList.add("active");
      });

      layerConfig.el.appendChild(card);

      const cardObj = {
        el: card,
        posX,
        posY,
        rotation,
        speed,
        height: cardSize,
        paused: false,
      };

      // Pause drifting on hover
      card.addEventListener("mouseenter", () => {
        cardObj.paused = true;
      });
      card.addEventListener("mouseleave", () => {
        cardObj.paused = false;
      });

      activeCards.push(cardObj);
    }

    // Pre-populate viewport initially so the page doesn't start empty
    for (let i = 0; i < maxActiveCards; i++) {
      spawnCard();
      if (activeCards[i]) {
        // distribute existing cards across the screen height
        activeCards[i].posY = Math.random() * window.innerHeight;
        activeCards[i].el.style.transform = `translate3d(${activeCards[i].posX}px, ${activeCards[i].posY}px, 0) rotate(${activeCards[i].rotation}deg)`;
      }
    }

    // Animation loop via requestAnimationFrame (high-efficiency 60fps)
    function animate() {
      for (let i = activeCards.length - 1; i >= 0; i--) {
        const item = activeCards[i];
        if (!item.paused) {
          item.posY -= item.speed;
          item.el.style.transform = `translate3d(${item.posX}px, ${item.posY}px, 0) rotate(${item.rotation}deg)`;

          // When card drifts off the top of screen, recycle it
          if (item.posY < -item.height - 50) {
            item.el.remove();
            activeCards.splice(i, 1);
            spawnCard();
          }
        }
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    // Subtle parallax shift on mouse move
    window.addEventListener("mousemove", (e) => {
      const mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      const mouseY = (e.clientY / window.innerHeight - 0.5) * 2;

      layerDeep.style.transform = `translate3d(${mouseX * -8}px, ${mouseY * -8}px, 0)`;
      layerMid.style.transform = `translate3d(${mouseX * -16}px, ${mouseY * -16}px, 0)`;
      layerFront.style.transform = `translate3d(${mouseX * -28}px, ${mouseY * -28}px, 0)`;
    });
  }
})();
