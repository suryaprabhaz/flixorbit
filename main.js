// --- Constants and Configuration ---
const API_KEY = '07593288b7c70475b39caecfe7054e07';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280'; // Larger size for backdrops
const PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w185'; // For cast/crew profiles
const PLACEHOLDER_POSTER = 'https://via.placeholder.com/360x540?text=No+Poster';
const PLACEHOLDER_PROFILE = 'https://placehold.co/185x278/cccccc/333333?text=No+Photo'; // Placeholder for missing profile pics
const YOUTUBE_EMBED_URL = 'https://www.youtube.com/embed/';

const POPULAR_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'fr', name: 'French' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
];

// --- DOM Elements ---
const DOMElements = {
  themeToggle: document.getElementById('themeToggle'),
  htmlRoot: document.documentElement,
  resultsSection: document.getElementById('resultsSection'),
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  loaderOverlay: document.getElementById('loaderOverlay'),
  genreFilter: document.getElementById('genreFilter'),
  langFilter: document.getElementById('langFilter'),
  movieDetailModal: document.getElementById('movieDetailModal'),
  movieDetailContent: document.getElementById('movieDetailContent'),
  modalCloseBtn: document.getElementById('modalCloseBtn'), // This is now static in index.html
  noResultsMessage: document.getElementById('noResults'),
  homeLogoLink: document.getElementById('homeLogoLink'),
  scrollSentinel: document.getElementById('scrollSentinel'),
  // New elements for trailer modal
  trailerModal: null, // Will be dynamically created
  trailerModalContent: null,
  trailerModalCloseBtn: null,
};

let currentGenreFilter = '';
let currentLanguageFilter = '';
let currentSearchQuery = '';
let activeModalTrigger = null;
let currentPage = 1;
let isLoading = false;
let hasMoreMovies = true;

// --- Utility Functions ---
const getPosterUrl = (path) => path ? `${POSTER_BASE_URL}${path}` : PLACEHOLDER_POSTER;
const getBackdropUrl = (path) => path ? `${BACKDROP_BASE_URL}${path}` : ''; // Backdrop can be empty if not available
const getProfileUrl = (path) => path ? `${PROFILE_BASE_URL}${path}` : PLACEHOLDER_PROFILE;

async function fetchFromTmdb(endpoint, params = new URLSearchParams()) {
  params.append('api_key', API_KEY);
  const url = `${TMDB_BASE_URL}${endpoint}?${params.toString()}`;
  console.log('Fetching from TMDB:', url); // Debugging fetch URL
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    const data = await response.json();
    console.log('TMDB response:', data); // Debugging TMDB response data
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error; // Re-throw to be caught by the calling function
  }
}

const debounce = (func, delay) => {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
};

// --- Theme ---
function setTheme(theme) {
  DOMElements.htmlRoot.setAttribute('data-theme', theme);
  localStorage.setItem('flixorbit-theme', theme);
}

function getPreferredTheme() {
  return localStorage.getItem('flixorbit-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function toggleTheme() {
  const current = DOMElements.htmlRoot.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// --- Loader ---
function showLoader() {
  isLoading = true;
  DOMElements.loaderOverlay.classList.add('is-visible');
  DOMElements.loaderOverlay.setAttribute('aria-hidden', 'false');
  DOMElements.resultsSection.setAttribute('aria-busy', 'true');
  document.body.style.overflow = 'hidden'; // Prevent scrolling when loader is active
}

function hideLoader() {
  isLoading = false;
  DOMElements.loaderOverlay.classList.remove('is-visible');
  DOMElements.loaderOverlay.setAttribute('aria-hidden', 'true');
  DOMElements.resultsSection.setAttribute('aria-busy', 'false');
  document.body.style.overflow = ''; // Restore scrolling
}

// --- Filters ---
async function loadGenres() {
  try {
    const data = await fetchFromTmdb('/genre/movie/list', new URLSearchParams('language=en'));
    DOMElements.genreFilter.innerHTML = `<option value="">All Genres</option>` +
      data.genres.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
  } catch (error) {
    console.error('Error loading genres:', error);
    DOMElements.genreFilter.innerHTML = '<option value="">Genres unavailable</option>';
  }
}

async function loadLanguages() {
  try {
    const all = await fetchFromTmdb('/configuration/languages');
    const langs = POPULAR_LANGUAGES.filter(l => all.some(al => al.iso_639_1 === l.code));
    DOMElements.langFilter.innerHTML = `<option value="">Any Language</option>` +
      langs.map(l => `<option value="${l.code}">${l.name}</option>`).join('');
  } catch (error) {
    console.error('Error loading languages:', error);
    DOMElements.langFilter.innerHTML = '<option value="">Languages unavailable</option>';
  }
}

// --- Fetch Movies ---
async function fetchMovies({ query = '', genre = '', lang = '', page = 1 } = {}) {
  const params = new URLSearchParams();
  params.append('page', page);
  let endpoint = '/trending/movie/week'; // Default to trending movies
  if (query) {
    endpoint = '/search/movie';
    params.append('query', query);
  } else if (genre || lang) {
    // If genre or language is selected, use discover endpoint
    endpoint = '/discover/movie';
  }
  if (genre) params.append('with_genres', genre);
  if (lang) params.append('with_original_language', lang);
  params.append('sort_by', 'popularity.desc'); // Always sort by popularity
  const data = await fetchFromTmdb(endpoint, params);
  const movies = (data.results || []).filter(m => m.poster_path); // Filter out movies without posters
  return { movies, total_pages: data.total_pages || 1 };
}

// --- Render Movie Cards ---
function createMovieCardHTML(movie) {
  const title = movie.title || movie.name || 'Untitled';
  const year = (movie.release_date || '').split('-')[0] || '';
  return `
    <article class="movie-card" tabindex="0" aria-label="${title} (${year})">
      <img src="${getPosterUrl(movie.poster_path)}"
           alt="${title} poster"
           loading="lazy"
           class="movie-card-poster"
           data-movie-id="${movie.id}"
           onerror="this.onerror=null;this.src='${PLACEHOLDER_POSTER}';" />
      <h2 class="movie-card-title">${title} (${year})</h2>
    </article>`;
}

function renderMovieCards(movies, append = false) {
  if (!append) DOMElements.resultsSection.innerHTML = ''; // Clear existing results if not appending
  DOMElements.noResultsMessage.hidden = true; // Hide no results message by default

  if (!movies.length && !append) {
    DOMElements.noResultsMessage.hidden = false; // Show no results message if no movies and not appending
    return;
  }

  const fragment = document.createDocumentFragment();
  movies.forEach(movie => {
    const div = document.createElement('div');
    div.innerHTML = createMovieCardHTML(movie);
    fragment.appendChild(div.firstElementChild); // Append the article element
  });
  DOMElements.resultsSection.appendChild(fragment);
}

// --- Load Movies ---
async function loadNewMovies(resetFilters = false) {
  console.log('loadNewMovies called. resetFilters:', resetFilters); // Debugging
  currentPage = 1;
  hasMoreMovies = true;
  DOMElements.scrollSentinel.hidden = true; // Hide sentinel until movies are loaded

  if (resetFilters) {
    currentSearchQuery = '';
    currentGenreFilter = '';
    currentLanguageFilter = '';
    if (DOMElements.searchInput) DOMElements.searchInput.value = '';
    if (DOMElements.genreFilter) DOMElements.genreFilter.value = '';
    if (DOMElements.langFilter) DOMElements.langFilter.value = '';
  }

  await initiateMovieSearchAndDisplay(false); // Load initial movies (not appending)
}

async function initiateMovieSearchAndDisplay(append = false) {
  console.log('initiateMovieSearchAndDisplay called. append:', append, 'isLoading:', isLoading, 'hasMoreMovies:', hasMoreMovies); // Debugging
  if (isLoading || (!hasMoreMovies && append)) {
    console.log('Skipping initiateMovieSearchAndDisplay due to current state.');
    return; // Prevent multiple loads or loading past last page
  }
  showLoader();
  try {
    const { movies, total_pages } = await fetchMovies({
      query: currentSearchQuery,
      genre: currentGenreFilter,
      lang: currentLanguageFilter,
      page: currentPage
    });
    console.log('Movies fetched:', movies.length, 'Total pages:', total_pages); // Debugging
    renderMovieCards(movies, append);
    hasMoreMovies = currentPage < total_pages;
    DOMElements.scrollSentinel.hidden = !hasMoreMovies; // Show sentinel if more movies exist
  } catch (e) {
    console.error('Error initiating movie search:', e);
    if (!append) {
      DOMElements.resultsSection.innerHTML = `<div class="no-results" role="alert">Error loading movies. Please try again later.</div>`;
    }
  } finally {
    hideLoader();
  }
}

// --- Modal ---
async function fetchMovieDetails(id) {
  // Fetch details, videos, reviews, watch providers, and credits (cast & crew)
  return fetchFromTmdb(`/movie/${id}`, new URLSearchParams('append_to_response=videos,reviews,watch/providers,credits,recommendations'));
}

function createTrailerModal(youtubeKey) {
  // Create the modal HTML dynamically
  const modalHTML = `
    <aside id="trailerModal" class="modal trailer-modal" role="dialog" aria-modal="true" aria-labelledby="trailerModalTitle" tabindex="-1">
      <div class="modal-content trailer-modal-content">
        <button id="trailerModalCloseBtn" class="modal-close-button" aria-label="Close trailer" type="button" title="Close Trailer">×</button>
        <div class="trailer-container">
          <iframe id="youtubeTrailerFrame" src="${YOUTUBE_EMBED_URL}${youtubeKey}?autoplay=1" title="Movie Trailer"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>
      </div>
    </aside>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  DOMElements.trailerModal = document.getElementById('trailerModal');
  DOMElements.trailerModalContent = DOMElements.trailerModal.querySelector('.trailer-modal-content');
  DOMElements.trailerModalCloseBtn = document.getElementById('trailerModalCloseBtn');

  DOMElements.trailerModalCloseBtn.addEventListener('click', closeTrailerModal);
  
  // Close on outside click
  DOMElements.trailerModal.addEventListener('click', (e) => {
    if (e.target === DOMElements.trailerModal) {
      closeTrailerModal();
    }
  });

  // Close on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOMElements.trailerModal && !DOMElements.trailerModal.hidden) {
      closeTrailerModal();
    }
  });

  // Show the modal
  setTimeout(() => { // Small delay to allow CSS transition
    DOMElements.trailerModal.classList.add('is-visible');
    DOMElements.trailerModal.hidden = false;
    document.body.style.overflow = 'hidden';
    DOMElements.trailerModalCloseBtn.focus();
  }, 50);
}

function closeTrailerModal() {
  if (DOMElements.trailerModal) {
    DOMElements.trailerModal.classList.remove('is-visible');
    setTimeout(() => {
      DOMElements.trailerModal.hidden = true;
      // Remove the modal from DOM after closing
      DOMElements.trailerModal.remove();
      DOMElements.trailerModal = null;
      DOMElements.trailerModalContent = null;
      DOMElements.trailerModalCloseBtn = null;
      document.body.style.overflow = ''; // Restore scrolling
      if (activeModalTrigger) activeModalTrigger.focus(); // Return focus to the element that opened the movie detail modal
    }, 300);
  }
}

function getPlayTrailerButton(videos) {
  const trailer = videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.key);
  if (trailer) {
    return `<button class="button primary-button play-trailer-button" data-youtube-key="${trailer.key}">Play Trailer</button>`;
  }
  return '<p class="no-info-message">No trailer available.</p>';
}

function getReviewsHTML(reviews) {
  if (!reviews?.results?.length) return '<p class="no-info-message">No user reviews.</p>';
  return reviews.results.slice(0, 3).map(r => `
    <div class="review-box">
      <p class="review-author"><strong>${r.author}</strong></p>
      <p class="review-content">${r.content.length > 300 ? r.content.slice(0, 300) + '...' : r.content}</p>
    </div>
  `).join('');
}

function getWatchProvidersHTML(data) {
  const us = data?.results?.US;
  if (!us) return '<p class="no-info-message">No streaming information for US.</p>';
  let html = '';

  const renderProviderGroup = (providers, title) => {
    if (!providers || providers.length === 0) return '';
    const logos = providers.map(p => `
      <a href="${p.link || '#'}" target="_blank" rel="noopener noreferrer" class="provider-link" aria-label="Watch on ${p.provider_name}">
        <img src="https://image.tmdb.org/t/p/original${p.logo_path}" alt="${p.provider_name}" class="provider-logo" title="${p.provider_name}" onerror="this.onerror=null;this.src='https://placehold.co/45x45/cccccc/333333?text=N/A';">
      </a>
    `).join('');
    return `<h4>${title}</h4><div class="providers">${logos}</div>`;
  };

  html += renderProviderGroup(us.flatrate, 'Stream');
  html += renderProviderGroup(us.rent, 'Rent');
  html += renderProviderGroup(us.buy, 'Buy');
  
  return html || '<p class="no-info-message">No providers found.</p>';
}

function getCastHTML(credits) {
  const cast = credits?.cast?.filter(c => c.profile_path).slice(0, 10); // Limit to 10 cast members with profiles
  if (!cast || cast.length === 0) return '<p class="no-info-message">No cast information.</p>';
  return `
    <div class="cast-list-detail">
      ${cast.map(c => `
        <div class="cast-member-detail">
          <img src="${getProfileUrl(c.profile_path)}" alt="${c.name}" onerror="this.onerror=null;this.src='${PLACEHOLDER_PROFILE}';" loading="lazy">
          <span class="cast-name">${c.name}</span>
          <span class="cast-character">${c.character || 'N/A'}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function getCrewHTML(credits) {
  const director = credits?.crew?.find(c => c.job === 'Director');
  const writers = credits?.crew?.filter(c => c.department === 'Writing').map(c => c.name);
  
  let crewHtml = '';
  if (director) {
    crewHtml += `<p><strong>Director:</strong> ${director.name}</p>`;
  }
  if (writers && writers.length > 0) {
    crewHtml += `<p><strong>Writers:</strong> ${writers.join(', ')}</p>`;
  }
  return crewHtml || '<p class="no-info-message">No crew information.</p>';
}

function getRecommendationsHTML(recommendations) {
  if (!recommendations?.results?.length) return '<p class="no-info-message">No recommendations available.</p>';
  
  const recommendedMovies = recommendations.results.filter(m => m.poster_path).slice(0, 8); // Limit to 8 recommendations with posters
  if (recommendedMovies.length === 0) return '<p class="no-info-message">No recommendations available.</p>';

  return `
    <div class="recommendation-list">
      ${recommendedMovies.map(movie => `
        <div class="recommendation-card" data-movie-id="${movie.id}" tabindex="0" aria-label="Recommended movie: ${movie.title || movie.name}">
          <img src="${getPosterUrl(movie.poster_path)}" alt="${movie.title || movie.name} poster" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_POSTER}';">
          <span class="recommendation-title">${movie.title || movie.name}</span>
        </div>
      `).join('')}
    </div>
  `;
}


async function openMovieDetailsModal(id) {
  console.log('openMovieDetailsModal called for ID:', id); // Debugging
  showLoader();
  try {
    const movie = await fetchMovieDetails(id);
    const title = movie.title || movie.name || 'Untitled';
    const releaseYear = (movie.release_date || movie.first_air_date || '').split('-')[0] || 'N/A';
    const runtime = movie.runtime ? `${movie.runtime} min` : 'N/A';
    const genres = movie.genres?.map(g => g.name).join(', ') || 'N/A';
    const userScore = movie.vote_average ? Math.round(movie.vote_average * 10) : 'N/A';
    const tagline = movie.tagline ? `<p class="tagline">${movie.tagline}</p>` : '';

    DOMElements.movieDetailContent.innerHTML = `
      <div class="modal-header-section">
        <div class="modal-backdrop" style="background-image: url('${getBackdropUrl(movie.backdrop_path)}');">
          <div class="modal-overlay"></div>
        </div>
        <div class="modal-poster-and-info">
          <img src="${getPosterUrl(movie.poster_path)}" alt="${title} poster" class="modal-main-poster" onerror="this.onerror=null;this.src='${PLACEHOLDER_POSTER}';">
          <div class="modal-main-info">
            <h2 id="modalTitle">${title} <span class="release-year">(${releaseYear})</span></h2>
            ${tagline}
            <div class="movie-meta-info">
              <div class="user-score-container">
                <div class="user-score-circle">
                  <span class="user-score-text">${userScore}%</span>
                </div>
                <span>User Score</span>
              </div>
              <p><strong>Runtime:</strong> ${runtime}</p>
              <p><strong>Genres:</strong> ${genres}</p>
            </div>
            ${getPlayTrailerButton(movie.videos)}
          </div>
        </div>
      </div>
      
      <div class="modal-details-section">
        <h3>Overview</h3>
        <p class="overview-text">${movie.overview || 'No description available.'}</p>
        
        <div class="crew-section">
          ${getCrewHTML(movie.credits)}
        </div>

        <h3>Top Billed Cast</h3>
        ${getCastHTML(movie.credits)}
        
        <h3>Where to Watch</h3>
        ${getWatchProvidersHTML(movie['watch/providers'])}

        <h3>More Like This</h3>
        ${getRecommendationsHTML(movie.recommendations)}
        
        <h3>User Reviews</h3>
        ${getReviewsHTML(movie.reviews)}
      </div>
    `;

    // Add event listener for recommended movie cards within the modal
    DOMElements.movieDetailContent.querySelectorAll('.recommendation-card').forEach(card => {
      card.addEventListener('click', () => {
        const movieId = card.dataset.movieId;
        if (movieId) {
          openMovieDetailsModal(movieId); // Open new modal for recommended movie
        }
      });
    });

    // Add event listener for play trailer button
    const playTrailerBtn = DOMElements.movieDetailContent.querySelector('.play-trailer-button');
    if (playTrailerBtn) {
      playTrailerBtn.addEventListener('click', () => {
        const youtubeKey = playTrailerBtn.dataset.youtubeKey;
        if (youtubeKey) {
          createTrailerModal(youtubeKey);
        }
      });
    }

    // Update URL
    const movieSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    history.pushState({ movieId: id }, '', `/${movieSlug}-${id}`);
    console.log('URL updated to:', `/${movieSlug}-${id}`); // Debugging URL change


    // Ensure modal is visible and focus is managed
    DOMEElements.movieDetailModal.classList.add('is-visible');
    DOMElements.movieDetailModal.hidden = false;
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Debugging close button visibility
    console.log('Modal close button computed style:', window.getComputedStyle(DOMElements.modalCloseBtn));
    DOMElements.modalCloseBtn.focus(); // Focus the close button for accessibility
  } catch (error) {
    console.error('Failed to load movie details:', error);
    DOMElements.movieDetailContent.innerHTML = '<p class="error-message">Failed to load movie details. Please try again.</p>';
    DOMElements.movieDetailModal.classList.add('is-visible');
    DOMElements.movieDetailModal.hidden = false;
  } finally {
    hideLoader();
  }
}

function closeMovieDetailsModal() {
  console.log('closeMovieDetailsModal called.'); // Debugging
  DOMElements.movieDetailModal.classList.remove('is-visible');
  // Use a timeout to allow the transition to complete before hiding
  setTimeout(() => {
    DOMElements.movieDetailModal.hidden = true;
    DOMElements.movieDetailContent.innerHTML = ''; // Clear content
    document.body.style.overflow = ''; // Restore body scrolling
    if (activeModalTrigger) activeModalTrigger.focus(); // Return focus to the element that opened the modal
    // Revert URL to home page
    history.pushState({}, '', '/');
    console.log('URL reverted to /'); // Debugging URL change
  }, 300); // Match this duration with the CSS transition speed
}

// --- URL Routing ---
function handleUrlChange() {
  console.log('handleUrlChange called. Current path:', window.location.pathname); // Debugging
  const path = window.location.pathname;
  const match = path.match(/-(\d+)$/); // Matches -{id} at the end of the path
  if (match && match[1]) {
    const movieId = match[1];
    // Only open if not already open for this movie
    if (!DOMElements.movieDetailModal.classList.contains('is-visible') || 
        DOMElements.movieDetailModal.dataset.currentMovieId !== movieId) {
        DOMElements.movieDetailModal.dataset.currentMovieId = movieId; // Store current movie ID
        openMovieDetailsModal(movieId);
    }
  } else if (DOMElements.movieDetailModal && DOMElements.movieDetailModal.classList.contains('is-visible')) {
    // If modal is open but URL doesn't match a movie, close it
    closeMovieDetailsModal();
  } else {
    // If on home path and no modal open, ensure initial movies are loaded
    loadNewMovies(true);
  }
}

// --- Event Listeners ---
function addEventListeners() {
  DOMElements.themeToggle.addEventListener('click', toggleTheme);

  DOMElements.homeLogoLink.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default link behavior (page refresh)
    loadNewMovies(true);  // Reset all filters and search on "home" click
    history.pushState({}, '', '/'); // Ensure URL is home
  });

  DOMElements.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentSearchQuery = DOMElements.searchInput.value.trim();
    // Reset genre and language filters when a new search is submitted
    currentGenreFilter = '';
    currentLanguageFilter = '';
    if (DOMElements.genreFilter) DOMElements.genreFilter.value = '';
    if (DOMElements.langFilter) DOMElements.langFilter.value = '';
    loadNewMovies(false); // Load new movies based on search query
    history.pushState({}, '', '/'); // Reset URL to home after search
  });

  // Debounced search input handler for real-time search as user types
  const debouncedSearch = debounce(() => {
    currentSearchQuery = DOMElements.searchInput.value.trim();
    // Do NOT reset filters on typing search input – keep them intact for combined filtering
    loadNewMovies(false); // Load new movies based on current search and filters
    // Do not change URL here, only on form submit or direct movie open
  }, 500); // 500ms debounce delay
  DOMElements.searchInput.addEventListener('input', debouncedSearch);

  DOMElements.genreFilter.addEventListener('change', (e) => {
    currentGenreFilter = e.target.value;
    currentSearchQuery = ''; // Clear search query when genre filter changes
    if (DOMElements.searchInput) DOMElements.searchInput.value = '';
    loadNewMovies(false);
    history.pushState({}, '', '/'); // Reset URL to home after filter change
  });

  DOMElements.langFilter.addEventListener('change', (e) => {
    currentLanguageFilter = e.target.value;
    currentSearchQuery = ''; // Clear search query when language filter changes
    if (DOMElements.searchInput) DOMElements.searchInput.value = '';
    loadNewMovies(false);
    history.pushState({}, '', '/'); // Reset URL to home after filter change
  });

  DOMElements.resultsSection.addEventListener('click', (e) => {
    const poster = e.target.closest('.movie-card-poster');
    if (poster && poster.dataset.movieId) {
      activeModalTrigger = poster; // Store the element that triggered the modal
      openMovieDetailsModal(poster.dataset.movieId);
    }
  });

  // Static modal close button listener (since it's now in the HTML)
  if (DOMElements.modalCloseBtn) {
    DOMElements.modalCloseBtn.addEventListener('click', closeMovieDetailsModal);
  }

  // Close modal on Escape key press
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !DOMElements.movieDetailModal.hidden) {
      closeMovieDetailsModal();
    }
  });

  // Intersection Observer for infinite scrolling
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMoreMovies && !isLoading) {
      currentPage++;
      initiateMovieSearchAndDisplay(true); // Append new movies
    }
  }, { threshold: 0.1 }); // Trigger when 10% of the sentinel is visible

  // Observe the scroll sentinel if it exists
  if (DOMElements.scrollSentinel) observer.observe(DOMElements.scrollSentinel);

  // Listen for browser back/forward buttons
  window.addEventListener('popstate', handleUrlChange);
}

// --- Init ---
async function initializeApp() {
  console.log('initializeApp called.'); // Debugging
  setTheme(getPreferredTheme());
  addEventListeners();
  showLoader(); // Show loader immediately on app initialization
  try {
    // Load genres and languages in parallel for faster startup
    await Promise.all([loadGenres(), loadLanguages()]);
    
    // Check URL for movie ID on initial load
    const path = window.location.pathname;
    const match = path.match(/-(\d+)$/);
    if (match && match[1]) {
      console.log('Movie ID found in URL:', match[1]); // Debugging
      DOMElements.movieDetailModal.dataset.currentMovieId = match[1]; // Store current movie ID
      await openMovieDetailsModal(match[1]);
    } else {
      console.log('No movie ID in URL, loading initial movies.'); // Debugging
      // Otherwise, load initial trending movies
      await loadNewMovies(true);
    }
  } catch (error) {
    console.error("Initialization failed:", error);
    // Display a user-friendly error message if initialization fails
    DOMElements.resultsSection.innerHTML = `<div class="no-results" role="alert">Failed to initialize the app. Please check your internet connection.</div>`;
  } finally {
    hideLoader(); // Hide loader after all initial data is loaded
    console.log('initializeApp finished.'); // Debugging
  }
}

// Ensure the app initializes after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);
