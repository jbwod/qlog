// Global Search Functionality
// NOTE: This is now handled by advanced-search.js
// The globalSearch input is readonly and opens the advanced search modal
function initSearch() {
    // This function is kept for compatibility but the search functionality
    // has been moved to advanced-search.js
    // The globalSearch input is now readonly and triggers the advanced search modal
    const globalSearch = document.getElementById('globalSearch');
    if (!globalSearch) return;
    
    // Remove any existing input handlers since the input is readonly
    // The advanced search modal handles all search functionality
}

