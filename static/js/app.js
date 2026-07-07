// SevaSetu AI App Logic

document.addEventListener('DOMContentLoaded', () => {
    // Global App State
    const state = {
        activeTab: 'tab-dashboard',
        schemes: [],
        complaints: [],
        selectedComplaint: null,
        selectedAdminComplaint: null,
        language: 'English',
        aiStatus: 'simulated',
        chatHistory: [
            { sender: 'bot', text: 'Namaste! I am Vani, your SevaSetu AI Companion. How can I help you today? You can ask me about local welfare schemes or how to report civic issues.' }
        ],
        map: null,
        miniMap: null,
        mapMarkers: [],
        categoryChart: null,
        uploadBase64: null,
        uploadMime: null,
        uploadFilename: ""
    };

    // Initialize all modules
    initApp();

    // -------------------------------------------------------------
    // Core App Initialization
    // -------------------------------------------------------------
    async function initApp() {
        // Run SVG Icon replacement
        lucide.createIcons();

        // ------------------ Tab Navigation ------------------
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                switchTab(targetTab);
            });
        });

        // ------------------ Language Change ------------------
        const langSelector = document.getElementById('lang-selector');
        langSelector.addEventListener('change', (e) => {
            state.language = e.target.value;
            // Update AI status & chat welcoming language
            updateVaniWelcoming();
        });

        // ------------------ Load Initial API Config & Data ------------------
        await checkAPIConfig();
        await fetchSchemes();
        await fetchComplaints();

        // ------------------ Initialize Map & Charts ------------------
        initMainMap();
        initCategoryChart();
        updateDashboardMetrics();
        startAITypewriterDiagnostic();

        // ------------------ Set up Forms & Subscriptions ------------------
        setupSchemeFilters();
        setupGrievanceSubmission();
        setupAdminSimulator();
        setupVaniChat();
        setupAPIConfigForm();
    }

    // -------------------------------------------------------------
    // Router / Tab Switcher
    // -------------------------------------------------------------
    function switchTab(tabId) {
        // Toggle Active Button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Toggle Active Pane
        document.querySelectorAll('.tab-pane').forEach(pane => {
            if (pane.id === tabId) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        state.activeTab = tabId;

        // Header Title Mapping
        const headerTitle = document.getElementById('page-title');
        const headerSubtitle = document.getElementById('page-subtitle');

        const headers = {
            'tab-dashboard': { title: 'Dashboard Hub', sub: 'Real-time civic diagnostics and local updates.' },
            'tab-schemes': { title: 'Scheme Matcher', sub: 'Instant dynamic matching with Indian welfare programs.' },
            'tab-file-grievance': { title: 'Report Civic Issue', sub: 'Upload photos to file smart geo-located complaints.' },
            'tab-tracker': { title: 'Grievance Tracker', sub: 'Track resolution timeline and field crew updates.' },
            'tab-admin': { title: 'Municipal Control Station', sub: 'Internal portal to dispatch crews and update complaints.' },
            'tab-settings': { title: 'API Configuration', sub: 'Manage AI credentials and local environment settings.' }
        };

        if (headers[tabId]) {
            headerTitle.textContent = headers[tabId].title;
            headerSubtitle.textContent = headers[tabId].sub;
        }

        // Specific Tab Actions
        if (tabId === 'tab-dashboard') {
            // Relayout Leaflet Map to prevent gray tiles error
            if (state.map) {
                setTimeout(() => { state.map.invalidateSize(); }, 200);
            }
        } else if (tabId === 'tab-tracker') {
            if (state.miniMap) {
                setTimeout(() => { state.miniMap.invalidateSize(); }, 200);
            }
        }
    }

    // -------------------------------------------------------------
    // Configuration Management
    // -------------------------------------------------------------
    async function checkAPIConfig() {
        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            const badge = document.getElementById('ai-status-badge');
            const statusText = document.getElementById('ai-status-text');

            if (data.has_gemini) {
                state.aiStatus = 'active';
                badge.className = 'ai-status-indicator active';
                statusText.textContent = 'Gemini AI Active';
            } else {
                state.aiStatus = 'simulated';
                badge.className = 'ai-status-indicator simulated';
                statusText.textContent = 'AI Simulated';
            }
        } catch (err) {
            console.error('Error fetching config status:', err);
        }
    }

    function setupAPIConfigForm() {
        const form = document.getElementById('config-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const geminiKey = document.getElementById('config-gemini-key').value;
            const openaiKey = document.getElementById('config-openai-key').value;

            try {
                const res = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gemini_key: geminiKey, openai_key: openaiKey })
                });
                const data = await res.json();
                alert(data.message);
                await checkAPIConfig();
                switchTab('tab-dashboard');
            } catch (err) {
                alert('Failed to save API configuration.');
            }
        });
    }

    // -------------------------------------------------------------
    // Welfare Schemes Engine
    // -------------------------------------------------------------
    async function fetchSchemes() {
        try {
            const res = await fetch('/api/schemes');
            state.schemes = await res.json();
            renderSchemesList(state.schemes);
        } catch (err) {
            console.error('Error loading schemes database:', err);
        }
    }

    function renderSchemesList(schemesList) {
        const grid = document.getElementById('schemes-grid');
        const countBadge = document.getElementById('scheme-matches-count');
        grid.innerHTML = '';
        
        countBadge.textContent = `Showing ${schemesList.length} qualifying schemes`;

        if (schemesList.length === 0) {
            grid.innerHTML = `
                <div class="card p-8 text-center text-secondary">
                    <i data-lucide="info" style="width: 48px; height: 48px; margin: 0 auto 12px; color: var(--text-muted);"></i>
                    <h4>No Matching Schemes Found</h4>
                    <p>Try adjusting your income ceiling, state filters, or occupation parameters.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        schemesList.forEach(scheme => {
            const card = document.createElement('div');
            card.className = 'scheme-card';
            card.id = `scheme-${scheme.id}`;
            
            // Highlight list of documents
            const docsList = scheme.documents.map(doc => `<li>${doc}</li>`).join('');

            card.innerHTML = `
                <div class="scheme-summary">
                    <div class="scheme-main-info">
                        <span class="scheme-cat-badge">${scheme.category}</span>
                        <h3>${scheme.name}</h3>
                        <p class="scheme-desc-excerpt">${scheme.description}</p>
                    </div>
                    <i data-lucide="chevron-down" class="scheme-chevron"></i>
                </div>
                <div class="scheme-details-drawer">
                    <div class="details-grid">
                        <div class="details-block">
                            <h4>Benefits Support</h4>
                            <p>${scheme.benefits}</p>
                        </div>
                        <div class="details-block">
                            <h4>Eligibility Rules</h4>
                            <p>${scheme.eligibility.additional || 'Standard conditions apply.'}</p>
                            <p style="margin-top: 4px; font-weight: 500;">
                                Income ceiling: Under ₹${scheme.eligibility.max_income.toLocaleString()}
                            </p>
                        </div>
                        <div class="details-block">
                            <h4>Required Documents</h4>
                            <ul>${docsList}</ul>
                        </div>
                        <div class="details-block">
                            <h4>Application Process</h4>
                            <p>${scheme.application_mode}</p>
                            <a href="${scheme.official_url}" target="_blank" class="btn btn-secondary btn-sm" style="margin-top: 8px; align-self: flex-start;">
                                <i data-lucide="external-link"></i> Official Portal
                            </a>
                        </div>
                    </div>
                    <div class="scheme-actions">
                        <button class="btn btn-secondary btn-sm btn-ask-scheme" data-scheme="${scheme.name}">
                            <i data-lucide="message-square"></i> Ask Vani about this
                        </button>
                    </div>
                </div>
            `;

            // Accordion click toggle
            const summary = card.querySelector('.scheme-summary');
            summary.addEventListener('click', () => {
                card.classList.toggle('open');
            });

            // Action: ask Vani
            const askBtn = card.querySelector('.btn-ask-scheme');
            askBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openVaniWithQuery(`Tell me how to apply for ${scheme.name} and what documents are required.`);
            });

            grid.appendChild(card);
        });

        lucide.createIcons();
    }

    function setupSchemeFilters() {
        const searchInput = document.getElementById('scheme-search-input');
        const filterForm = document.getElementById('scheme-filter-form');
        const btnMatch = document.getElementById('btn-match-schemes');

        const runLocalFilter = () => {
            const search = searchInput.value.toLowerCase();
            const stateVal = document.getElementById('filter-state').value;
            const genderVal = document.getElementById('filter-gender').value;
            const ageVal = parseInt(document.getElementById('filter-age').value) || 0;
            const incomeVal = parseInt(document.getElementById('filter-income').value) || 9999999;
            const occVal = document.getElementById('filter-occupation').value;

            const filtered = state.schemes.filter(s => {
                // Keyword Search Match
                const matchesKeyword = s.name.toLowerCase().includes(search) || 
                                       s.description.toLowerCase().includes(search) || 
                                       s.category.toLowerCase().includes(search);
                if (!matchesKeyword) return false;

                // State Match
                const stateOk = stateVal === 'All' || s.eligibility.states.includes('All') || s.eligibility.states.includes(stateVal);
                if (!stateOk) return false;

                // Gender Match
                const genderOk = s.eligibility.gender === 'Any' || genderVal === 'Any' || s.eligibility.gender === genderVal;
                if (!genderOk) return false;

                // Age Match
                const ageOk = ageVal >= s.eligibility.min_age && ageVal <= s.eligibility.max_age;
                if (!ageOk) return false;

                // Income Match
                const incomeOk = incomeVal <= s.eligibility.max_income;
                if (!incomeOk) return false;

                // Occupation Match
                const occOk = s.eligibility.occupations.includes('Any') || occVal === 'Any' || s.eligibility.occupations.includes(occVal);
                if (!occOk) return false;

                return true;
            });

            renderSchemesList(filtered);
        };

        // Inputs triggering filters
        searchInput.addEventListener('input', runLocalFilter);
        
        btnMatch.addEventListener('click', () => {
            // Simulated AI summary matcher activation
            runLocalFilter();
            
            const stateVal = document.getElementById('filter-state').value;
            const ageVal = document.getElementById('filter-age').value;
            const incomeVal = document.getElementById('filter-income').value;
            const occVal = document.getElementById('filter-occupation').value;
            
            const aiPrompt = `Recommend welfare schemes for a user living in ${stateVal}, age ${ageVal}, occupation ${occVal}, with an annual income of ₹${incomeVal}.`;
            openVaniWithQuery(aiPrompt);
        });
    }

    // -------------------------------------------------------------
    // Complaints & Grievance Manager
    // -------------------------------------------------------------
    async function fetchComplaints() {
        try {
            const res = await fetch('/api/complaints');
            state.complaints = await res.json();
            
            // Initial selection
            if (state.complaints.length > 0) {
                state.selectedComplaint = state.complaints[0];
            }
            
            renderComplaintsList();
            renderAdminQueue();
            updateMapMarkers();
            updateCategoryChart();
            updateDashboardMetrics();
        } catch (err) {
            console.error('Error fetching complaints list:', err);
        }
    }

    function renderComplaintsList() {
        const listContainer = document.getElementById('tracker-list');
        const searchVal = document.getElementById('tracker-search-input').value.toLowerCase();
        listContainer.innerHTML = '';

        const filtered = state.complaints.filter(c => {
            return c.id.toLowerCase().includes(searchVal) || 
                   c.title.toLowerCase().includes(searchVal) || 
                   c.category.toLowerCase().includes(searchVal) || 
                   c.status.toLowerCase().includes(searchVal);
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="p-4 text-center text-secondary">No issues found.</div>`;
            return;
        }

        filtered.forEach(comp => {
            const item = document.createElement('div');
            item.className = `tracker-item ${state.selectedComplaint && state.selectedComplaint.id === comp.id ? 'active' : ''}`;
            
            // Format status class name
            const statusClass = comp.status.toLowerCase().replace(' ', '-');
            const dateObj = new Date(comp.submitted_at);
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

            item.innerHTML = `
                <div class="tracker-item-header">
                    <span class="tracker-item-id">${comp.id}</span>
                    <span class="status-badge ${statusClass}">${comp.status}</span>
                </div>
                <h4>${comp.title}</h4>
                <div class="tracker-item-footer">
                    <span>${comp.category}</span>
                    <span>${dateStr}</span>
                </div>
            `;

            item.addEventListener('click', () => {
                state.selectedComplaint = comp;
                renderComplaintsList();
                renderTimelineDetails();
            });

            listContainer.appendChild(item);
        });

        // Trigger detail rendering
        renderTimelineDetails();
    }

    // Timeline detail panels rendering
    function renderTimelineDetails() {
        const emptyState = document.getElementById('timeline-empty-state');
        const contentArea = document.getElementById('timeline-results-content');

        if (!state.selectedComplaint) {
            emptyState.classList.remove('hidden');
            contentArea.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        contentArea.classList.remove('hidden');

        const comp = state.selectedComplaint;
        
        document.getElementById('timeline-ticket-id').textContent = comp.id;
        document.getElementById('timeline-ticket-title').textContent = comp.title;
        document.getElementById('timeline-ticket-desc').textContent = comp.description;
        document.getElementById('timeline-ticket-cat').textContent = comp.category;
        document.getElementById('timeline-ticket-loc').textContent = comp.location;
        
        const dateObj = new Date(comp.submitted_at);
        document.getElementById('timeline-ticket-date').textContent = dateObj.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        // Set status badge text
        const statusBadge = document.getElementById('timeline-ticket-status');
        statusBadge.textContent = comp.status;
        statusBadge.className = `status-badge ${comp.status.toLowerCase().replace(' ', '-')}`;

        // Set Image
        const imgEl = document.getElementById('timeline-ticket-photo');
        imgEl.src = comp.image_path;

        // Render Vertical Timeline steps
        const flowContainer = document.getElementById('timeline-progress-flow');
        flowContainer.innerHTML = '';

        // Timeline stages
        const stages = ["Submitted", "Under Review", "Assigned", "Resolved"];
        const currentStageIndex = stages.indexOf(comp.status);

        stages.forEach((stage, idx) => {
            const step = document.createElement('div');
            step.className = 'timeline-step';
            
            // Identify if completed, active, or pending
            if (idx < currentStageIndex) {
                step.classList.add('completed');
            } else if (idx === currentStageIndex) {
                step.classList.add('active');
            }
            
            // Check if we have dynamic logs for this stage
            const matchingLog = comp.timeline.find(log => log.status === stage);
            let timeStr = "";
            let logNote = `Pending assignment.`;

            if (stage === 'Submitted') logNote = "Grievance lodged in database, dispatch system triggered.";
            if (stage === 'Under Review') logNote = "Verifying report geocoding details.";
            if (stage === 'Assigned') logNote = "Municipal technicians scheduled.";
            if (stage === 'Resolved') logNote = "Pending final cleanup verification.";

            if (matchingLog) {
                const logDate = new Date(matchingLog.timestamp);
                timeStr = logDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                logNote = matchingLog.note;
            }

            step.innerHTML = `
                <div class="timeline-dot"></div>
                <div class="timeline-meta">
                    <span class="timeline-title">${stage}</span>
                    <span class="timeline-time">${timeStr}</span>
                </div>
                <p class="timeline-note">${logNote}</p>
            `;
            flowContainer.appendChild(step);
        });

        // Initialize/Update dynamic Mini map inside timeline
        initTimelineMiniMap(comp.latitude, comp.longitude, comp.title);
    }

    // Tracker search event
    document.getElementById('tracker-search-input').addEventListener('input', renderComplaintsList);

    // -------------------------------------------------------------
    // Leaflet Map Implementations
    // -------------------------------------------------------------
    function initMainMap() {
        if (state.map) return;

        // Center on Bangalore coordinates
        state.map = L.map('dashboard-map').setView([12.9716, 77.5946], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(state.map);

        // Map Click Action to autofill GPS coordinates
        state.map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            document.getElementById('grievance-lat').value = lat.toFixed(6);
            document.getElementById('grievance-lng').value = lng.toFixed(6);
            
            // Visual notice
            showToastMessage(`Coordinates captured: ${lat.toFixed(4)}, ${lng.toFixed(4)}. Switch to "Report Issue" to file!`);
            
            // Dynamic geocoding mock
            fetchMockAddress(lat, lng);
        });
    }

    async function fetchMockAddress(lat, lng) {
        // Reverse address mock
        const landmarks = [
            "Near Central Metro Station, Bangalore",
            "Opposite Public Park, Sector 4, Noida",
            "Near 5th Cross Junction, Indiranagar, Bangalore",
            "Next to Community Playground, Noida",
            "Adjacent to Metro Pillar 24, MG Road, Bangalore"
        ];
        const randomLandmark = landmarks[Math.floor(Math.random() * landmarks.length)];
        document.getElementById('grievance-location').value = randomLandmark;
    }

    function initTimelineMiniMap(lat, lng, title) {
        // If minimap exists, remove it or reset center
        if (state.miniMap) {
            state.miniMap.setView([lat, lng], 15);
            // Remove existing markers from minimap
            state.miniMap.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                    state.miniMap.removeLayer(layer);
                }
            });
        } else {
            state.miniMap = L.map('timeline-mini-map', {
                zoomControl: false,
                attributionControl: false
            }).setView([lat, lng], 15);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.miniMap);
        }

        L.marker([lat, lng]).addTo(state.miniMap)
            .bindPopup(title)
            .openPopup();
    }

    function updateMapMarkers() {
        if (!state.map) return;

        // Clear existing markers
        state.mapMarkers.forEach(marker => state.map.removeLayer(marker));
        state.mapMarkers = [];

        state.complaints.forEach(comp => {
            // Determine Color based on severity
            let markerColor = 'blue'; // low
            if (comp.severity === 'High' || comp.severity === 'Critical') markerColor = 'red';
            else if (comp.severity === 'Medium') markerColor = 'orange';

            // Custom Leaflet Circle Marker
            const marker = L.circleMarker([comp.latitude, comp.longitude], {
                radius: 10,
                fillColor: markerColor === 'red' ? '#EF4444' : (markerColor === 'orange' ? '#F59E0B' : '#3B82F6'),
                color: '#FFFFFF',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(state.map);

            marker.bindPopup(`
                <div style="font-family: var(--font-primary); color: #FFF; background: #0F1424; padding: 6px; border-radius: 4px;">
                    <h5 style="margin: 0 0 4px; font-weight: 700; font-family: var(--font-heading);">${comp.id}: ${comp.title}</h5>
                    <p style="margin: 0; font-size: 0.75rem;">Status: <b style="color: var(--color-secondary);">${comp.status}</b></p>
                    <button onclick="document.dispatchEvent(new CustomEvent('view-ticket', {detail: '${comp.id}'}))" style="margin-top: 8px; border: none; background: #6366F1; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">
                        Track Timeline
                    </button>
                </div>
            `);

            state.mapMarkers.push(marker);
        });
    }

    // Intercept visual map buttons
    document.addEventListener('view-ticket', (e) => {
        const ticketId = e.detail;
        const target = state.complaints.find(c => c.id === ticketId);
        if (target) {
            state.selectedComplaint = target;
            switchTab('tab-tracker');
            renderComplaintsList();
        }
    });

    // -------------------------------------------------------------
    // Charts Integration
    // -------------------------------------------------------------
    function initCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;

        state.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Roads & Transport', 'Sanitation & Waste', 'Utilities & Power', 'Health & Safety', 'Public Amenities'],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: [
                        '#6366F1', // Indigo
                        '#14B8A6', // Teal
                        '#F59E0B', // Amber
                        '#EF4444', // Red
                        '#3B82F6'  // Blue
                    ],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.05)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94A3B8',
                            font: { family: 'Inter', size: 10 }
                        }
                    }
                }
            }
        });
    }

    function updateCategoryChart() {
        if (!state.categoryChart) return;

        const counts = {
            'Roads & Transport': 0,
            'Sanitation & Waste': 0,
            'Utilities & Power': 0,
            'Health & Safety': 0,
            'Public Amenities': 0
        };

        state.complaints.forEach(c => {
            if (counts[c.category] !== undefined) {
                counts[c.category]++;
            } else {
                counts['Public Amenities']++; // Catch-all fallback
            }
        });

        state.categoryChart.data.datasets[0].data = [
            counts['Roads & Transport'],
            counts['Sanitation & Waste'],
            counts['Utilities & Power'],
            counts['Health & Safety'],
            counts['Public Amenities']
        ];
        state.categoryChart.update();
    }

    function updateDashboardMetrics() {
        document.getElementById('count-total').textContent = state.complaints.length;
        
        const activeCount = state.complaints.filter(c => c.status !== 'Resolved').length;
        const resolvedCount = state.complaints.filter(c => c.status === 'Resolved').length;

        document.getElementById('count-active').textContent = activeCount;
        document.getElementById('count-resolved').textContent = resolvedCount;
    }

    // -------------------------------------------------------------
    // AI Typewriter Insight Summaries
    // -------------------------------------------------------------
    function startAITypewriterDiagnostic() {
        const textContainer = document.getElementById('ai-typewriter');
        if (!textContainer) return;

        const summaries = [
            "AI DIAGNOSTIC: Neighborhood analysis reports solid waste clearance in Indiranagar has improved. Roads around Central Metro continue to display High-severity potholes causing peak-hour bottlenecks.",
            "AI COMPULSION METRICS: Standard response time for streetlight blackouts resolved in Sector 4 is 3.2 days (SLA Target: 4 days). Actioning of Road issues remains lagging due to rainfall delays.",
            "AI REGIONAL TRENDS: 45% of active complaints represent Sanitation issues. Recommending additional waste containers at commercial boundaries to alleviate duplicate reporting."
        ];

        let index = 0;
        let charIndex = 0;
        let activeSummary = summaries[0];
        textContainer.textContent = '';

        const type = () => {
            if (charIndex < activeSummary.length) {
                textContainer.textContent += activeSummary.charAt(charIndex);
                charIndex++;
                setTimeout(type, 30);
            } else {
                // Pause and rotate to next summary
                setTimeout(() => {
                    index = (index + 1) % summaries.length;
                    activeSummary = summaries[index];
                    charIndex = 0;
                    textContainer.textContent = '';
                    type();
                }, 10000);
            }
        };

        type();
    }

    // -------------------------------------------------------------
    // Drag & Drop Grievance Vision Submission Flow
    // -------------------------------------------------------------
    function setupGrievanceSubmission() {
        const uploadZone = document.getElementById('upload-zone');
        const fileInput = document.getElementById('issue-image-input');
        const previewCont = uploadZone.querySelector('.preview-container');
        const imagePreview = document.getElementById('image-preview');
        const btnRemove = document.getElementById('btn-remove-photo');
        const dropzoneContent = uploadZone.querySelector('.dropzone-content');

        // Click trigger file explorer
        uploadZone.addEventListener('click', () => {
            // Check if preview is open. If so, don't trigger click again
            if (previewCont.classList.contains('hidden')) {
                fileInput.click();
            }
        });

        // Prevent browser opening drop files
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Highlight border on drag over
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadZone.addEventListener(eventName, () => {
                uploadZone.classList.add('highlight');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadZone.addEventListener(eventName, () => {
                uploadZone.classList.remove('highlight');
            }, false);
        });

        // Handle file drop
        uploadZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                processUploadedImage(files[0]);
            }
        });

        // Handle standard browse selection
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                processUploadedImage(e.target.files[0]);
            }
        });

        // Remove photo reset action
        btnRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.value = '';
            state.uploadBase64 = null;
            state.uploadMime = null;
            state.uploadFilename = "";
            previewCont.classList.add('hidden');
            dropzoneContent.classList.remove('hidden');
            
            // Reset AI vision diagnostics UI
            document.getElementById('vision-results-content').classList.add('hidden');
            document.getElementById('vision-empty-state').classList.remove('hidden');
        });

        // MOCK GPS trigger to autofill coordinates
        document.getElementById('btn-gps-mock').addEventListener('click', () => {
            // Random offset around Central Bangalore
            const lat = 12.9716 + (Math.random() - 0.5) * 0.05;
            const lng = 77.5946 + (Math.random() - 0.5) * 0.05;
            
            document.getElementById('grievance-lat').value = lat.toFixed(6);
            document.getElementById('grievance-lng').value = lng.toFixed(6);
            document.getElementById('grievance-location').value = "MG Road Area, Landmark " + Math.floor(Math.random() * 100 + 1);
            showToastMessage("GPS Mock coordinates injected!");
        });

        // Form submission trigger
        const grievanceForm = document.getElementById('grievance-form');
        grievanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!state.uploadBase64) {
                alert("Please upload a photo of the civic issue.");
                return;
            }

            const payload = {
                title: document.getElementById('grievance-title').value.trim(),
                category: document.getElementById('grievance-category').value,
                description: document.getElementById('grievance-description').value.trim(),
                location: document.getElementById('grievance-location').value.trim(),
                latitude: parseFloat(document.getElementById('grievance-lat').value),
                longitude: parseFloat(document.getElementById('grievance-lng').value),
                severity: document.getElementById('grievance-severity').value,
                submitted_by: document.getElementById('grievance-reporter').value,
                image_path: state.uploadBase64, // Inline base64 for simplicity
                ai_verification: {
                    verified: true,
                    category_detected: document.getElementById('grievance-category').value,
                    severity_score: document.getElementById('grievance-severity').value === 'High' ? 8 : 5,
                    confidence: 0.95,
                    draft_letter: document.getElementById('vision-letter').textContent || "Grievance drafted letter."
                }
            };

            try {
                const res = await fetch('/api/complaints', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.status === 201) {
                    showToastMessage("Complaint filed successfully. Added to tracking queue!");
                    grievanceForm.reset();
                    btnRemove.click(); // Reset upload dropzone
                    await fetchComplaints(); // Refresh data
                    switchTab('tab-tracker'); // Redirect to timeline
                } else {
                    alert("Failed to submit grievance.");
                }
            } catch (err) {
                console.error("Submission failed:", err);
            }
        });
    }

    // Process image file
    function processUploadedImage(file) {
        if (!file.type.match('image.*')) {
            alert('Please select an image file (PNG, JPG, WEBP).');
            return;
        }

        const reader = new FileReader();
        state.uploadFilename = file.name;
        state.uploadMime = file.type;

        reader.onload = (e) => {
            const base64Content = e.target.result;
            state.uploadBase64 = base64Content;

            // Render upload UI preview
            const previewCont = document.querySelector('#upload-zone .preview-container');
            const imagePreview = document.getElementById('image-preview');
            const dropzoneContent = document.querySelector('#upload-zone .dropzone-content');

            imagePreview.src = base64Content;
            previewCont.classList.remove('hidden');
            dropzoneContent.classList.add('hidden');

            // Trigger AI Vision Model API call
            triggerAIVisionAnalysis(base64Content);
        };

        reader.readAsDataURL(file);
    }

    // Call /api/report_vision to analyze image
    async function triggerAIVisionAnalysis(base64Data) {
        const loader = document.getElementById('vision-loader');
        const emptyState = document.getElementById('vision-empty-state');
        const resultsCont = document.getElementById('vision-results-content');

        loader.classList.remove('hidden');
        emptyState.classList.add('hidden');
        resultsCont.classList.add('hidden');

        try {
            const res = await fetch('/api/report_vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: base64Data,
                    filename: state.uploadFilename,
                    reporter_name: document.getElementById('grievance-reporter').value,
                    location: document.getElementById('grievance-location').value
                })
            });

            const result = await res.json();
            
            if (result.success && result.analysis) {
                const analysis = result.analysis;
                
                // Show AI results panel
                resultsCont.classList.remove('hidden');
                
                // Fill diagnostic metadata
                document.getElementById('vision-cat').textContent = analysis.category_detected || analysis.category;
                document.getElementById('vision-conf').textContent = `${Math.round((analysis.confidence || 0.95) * 100)}%`;
                
                const sevText = `${analysis.severity} (${analysis.severity_score || 5}/10)`;
                document.getElementById('vision-sev').textContent = sevText;
                document.getElementById('vision-letter').textContent = analysis.draft_letter;

                // Auto-fill core form fields to WOW the user
                document.getElementById('grievance-title').value = analysis.title || "Civic Issue detected by AI";
                document.getElementById('grievance-description').value = analysis.description || "";
                document.getElementById('grievance-category').value = analysis.category_detected || analysis.category || "Roads & Transport";
                document.getElementById('grievance-severity').value = analysis.severity || "Medium";

                showToastMessage("AI vision successfully auto-filled form details!");
            } else {
                emptyState.classList.remove('hidden');
            }
        } catch (err) {
            console.error("AI vision call failed:", err);
            emptyState.classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
        }
    }

    // Copy draft letter action
    document.getElementById('btn-copy-letter').addEventListener('click', () => {
        const text = document.getElementById('vision-letter').textContent;
        navigator.clipboard.writeText(text);
        showToastMessage("Letter text copied to clipboard!");
    });

    // -------------------------------------------------------------
    // Administrative Control Simulator Panel
    // -------------------------------------------------------------
    function setupAdminSimulator() {
        const form = document.getElementById('admin-update-form');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.selectedAdminComplaint) return;

            const compId = state.selectedAdminComplaint.id;
            const payload = {
                status: document.getElementById('admin-new-status').value,
                note: document.getElementById('admin-note').value.trim()
            };

            try {
                const res = await fetch(`/api/complaints/${compId}/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.status === 200) {
                    showToastMessage(`Status update committed for ${compId}!`);
                    document.getElementById('admin-note').value = '';
                    
                    // Re-sync data
                    await fetchComplaints();
                    
                    // Maintain selection in admin view
                    state.selectedAdminComplaint = state.complaints.find(c => c.id === compId);
                    renderAdminQueue();
                    renderAdminDetailPanel();
                }
            } catch (err) {
                console.error("Failed to commit status update:", err);
            }
        });
    }

    function renderAdminQueue() {
        const container = document.getElementById('admin-queue-list');
        container.innerHTML = '';

        // Show unresolved or all complaints in administrative view
        const targetQueue = state.complaints;

        if (targetQueue.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-secondary">Queue is empty.</div>';
            return;
        }

        targetQueue.forEach(comp => {
            const item = document.createElement('div');
            item.className = `admin-queue-item ${state.selectedAdminComplaint && state.selectedAdminComplaint.id === comp.id ? 'active' : ''}`;
            
            const dateObj = new Date(comp.submitted_at);
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

            item.innerHTML = `
                <div class="admin-queue-header">
                    <h4>${comp.id}: ${comp.title}</h4>
                    <span class="status-badge ${comp.status.toLowerCase().replace(' ', '-')}" style="font-size: 0.65rem;">${comp.status}</span>
                </div>
                <div class="admin-queue-details">
                    <span>${comp.category}</span>
                    <span>${dateStr}</span>
                </div>
            `;

            item.addEventListener('click', () => {
                state.selectedAdminComplaint = comp;
                renderAdminQueue();
                renderAdminDetailPanel();
            });

            container.appendChild(item);
        });

        // Maintain selection detail renders
        renderAdminDetailPanel();
    }

    function renderAdminDetailPanel() {
        const emptyState = document.getElementById('admin-empty-state');
        const actionsArea = document.getElementById('admin-actions-content');

        if (!state.selectedAdminComplaint) {
            emptyState.classList.remove('hidden');
            actionsArea.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        actionsArea.classList.remove('hidden');

        const comp = state.selectedAdminComplaint;

        document.getElementById('admin-ticket-id').textContent = comp.id;
        document.getElementById('admin-ticket-title').textContent = comp.title;
        document.getElementById('admin-ticket-loc').textContent = comp.location;

        // Auto-select dropdown with current status
        document.getElementById('admin-new-status').value = comp.status;
    }

    // -------------------------------------------------------------
    // Vani: Multilingual Floating Assistant
    // -------------------------------------------------------------
    function setupVaniChat() {
        const trigger = document.getElementById('vani-trigger');
        const widget = document.getElementById('vani-chat-widget');
        const input = document.getElementById('vani-input');
        const sendBtn = document.getElementById('btn-send-message');
        const chatBody = document.getElementById('vani-chat-body');
        const clearBtn = document.getElementById('btn-clear-chat');
        const listenBtn = document.getElementById('btn-speech-listen');
        const readBtn = document.getElementById('btn-speech-read');

        // Toggle chat drawer
        trigger.addEventListener('click', () => {
            widget.classList.toggle('open');
            widget.classList.toggle('closed');
            if (widget.classList.contains('open')) {
                input.focus();
                scrollChatToBottom();
            }
        });

        // Trigger typing enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendUserChatMessage();
        });

        sendBtn.addEventListener('click', sendUserChatMessage);

        // Suggestions click handlers
        const suggestBtns = document.querySelectorAll('.suggest-btn');
        suggestBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.getAttribute('data-query');
                openVaniWithQuery(query);
            });
        });

        // Clear chat
        clearBtn.addEventListener('click', () => {
            state.chatHistory = [];
            chatBody.innerHTML = '';
            showToastMessage("Chat history cleared!");
        });

        // ------------------ Speech Recognition (STT) ------------------
        let recognition = null;
        if ('webkitSpeechRecognition' in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            
            // Map Speech locale based on selected dropdown
            recognition.onstart = () => {
                listenBtn.classList.add('active');
                input.placeholder = "Listening...";
            };

            recognition.onend = () => {
                listenBtn.classList.remove('active');
                input.placeholder = "Type message...";
            };

            recognition.onresult = (event) => {
                const speechResult = event.results[0][0].transcript;
                input.value = speechResult;
                sendUserChatMessage();
            };

            listenBtn.addEventListener('click', () => {
                const mapLocales = {
                    'English': 'en-IN',
                    'Hindi': 'hi-IN',
                    'Kannada': 'kn-IN',
                    'Tamil': 'ta-IN',
                    'Telugu': 'te-IN',
                    'Bengali': 'bn-IN',
                    'Marathi': 'mr-IN'
                };
                recognition.lang = mapLocales[state.language] || 'en-IN';
                recognition.start();
            });
        } else {
            listenBtn.style.display = 'none'; // Hide if speech not supported
        }

        // ------------------ Text-to-Speech Toggle (TTS) ------------------
        let speechSynthActive = false;
        readBtn.addEventListener('click', () => {
            speechSynthActive = !speechSynthActive;
            if (speechSynthActive) {
                readBtn.classList.add('active');
                showToastMessage("Text-to-Speech active. Vani will read responses aloud.");
                // Speak last bot message if present
                const lastBotMsg = state.chatHistory.filter(h => h.sender === 'bot').pop();
                if (lastBotMsg) speakResponseText(lastBotMsg.text);
            } else {
                readBtn.classList.remove('active');
                window.speechSynthesis.cancel();
            }
        });

        // Internal: Speech execution
        function speakResponseText(text) {
            if (!speechSynthActive) return;
            window.speechSynthesis.cancel(); // Stop current speech
            
            // Strip markdown asterisks and bullet points
            const cleanText = text.replace(/[*#`\-]/g, '');

            const utterance = new SpeechSynthesisUtterance(cleanText);
            
            const mapLocales = {
                'English': 'en-IN',
                'Hindi': 'hi-IN',
                'Kannada': 'kn-IN',
                'Tamil': 'ta-IN',
                'Telugu': 'te-IN',
                'Bengali': 'bn-IN',
                'Marathi': 'mr-IN'
            };
            utterance.lang = mapLocales[state.language] || 'en-IN';
            
            // Try to find localized system voices
            const voices = window.speechSynthesis.getVoices();
            const targetLang = mapLocales[state.language];
            const matchingVoice = voices.find(voice => voice.lang.startsWith(targetLang));
            if (matchingVoice) utterance.voice = matchingVoice;

            window.speechSynthesis.speak(utterance);
        }

        // Core Send function
        async function sendUserChatMessage() {
            const query = input.value.trim();
            if (!query) return;

            // Clear field
            input.value = '';

            // Render User Bubble
            renderChatBubble('user', query);
            state.chatHistory.push({ sender: 'user', text: query });

            // Show Typing loader
            const typingBubble = renderChatTyping();
            scrollChatToBottom();

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: query,
                        history: state.chatHistory,
                        language: state.language
                    })
                });

                const data = await res.json();
                
                // Remove Typing bubble
                typingBubble.remove();

                if (data.reply) {
                    renderChatBubble('bot', data.reply);
                    state.chatHistory.push({ sender: 'bot', text: data.reply });
                    speakResponseText(data.reply);
                } else {
                    renderChatBubble('bot', "Apologies, I encountered an error answering your question. Please try again.");
                }
            } catch (err) {
                console.error("Chat error:", err);
                typingBubble.remove();
                renderChatBubble('bot', "Server communication failed. Please check backend is running.");
            } finally {
                scrollChatToBottom();
            }
        }

        // DOM builders for chat
        function renderChatBubble(sender, text) {
            const wrapper = document.createElement('div');
            wrapper.className = `chat-msg ${sender}`;
            
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            // Convert simple markdown links/bold to HTML tags
            let htmlText = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');

            wrapper.innerHTML = `
                <div class="msg-bubble">${htmlText}</div>
                <span class="msg-time">${timeStr}</span>
            `;
            chatBody.appendChild(wrapper);
        }

        function renderChatTyping() {
            const wrapper = document.createElement('div');
            wrapper.className = 'chat-msg bot typing-wrapper';
            wrapper.innerHTML = `
                <div class="msg-bubble flex-center">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            `;
            chatBody.appendChild(wrapper);
            return wrapper;
        }

        function scrollChatToBottom() {
            chatBody.scrollTop = chatBody.scrollHeight;
        }

        function updateVaniWelcoming() {
            const greetings = {
                'English': 'Namaste! I am Vani, your SevaSetu AI Companion. How can I help you today? You can ask me about local welfare schemes or how to report civic issues.',
                'Hindi': 'नमस्ते! मैं वाणी हूँ, आपकी सेवासेतु नागरिक सहायक। आज मैं आपकी क्या सहायता कर सकती हूँ? आप मुझसे सरकारी योजनाओं या नागरिक शिकायतों के बारे में पूछ सकते हैं।',
                'Kannada': 'ನಮಸ್ತೆ! ನಾನು ವಾಣಿ, ನಿಮ್ಮ ಸೇವಾಸೇತು AI ಸಹಚರಿ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ? ಕಲ್ಯಾಣ ಯೋಜನೆಗಳು ಅಥವಾ ನಾಗರಿಕ ಸಮಸ್ಯೆಗಳನ್ನು ವರದಿ ಮಾಡುವ ಬಗ್ಗೆ ನೀವು ನನ್ನನ್ನು ಕೇಳಬಹುದು.',
                'Tamil': 'வணக்கம்! நான் வாணி, உங்கள் சேவாசேது AI துணையாள். இன்று உங்களுக்கு நான் எவ்வாறு உதவ முடியும்? சமூக நலத் திட்டங்கள் அல்லது குடிமைப் பிரச்சினைகள் பற்றி நீங்கள் என்னிடம் கேட்கலாம்.',
                'Telugu': 'నమస్తే! నేను వాణి, మీ సేవాసేతు AI భాగస్వామిని. ఈ రోజు మీకు నేను ఎలా సహాయపడగలను? సంక్షేమ పథకాలు లేదా పౌర సమస్యలను నివేదించడం గురించి నన్ను అడగవచ్చు.',
                'Bengali': 'নমস্কার! আমি বাণী, আপনার সেবাসেতু AI সহকারী। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি? আপনি আমাকে সরকারি কল্যাণমূলক প্রকল্প বা নাগরিক সমস্যা রিপোর্টের বিষয়ে জিজ্ঞাসা করতে পারেন।',
                'Marathi': 'नमस्ते! मी वाणी, आपली सेवासेतू AI सहचारी. आज मी आपली काय मदत करू शकते? आपण मला सरकारी कल्याणकारी योजनांबद्दल किंवा नागरी तक्रारी कशा नोंदवायच्या याबद्दल विचारू शकता।'
            };
            const welcomeMsg = greetings[state.language] || greetings['English'];
            chatBody.innerHTML = '';
            renderChatBubble('bot', welcomeMsg);
            state.chatHistory = [{ sender: 'bot', text: welcomeMsg }];
            speakResponseText(welcomeMsg);
        }

        // Global opener function
        window.openVaniWithQuery = function(query) {
            const widget = document.getElementById('vani-chat-widget');
            if (widget.classList.contains('closed')) {
                trigger.click();
            }
            input.value = query;
            sendUserChatMessage();
        };
    }

    // -------------------------------------------------------------
    // Helper Toast Notification
    // -------------------------------------------------------------
    function showToastMessage(msg) {
        // Remove existing toast if visible
        const oldToast = document.querySelector('.toast-banner');
        if (oldToast) oldToast.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-banner animate-pulse-glow';
        toast.style.cssText = `
            position: fixed;
            bottom: 40px;
            left: 40px;
            background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
            border: 1px solid var(--color-primary);
            color: var(--text-primary);
            padding: 12px 20px;
            border-radius: var(--border-radius-md);
            font-size: 0.85rem;
            font-weight: 500;
            z-index: 999;
            box-shadow: var(--shadow-lg);
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        toast.innerHTML = `<i data-lucide="bell" style="color: var(--color-secondary); width: 18px; height: 18px;"></i> <span>${msg}</span>`;
        document.body.appendChild(toast);
        lucide.createIcons();

        // Fade out
        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s ease';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
});
