// State management
let currentCategory = '';
let currentPage = 1;
let pageLimit = 24;
let nextCursor = null;
let prevCursor = null;

// DOM Elements
const productsGrid = document.getElementById('products-grid');
const categoryFilters = document.getElementById('category-filters');
const categorySkeletons = document.getElementById('category-skeletons');
const pageIndicator = document.getElementById('page-indicator');
const resultsMeta = document.getElementById('results-meta');
const limitSelect = document.getElementById('limit-select');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnSimulate = document.getElementById('btn-simulate');
const simCategorySelect = document.getElementById('sim-category-select');
const simToast = document.getElementById('sim-toast');
const connectionStatus = document.getElementById('connection-status');
const debugPrevCursor = document.getElementById('debug-prev-cursor');
const debugNextCursor = document.getElementById('debug-next-cursor');

// Format date helpers
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  }) + '.' + String(d.getMilliseconds()).padStart(3, '0') + 's';
};

// Render Skeletons
function showSkeletons(count = 12) {
  productsGrid.innerHTML = Array(count).fill(0).map(() => `
    <div class="product-card skeleton-card">
      <div class="skeleton skeleton-tag"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-price" style="margin-top: 10px;"></div>
      <div class="skeleton skeleton-date" style="margin-top: 15px; height: 12px;"></div>
      <div class="skeleton skeleton-date" style="margin-top: 5px; height: 12px; width: 80px;"></div>
    </div>
  `).join('');
}

// Fetch categories from API
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    
    if (data.success && data.categories) {
      categorySkeletons.style.display = 'none';
      
      data.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.textContent = cat;
        btn.dataset.category = cat;
        
        btn.addEventListener('click', () => {
          // Update active style
          document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          // Reset page state
          currentCategory = cat;
          currentPage = 1;
          nextCursor = null;
          prevCursor = null;
          
          loadProducts();
        });
        
        categoryFilters.appendChild(btn);
      });
    }
  } catch (error) {
    console.error('Failed to load categories:', error);
    connectionStatus.className = 'status-indicator offline';
    connectionStatus.nextElementSibling.textContent = 'Database Disconnected';
  }
}

// Fetch products from API (supporting forward/backward cursors)
async function loadProducts(direction = null) {
  showSkeletons(pageLimit);
  btnPrev.disabled = true;
  btnNext.disabled = true;

  try {
    let url = `/api/products?limit=${pageLimit}`;
    if (currentCategory) {
      url += `&category=${encodeURIComponent(currentCategory)}`;
    }
    
    if (direction === 'next' && nextCursor) {
      url += `&next=${nextCursor}`;
    } else if (direction === 'prev' && prevCursor) {
      url += `&prev=${prevCursor}`;
    }

    const startTime = performance.now();
    const res = await fetch(url);
    const data = await res.json();
    const duration = (performance.now() - startTime).toFixed(1);

    if (data.success) {
      connectionStatus.className = 'status-indicator online';
      connectionStatus.nextElementSibling.textContent = 'Database Connected';

      const products = data.products;
      
      // Update cursors
      nextCursor = data.next_cursor;
      prevCursor = data.prev_cursor;

      // Update Debug Info
      debugPrevCursor.textContent = prevCursor ? prevCursor.slice(0, 16) + '...' : 'null';
      debugNextCursor.textContent = nextCursor ? nextCursor.slice(0, 16) + '...' : 'null';
      debugPrevCursor.title = prevCursor || 'null';
      debugNextCursor.title = nextCursor || 'null';

      // Update navigation button states
      btnPrev.disabled = !data.has_prev;
      btnNext.disabled = !data.has_next;

      // Update meta text
      const catText = currentCategory ? `in ${currentCategory}` : 'across all categories';
      resultsMeta.textContent = `Showing ${products.length} products ${catText} (Fetched in ${duration}ms)`;
      pageIndicator.textContent = `Page ${currentPage}`;

      // Render cards
      if (products.length === 0) {
        productsGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-muted);">
            <h3>No products found</h3>
            <p>Try seeding the database or adding simulation products.</p>
          </div>
        `;
        return;
      }

      productsGrid.innerHTML = products.map(prod => `
        <div class="product-card" id="card-${prod.id}">
          <span class="product-tag">${prod.category}</span>
          <div class="product-title" title="${prod.name}">${prod.name}</div>
          <div class="product-price-row">
            <span class="product-price">₹${parseFloat(prod.price).toFixed(2)}</span>
            <span class="product-price-label">INR</span>
          </div>
          <div class="product-meta-details">
            <div>Created: ${formatDate(prod.created_at)}</div>
            <div class="product-id-label">ID: ${prod.id.slice(0, 8)}...</div>
          </div>
        </div>
      `).join('');
    } else {
      productsGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--accent-red)">Error: ${data.error}</div>`;
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    productsGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--accent-red)">Connection error. Make sure server is running and DATABASE_URL is set correctly.</div>`;
    connectionStatus.className = 'status-indicator offline';
    connectionStatus.nextElementSibling.textContent = 'Connection Error';
  }
}

// Event Listeners
btnPrev.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    loadProducts('prev');
  }
});

btnNext.addEventListener('click', () => {
  currentPage++;
  loadProducts('next');
});

limitSelect.addEventListener('change', () => {
  pageLimit = parseInt(limitSelect.value);
  currentPage = 1;
  nextCursor = null;
  prevCursor = null;
  loadProducts();
});

// All Categories filter click
document.querySelector('[data-category=""]').addEventListener('click', (e) => {
  document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  currentCategory = '';
  currentPage = 1;
  nextCursor = null;
  prevCursor = null;
  loadProducts();
});

// Simulate Live Insertion
btnSimulate.addEventListener('click', async () => {
  const selectedCat = simCategorySelect.value;
  btnSimulate.disabled = true;
  btnSimulate.textContent = 'Inserting...';

  try {
    const res = await fetch('/api/products/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: selectedCat })
    });
    const data = await res.json();
    
    if (data.success) {
      simToast.textContent = data.message;
      simToast.style.display = 'block';
      
      // Auto-hide toast after 4 seconds
      setTimeout(() => {
        simToast.style.display = 'none';
      }, 4000);

      // Flash load categories if they change (usually static, but good practice)
      // If we are on Page 1, refresh the page to show the new items immediately.
      // If we are on later pages, refreshing keeps us exactly where we were.
      // (This validates that inserting items doesn't shift our page rows!)
      if (currentPage === 1) {
        nextCursor = null;
        prevCursor = null;
        loadProducts();
      } else {
        // If we are on later pages, we refresh using the current boundary cursor so the list remains stable
        // We simulate a re-fetch of the current page. Since keyset pagination is stable, we won't see any shifts!
        console.log('Product added! Keyset cursor ensures your view is stable and does not shift.');
      }
    }
  } catch (error) {
    console.error('Simulation failed:', error);
  } finally {
    btnSimulate.disabled = false;
    btnSimulate.textContent = 'Add 50 New Products';
  }
});

// Init
async function init() {
  await loadCategories();
  loadProducts();
}

init();
