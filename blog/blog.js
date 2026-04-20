const DATA_URL = "/blog-data.json";
const PORTFOLIO_DATA_URL = "/data.json";
const CONTENT_BASE = "./post/";

function byId(id) {
  return document.getElementById(id);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseFrontMatterValue(value) {
  const trimmed = value.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^(["'])(.*)\1$/, "$2"))
      .filter(Boolean);
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed.replace(/^(["'])(.*)\1$/, "$2");
}

function parseFrontMatter(markdown) {
  const source = markdown.replace(/^\uFEFF/, "");
  if (!source.startsWith("---")) {
    return { meta: {}, body: source.trim() };
  }

  const lines = source.split(/\r?\n/);
  let cursor = 1;
  const metaLines = [];

  while (cursor < lines.length && lines[cursor].trim() !== "---") {
    metaLines.push(lines[cursor]);
    cursor += 1;
  }

  const body = lines.slice(cursor + 1).join("\n").trim();
  const meta = {};

  metaLines.forEach((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) {
      return;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    meta[key] = parseFrontMatterValue(value);
  });

  return { meta, body };
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const line = lines[cursor].trim();

    if (line === "") {
      cursor += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      cursor += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (cursor < lines.length && /^[-*]\s+/.test(lines[cursor].trim())) {
        items.push(lines[cursor].trim().replace(/^[-*]\s+/, ""));
        cursor += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    const paragraphLines = [];
    while (cursor < lines.length) {
      const paragraphLine = lines[cursor].trim();
      if (paragraphLine === "" || /^(#{1,6})\s+/.test(paragraphLine) || /^[-*]\s+/.test(paragraphLine)) {
        break;
      }
      paragraphLines.push(paragraphLine);
      cursor += 1;
    }

    if (paragraphLines.length > 0) {
      blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
      continue;
    }

    cursor += 1;
  }

  return blocks.join("");
}

async function loadMarkdownPost(slug) {
  const candidates = [
    `${CONTENT_BASE}${slug}.md`,
    `/blog/post/${slug}.md`,
  ];

  let response = null;

  for (const url of candidates) {
    const candidateResponse = await fetch(url, { cache: "no-store" });
    if (candidateResponse.ok) {
      response = candidateResponse;
      break;
    }
  }

  if (!response) {
    throw new Error(`Failed to fetch blog post ${slug}: 404`);
  }

  const markdown = await response.text();
  const { meta, body } = parseFrontMatter(markdown);

  return {
    slug,
    title: meta.title ?? slug,
    date: meta.date ?? "",
    featured: meta.featured ?? false,
    category: meta.category ?? "Blog",
    summary: meta.summary ?? "",
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    readingTime: Number(meta.readingTime) || 5,
    html: markdownToHtml(body),
  };
}

function countTags(posts) {
  return posts.reduce((accumulator, post) => {
    post.tags.forEach((tag) => {
      accumulator[tag] = (accumulator[tag] ?? 0) + 1;
    });
    return accumulator;
  }, {});
}

function getTopTags(posts, limit = 10) {
  return Object.entries(countTags(posts))
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([tag]) => tag);
}

function matchesFilters(post, selectedTags, searchQuery) {
  const tagMatch = selectedTags.length === 0 || selectedTags.every((tag) => post.tags.includes(tag));
  const query = searchQuery.trim().toLowerCase();
  const searchMatch =
    query === "" ||
    post.title.toLowerCase().includes(query) ||
    (post.summary ?? "").toLowerCase().includes(query) ||
    post.tags.some((tag) => tag.toLowerCase().includes(query));

  return tagMatch && searchMatch;
}

function createPostCard(post, readMoreLabel) {
  const article = document.createElement("article");
  article.className = "post-card surface";

  const meta = document.createElement("div");
  meta.className = "post-meta";
  meta.innerHTML = `
    <span>${formatDate(post.date)}</span>
    <span class="badge">${post.category ?? "Blog"}</span>
    ${post.featured ? '<span class="badge">Featured</span>' : ""}
  `;

  const title = document.createElement("h3");
  title.className = "post-title";
  const link = document.createElement("a");
  link.href = `./post.html?slug=${encodeURIComponent(post.slug)}`;
  link.textContent = post.title;
  title.appendChild(link);

  const summary = document.createElement("p");
  summary.className = "post-summary";
  summary.textContent = post.summary ?? "";

  const tags = document.createElement("div");
  tags.className = "tags";
  post.tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "badge";
    chip.textContent = tag;
    tags.appendChild(chip);
  });

  const footer = document.createElement("div");
  footer.className = "post-meta-inline";
  const more = document.createElement("a");
  more.className = "button";
  more.href = `./post.html?slug=${encodeURIComponent(post.slug)}`;
  more.textContent = readMoreLabel;
  footer.appendChild(more);

  article.append(meta, title, summary, tags, footer);
  return article;
}

function renderTagButtons(container, tags, activeTags, onToggle) {
  container.innerHTML = "";
  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button chip ${activeTags.includes(tag) ? "active" : ""}`.trim();
    button.textContent = tag;
    button.addEventListener("click", () => onToggle(tag));
    container.appendChild(button);
  });
}

function renderShareButtons(container, title, url) {
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);
  container.innerHTML = `
    <a class="button" href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noreferrer">X</a>
    <a class="button" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noreferrer">LinkedIn</a>
    <a class="button" href="mailto:?subject=${encodedTitle}&body=${encodedUrl}">Email</a>
  `;
}

async function loadBlog() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch blog data: ${response.status}`);
  }

  const payload = await response.json();
  const blog = payload.blog ?? payload;
  const posts = await Promise.all((blog.posts ?? []).map((entry) => loadMarkdownPost(entry.slug)));

  return {
    ...blog,
    posts,
  };
}

async function loadPortfolioData() {
  const response = await fetch(PORTFOLIO_DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch portfolio data: ${response.status}`);
  }

  return response.json();
}

function normalizeSiteUrl(url) {
  if (typeof url !== "string" || url.length === 0) {
    return "#";
  }

  if (url.startsWith("./")) {
    return `/${url.slice(2)}`;
  }

  return url;
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url);
}

function renderConnectPanel(portfolio) {
  const actionsContainer = byId("sidebar-actions");
  const socialsContainer = byId("sidebar-social");

  if (!actionsContainer || !socialsContainer || !portfolio) {
    return;
  }

  const actions = portfolio.hero?.actions ?? {};
  const socials = portfolio.content?.socials ?? [];

  const connectActions = [actions.contact, actions.resume, actions.github].filter(Boolean);

  actionsContainer.innerHTML = "";
  connectActions.forEach((action) => {
    const anchor = document.createElement("a");
    anchor.className = "button";
    anchor.href = normalizeSiteUrl(action.url);
    anchor.textContent = action.label ?? "Link";
    if (isExternalUrl(anchor.href)) {
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
    }
    actionsContainer.appendChild(anchor);
  });

  socialsContainer.innerHTML = "";
  socials.forEach((social) => {
    const anchor = document.createElement("a");
    anchor.href = normalizeSiteUrl(social.url);
    anchor.textContent = social.handle || social.name || "Social";
    if (isExternalUrl(anchor.href)) {
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
    }
    socialsContainer.appendChild(anchor);
  });
}

function renderIndex(blog) {
  const page = blog.page;
  const posts = blog.posts ?? [];
  const featuredPosts = posts.filter((post) => post.featured);
  const topTags = getTopTags(posts);

  document.title = `${page.title} | Efetomeh`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute("content", page.description);
  }

  byId("blog-title").textContent = page.title;
  byId("blog-intro").textContent = page.intro;
  byId("home-link").textContent = page.backToHomeLabel;
  byId("home-link").href = "/";
  byId("search-input").placeholder = page.searchPlaceholder;
  byId("filter-label").textContent = page.filterLabel;
  byId("featured-label").textContent = page.featuredLabel;
  byId("clear-filters").textContent = page.clearFiltersLabel;

  const state = {
    selectedTags: [],
    searchQuery: "",
  };

  const featuredSection = byId("featured-section");
  const featuredList = byId("featured-list");
  const allPostsList = byId("all-posts-list");
  const tagsContainer = byId("tag-filters");
  const activeFilters = byId("active-filters");
  const resultsCount = byId("results-count");
  const clearFiltersButton = byId("clear-filters");
  const searchInput = byId("search-input");

  function syncActiveFilters() {
    activeFilters.innerHTML = "";
    if (state.selectedTags.length === 0 && state.searchQuery === "") {
      activeFilters.classList.add("empty-state");
      activeFilters.textContent = "";
      return;
    }

    activeFilters.classList.remove("empty-state");
    const label = document.createElement("span");
    label.className = "label-row";
    label.textContent = page.activeFiltersLabel;
    activeFilters.appendChild(label);

    state.selectedTags.forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button chip active";
      button.textContent = tag;
      button.addEventListener("click", () => {
        state.selectedTags = state.selectedTags.filter((item) => item !== tag);
        renderFilteredPosts();
      });
      activeFilters.appendChild(button);
    });

    if (state.searchQuery) {
      const queryChip = document.createElement("button");
      queryChip.type = "button";
      queryChip.className = "button chip active";
      queryChip.textContent = state.searchQuery;
      queryChip.addEventListener("click", () => {
        state.searchQuery = "";
        searchInput.value = "";
        renderFilteredPosts();
      });
      activeFilters.appendChild(queryChip);
    }
  }

  function renderFilteredPosts() {
    const filteredPosts = posts.filter((post) => matchesFilters(post, state.selectedTags, state.searchQuery));
    const visibleFeatured = featuredPosts.filter((post) => matchesFilters(post, state.selectedTags, state.searchQuery));
    featuredSection.hidden = visibleFeatured.length === 0;

    featuredList.innerHTML = "";
    visibleFeatured.forEach((post) => {
      featuredList.appendChild(createPostCard(post, page.readMoreLabel));
    });

    allPostsList.innerHTML = "";
    if (filteredPosts.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state surface";
      empty.textContent = page.noPostsLabel;
      allPostsList.appendChild(empty);
    } else {
      filteredPosts.forEach((post) => {
        allPostsList.appendChild(createPostCard(post, page.readMoreLabel));
      });
    }

    resultsCount.textContent = filteredPosts.length === posts.length ? page.allPostsLabel : `${page.allPostsLabel} (${filteredPosts.length} of ${posts.length})`;
    clearFiltersButton.hidden = state.selectedTags.length === 0 && state.searchQuery === "";
    syncActiveFilters();
  }

  renderTagButtons(tagsContainer, topTags, state.selectedTags, (tag) => {
    state.selectedTags = state.selectedTags.includes(tag)
      ? state.selectedTags.filter((item) => item !== tag)
      : [...state.selectedTags, tag];
    renderFilteredPosts();
  });

  searchInput.addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    renderFilteredPosts();
  });

  clearFiltersButton.addEventListener("click", () => {
    state.selectedTags = [];
    state.searchQuery = "";
    searchInput.value = "";
    renderTagButtons(tagsContainer, topTags, state.selectedTags, (tag) => {
      state.selectedTags = state.selectedTags.includes(tag)
        ? state.selectedTags.filter((item) => item !== tag)
        : [...state.selectedTags, tag];
      renderFilteredPosts();
    });
    renderFilteredPosts();
  });

  renderFilteredPosts();
}

function renderPost(blog, portfolio) {
  const posts = blog.posts ?? [];
  const page = blog.page;
  const slug = document.body.dataset.slug || new URLSearchParams(window.location.search).get("slug") || posts[0]?.slug;
  const post = posts.find((entry) => entry.slug === slug) ?? posts[0];

  if (!post) {
    byId("post-content").innerHTML = '<div class="empty-state surface">Post not found.</div>';
    return;
  }

  const postUrl = `${window.location.origin}/blog/post.html?slug=${encodeURIComponent(post.slug)}`;
  document.title = `${post.title} | Efetomeh`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute("content", post.summary ?? page.description);
  }

  byId("back-link").textContent = page.backToBlogLabel;
  byId("back-link").href = "/blog/";
  byId("home-link").textContent = page.backToHomeLabel;
  byId("home-link").href = "/";
  byId("more-articles-link").textContent = page.moreArticlesLabel;

  byId("post-meta-date").textContent = formatDate(post.date);
  byId("post-meta-time").textContent = `${post.readingTime ?? 5} min read`;
  byId("post-meta-category").textContent = post.category ?? "Blog";
  byId("post-title").textContent = post.title;
  byId("post-summary").textContent = post.summary ?? "";

  const tagsContainer = byId("post-tags");
  tagsContainer.innerHTML = "";
  post.tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "badge";
    chip.textContent = tag;
    tagsContainer.appendChild(chip);
  });

  byId("post-content").innerHTML = post.html;
  renderConnectPanel(portfolio);

  renderShareButtons(byId("share-buttons-top"), post.title, postUrl);
  renderShareButtons(byId("share-buttons-bottom"), post.title, postUrl);

  const relatedPosts = posts
    .filter((entry) => entry.slug !== post.slug)
    .filter((entry) => entry.tags.some((tag) => post.tags.includes(tag)))
    .slice(0, 3);

  const relatedContainer = byId("related-posts");
  relatedContainer.innerHTML = "";
  const heading = document.createElement("h2");
  heading.className = "section-title";
  heading.textContent = page.relatedLabel;
  relatedContainer.appendChild(heading);

  if (relatedPosts.length > 0) {
    const grid = document.createElement("div");
    grid.className = "related-grid";

    relatedPosts.forEach((entry) => {
      const card = createPostCard(entry, page.readMoreLabel);
      grid.appendChild(card);
    });

    relatedContainer.appendChild(grid);
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = page.noRelatedPostsLabel ?? "No related posts available yet.";
    relatedContainer.appendChild(empty);
  }

  const progressBar = byId("reading-progress-bar");
  const updateProgress = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(1, scrollTop / docHeight) : 0;
    progressBar.style.width = `${progress * 100}%`;
  };

  window.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();
}

(async function init() {
  const view = document.body.dataset.view;
  try {
    const [blog, portfolio] = await Promise.all([
      loadBlog(),
      loadPortfolioData().catch(() => null),
    ]);
    if (view === "post") {
      renderPost(blog, portfolio);
    } else {
      renderIndex(blog);
    }
  } catch (error) {
    console.error(error);
    const target = view === "post" ? byId("post-content") : byId("all-posts-list");
    if (target) {
      target.innerHTML = '<div class="empty-state surface">Blog content could not be loaded.</div>';
    }
  }
})();
