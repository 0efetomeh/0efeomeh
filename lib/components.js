/**
 * Shared UI component library for Efetomeh portfolio and blog
 * Provides reusable DOM creation, data handling, and text utilities
 */

// ============================================================================
// Text & HTML Utilities
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS vulnerabilities
 * @param {string} value - The text to escape
 * @returns {string} Escaped HTML-safe string
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render inline markdown-like syntax (bold, links, code)
 * @param {string} text - Text with markdown patterns
 * @returns {string} HTML string with rendered inline markup
 */
function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

// ============================================================================
// URL Utilities
// ============================================================================

/**
 * Normalize site URLs for consistent routing
 * Converts relative paths to absolute paths and handles special cases
 * @param {string} url - Raw URL to normalize
 * @returns {string} Normalized URL or "#" if invalid
 */
function normalizeSiteUrl(url) {
  if (typeof url !== "string" || url.length === 0) {
    return "#";
  }
  if (url.startsWith("./")) {
    return `/${url.slice(2)}`;
  }
  return url;
}

/**
 * Check if a URL is external (http/https protocol)
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is external
 */
function isExternalUrl(url) {
  return /^https?:\/\//i.test(url);
}

// ============================================================================
// DOM Element Creation
// ============================================================================

/**
 * Get element by ID, with fallback to multiple IDs
 * Useful for backward compatibility with renamed elements
 * @param {string|string[]} id - Single ID or array of IDs to try
 * @returns {HTMLElement|null} First found element or null
 */
function byId(id) {
  if (Array.isArray(id)) {
    for (const idStr of id) {
      const node = document.getElementById(idStr);
      if (node) return node;
    }
    return null;
  }
  return document.getElementById(id);
}

/**
 * Create a reusable link/anchor element
 * @param {string} url - Link href (will be normalized)
 * @param {string} text - Link display text
 * @param {Object} options - Configuration options
 * @param {string} options.className - CSS class name(s)
 * @param {boolean} options.external - Should open in new tab (default: true)
 * @param {string} options.label - Alternative text if text is empty
 * @returns {HTMLAnchorElement} Configured link element
 */
function createLink(url, text, { className = "", external = true, label = "" } = {}) {
  const a = document.createElement("a");
  a.href = normalizeSiteUrl(url);
  a.textContent = text || label;
  if (className) a.className = className;
  if (external && isExternalUrl(a.href)) {
    a.target = "_blank";
    a.rel = "noreferrer";
  }
  return a;
}

/**
 * Create a badge/chip/tag element
 * @param {string} text - Badge text
 * @param {string} variant - CSS class variant ("chip", "badge", etc.)
 * @returns {HTMLSpanElement} Badge element
 */
function createBadge(text, variant = "chip") {
  const span = document.createElement("span");
  span.className = variant;
  span.textContent = text;
  return span;
}

/**
 * Create a metadata card (label + value pair)
 * @param {string} label - Card label text
 * @param {string} value - Card value text
 * @returns {HTMLDivElement} Meta card element
 */
function createMetaCard(label, value) {
  const card = document.createElement("div");
  card.className = "meta-card";
  card.innerHTML = `
    <span class="meta-label">${escapeHtml(label)}</span>
    <div class="meta-value">${escapeHtml(value)}</div>
  `;
  return card;
}

/**
 * Create a section title element
 * @param {string} text - Title text
 * @returns {HTMLParagraphElement} Section title element
 */
function createSectionTitle(text) {
  const title = document.createElement("p");
  title.className = "section-title";
  title.textContent = text;
  return title;
}

/**
 * Populate a container with a list of items
 * @param {HTMLElement} container - Target container
 * @param {Array} items - Array of items to render
 * @param {Function} createItemFn - Function that creates element from item
 */
function renderList(container, items, createItemFn) {
  container.innerHTML = "";
  items.forEach((item) => {
    container.appendChild(createItemFn(item));
  });
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Fetch and parse JSON from a URL
 * Handles errors gracefully and returns fallback value on failure
 * @param {string} url - URL to fetch from
 * @param {*} fallback - Value to return on error (default: null)
 * @returns {Promise<*>} Parsed JSON or fallback value
 */
async function fetchJson(url, fallback = null) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }
    return response.json();
  } catch (error) {
    console.warn(`Failed to fetch ${url}:`, error);
    return fallback;
  }
}

/**
 * Fetch plain text from a URL
 * @param {string} url - URL to fetch from
 * @returns {Promise<string|null>} Text content or null on error
 */
async function fetchText(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }
    return response.text();
  } catch (error) {
    console.warn(`Failed to fetch ${url}:`, error);
    return null;
  }
}

// ============================================================================
// Date & Time
// ============================================================================

/**
 * Format a date string to readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date (e.g., "January 15, 2026")
 */
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Register the site's service worker once on page load.
 * This keeps cache policy centralized without a separate bootstrap file.
 */
// Export for use in both modules (if using ES modules)
// Otherwise, these are available globally in the browser
