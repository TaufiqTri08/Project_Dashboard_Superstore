/* app.js - Full Interactive Logic & Data Processing */

// Global Variables
let superstoreData = [];
let filteredData = [];
let activeCharts = {};

// Helper: Parse Indonesian/European Number Format (comma as decimal)
function parseFormattedNumber(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  let str = val.toString().trim();
  str = str.replace(',', '.');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper: Format Currency (USD)
function formatUSD(num) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(num);
}

function formatUSDDecimal(num) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(num);
}

// Helper: Format Percentage
function formatPercent(num) {
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}

// Helper: Destroy existing chart instance
function destroyChart(id) {
  if (activeCharts[id]) {
    activeCharts[id].destroy();
    delete activeCharts[id];
  }
}

// Initialization on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupFilters();
  setupDragAndDrop();
  
  // 1. Check if dataset is already loaded in global namespace (from data.js script tag)
  if (typeof superstoreDataRaw !== 'undefined' && superstoreDataRaw.length > 0) {
    showLoader("Memproses dataset...");
    setTimeout(() => {
      processData(superstoreDataRaw);
      hideLoader();
      hideUploadOverlay();
    }, 50);
    return;
  }
  
  // 2. Try to load cached data if present
  const cachedData = sessionStorage.getItem('superstore_data');
  if (cachedData) {
    try {
      showLoader("Memuat data dari cache...");
      const data = JSON.parse(cachedData);
      processData(data);
      hideLoader();
      hideUploadOverlay();
      return;
    } catch (e) {
      console.warn("Failed to load cached data, clearing cache", e);
      sessionStorage.removeItem('superstore_data');
    }
  }
  
  // 3. Fallback to Auto-fetch
  autoLoadData();
});

// Auto Load Dataset
async function autoLoadData() {
  showLoader("Membaca dataset otomatis...");
  try {
    const response = await fetch('./sample_-_superstoreHirarkiQuartal.json');
    if (!response.ok) throw new Error("Gagal mengambil file JSON");
    const data = await response.json();
    processData(data);
    hideLoader();
    hideUploadOverlay();
  } catch (error) {
    console.warn("Auto-load failed, showing manual upload screen", error);
    hideLoader();
    showUploadOverlay();
  }
}

// Setup Drag & Drop & File Picker
function setupDragAndDrop() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  
  dropzone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
  });
  
  // Drag over effects
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  
  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
  
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
  });
}

function handleFile(file) {
  if (!file) return;
  
  // Validate that it's a JSON file
  if (!file.name.endsWith('.json')) {
    alert("Hanya mendukung file dengan format JSON (.json)");
    return;
  }
  
  showLoader("Membaca file JSON...");
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      processData(data);
      
      // Save cache in sessionStorage (up to 5MB, if larger, fail silently)
      try {
        sessionStorage.setItem('superstore_data', e.target.result);
      } catch (err) {
        console.warn("File too large to cache in sessionStorage, continuing in-memory");
      }
      
      hideLoader();
      hideUploadOverlay();
    } catch (error) {
      alert("Gagal mem-parsing file JSON. Pastikan isi file valid.");
      hideLoader();
    }
  };
  reader.onerror = function() {
    alert("Gagal membaca file.");
    hideLoader();
  };
  reader.readAsText(file);
}

// Show/Hide Overlays
function showLoader(text) {
  document.getElementById('loaderText').textContent = text;
  document.getElementById('loaderOverlay').style.display = 'flex';
}

function hideLoader() {
  document.getElementById('loaderOverlay').style.display = 'none';
}

function showUploadOverlay() {
  document.getElementById('uploadOverlay').style.opacity = '1';
  document.getElementById('uploadOverlay').style.pointerEvents = 'auto';
  document.getElementById('uploadOverlay').style.display = 'flex';
}

function hideUploadOverlay() {
  document.getElementById('uploadOverlay').style.opacity = '0';
  document.getElementById('uploadOverlay').style.pointerEvents = 'none';
  setTimeout(() => {
    document.getElementById('uploadOverlay').style.display = 'none';
  }, 500);
}

// Core Data Processing
function processData(rawItems) {
  superstoreData = rawItems.map(item => {
    const sales = parseFormattedNumber(item["Sales"]);
    const profit = parseFormattedNumber(item["Profit"]);
    const discount = parseFormattedNumber(item["Discount"]);
    const quantity = parseInt(item["Quantity"]) || 0;
    
    return {
      rowId: item["Row ID"],
      orderId: item["Order ID"],
      orderDate: item["Order Date"],
      shipDate: item["Ship Date"],
      shipMode: item["Ship Mode"],
      customerId: item["Customer ID"],
      customerName: item["Customer Name"],
      segment: item["Segment"],
      region: item.Region,
      city: item.City,
      state: item.State?.Province || item.State || "",
      country: item.Country?.Region || item.Country || "",
      postalCode: item["Postal Code"],
      productId: item["Product ID"],
      category: item.Category,
      subCategory: item["Sub-Category"],
      productName: item["Product Name"],
      sales: sales,
      profit: profit,
      discount: discount,
      quantity: quantity,
      tahun: parseInt(item.Tahun) || 0,
      bulan: parseInt(item.Bulan) || 0,
      quartal: item.Quartal
    };
  });
  
  // Set default filteredData
  filteredData = [...superstoreData];
  
  // Update Dataset Status Card in Sidebar
  updateDatasetStatus();
  
  // Load dynamic filter values
  populateFilterDropdowns();
  
  // Render current view
  renderCurrentView();
}

function updateDatasetStatus() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  
  dot.className = 'status-dot active';
  text.textContent = 'Superstore';
  
  // Set total transaction badge
  document.getElementById('dataBadge').innerHTML = `<i class="fas fa-database"></i> ${superstoreData.length.toLocaleString('en-US')} Rows Loaded`;
}

// Dropdown Filters
function populateFilterDropdowns() {
  const regions = ['ALL', ...new Set(superstoreData.map(d => d.region).filter(Boolean))].sort();
  const segments = ['ALL', ...new Set(superstoreData.map(d => d.segment).filter(Boolean))].sort();
  const categories = ['ALL', ...new Set(superstoreData.map(d => d.category).filter(Boolean))].sort();
  const years = [...new Set(superstoreData.map(d => d.tahun).filter(Boolean))].sort((a,b) => b - a);
  
  const selectRegion = document.getElementById('filterRegion');
  const selectSegment = document.getElementById('filterSegment');
  const selectCategory = document.getElementById('filterCategory');
  const selectTahun = document.getElementById('filterTahun');
  
  selectRegion.innerHTML = regions.map(r => `<option value="${r}">${r === 'ALL' ? 'Semua Region' : r}</option>`).join('');
  selectSegment.innerHTML = segments.map(s => `<option value="${s}">${s === 'ALL' ? 'Semua Segment' : s}</option>`).join('');
  selectCategory.innerHTML = categories.map(c => `<option value="${c}">${c === 'ALL' ? 'Semua Kategori' : c}</option>`).join('');
  
  if (selectTahun) {
    selectTahun.innerHTML = `<option value="ALL">Semua Tahun</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('');
  }
}

function setupFilters() {
  const selects = ['filterTahun', 'filterRegion', 'filterSegment', 'filterCategory'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });
  
  document.getElementById('btnResetFilters').addEventListener('click', () => {
    if (document.getElementById('filterTahun')) document.getElementById('filterTahun').value = 'ALL';
    document.getElementById('filterRegion').value = 'ALL';
    document.getElementById('filterSegment').value = 'ALL';
    document.getElementById('filterCategory').value = 'ALL';
    applyFilters();
  });
}

function applyFilters() {
  const tahunEl = document.getElementById('filterTahun');
  const tahunVal = tahunEl ? tahunEl.value : 'ALL';
  const regionVal = document.getElementById('filterRegion').value;
  const segmentVal = document.getElementById('filterSegment').value;
  const categoryVal = document.getElementById('filterCategory').value;
  
  filteredData = superstoreData.filter(item => {
    const matchTahun = tahunVal === 'ALL' || item.tahun.toString() === tahunVal;
    const matchRegion = regionVal === 'ALL' || item.region === regionVal;
    const matchSegment = segmentVal === 'ALL' || item.segment === segmentVal;
    const matchCategory = categoryVal === 'ALL' || item.category === categoryVal;
    return matchTahun && matchRegion && matchSegment && matchCategory;
  });
  
  // Re-render current view with new filtered data
  renderCurrentView();
}

// Sidebar Navigation Control
let currentViewId = 'view1';
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active from all items
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      
      // Add active to parent item
      const parent = link.closest('.nav-item');
      parent.classList.add('active');
      
      // Switch view
      const viewId = link.getAttribute('data-view');
      switchView(viewId);
    });
  });
}

function switchView(viewId) {
  currentViewId = viewId;
  
  // Deactivate all view containers
  document.querySelectorAll('.view-container').forEach(c => c.classList.remove('active'));
  
  // Activate selected container
  const activeContainer = document.getElementById(viewId);
  if (activeContainer) activeContainer.classList.add('active');
  
  // Update Header Text
  const title = activeContainer.getAttribute('data-title');
  const sub = activeContainer.getAttribute('data-subtitle');
  document.getElementById('activeViewTitle').textContent = title;
  document.getElementById('activeViewSub').textContent = sub;
  
  // Trigger rendering for the active view
  renderCurrentView();
}

// Render active view
function renderCurrentView() {
  if (superstoreData.length === 0) return;
  
  switch(currentViewId) {
    case 'view1':
      renderView1();
      break;
    case 'view2':
      renderView2();
      break;
    case 'view3':
      renderView3();
      break;
    case 'view4':
      renderView4();
      break;
    case 'view5':
      renderView5();
      break;
    case 'view6':
      renderView6();
      break;
    case 'view7':
      renderView7();
      break;
  }
}

// Calculate Quarter Specific KPIs
function getQuarterKPIs(year, quarter, dataset) {
  const qData = dataset.filter(d => d.tahun === year && d.quartal === quarter);
  const sales = qData.reduce((sum, d) => sum + d.sales, 0);
  const uniqueOrders = new Set(qData.map(d => d.orderId));
  const orders = uniqueOrders.size;
  const aov = orders > 0 ? sales / orders : 0;
  const uniqueCustomers = new Set(qData.map(d => d.customerId));
  const customers = uniqueCustomers.size;
  return { sales, orders, aov, customers };
}

/* =========================================================================
   HELPER: Get Active Year
   ========================================================================= */
function getActiveYear() {
  const tahunEl = document.getElementById('filterTahun');
  if (tahunEl && tahunEl.value !== 'ALL') {
    return parseInt(tahunEl.value);
  }
  if (filteredData.length > 0) {
    return Math.max(...filteredData.map(d => d.tahun));
  }
  return 2026;
}

/* =========================================================================
   VIEW 1 - PEMBUKA (HOOK)
   ========================================================================= */
function renderView1() {
  const activeYear = getActiveYear();
  
  const titleEl = document.getElementById('v1BarTitle');
  if (titleEl) titleEl.innerHTML = `<i class="fas fa-chart-bar"></i> Total Penjualan Kuartal Terakhir (Q4 ${activeYear})`;
  const subEl = document.getElementById('v1BarSub');
  if (subEl) subEl.textContent = `Perbandingan volume sales 3 bulan penutup tahun ${activeYear}.`;

  // 1. Overall KPIs in current active filtered data
  const totalSalesVal = filteredData.reduce((sum, d) => sum + d.sales, 0);
  const uniqueOrders = new Set(filteredData.map(d => d.orderId));
  const totalOrdersVal = uniqueOrders.size;
  const avgOrderVal = totalOrdersVal > 0 ? totalSalesVal / totalOrdersVal : 0;
  const uniqueCustomers = new Set(filteredData.map(d => d.customerId));
  const totalCustomersVal = uniqueCustomers.size;
  
  // Populate general KPI values
  document.getElementById('v1-sales-val').textContent = formatUSD(totalSalesVal);
  document.getElementById('v1-orders-val').textContent = totalOrdersVal.toLocaleString('en-US');
  document.getElementById('v1-aov-val').textContent = formatUSDDecimal(avgOrderVal);
  document.getElementById('v1-customers-val').textContent = totalCustomersVal.toLocaleString('en-US');
  
  // 2. Growth Indicators (Q4 activeYear vs Q3 activeYear)
  const q3 = getQuarterKPIs(activeYear, 'Q3', filteredData);
  const q4 = getQuarterKPIs(activeYear, 'Q4', filteredData);
  
  const salesGrowth = q3.sales > 0 ? ((q4.sales - q3.sales) / q3.sales) * 100 : 0;
  const ordersGrowth = q3.orders > 0 ? ((q4.orders - q3.orders) / q3.orders) * 100 : 0;
  const aovGrowth = q3.aov > 0 ? ((q4.aov - q3.aov) / q3.aov) * 100 : 0;
  const customersGrowth = q3.customers > 0 ? ((q4.customers - q3.customers) / q3.customers) * 100 : 0;
  
  updateGrowthBadge('v1-sales-growth', salesGrowth);
  updateGrowthBadge('v1-orders-growth', ordersGrowth);
  updateGrowthBadge('v1-aov-growth', aovGrowth);
  updateGrowthBadge('v1-customers-growth', customersGrowth);
  
  // 3. Bar Chart: Sales by Month (Q4 activeYear - Last 3 Months: Oct, Nov, Dec)
  const last3MonthsData = [
    { name: `Oktober ${activeYear}`, sales: 0, count: 0 },
    { name: `November ${activeYear}`, sales: 0, count: 0 },
    { name: `Desember ${activeYear}`, sales: 0, count: 0 }
  ];
  
  filteredData.forEach(d => {
    if (d.tahun === activeYear) {
      if (d.bulan === 10) last3MonthsData[0].sales += d.sales;
      else if (d.bulan === 11) last3MonthsData[1].sales += d.sales;
      else if (d.bulan === 12) last3MonthsData[2].sales += d.sales;
    }
  });
  
  const labels = last3MonthsData.map(d => d.name);
  const salesValues = last3MonthsData.map(d => d.sales);
  
  destroyChart('v1SalesChart');
  
  const ctx = document.getElementById('v1SalesChart').getContext('2d');
  
  // Cyberpunk neon gradients for bars
  const gradGreen = ctx.createLinearGradient(0, 0, 0, 300);
  gradGreen.addColorStop(0, 'rgba(0, 255, 135, 0.85)');
  gradGreen.addColorStop(1, 'rgba(0, 255, 135, 0.15)');

  const gradYellow = ctx.createLinearGradient(0, 0, 0, 300);
  gradYellow.addColorStop(0, 'rgba(255, 183, 3, 0.85)');
  gradYellow.addColorStop(1, 'rgba(255, 183, 3, 0.15)');

  const gradRed = ctx.createLinearGradient(0, 0, 0, 300);
  gradRed.addColorStop(0, 'rgba(255, 42, 109, 0.85)');
  gradRed.addColorStop(1, 'rgba(255, 42, 109, 0.15)');
  
  // Calculate Thresholds based on max sales
  const maxSales = Math.max(...salesValues);
  const highThreshold = maxSales * 0.8;
  const lowThreshold = maxSales * 0.5;

  const bgGradients = salesValues.map(val => {
    if (val >= highThreshold) return gradGreen;
    if (val >= lowThreshold) return gradYellow;
    return gradRed;
  });

  const borderColors = salesValues.map(val => {
    if (val >= highThreshold) return '#00ff87';
    if (val >= lowThreshold) return '#ffb703';
    return '#ff2a6d';
  });

  // Populate Legend
  const legendHtml = `
    <div class="legend-item" data-tooltip="Tinggi (>= ${formatUSDDecimal(highThreshold)})">
      <span class="legend-color legend-green"></span>
    </div>
    <div class="legend-item" data-tooltip="Sedang (${formatUSDDecimal(lowThreshold)} - ${formatUSDDecimal(highThreshold)})">
      <span class="legend-color legend-yellow"></span>
    </div>
    <div class="legend-item" data-tooltip="Rendah (< ${formatUSDDecimal(lowThreshold)})">
      <span class="legend-color legend-red"></span>
    </div>
  `;
  document.getElementById('v1-legend').innerHTML = legendHtml;
  
  // Also keep maxIdx for text insight
  const maxIdx = salesValues.indexOf(maxSales);
  
  activeCharts['v1SalesChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Revenue Sales',
        data: salesValues,
        backgroundColor: bgGradients,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8,
        barPercentage: 0.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1424',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#a5b4fc',
          bodyFont: { family: 'Inter', weight: 'bold' },
          callbacks: {
            label: function(context) {
              return ` Sales: ${formatUSDDecimal(context.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: {
            color: '#9ca3af',
            font: { family: 'Inter', size: 10 },
            callback: value => formatUSD(value)
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter', weight: 'bold', size: 11 } }
        }
      }
    }
  });
  
  // Dynamic Explanation Text
  const peakMonthName = last3MonthsData[maxIdx]?.name || 'Desember 2026';
  const peakSalesVal = formatUSDDecimal(salesValues[maxIdx] || 0);
  const novSalesVal = formatUSDDecimal(salesValues[1] || 0);
  
  document.getElementById('v1-insight-text').innerHTML = `
    Berdasarkan data kuartal terakhir (Q4 ${activeYear}), performa penjualan menunjukkan momentum tren positif yang luar biasa. 
    Penjualan melonjak tajam dan memuncak pada bulan <strong>${peakMonthName}</strong> dengan rekor <strong>${peakSalesVal}</strong>, 
    meningkat pesat dibandingkan bulan November (<strong>${novSalesVal}</strong>). Lonjakan dramatis di akhir tahun ini didorong 
    oleh tingginya seasonal holiday demand, menobatkan Q4 sebagai penutup tahun dengan pencapaian finansial paling sukses.
    <br><br>
    <strong>Saran Strategis:</strong> Mengingat tren lonjakan yang selalu terjadi di penghujung tahun, disarankan untuk mempersiapkan kampanye promosi <em>early-bird</em> dan memastikan ketersediaan stok (inventory) untuk produk-produk unggulan sejak bulan Oktober. Hal ini bertujuan untuk mengantisipasi <em>bottleneck</em> logistik dan memaksimalkan pendapatan sebelum puncak <em>holiday season</em> tiba.
  `;
}

function updateGrowthBadge(id, growth) {
  const element = document.getElementById(id);
  const sign = growth >= 0 ? '+' : '';
  const val = `${sign}${growth.toFixed(1)}%`;
  
  if (growth >= 0) {
    element.className = 'trend-badge up';
    element.innerHTML = `<i class="fas fa-arrow-up"></i> ${val}`;
  } else {
    element.className = 'trend-badge down';
    element.innerHTML = `<i class="fas fa-arrow-down"></i> ${val}`;
  }
}

/* =========================================================================
   VIEW 2 - OVERVIEW HISTORIS (CONTEXT)
   ========================================================================= */
function renderView2() {
  const activeYear = getActiveYear();
  
  const titleEl = document.getElementById('v2BarTitle');
  if (titleEl) titleEl.innerHTML = `<i class="fas fa-align-left"></i> Total Penjualan per Kuartal (Tahun ${activeYear})`;

  // 1. Calculate quarterly sales for the 4 quarters of activeYear
  const quarters = [
    { year: activeYear, q: 'Q1', label: `Q1 ${activeYear}`, sales: 0, orders: 0, customers: new Set(), prevSales: 0 },
    { year: activeYear, q: 'Q2', label: `Q2 ${activeYear}`, sales: 0, orders: 0, customers: new Set(), prevSales: 0 },
    { year: activeYear, q: 'Q3', label: `Q3 ${activeYear}`, sales: 0, orders: 0, customers: new Set(), prevSales: 0 },
    { year: activeYear, q: 'Q4', label: `Q4 ${activeYear}`, sales: 0, orders: 0, customers: new Set(), prevSales: 0 }
  ];
  
  // Fetch prior quarter (Q4 activeYear-1) for Q1 activeYear growth calculations
  const q4_prev = getQuarterKPIs(activeYear - 1, 'Q4', filteredData);
  quarters[0].prevSales = q4_prev.sales;
  
  // Populate the statistics
  filteredData.forEach(d => {
    if (d.tahun === activeYear) {
      const idx = quarters.findIndex(q => q.q === d.quartal);
      if (idx !== -1) {
        quarters[idx].sales += d.sales;
        quarters[idx].customers.add(d.customerId);
      }
    }
  });
  
  // Calculate unique orders counts per quarter
  quarters.forEach(q => {
    const qData = filteredData.filter(d => d.tahun === q.year && d.quartal === q.q);
    q.orders = new Set(qData.map(d => d.orderId)).size;
  });
  
  // Align prevSales for sequential growth
  quarters[1].prevSales = quarters[0].sales;
  quarters[2].prevSales = quarters[1].sales;
  quarters[3].prevSales = quarters[2].sales;
  
  const labels = quarters.map(q => q.label);
  const salesValues = quarters.map(q => q.sales);
  
  // Horizontal Bar Chart
  destroyChart('v2QuartersChart');
  const ctx = document.getElementById('v2QuartersChart').getContext('2d');
  
  // Neon gradients for horizontal bars
  const gradGreen = ctx.createLinearGradient(0, 0, 400, 0);
  gradGreen.addColorStop(0, 'rgba(0, 255, 135, 0.85)');
  gradGreen.addColorStop(1, 'rgba(0, 255, 135, 0.15)');

  const gradYellow = ctx.createLinearGradient(0, 0, 400, 0);
  gradYellow.addColorStop(0, 'rgba(255, 183, 3, 0.85)');
  gradYellow.addColorStop(1, 'rgba(255, 183, 3, 0.15)');

  const gradRed = ctx.createLinearGradient(0, 0, 400, 0);
  gradRed.addColorStop(0, 'rgba(255, 42, 109, 0.85)');
  gradRed.addColorStop(1, 'rgba(255, 42, 109, 0.15)');
  
  // Calculate Thresholds based on max sales
  const maxSales = Math.max(...salesValues);
  const highThreshold = maxSales * 0.8;
  const lowThreshold = maxSales * 0.5;

  const bgGradients = salesValues.map(val => {
    if (val >= highThreshold) return gradGreen;
    if (val >= lowThreshold) return gradYellow;
    return gradRed;
  });

  const borderColors = salesValues.map(val => {
    if (val >= highThreshold) return '#00ff87';
    if (val >= lowThreshold) return '#ffb703';
    return '#ff2a6d';
  });

  // Populate Legend
  const legendHtml = `
    <div class="legend-item" data-tooltip="Tinggi (>= ${formatUSDDecimal(highThreshold)})">
      <span class="legend-color legend-green"></span>
    </div>
    <div class="legend-item" data-tooltip="Sedang (${formatUSDDecimal(lowThreshold)} - ${formatUSDDecimal(highThreshold)})">
      <span class="legend-color legend-yellow"></span>
    </div>
    <div class="legend-item" data-tooltip="Rendah (< ${formatUSDDecimal(lowThreshold)})">
      <span class="legend-color legend-red"></span>
    </div>
  `;
  document.getElementById('v2-legend').innerHTML = legendHtml;
  
  activeCharts['v2QuartersChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: salesValues,
        backgroundColor: bgGradients,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8,
        barPercentage: 0.5
      }]
    },
    options: {
      indexAxis: 'y', // Horizontal bars
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1424',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#a5b4fc',
          bodyFont: { family: 'Inter', weight: 'bold' },
          callbacks: {
            label: function(context) {
              return ` Sales: ${formatUSDDecimal(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: {
            color: '#9ca3af',
            font: { family: 'Inter', size: 10 },
            callback: value => formatUSD(value)
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter', weight: 'bold', size: 11 } }
        }
      }
    }
  });
  
  // 2. Render Table Data
  const tableBody = document.getElementById('v2-table-body');
  tableBody.innerHTML = '';
  
  quarters.forEach(q => {
    const avgOrderVal = q.orders > 0 ? q.sales / q.orders : 0;
    const activeCustomersCount = q.customers.size;
    
    let growth = 0;
    let growthBadgeClass = 'badge-pill';
    if (q.prevSales > 0) {
      growth = ((q.sales - q.prevSales) / q.prevSales) * 100;
      growthBadgeClass += growth >= 0 ? ' success' : ' danger';
    } else {
      growthBadgeClass += ' primary';
    }
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${q.label}</strong></td>
      <td class="text-right"><strong>${formatUSDDecimal(q.sales)}</strong></td>
      <td class="text-center">${q.orders.toLocaleString('en-US')}</td>
      <td class="text-right">${formatUSDDecimal(avgOrderVal)}</td>
      <td class="text-center">${activeCustomersCount.toLocaleString('en-US')}</td>
      <td class="text-center">
        <span class="${growthBadgeClass}">${q.prevSales > 0 ? formatPercent(growth) : 'N/A'}</span>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/* =========================================================================
   VIEW 3 - TREN BULANAN (TENSION)
   ========================================================================= */
function renderView3() {
  const selectedYear = getActiveYear();

  const titleEl = document.getElementById('v3Title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fas fa-chart-area"></i> Tren Penjualan Bulanan (Tahun ${selectedYear})`;
  }

  // 1. Calculate sales per month for selectedYear
  const monthlySales = Array(12).fill(0);
  
  filteredData.forEach(d => {
    if (d.tahun === selectedYear && d.bulan >= 1 && d.bulan <= 12) {
      monthlySales[d.bulan - 1] += d.sales;
    }
  });
  
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  // Calculate average sales in selectedYear
  const nonZeroMonths = monthlySales.filter(v => v > 0);
  const avgSales = nonZeroMonths.length > 0 ? nonZeroMonths.reduce((a, b) => a + b, 0) / nonZeroMonths.length : 0;
  
  // Set dashed target line at 108% of average
  const targetSales = avgSales * 1.08;
  const targetData = Array(12).fill(targetSales);
  
  // Identify peak and trough months in selectedYear
  const maxIdx = monthlySales.indexOf(Math.max(...monthlySales));
  const minIdx = monthlySales.indexOf(Math.min(...monthlySales.filter(v => v > 0))); // ignore months with zero if any
  
  // Point radius: highlight peak & trough
  const pointRadii = Array(12).fill(5);
  const pointBgColor = Array(12).fill('rgba(0, 242, 254, 1)');
  const pointBorderColor = Array(12).fill('rgba(0, 242, 254, 1)');
  const pointHoverRadii = Array(12).fill(7);
  
  if (maxIdx !== -1) {
    pointRadii[maxIdx] = 9;
    pointBgColor[maxIdx] = '#00ff87'; // Green for peak
    pointBorderColor[maxIdx] = '#00ff87';
    pointHoverRadii[maxIdx] = 11;
  }
  if (minIdx !== -1 && minIdx !== maxIdx) {
    pointRadii[minIdx] = 9;
    pointBgColor[minIdx] = '#ff2a6d'; // Red/Pink for trough
    pointBorderColor[minIdx] = '#ff2a6d';
    pointHoverRadii[minIdx] = 11;
  }
  
  destroyChart('v3TrendChart');
  const ctx = document.getElementById('v3TrendChart').getContext('2d');
  
  // Glowing gradient for the line
  const gradLine = ctx.createLinearGradient(0, 0, 0, 300);
  gradLine.addColorStop(0, 'rgba(0, 242, 254, 0.4)');
  gradLine.addColorStop(1, 'rgba(157, 78, 221, 0.02)');
  
  activeCharts['v3TrendChart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthNames,
      datasets: [
        {
          label: 'Target Sales',
          data: targetData,
          borderColor: 'rgba(255, 183, 3, 0.5)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          labelColor: '#ffb703'
        },
        {
          label: 'Bulanan Realisasi',
          data: monthlySales,
          borderColor: '#00f2fe',
          borderWidth: 3,
          backgroundColor: gradLine,
          fill: true,
          tension: 0.35,
          pointRadius: pointRadii,
          pointBackgroundColor: pointBgColor,
          pointBorderColor: pointBorderColor,
          pointHoverRadius: pointHoverRadii
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#9ca3af', font: { family: 'Inter' } }
        },
        tooltip: {
          backgroundColor: '#0d1424',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#a5b4fc',
          bodyFont: { family: 'Inter', weight: 'bold' },
          callbacks: {
            label: function(context) {
              if (context.datasetIndex === 0) return ` Target: ${formatUSDDecimal(context.raw)}`;
              return ` Realisasi: ${formatUSDDecimal(context.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: {
            color: '#9ca3af',
            font: { family: 'Inter', size: 10 },
            callback: value => formatUSD(value)
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter', size: 10 } }
        }
      }
    }
  });
  
  // 3. Dynamic Narrative Box
  const peakMonth = monthNames[maxIdx] || 'Desember';
  const peakSales = formatUSDDecimal(monthlySales[maxIdx] || 0);
  const troughMonth = monthNames[minIdx] || 'Februari';
  const troughSales = formatUSDDecimal(monthlySales[minIdx] || 0);
  
  const targetSalesVal = formatUSDDecimal(targetSales);
  const percentAboveTarget = targetSales > 0 ? ((monthlySales[maxIdx] - targetSales) / targetSales) * 100 : 0;
  
  document.getElementById('v3-insight-text').innerHTML = `
    Tren bulanan sepanjang tahun <strong>${selectedYear}</strong> menunjukkan dinamika bisnis yang bergejolak (<strong>tension</strong>). 
    Penjualan menyentuh titik terendah pada bulan <strong>${troughMonth}</strong> sebesar <strong>${troughSales}</strong> yang berada jauh di bawah garis target bulanan sebesar <strong>${targetSalesVal}</strong>. 
    Namun, gejolak ini diikuti oleh pemulihan (<em>rally</em>) agresif di paruh kedua tahun ini, memuncak pada bulan <strong>${peakMonth}</strong> dengan mencatatkan rekor penjualan tertinggi sebesar <strong>${peakSales}</strong>, 
    atau melampaui target bulanan sebesar <strong>${formatPercent(percentAboveTarget)}</strong>. 
    Pola volatilitas ini menegaskan perlunya mitigasi sales deficit pada awal tahun guna menyeimbangkan siklus arus kas operasional.
  `;
}

/* =========================================================================
   VIEW 4 - PROFITABILITY BY CATEGORY (TENSION/INSIGHT)
   ========================================================================= */
function renderView4() {
  // 1. Group profit by category for Donut Chart
  const catProfitData = {};
  filteredData.forEach(d => {
    if (!catProfitData[d.category]) catProfitData[d.category] = 0;
    // Only include positive profit for proportion calculation, or handle net profit.
    // In this case we just use raw profit. If a category is negative, chartjs might hide it, but usually categories are net positive.
    catProfitData[d.category] += d.profit;
  });
  
  const catListProfit = Object.keys(catProfitData).map(name => ({
    name, profit: catProfitData[name] > 0 ? catProfitData[name] : 0 // Ensure non-negative for donut
  })).sort((a, b) => b.profit - a.profit);
  
  const totalProfitAll = catListProfit.reduce((sum, item) => sum + item.profit, 0);
  const donutLabels = catListProfit.map(c => c.name);
  const donutData = catListProfit.map(c => c.profit);
  
  // Donut Chart Colors
  const donutColors = ['#00f2fe', '#9d4edd', '#00ff87', '#ffb703', '#ff2a6d'];
  const donutBorders = donutColors.map(color => '#060913'); // dark border matching background
  
  destroyChart('v4DonutChart');
  const ctxDonut = document.getElementById('v4DonutChart').getContext('2d');
  activeCharts['v4DonutChart'] = new Chart(ctxDonut, {
    type: 'doughnut',
    data: {
      labels: donutLabels,
      datasets: [{
        data: donutData,
        backgroundColor: donutColors.slice(0, donutLabels.length),
        borderColor: donutBorders.slice(0, donutLabels.length),
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9ca3af', font: { family: 'Inter', size: 11 }, padding: 15 }
        },
        tooltip: {
          backgroundColor: '#0d1424',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#a5b4fc',
          bodyFont: { family: 'Inter', weight: 'bold' },
          callbacks: {
            label: function(context) {
              const val = context.raw;
              const perc = totalProfitAll > 0 ? ((val / totalProfitAll) * 100).toFixed(1) : 0;
              return ` ${context.label}: ${formatUSDDecimal(val)} (${perc}%)`;
            }
          }
        }
      }
    }
  });

  // 2. Group sales & profit by SUB-CATEGORY for Bar Charts
  const subCatData = {};
  filteredData.forEach(d => {
    if (!subCatData[d.subCategory]) {
      subCatData[d.subCategory] = { sales: 0, profit: 0 };
    }
    subCatData[d.subCategory].sales += d.sales;
    subCatData[d.subCategory].profit += d.profit;
  });
  
  // Convert to array and sort by Sales descending
  const subCatList = Object.keys(subCatData).map(name => {
    const sales = subCatData[name].sales;
    const profit = subCatData[name].profit;
    const margin = sales > 0 ? (profit / sales) * 100 : 0;
    return { name, sales, profit, margin };
  }).sort((a, b) => b.sales - a.sales);
  
  const labels = subCatList.map(c => c.name);
  const salesValues = subCatList.map(c => c.sales);
  const marginValues = subCatList.map(c => c.margin);
  
  // Draw Top Chart: "Sales per Sub-Category" (Horizontal)
  destroyChart('v4SalesChart');
  const ctxSales = document.getElementById('v4SalesChart').getContext('2d');
  
  const gradSales = ctxSales.createLinearGradient(0, 0, 400, 0);
  gradSales.addColorStop(0, 'rgba(0, 242, 254, 0.85)');
  gradSales.addColorStop(1, 'rgba(157, 78, 221, 0.15)');
  
  activeCharts['v4SalesChart'] = new Chart(ctxSales, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: salesValues,
        backgroundColor: gradSales,
        borderColor: '#00f2fe',
        borderWidth: 2,
        borderRadius: 4,
        barPercentage: 0.6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1424',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#a5b4fc',
          bodyFont: { family: 'Inter', weight: 'bold' },
          callbacks: {
            label: function(context) {
              return ` Sales Volume: ${formatUSDDecimal(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#9ca3af', font: { family: 'Inter', size: 9 }, callback: value => formatUSD(value) }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter', weight: 'bold', size: 9 } }
        }
      }
    }
  });
  
  // Draw Bottom Chart: "Profit Margin per Sub-Category" (Horizontal)
  // Must preserve the EXACT same sub-category order as the sales chart
  destroyChart('v4MarginChart');
  const ctxMargin = document.getElementById('v4MarginChart').getContext('2d');
  
  const gradGreen = ctxMargin.createLinearGradient(0, 0, 400, 0);
  gradGreen.addColorStop(0, 'rgba(0, 255, 135, 0.85)');
  gradGreen.addColorStop(1, 'rgba(0, 255, 135, 0.15)');
  
  const gradRed = ctxMargin.createLinearGradient(0, 0, 400, 0);
  gradRed.addColorStop(0, 'rgba(255, 42, 109, 0.85)');
  gradRed.addColorStop(1, 'rgba(255, 42, 109, 0.15)');
  
  // Color code: if margin is below 0%, paint it Neon Red, otherwise paint it Neon Green
  const bgGradientsMargin = marginValues.map(m => m < 0 ? gradRed : gradGreen);
  const borderColorsMargin = marginValues.map(m => m < 0 ? '#ff2a6d' : '#00ff87');
  
  activeCharts['v4MarginChart'] = new Chart(ctxMargin, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: marginValues,
        backgroundColor: bgGradientsMargin,
        borderColor: borderColorsMargin,
        borderWidth: 2,
        borderRadius: 4,
        barPercentage: 0.6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1424',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#a5b4fc',
          bodyFont: { family: 'Inter', weight: 'bold' },
          callbacks: {
            label: function(context) {
              return ` Margin Profit: ${context.raw.toFixed(2)}%`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#9ca3af', font: { family: 'Inter', size: 9 }, callback: value => `${value}%` }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter', weight: 'bold', size: 9 } }
        }
      }
    }
  });
  
  // 3. Dynamic Narrative Box
  const topSalesSubCat = subCatList[0]?.name || 'Phones';
  const topSalesVal = formatUSDDecimal(subCatList[0]?.sales || 0);
  
  // Find tables or a poorly performing sub-category for narrative
  const worstMarginData = [...subCatList].sort((a,b) => a.margin - b.margin)[0] || { name: 'Tables', margin: 0 };
  
  document.getElementById('v4-insight-text').innerHTML = `
    Analisis profitabilitas Sub-Category mengungkap adanya <strong>gap kontradiktif</strong> (<em>tension/insight</em>) antara volume penjualan dan margin laba bersih. 
    Produk <strong>${topSalesSubCat}</strong> memimpin kontribusi penjualan (<strong>${topSalesVal}</strong>) dengan margin yang sehat. 
    Sebaliknya, sub-kategori <strong>${worstMarginData.name}</strong> mencatatkan margin terendah sebesar <strong>${worstMarginData.margin.toFixed(1)}%</strong> meskipun volume penjualannya cukup material. 
    Kesenjangan ekstrem ini lazimnya dipicu oleh tingginya biaya pengiriman (logistik) dan pemberian tingkat diskon (discount rate) berlebih. Evaluasi strategi promosi pada produk bermargin negatif sangat direkomendasikan.
  `;
}

/* =========================================================================
   VIEW 5 - ANALISIS REGION (INSIGHT)
   ========================================================================= */
function renderView5() {
  // 1. Group by Region
  const regData = {};
  filteredData.forEach(d => {
    if (!regData[d.region]) {
      regData[d.region] = { sales: 0, count: 0, customers: new Set(), catSales: {} };
    }
    regData[d.region].sales += d.sales;
    regData[d.region].customers.add(d.customerId);
    
    // Track categories in region to find top category
    if (!regData[d.region].catSales[d.category]) {
      regData[d.region].catSales[d.category] = 0;
    }
    regData[d.region].catSales[d.category] += d.sales;
  });
  
  const regions = Object.keys(regData).map(name => {
    const sales = regData[name].sales;
    const customers = regData[name].customers.size;
    
    // Top category in region
    const catSales = regData[name].catSales;
    let topCat = 'N/A';
    let maxCatSales = -1;
    Object.keys(catSales).forEach(catName => {
      if (catSales[catName] > maxCatSales) {
        maxCatSales = catSales[catName];
        topCat = catName;
      }
    });
    
    return { name, sales, customers, topCat };
  }).sort((a, b) => b.sales - a.sales);
  
  const labels = regions.map(r => r.name);
  const salesValues = regions.map(r => r.sales);
  
  // Highlight highest region bar with green
  const maxIdx = salesValues.indexOf(Math.max(...salesValues));
  
  destroyChart('v5RegionChart');
  const ctx = document.getElementById('v5RegionChart').getContext('2d');
  
  const gradPrimary = ctx.createLinearGradient(0, 0, 0, 300);
  gradPrimary.addColorStop(0, 'rgba(157, 78, 221, 0.85)');
  gradPrimary.addColorStop(1, 'rgba(157, 78, 221, 0.15)');
  
  const gradSuccess = ctx.createLinearGradient(0, 0, 0, 300);
  gradSuccess.addColorStop(0, 'rgba(0, 255, 135, 0.85)');
  gradSuccess.addColorStop(1, 'rgba(0, 255, 135, 0.15)');
  
  const bgGradients = regions.map((r, idx) => idx === maxIdx ? gradSuccess : gradPrimary);
  const borderColors = regions.map((r, idx) => idx === maxIdx ? '#00ff87' : '#9d4edd');
  
  activeCharts['v5RegionChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: salesValues,
        backgroundColor: bgGradients,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8,
        barPercentage: 0.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1424',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#a5b4fc',
          bodyFont: { family: 'Inter', weight: 'bold' },
          callbacks: {
            label: function(context) {
              return ` Sales Volume: ${formatUSDDecimal(context.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#9ca3af', font: { family: 'Inter', size: 9 }, callback: value => formatUSD(value) }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter', weight: 'bold', size: 10 } }
        }
      }
    }
  });
  
  // 2. Data Table below
  const tableBody = document.getElementById('v5-table-body');
  tableBody.innerHTML = '';
  
  const activeYear = getActiveYear();
  const thGrowth = document.getElementById('v5TableGrowthHeader');
  if (thGrowth) thGrowth.innerHTML = `Growth YoY (${activeYear} vs ${activeYear - 1})`;
  
  const segmentVal = document.getElementById('filterSegment').value;
  const categoryVal = document.getElementById('filterCategory').value;

  regions.forEach((r, idx) => {
    // Calculate % Growth YoY for each region dynamically
    const salesPrev = superstoreData
      .filter(d => d.region === r.name && d.tahun === (activeYear - 1) && 
                   (segmentVal === 'ALL' || d.segment === segmentVal) &&
                   (categoryVal === 'ALL' || d.category === categoryVal))
      .reduce((sum, d) => sum + d.sales, 0);
      
    const salesCurr = filteredData
      .filter(d => d.region === r.name && d.tahun === activeYear)
      .reduce((sum, d) => sum + d.sales, 0);
      
    let growth = 0;
    let growthBadgeClass = 'badge-pill';
    if (salesPrev > 0) {
      growth = ((salesCurr - salesPrev) / salesPrev) * 100;
      growthBadgeClass += growth >= 0 ? ' success' : ' danger';
    } else {
      growthBadgeClass += ' primary';
    }
    
    // Category pill color based on name
    let catPillClass = 'badge-pill';
    if (r.topCat === 'Technology') catPillClass += ' success';
    else if (r.topCat === 'Furniture') catPillClass += ' danger';
    else catPillClass += ' primary';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.name}</strong></td>
      <td class="text-right"><strong>${formatUSDDecimal(r.sales)}</strong></td>
      <td class="text-center">
        <span class="${growthBadgeClass}">${salesPrev > 0 ? formatPercent(growth) : 'N/A'}</span>
      </td>
      <td class="text-center">${r.customers.toLocaleString('en-US')}</td>
      <td class="text-center">
        <span class="${catPillClass}">${r.topCat}</span>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/* =========================================================================
   VIEW 6 - PERFORMA STATE (CLIMAX)
   ========================================================================= */
function renderView6() {
  // 1. Group by State and sum Sales
  const stateData = {};
  filteredData.forEach(d => {
    if (d.state) {
      if (!stateData[d.state]) stateData[d.state] = 0;
      stateData[d.state] += d.sales;
    }
  });
  
  // Sort descending and take top 10
  const topStates = Object.keys(stateData).map(name => {
    return { name, sales: stateData[name] };
  }).sort((a, b) => b.sales - a.sales).slice(0, 10);
  
  const labels = topStates.map(s => s.name);
  const salesValues = topStates.map(s => s.sales);
  
  destroyChart('v6StateChart');
  const ctx = document.getElementById('v6StateChart').getContext('2d');
  
  // Beautiful neon cyan-to-purple gradient for the bars
  const gradState = ctx.createLinearGradient(0, 0, 0, 300);
  gradState.addColorStop(0, 'rgba(0, 242, 254, 0.85)');
  gradState.addColorStop(1, 'rgba(157, 78, 221, 0.2)');
  
  activeCharts['v6StateChart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Revenue Sales',
        data: salesValues,
        backgroundColor: gradState,
        borderColor: '#00f2fe',
        borderWidth: 2,
        borderRadius: 8,
        barPercentage: 0.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1424',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#a5b4fc',
          bodyFont: { family: 'Inter', weight: 'bold' },
          callbacks: {
            label: function(context) {
              return ` Sales: ${formatUSDDecimal(context.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#9ca3af', font: { family: 'Inter', size: 9 }, callback: value => formatUSD(value) }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter', weight: 'bold', size: 9 } }
        }
      }
    }
  });
  
  // Calculate dynamic narrative insights
  const totalSalesAll = filteredData.reduce((sum, d) => sum + d.sales, 0);
  
  const s1 = topStates[0] || { name: 'California', sales: 0 };
  const s2 = topStates[1] || { name: 'New York', sales: 0 };
  const s3 = topStates[2] || { name: 'Texas', sales: 0 };
  
  const combinedTop3 = s1.sales + s2.sales + s3.sales;
  const contributionPercent = totalSalesAll > 0 ? (combinedTop3 / totalSalesAll) * 100 : 0;
  
  document.getElementById('v6-insight-text').innerHTML = `
    Analisis performa state menyajikan klimaks (<strong>climax</strong>) kontribusi geografis yang sangat tidak berimbang. 
    Tiga kontributor terbesar nasional adalah <strong>${s1.name}</strong> (<strong>${formatUSDDecimal(s1.sales)}</strong>), 
    <strong>${s2.name}</strong> (<strong>${formatUSDDecimal(s2.sales)}</strong>), dan 
    <strong>${s3.name}</strong> (<strong>${formatUSDDecimal(s3.sales)}</strong>). 
    Secara akumulatif, ketiga state ini mendominasi dan menyumbangkan kontribusi raksasa sebesar 
    <strong>${contributionPercent.toFixed(1)}%</strong> dari total seluruh penjualan nasional di dataset. 
    Dominasi luar biasa di wilayah utama ini mempertegas pentingnya fokus alokasi stok produk, prioritas kampanye pemasaran, 
    dan keunggulan layanan logistik pada region kontributor puncak.
  `;
}

/* =========================================================================
   VIEW 7 - RINGKASAN & TEMUAN UTAMA (ACTION)
   ========================================================================= */
function renderView7() {
  const activeYear = getActiveYear();

  // 1. Calculations for Action Plan 1: Q4 activeYear Sales & Growth
  const q3 = getQuarterKPIs(activeYear, 'Q3', filteredData);
  const q4 = getQuarterKPIs(activeYear, 'Q4', filteredData);
  const growthQ4 = q3.sales > 0 ? ((q4.sales - q3.sales) / q3.sales) * 100 : 0;
  
  const lastMonthSalesData = filteredData
    .filter(d => d.tahun === activeYear && d.bulan === 12)
    .reduce((sum, d) => sum + d.sales, 0);
    
  document.getElementById('v7-card1-body').innerHTML = `
    Kuartal penutup (Q4 ${activeYear}) mencatatkan penjualan sebesar 
    <strong>${formatUSD(q4.sales)}</strong>, tumbuh sebesar <strong>${formatPercent(growthQ4)}</strong> 
    dibandingkan kuartal sebelumnya (Q3 ${activeYear}). Puncak transaksi bulanan di akhir tahun tercatat pada bulan Desember 
    dengan total realisasi <strong>${formatUSD(lastMonthSalesData)}</strong>.
  `;
  
  document.getElementById('v7-card1-bullets').innerHTML = `
    <li>Pertumbuhan Q4 mengonfirmasi penyerapan produk yang tinggi menjelang akhir tahun.</li>
    <li>Penutupan budget tahunan korporat serta momentum liburan menjadi akselerator revenue utama.</li>
    <li>Disarankan menyiapkan <em>capital expenditure</em> logistik 15% lebih awal untuk menanggulangi lonjakan pesanan di Q1 ${activeYear + 1}.</li>
  `;
  
  // 2. Action Plan 2: Region YoY Growth
  const regData = {};
  filteredData.forEach(d => {
    if (d.region) {
      if (!regData[d.region]) regData[d.region] = { sales: 0, customers: new Set() };
      regData[d.region].sales += d.sales;
      regData[d.region].customers.add(d.customerId);
    }
  });
  
  // Find top region by sales
  const sortedRegs = Object.keys(regData).map(name => {
    return { name, sales: regData[name].sales, customers: regData[name].customers.size };
  }).sort((a, b) => b.sales - a.sales);
  
  const topReg = sortedRegs[0] || { name: 'Semua Region', sales: 0, customers: 0 };
  
  // Get filter states
  const segmentVal = document.getElementById('filterSegment').value;
  const categoryVal = document.getElementById('filterCategory').value;

  // YoY growth for top region against activeYear - 1
  const rSalesPrev = superstoreData
    .filter(d => d.region === topReg.name && d.tahun === (activeYear - 1) && 
                 (segmentVal === 'ALL' || d.segment === segmentVal) &&
                 (categoryVal === 'ALL' || d.category === categoryVal))
    .reduce((sum, d) => sum + d.sales, 0);
  const rSalesCurr = topReg.sales;
  const rGrowth = rSalesPrev > 0 ? ((rSalesCurr - rSalesPrev) / rSalesPrev) * 100 : 0;
  
  document.getElementById('v7-card2-body').innerHTML = `
    Wilayah <strong>${topReg.name}</strong> mendominasi peta kontribusi pasar dengan total volume penjualan sebesar 
    <strong>${formatUSD(topReg.sales)}</strong>. Wilayah ini mencatatkan pertumbuhan year-over-year (YoY) 
    sebesar <strong>${formatPercent(rGrowth)}</strong> (${activeYear} vs ${activeYear - 1}).
  `;
  
  document.getElementById('v7-card2-bullets').innerHTML = `
    <li>Menjadi region dengan basis pelanggan terluas pada kriteria saat ini, memayungi <strong>${topReg.customers.toLocaleString('en-US')}</strong> customer aktif.</li>
    <li>Tingkat penetrasi produk di wilayah ini berperan besar sebagai motor penggerak growth (pertumbuhan) utama.</li>
    <li>Strategi replikasi program loyalti dari <strong>${topReg.name}</strong> direkomendasikan untuk diterapkan di region lain guna mendongkrak penjualan serentak.</li>
  `;
  
  // 3. Action Plan 3: Lowest Margin Category (Dynamic)
  const catStats = {};
  filteredData.forEach(d => {
    if (!catStats[d.category]) catStats[d.category] = { sales: 0, profit: 0, discounts: [] };
    catStats[d.category].sales += d.sales;
    catStats[d.category].profit += d.profit;
    catStats[d.category].discounts.push(d.discount);
  });
  
  let worstCat = '';
  let worstMargin = Infinity;
  let worstSales = 0;
  let worstAvgDiscount = 0;
  
  Object.keys(catStats).forEach(c => {
    const margin = catStats[c].sales > 0 ? (catStats[c].profit / catStats[c].sales) * 100 : 0;
    if (margin < worstMargin) {
      worstMargin = margin;
      worstCat = c;
      worstSales = catStats[c].sales;
      const dArr = catStats[c].discounts;
      worstAvgDiscount = dArr.length > 0 ? (dArr.reduce((a,b)=>a+b,0)/dArr.length) * 100 : 0;
    }
  });

  const displayMargin = worstMargin === Infinity ? 0 : worstMargin;
  
  document.getElementById('v7-card3-body').innerHTML = `
    Kategori <strong>${worstCat || 'Produk'}</strong> menyumbangkan volume penjualan sebesar 
    <strong>${formatUSD(worstSales)}</strong>, namun menghasilkan margin profit bersih yang paling rendah di antara lainnya, yaitu hanya 
    <strong>${displayMargin.toFixed(1)}%</strong>. Faktor diskon rata-rata sebesar <strong>${worstAvgDiscount.toFixed(1)}%</strong> teridentifikasi sebagai salah satu pemicunya.
  `;
  
  document.getElementById('v7-card3-bullets').innerHTML = `
    <li>Tingkat margin yang rendah pada kategori <strong>${worstCat || 'Produk'}</strong> berpotensi menggerus profitabilitas bersih secara keseluruhan.</li>
    <li>Area kritis ini membutuhkan tindakan evaluasi harga (restrukturisasi) atau penyesuaian biaya operasional segera.</li>
    <li>Aksi: Batasi maksimal promo diskon yang tidak wajar, dan dorong upselling produk yang memiliki margin lebih tebal untuk kompensasi (subsidi silang).</li>
  `;
  
  // 4. Action Plan 4: AOV
  const totalSalesAll = filteredData.reduce((sum, d) => sum + d.sales, 0);
  const totalOrdersAll = new Set(filteredData.map(d => d.orderId)).size;
  const aovVal = totalOrdersAll > 0 ? totalSalesAll / totalOrdersAll : 0;
  
  // Sub-category (instead of category) with highest AOV for more granularity if category is filtered
  const subcatAovs = {};
  filteredData.forEach(d => {
    if (!subcatAovs[d.subCategory]) subcatAovs[d.subCategory] = { sales: 0, orders: new Set() };
    subcatAovs[d.subCategory].sales += d.sales;
    subcatAovs[d.subCategory].orders.add(d.orderId);
  });
  
  let topCatAovName = '';
  let maxCatAovVal = -1;
  Object.keys(subcatAovs).forEach(c => {
    const oSize = subcatAovs[c].orders.size;
    const aov = oSize > 0 ? subcatAovs[c].sales / oSize : 0;
    if (aov > maxCatAovVal) {
      maxCatAovVal = aov;
      topCatAovName = c;
    }
  });
  
  document.getElementById('v7-card4-body').innerHTML = `
    Rata-rata Nilai Pesanan (Average Order Value) berada di angka <strong>${formatUSDDecimal(aovVal)}</strong> per transaksi. 
    Jika di-breakdown lebih dalam, sub-kategori dengan nilai transaksi rata-rata tertinggi dipimpin oleh <strong>${topCatAovName || 'N/A'}</strong> dengan rata-rata 
    <strong>${formatUSDDecimal(maxCatAovVal)}</strong> per order.
  `;
  
  document.getElementById('v7-card4-bullets').innerHTML = `
    <li>AOV yang sehat menunjukkan adanya kapabilitas daya beli (purchasing power) dari segmen pelanggan saat ini.</li>
    <li>Pemberlakuan cross-selling bundle (paket bundling) terbukti ampuh memicu kenaikan rata-rata transaksi.</li>
    <li>Action Plan: Luncurkan skema gratis ongkir dengan minimum pembelanjaan sedikit di atas nilai AOV saat ini guna menaikkan target keranjang belanja sebesar 15% pada kuartal mendatang.</li>
  `;
}
