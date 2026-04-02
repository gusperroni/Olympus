const contentDiv = document.getElementById('content');
const refreshBtn = document.getElementById('refresh-btn');
const lastUpdated = document.getElementById('last-updated');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const subSidebar = document.getElementById('sub-sidebar');
const mainContainer = document.getElementById('main-container');
const chatInputFooter = document.getElementById('chat-input-footer');

let activeSessionId = "sess_dash";

const activeNavClasses = ['border-l-2', 'border-[#58a6ff]', 'text-[#a2c9ff]', 'bg-[#10141a]'];
const inactiveNavClasses = ['text-[#94a3b8]'];

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const now = new Date();
        lastUpdated.textContent = `Updated ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        return data;
    } catch (err) {
        contentDiv.innerHTML = `<div class="bg-error-container text-on-error-container p-4 rounded-xl">Error: ${err.message}</div>`;
        return null;
    }
}

const routes = {
    '#/': renderOverview,
    '#/chat': renderChat,
    '#/config': renderConfig,
    '#/environment': renderEnv,
    '#/sessions': renderSessions,
    '#/memory': renderMemory,
    '#/soul': renderSoul,
    '#/skills': renderSkills,
    '#/cron': renderCron
};

async function router() {
    let hash = window.location.hash || '#/';
    if (!routes[hash]) hash = '#/';
    
    // Update active nav state
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === hash) {
            link.classList.add(...activeNavClasses);
            link.classList.remove(...inactiveNavClasses);
            const icon = link.querySelector('.material-symbols-outlined');
            if(icon) icon.style.fontVariationSettings = "'FILL' 1";
        } else {
            link.classList.remove(...activeNavClasses);
            link.classList.add(...inactiveNavClasses);
            const icon = link.querySelector('.material-symbols-outlined');
            if(icon) icon.style.fontVariationSettings = "'FILL' 0";
        }
    });

    // Toggle Chat layout overrides
    if (hash === '#/chat') {
        subSidebar.classList.remove('hidden');
        mainContainer.classList.remove('ml-[240px]');
        mainContainer.classList.add('ml-[540px]');
        chatInputFooter.classList.remove('hidden');
        contentDiv.className = 'flex-1 overflow-y-auto px-10 py-8 space-y-10';
        contentDiv.innerHTML = ''; // cleared for chat
    } else {
        subSidebar.classList.add('hidden');
        mainContainer.classList.remove('ml-[540px]');
        mainContainer.classList.add('ml-[240px]');
        chatInputFooter.classList.add('hidden');
        contentDiv.className = 'flex-1 overflow-y-auto px-10 py-8 space-y-6 max-w-7xl';
        contentDiv.innerHTML = '<div class="text-outline">Loading...</div>';
    }

    await routes[hash]();
}

// ----------------------------------------------------
// Views
// ----------------------------------------------------

async function renderOverview() {
    pageTitle.textContent = "Overview";
    pageSubtitle.textContent = "System Status";
    const status = await fetchAPI('/api/status');
    if (!status) return;
    
    contentDiv.innerHTML = `
        <div class="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20">
            <h3 class="text-primary font-bold mb-4">Instance Configuration</h3>
            <p class="text-sm text-outline mb-4">Workspace Path: <code class="bg-surface-container px-2 py-1 rounded font-mono">${status.hermes_home}</code></p>
            <pre class="bg-surface-container-lowest p-4 rounded-lg font-mono text-sm text-on-surface-variant overflow-x-auto">${JSON.stringify(status.files, null, 2)}</pre>
        </div>
    `;
}

async function renderConfig() {
    pageTitle.textContent = "Configuration";
    pageSubtitle.textContent = "Settings Editor";
    const data = await fetchAPI('/api/config');
    if (!data) return;
    let html = '';
    for (const [section, values] of Object.entries(data)) {
        html += `<div class="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20">
            <h3 class="text-lg font-semibold text-on-surface mb-6 capitalize">${section}</h3>
            <div class="space-y-4">
        `;
        for (const [key, val] of Object.entries(values || {})) {
            let strVal = typeof val === 'object' ? JSON.stringify(val) : String(val || '');
            strVal = strVal.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            html += `
            <div class="flex items-center gap-4 group">
                <label class="w-48 text-sm font-label text-on-surface-variant">${key}</label>
                <div class="flex-1 relative">
                    <input type="text" id="cfg_${section}_${key}" value="${strVal}" 
                        class="w-full bg-surface-container-lowest border-b-2 border-outline-variant/20 focus:border-primary px-3 py-2 text-sm font-mono transition-all outline-none text-on-surface" />
                </div>
                <button onclick="saveCfg('${section}', '${key}')" class="px-4 py-2 bg-transparent text-outline hover:bg-surface-container-highest hover:text-on-surface rounded-md text-sm transition-colors border border-outline-variant/30">
                    Save
                </button>
            </div>`;
        }
        html += `</div></div>`;
    }
    contentDiv.innerHTML = html;
}

window.saveCfg = async (section, key) => {
    const el = document.getElementById(`cfg_${section}_${key}`);
    const res = await fetch('/api/config', {
        method: 'PUT', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({section, key, value: el.value})
    });
    if (res.ok) alert('Saved Configuration!');
    else alert('Error Saving Configuration!');
};

async function renderEnv() {
    pageTitle.textContent = "Environment Variables";
    pageSubtitle.textContent = ".env Editor";
    const data = await fetchAPI('/api/env');
    if (!data || !data.variables) return;
    
    let html = `
    <div class="bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden">
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="border-b border-outline-variant/20 bg-surface-container-highest/50">
                    <th class="px-6 py-4 font-label uppercase tracking-widest text-xs text-outline">Key</th>
                    <th class="px-6 py-4 font-label uppercase tracking-widest text-xs text-outline">Value</th>
                    <th class="px-6 py-4 font-label uppercase tracking-widest text-xs text-outline w-24">Status</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (const v of data.variables) {
        html += `
            <tr class="border-b border-outline-variant/10 hover:bg-surface-container transition-colors">
                <td class="px-6 py-4 font-mono text-sm text-primary">${v.key}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <input type="text" id="env_${v.key}" placeholder="${v.value}" 
                            class="flex-1 max-w-md bg-surface-container-lowest border-b-2 border-outline-variant/20 focus:border-primary px-3 py-1.5 text-sm font-mono outline-none text-on-surface placeholder:text-outline-variant" />
                        <button onclick="saveEnv('${v.key}')" class="px-3 py-1.5 bg-transparent text-primary hover:bg-primary/10 rounded border border-primary/30 text-xs transition-colors">Update</button>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-widest ${v.is_set ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-outline-variant/10 text-outline border border-outline-variant/20'}">
                        <span class="w-1.5 h-1.5 rounded-full ${v.is_set ? 'bg-primary shadow-[0_0_4px_#a2c9ff]' : 'bg-outline'}"></span>
                        ${v.is_set ? 'Set' : 'Unset'}
                    </span>
                </td>
            </tr>`;
    }
    html += '</tbody></table></div>';
    contentDiv.innerHTML = html;
}

window.saveEnv = async (key) => {
    const el = document.getElementById(`env_${key}`);
    if (!el.value) {
        alert("Enter a value first.");
        return;
    }
    const res = await fetch('/api/env', {
        method: 'PUT', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({key, value: el.value})
    });
    if (res.ok) {
        el.value = ''; 
        await renderEnv(); 
    } else {
        alert('Error Saving Environment Variable!');
    }
};

// ----------------------------------------------------
// Chat & Sessions 
// ----------------------------------------------------

window.createNewSession = () => {
    activeSessionId = "sess_" + Math.random().toString(36).substr(2, 6);
    pageTitle.textContent = "New Session";
    pageSubtitle.textContent = activeSessionId;
    contentDiv.innerHTML = `<div class="flex justify-center h-full items-center"><p class="text-outline font-mono text-sm">Start typing to begin a new session.</p></div>`;
};

async function populateSessionSidebar() {
    const sessionList = document.getElementById('session-list');
    const sessionData = await fetchAPI('/api/sessions?limit=20');
    if (!sessionData || !sessionData.sessions || sessionData.sessions.length === 0) {
        sessionList.innerHTML = `<div class="p-3 text-outline text-xs">No sessions found.</div>`;
        return;
    }

    let html = `<div class="px-3 mb-2"><h3 class="font-label uppercase tracking-[0.1em] text-[10px] text-outline">Recent Sessions</h3></div>`;
    sessionData.sessions.forEach(s => {
        const isActive = s.id === activeSessionId;
        const ms = new Date(s.started_at * 1000).toLocaleString();
        
        if (isActive) {
            html += `
            <button class="w-full text-left p-3 rounded-lg bg-surface-container-high relative group">
                <div class="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-primary"></div>
                <div class="text-sm font-medium text-on-surface truncate">${s.title || s.id}</div>
                <div class="text-[10px] font-mono text-outline mt-1">${ms} • ${s.message_count} msgs</div>
            </button>`;
        } else {
            html += `
            <button onclick="switchSession('${s.id}')" class="w-full text-left p-3 rounded-lg hover:bg-surface-container transition-colors group">
                <div class="text-sm font-medium text-on-surface-variant group-hover:text-on-surface truncate">${s.title || s.id}</div>
                <div class="text-[10px] font-mono text-outline/60 mt-1">${ms} • ${s.message_count} msgs</div>
            </button>`;
        }
    });

    sessionList.innerHTML = html;
}

window.switchSession = async (id) => {
    activeSessionId = id;
    await renderChat();
};

let chatPollingInterval = null;
let pendingUserMessage = null;

async function renderChat() {
    pageTitle.textContent = activeSessionId === 'sess_dash' ? "Chat" : `Session: ${activeSessionId}`;
    pageSubtitle.textContent = "Live Stream";
    
    if (activeSessionId === "sess_dash") {
        const sessionData = await fetchAPI('/api/sessions?limit=1');
        if (sessionData && sessionData.sessions.length > 0) activeSessionId = sessionData.sessions[0].id;
    }

    await populateSessionSidebar();

    const loadHistory = async () => {
        if(window.location.hash !== '#/chat') return; // abort if navigated away
        const res = await fetch(`/api/sessions/${activeSessionId}/messages`);
        if (res.ok) {
            const data = await res.json();
            
            // Check if DB caught up to pending message
            if (pendingUserMessage && data.messages.length > 0) {
                const latestUserMsg = [...data.messages].reverse().find(m => m.role === 'user');
                if (latestUserMsg && latestUserMsg.content.trim() === pendingUserMessage.content.trim()) {
                    pendingUserMessage = null; // DB caught up
                } else if (Date.now() - pendingUserMessage.sentAt > 180000) {
                    // Timeout pending message if backend failed completely (3 minutes for long LLM generations/tools)
                    pendingUserMessage.failed = true;
                }
            }

            let html = '';
            
            // Insert Database Messages First
            if (data.messages.length > 0) {
                data.messages.forEach(m => {
                    const parsedMarkdown = marked.parse(m.content || '');
                    if (m.role === 'user') {
                        html += `
                        <div class="flex flex-row-reverse gap-6 max-w-5xl ml-auto">
                            <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                <span class="material-symbols-outlined text-primary text-xl" data-icon="person" style="font-variation-settings: 'FILL' 1;">person</span>
                            </div>
                            <div class="flex-1 border-l-2 border-primary/40 pl-6 bg-surface-container-high p-4 rounded-xl shadow-sm">
                                <div class="text-sm leading-relaxed text-on-surface prose prose-invert prose-p:my-1 prose-pre:bg-surface-container-lowest prose-pre:border prose-pre:border-outline-variant/20 prose-a:text-primary max-w-none">
                                    ${parsedMarkdown}
                                </div>
                            </div>
                        </div>`;
                    } else {
                        html += `
                        <div class="flex gap-6 max-w-5xl">
                            <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center border border-outline-variant/30">
                                <span class="material-symbols-outlined text-primary text-xl" data-icon="smart_toy">smart_toy</span>
                            </div>
                            <div class="flex-1 space-y-4 border-l-2 border-tertiary/40 pl-6">
                                <div class="text-sm leading-relaxed text-on-surface-variant prose prose-invert prose-p:my-1 prose-pre:bg-surface-container-lowest prose-pre:border prose-pre:border-outline-variant/20 prose-pre:p-4 prose-a:text-primary max-w-none">
                                    ${parsedMarkdown}
                                </div>
                            </div>
                        </div>`;
                    }
                });
            } else {
                html += `<div class="flex justify-center h-full items-center"><p class="text-outline font-mono text-sm">No messages yet.</p></div>`;
            }
            
            // Append Pending Message if still pending
            if (pendingUserMessage && !pendingUserMessage.failed) {
                html += `
                <div class="flex flex-row-reverse gap-6 max-w-5xl ml-auto opacity-70">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                        <span class="material-symbols-outlined text-primary text-xl" data-icon="person" style="font-variation-settings: 'FILL' 1;">person</span>
                    </div>
                    <div class="flex-1 border-l-2 border-primary/40 pl-6 bg-surface-container-high p-4 rounded-xl">
                        <p class="text-[10px] text-outline mb-1 uppercase tracking-widest font-mono">Sending...</p>
                        <p class="text-sm leading-relaxed text-on-surface whitespace-pre-wrap">${pendingUserMessage.content}</p>
                    </div>
                </div>`;
            } else if (pendingUserMessage && pendingUserMessage.failed) {
                html += `
                <div class="flex flex-row-reverse gap-6 max-w-5xl ml-auto opacity-90">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-error-container/20 flex items-center justify-center border border-error/50">
                        <span class="material-symbols-outlined text-error text-xl" data-icon="warning">warning</span>
                    </div>
                    <div class="flex-1 border-l-2 border-error/40 pl-6 bg-surface-container-high p-4 rounded-xl">
                        <p class="text-[10px] text-error mb-1 uppercase tracking-widest font-mono">Delivery Failed - Network Error</p>
                        <p class="text-sm leading-relaxed text-error/80 whitespace-pre-wrap">${pendingUserMessage.content}</p>
                    </div>
                </div>`;
            }
            
            // Only update DOM if HTML is changing to prevent thrashing
            if (contentDiv.innerHTML !== html) {
                contentDiv.innerHTML = html;
                contentDiv.scrollTop = contentDiv.scrollHeight;
            }
        }
    };

    await loadHistory();
    
    // Polling setup specifically for active chat
    if(chatPollingInterval) clearInterval(chatPollingInterval);
    chatPollingInterval = setInterval(loadHistory, 3000);

    // Setup send handler once
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    
    // Remove old listeners by cloning
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    // Auto-resize logic
    input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });

    // Add enter key support
    input.onkeydown = (e) => {
        if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); newSendBtn.click(); }
    };
    
    newSendBtn.addEventListener('click', async () => {
        const msg = input.value;
        if (!msg.trim()) return;
        
        pendingUserMessage = { content: msg, sentAt: Date.now(), failed: false };
        input.value = '';
        input.style.height = 'auto'; // Reset height after send
        
        loadHistory(); // instant visual update
        
        await fetch('/api/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({session_id: activeSessionId, content: msg, role: 'user'})
        });
        
        populateSessionSidebar();
    });
}

// Ensure polling clears when navigating away
const oldRouter = router;
router = async () => {
    if(window.location.hash !== '#/chat' && chatPollingInterval) {
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
    }
    await oldRouter();
};

// ----------------------------------------------------
// Data Views
// ----------------------------------------------------

async function renderMemory() {
    pageTitle.textContent = "Active Memory";
    pageSubtitle.textContent = "Observability";
    const data = await fetchAPI('/api/memory');
    if (!data) return;
    contentDiv.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20">
                <div class="flex items-center justify-between mb-4 border-b border-outline-variant/10 pb-4">
                    <h3 class="text-primary font-bold">MEMORY.md</h3>
                    <span class="px-2 py-1 bg-surface-container rounded text-xs font-mono text-outline">${data.memory.char_count} bytes</span>
                </div>
                <div class="prose prose-invert prose-sm text-on-surface-variant max-w-none">
                    ${marked.parse(data.memory.content)}
                </div>
            </div>
            <div class="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20">
                <div class="flex items-center justify-between mb-4 border-b border-outline-variant/10 pb-4">
                    <h3 class="text-primary font-bold">USER.md</h3>
                    <span class="px-2 py-1 bg-surface-container rounded text-xs font-mono text-outline">${data.user_profile.char_count} bytes</span>
                </div>
                <div class="prose prose-invert prose-sm text-on-surface-variant max-w-none">
                    ${marked.parse(data.user_profile.content || '*No profile content*')}
                </div>
            </div>
        </div>
    `;
}

async function renderSoul() {
    pageTitle.textContent = "Agent Persona";
    pageSubtitle.textContent = "SOUL System Prompt";
    const data = await fetchAPI('/api/soul');
    if (!data) return;
    contentDiv.innerHTML = `
        <div class="bg-surface-container-low p-8 rounded-xl border border-outline-variant/20">
            <div class="prose prose-invert text-on-surface-variant prose-headings:text-primary max-w-none">
                ${marked.parse(data.content)}
            </div>
        </div>
    `;
}

async function renderSessions() {
    pageTitle.textContent = "Session Databank";
    pageSubtitle.textContent = "Historical Analytics";
    const data = await fetchAPI('/api/sessions');
    if (!data) return;
    let html = `
    <div class="bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden">
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="bg-surface-container-highest/50 border-b border-outline-variant/20">
                    <th class="px-6 py-4 font-label uppercase tracking-widest text-xs text-outline">Session ID</th>
                    <th class="px-6 py-4 font-label uppercase tracking-widest text-xs text-outline">Platform</th>
                    <th class="px-6 py-4 font-label uppercase tracking-widest text-xs text-outline">Initiated</th>
                    <th class="px-6 py-4 font-label uppercase tracking-widest text-xs text-outline">Telemetry</th>
                </tr>
            </thead>
            <tbody>
    `;
    for (const v of data.sessions) {
         const ms = new Date(v.started_at * 1000).toLocaleString();
         html += `
         <tr class="border-b border-outline-variant/10 hover:bg-surface-container transition-colors">
            <td class="px-6 py-4 font-mono text-xs text-primary">${v.id}</td>
            <td class="px-6 py-4 text-sm"><span class="bg-surface-container-highest px-2 py-1 rounded-md border border-outline-variant/20 mr-2">${v.platform}</span>${v.model || 'auto'}</td>
            <td class="px-6 py-4 font-mono text-xs text-outline">${ms}</td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-mono">
                    ${v.message_count} cycles
                </span>
            </td>
         </tr>`;
    }
    html += '</tbody></table></div>';
    contentDiv.innerHTML = html;
}

async function renderSkills() {
    pageTitle.textContent = "Capability Matrix";
    pageSubtitle.textContent = "Installed Skills";
    const data = await fetchAPI('/api/skills');
    if (!data) return;
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
    for (const v of data.skills) {
         html += `
         <div class="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20 hover:border-primary/50 transition-colors group cursor-default">
            <div class="flex items-center justify-between mb-4">
                <span class="px-2 py-1 text-[10px] font-mono uppercase tracking-widest bg-surface-container-highest rounded border border-outline-variant/30 text-outline">${v.category}</span>
                <span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-xl" data-icon="extension">extension</span>
            </div>
            <h3 class="text-base font-semibold text-on-surface mb-2">${v.name}</h3>
            <p class="text-sm text-outline font-body leading-relaxed line-clamp-3">${v.description}</p>
         </div>`;
    }
    html += '</div>';
    contentDiv.innerHTML = html;
}

async function renderCron() {
    pageTitle.textContent = "Autonomous Directives";
    pageSubtitle.textContent = "Cron Daemon Map";
    const data = await fetchAPI('/api/cron');
    if (!data) return;
    contentDiv.innerHTML = `
    <div class="bg-surface-container-low p-6 rounded-xl border border-outline-variant/20">
        <pre class="font-mono text-sm text-tertiary whitespace-pre-wrap">${JSON.stringify(data.jobs, null, 2)}</pre>
    </div>`;
}

window.addEventListener('hashchange', router);
refreshBtn.addEventListener('click', router);

// Global Status Polling
async function pollGlobalStatus() {
    const dot = document.getElementById('agent-status-dot');
    const label = dot?.nextElementSibling;
    const versionSpan = document.getElementById('hermes-version');
    
    if(!dot || !label) return;
    try {
        const res = await fetch('/api/status');
        if (res.ok) {
            const data = await res.json();
            dot.className = 'w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] transition-all';
            if (versionSpan && data.hermes_version) {
                versionSpan.textContent = data.hermes_version;
            }
        } else {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-error shadow-[0_0_8px_#ffb4ab] transition-all';
        }
    } catch {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-error shadow-[0_0_8px_#ffb4ab] transition-all';
        label.textContent = 'Offline';
    }
}
setInterval(pollGlobalStatus, 10000);
pollGlobalStatus();

// Boot
router();
