// API base URL
const API_URL = '/api/competitors';

// State
let competitors = [];
let currentCompetitorId = null;

// DOM Elements
const modal = document.getElementById('competitorModal');
const viewModal = document.getElementById('viewModal');
const addBtn = document.getElementById('addCompetitorBtn');
const closeBtn = document.querySelector('.close');
const closeViewBtn = document.querySelector('.close-view');
const closeViewBtnSecondary = document.querySelector('.close-view-btn');
const cancelBtn = document.getElementById('cancelBtn');
const form = document.getElementById('competitorForm');
const searchInput = document.getElementById('searchInput');
const competitorsList = document.getElementById('competitorsList');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCompetitors();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    addBtn.addEventListener('click', () => openModal());
    closeBtn.addEventListener('click', () => closeModal());
    closeViewBtn.addEventListener('click', () => closeViewModal());
    closeViewBtnSecondary.addEventListener('click', () => closeViewModal());
    cancelBtn.addEventListener('click', () => closeModal());
    form.addEventListener('submit', handleFormSubmit);
    searchInput.addEventListener('input', handleSearch);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
        if (e.target === viewModal) closeViewModal();
    });
}

// API Functions
async function loadCompetitors() {
    try {
        const response = await fetch(API_URL);
        competitors = await response.json();
        renderCompetitors(competitors);
    } catch (error) {
        console.error('Error loading competitors:', error);
        alert('Failed to load competitors');
    }
}

async function createCompetitor(data) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Error creating competitor:', error);
        throw error;
    }
}

async function updateCompetitor(id, data) {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating competitor:', error);
        throw error;
    }
}

async function deleteCompetitor(id) {
    try {
        await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('Error deleting competitor:', error);
        throw error;
    }
}

// UI Functions
function renderCompetitors(competitorsToRender) {
    if (competitorsToRender.length === 0) {
        competitorsList.innerHTML = `
            <div class="empty-state">
                <h3>No competitors found</h3>
                <p>Start tracking your competitors by clicking the "Add Competitor" button</p>
            </div>
        `;
        return;
    }

    competitorsList.innerHTML = competitorsToRender.map(competitor => `
        <div class="competitor-card" onclick="viewCompetitor(${competitor.id})">
            <h3>${escapeHtml(competitor.name)}</h3>
            ${competitor.website ? `<a href="${escapeHtml(competitor.website)}" class="website" onclick="event.stopPropagation()" target="_blank">${escapeHtml(competitor.website)}</a>` : ''}
            ${competitor.industry ? `<div class="industry">${escapeHtml(competitor.industry)}</div>` : ''}
            ${competitor.description ? `<p class="description">${escapeHtml(competitor.description)}</p>` : ''}
            <div class="meta">
                ${competitor.pricing ? `<span class="pricing">${escapeHtml(competitor.pricing)}</span>` : '<span></span>'}
                <span class="last-updated">Updated ${formatDate(competitor.lastUpdated)}</span>
            </div>
            <div class="card-actions">
                <button class="btn btn-edit" onclick="event.stopPropagation(); editCompetitor(${competitor.id})">Edit</button>
                <button class="btn btn-danger" onclick="event.stopPropagation(); handleDelete(${competitor.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function viewCompetitor(id) {
    const competitor = competitors.find(c => c.id === id);
    if (!competitor) return;

    const viewModalTitle = document.getElementById('viewModalTitle');
    const viewModalBody = document.getElementById('viewModalBody');

    viewModalTitle.textContent = competitor.name;
    
    viewModalBody.innerHTML = `
        ${competitor.website ? `
            <div class="detail-section">
                <h3>Website</h3>
                <p><a href="${escapeHtml(competitor.website)}" target="_blank">${escapeHtml(competitor.website)}</a></p>
            </div>
        ` : ''}
        
        ${competitor.industry ? `
            <div class="detail-section">
                <h3>Industry</h3>
                <p>${escapeHtml(competitor.industry)}</p>
            </div>
        ` : ''}
        
        ${competitor.description ? `
            <div class="detail-section">
                <h3>Description</h3>
                <p>${escapeHtml(competitor.description)}</p>
            </div>
        ` : ''}
        
        ${competitor.pricing ? `
            <div class="detail-section">
                <h3>Pricing Model</h3>
                <p>${escapeHtml(competitor.pricing)}</p>
            </div>
        ` : ''}
        
        ${competitor.keyFeatures && competitor.keyFeatures.length > 0 ? `
            <div class="detail-section">
                <h3>Key Features</h3>
                <ul>
                    ${competitor.keyFeatures.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
        
        ${competitor.strengths && competitor.strengths.length > 0 ? `
            <div class="detail-section">
                <h3>Strengths</h3>
                <ul>
                    ${competitor.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
        
        ${competitor.weaknesses && competitor.weaknesses.length > 0 ? `
            <div class="detail-section">
                <h3>Weaknesses</h3>
                <ul>
                    ${competitor.weaknesses.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
        
        <div class="detail-section">
            <h3>Last Updated</h3>
            <p>${formatDate(competitor.lastUpdated)}</p>
        </div>
    `;
    
    viewModal.style.display = 'block';
}

function openModal(competitor = null) {
    currentCompetitorId = competitor ? competitor.id : null;
    const modalTitle = document.getElementById('modalTitle');
    
    if (competitor) {
        modalTitle.textContent = 'Edit Competitor';
        document.getElementById('competitorId').value = competitor.id;
        document.getElementById('name').value = competitor.name;
        document.getElementById('website').value = competitor.website || '';
        document.getElementById('industry').value = competitor.industry || '';
        document.getElementById('description').value = competitor.description || '';
        document.getElementById('pricing').value = competitor.pricing || '';
        document.getElementById('keyFeatures').value = competitor.keyFeatures ? competitor.keyFeatures.join(', ') : '';
        document.getElementById('strengths').value = competitor.strengths ? competitor.strengths.join(', ') : '';
        document.getElementById('weaknesses').value = competitor.weaknesses ? competitor.weaknesses.join(', ') : '';
    } else {
        modalTitle.textContent = 'Add Competitor';
        form.reset();
    }
    
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
    form.reset();
    currentCompetitorId = null;
}

function closeViewModal() {
    viewModal.style.display = 'none';
}

function editCompetitor(id) {
    const competitor = competitors.find(c => c.id === id);
    if (competitor) {
        openModal(competitor);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('name').value,
        website: document.getElementById('website').value,
        industry: document.getElementById('industry').value,
        description: document.getElementById('description').value,
        pricing: document.getElementById('pricing').value,
        keyFeatures: parseCommaSeparated(document.getElementById('keyFeatures').value),
        strengths: parseCommaSeparated(document.getElementById('strengths').value),
        weaknesses: parseCommaSeparated(document.getElementById('weaknesses').value)
    };
    
    try {
        if (currentCompetitorId) {
            await updateCompetitor(currentCompetitorId, formData);
        } else {
            await createCompetitor(formData);
        }
        
        await loadCompetitors();
        closeModal();
    } catch (error) {
        alert('Failed to save competitor');
    }
}

async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this competitor?')) {
        return;
    }
    
    try {
        await deleteCompetitor(id);
        await loadCompetitors();
    } catch (error) {
        alert('Failed to delete competitor');
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    
    if (!query) {
        renderCompetitors(competitors);
        return;
    }
    
    const filtered = competitors.filter(c => {
        return (
            c.name.toLowerCase().includes(query) ||
            (c.description && c.description.toLowerCase().includes(query)) ||
            (c.industry && c.industry.toLowerCase().includes(query)) ||
            (c.website && c.website.toLowerCase().includes(query))
        );
    });
    
    renderCompetitors(filtered);
}

// Utility Functions
function parseCommaSeparated(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(s => s);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
}
