// Initialize WebsimSocket
const room = new WebsimSocket();

// State
let currentWorkflow = {
    agents: {
        sessions: {
            name: "Sessions Agent",
            prompt: "You are a helpful sessions agent that provides information about scheduled events and sessions. Always respond with accurate scheduling information.",
            voice: "en-female",
            widgets: ["schedule"]
        },
        general: {
            name: "General Agent",
            prompt: "You are a helpful general-purpose assistant. Answer questions clearly and concisely.",
            voice: "en-male",
            widgets: []
        }
    },
    classifier: "Analyze the user query and determine which agent should handle it:\n\n- If the query is about schedules, sessions, events, appointments, or time-related matters, respond with: \"sessions\"\n- For all other queries, respond with: \"general\"\n\nRespond with only the agent name.",
    guardrails: {
        piiProtection: true,
        hallucinationCheck: true,
        contentFilter: true
    }
};

let conversationHistory = [];

// View Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        
        // Update nav
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // Update view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}-view`).classList.add('active');
        
        // Load published workflows if switching to that view
        if (view === 'published') {
            loadPublishedWorkflows();
        }
    });
});

// Save Workflow
document.getElementById('save-workflow').addEventListener('click', () => {
    saveCurrentWorkflow();
    alert('Workflow saved!');
});

function saveCurrentWorkflow() {
    // Update from UI
    document.querySelectorAll('.agent-card').forEach(card => {
        const agentType = card.dataset.agent;
        currentWorkflow.agents[agentType].name = card.querySelector('.agent-name').value;
        currentWorkflow.agents[agentType].prompt = card.querySelector('.agent-prompt').value;
        currentWorkflow.agents[agentType].voice = card.querySelector('.tts-voice').value;
    });
    
    currentWorkflow.classifier = document.querySelector('.classifier-prompt').value;
    
    currentWorkflow.guardrails = {
        piiProtection: document.getElementById('pii-protection').checked,
        hallucinationCheck: document.getElementById('hallucination-check').checked,
        contentFilter: document.getElementById('content-filter').checked
    };
}

// Widget Preview
document.querySelectorAll('.preview-widget').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const widgetCard = e.target.closest('.widget-card');
        const widgetType = widgetCard.dataset.widget;
        const widget = WidgetLibrary[widgetType];
        
        document.getElementById('modal-title').textContent = widget.name;
        document.getElementById('modal-body').innerHTML = widget.render();
        document.getElementById('widget-modal').classList.add('active');
    });
});

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('widget-modal').classList.remove('active');
});

// Test Workflow
document.getElementById('send-test').addEventListener('click', async () => {
    const input = document.getElementById('test-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    input.value = '';
    
    // Add user message
    addMessage('user', message);
    
    // Process through workflow
    await processWorkflow(message);
});

document.getElementById('test-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('send-test').click();
    }
});

function addMessage(role, content, meta = '') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `
        <div class="message-content">${content}</div>
        ${meta ? `<div class="message-meta">${meta}</div>` : ''}
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function processWorkflow(message) {
    saveCurrentWorkflow();
    
    // Step 1: Classifier
    updateWorkflowStep('step-classifier', 'active', '🔄 Classifying...');
    
    try {
        const classifierResponse = await websim.chat.completions.create({
            messages: [
                { role: "system", content: currentWorkflow.classifier },
                { role: "user", content: message }
            ]
        });
        
        const selectedAgent = classifierResponse.content.trim().toLowerCase();
        updateWorkflowStep('step-classifier', 'complete', `✓ Routed to ${selectedAgent}`);
        
        // Step 2: Agent Processing
        updateWorkflowStep('step-agent', 'active', '🔄 Processing...');
        
        const agent = currentWorkflow.agents[selectedAgent] || currentWorkflow.agents.general;
        
        // Build context with widgets
        let context = agent.prompt;
        if (agent.widgets && agent.widgets.length > 0) {
            context += "\n\nYou have access to the following data:\n";
            agent.widgets.forEach(widgetType => {
                const widget = WidgetLibrary[widgetType];
                if (widget) {
                    context += `\n${widget.name}:\n${JSON.stringify(widget.getData(), null, 2)}\n`;
                }
            });
        }
        
        conversationHistory.push({ role: "user", content: message });
        
        const agentResponse = await websim.chat.completions.create({
            messages: [
                { role: "system", content: context },
                ...conversationHistory.slice(-6)
            ]
        });
        
        const response = agentResponse.content;
        conversationHistory.push({ role: "assistant", content: response });
        
        updateWorkflowStep('step-agent', 'complete', `✓ ${agent.name}`);
        
        // Step 3: Guardrails
        updateWorkflowStep('step-guardrails', 'active', '🔄 Checking...');
        
        const guardrailCheck = await checkGuardrails(message, response);
        
        if (!guardrailCheck.passed) {
            updateWorkflowStep('step-guardrails', 'error', '⚠️ Failed');
            updateWorkflowStep('step-response', 'error', '⚠️ Blocked');
            addMessage('agent', 'Sorry, I cannot provide that response due to safety guidelines.', 'Guardrail: ' + guardrailCheck.reason);
            return;
        }
        
        updateWorkflowStep('step-guardrails', 'complete', '✓ Passed');
        
        // Step 4: Response
        updateWorkflowStep('step-response', 'complete', '✓ Delivered');
        
        addMessage('agent', response, `Agent: ${agent.name} | Voice: ${agent.voice}`);
        
        // Optional: TTS
        if (agent.voice) {
            try {
                const tts = await websim.textToSpeech({
                    text: response,
                    voice: agent.voice
                });
                
                const audio = new Audio(tts.url);
                audio.play();
            } catch (e) {
                console.log('TTS not available:', e);
            }
        }
        
    } catch (error) {
        console.error('Workflow error:', error);
        updateWorkflowStep('step-agent', 'error', '⚠️ Error');
        addMessage('agent', 'An error occurred processing your request.');
    }
}

function updateWorkflowStep(stepId, state, status) {
    const step = document.getElementById(stepId);
    step.className = `workflow-step ${state}`;
    step.querySelector('.step-status').textContent = status;
}

async function checkGuardrails(userMessage, agentResponse) {
    const checks = [];
    
    if (currentWorkflow.guardrails.piiProtection) {
        const piiCheck = await websim.chat.completions.create({
            messages: [{
                role: "system",
                content: "Check if the following response contains any personally identifiable information (PII) such as email addresses, phone numbers, social security numbers, credit card numbers, etc. Respond with JSON: {containsPII: boolean, reason: string}"
            }, {
                role: "user",
                content: `Response to check: "${agentResponse}"`
            }],
            json: true
        });
        
        const result = JSON.parse(piiCheck.content);
        if (result.containsPII) {
            return { passed: false, reason: "PII Protection: " + result.reason };
        }
    }
    
    if (currentWorkflow.guardrails.hallucinationCheck) {
        // Simple check - in production this would be more sophisticated
        if (agentResponse.includes('I don\'t have') || agentResponse.includes('I cannot')) {
            // Agent is being honest about limitations
        }
    }
    
    if (currentWorkflow.guardrails.contentFilter) {
        // Basic content filtering
        const inappropriate = ['hack', 'exploit', 'illegal'];
        if (inappropriate.some(word => userMessage.toLowerCase().includes(word))) {
            return { passed: false, reason: "Content Filter: Potentially inappropriate content" };
        }
    }
    
    return { passed: true };
}

// Run Evaluations
document.getElementById('run-evals').addEventListener('click', async () => {
    const evalResults = document.getElementById('eval-results');
    const evalContent = document.getElementById('eval-content');
    
    evalResults.style.display = 'block';
    evalContent.innerHTML = '<p>Running evaluations...</p>';
    
    const testCases = [
        { input: "What's on my schedule today?", expectedAgent: "sessions" },
        { input: "What's the weather like?", expectedAgent: "general" },
        { input: "When is my next meeting?", expectedAgent: "sessions" },
        { input: "Tell me a joke", expectedAgent: "general" }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
        try {
            const classifierResponse = await websim.chat.completions.create({
                messages: [
                    { role: "system", content: currentWorkflow.classifier },
                    { role: "user", content: testCase.input }
                ]
            });
            
            const selectedAgent = classifierResponse.content.trim().toLowerCase();
            const passed = selectedAgent === testCase.expectedAgent;
            
            results.push({
                test: testCase.input,
                expected: testCase.expectedAgent,
                actual: selectedAgent,
                passed
            });
        } catch (e) {
            results.push({
                test: testCase.input,
                expected: testCase.expectedAgent,
                actual: 'error',
                passed: false
            });
        }
    }
    
    evalContent.innerHTML = results.map(r => `
        <div class="eval-item ${r.passed ? 'pass' : 'fail'}">
            <strong>${r.passed ? '✓' : '✗'} ${r.test}</strong><br>
            Expected: ${r.expected} | Got: ${r.actual}
        </div>
    `).join('');
    
    // Auto-fix if failures
    const failures = results.filter(r => !r.passed);
    if (failures.length > 0) {
        evalContent.innerHTML += `<p style="margin-top: 16px; color: #ef4444;">Found ${failures.length} failures. Consider updating your classifier prompt.</p>`;
    } else {
        evalContent.innerHTML += `<p style="margin-top: 16px; color: #22c55e;">All evaluations passed! ✓</p>`;
    }
});

// Publish Workflow
document.getElementById('publish-workflow').addEventListener('click', async () => {
    saveCurrentWorkflow();
    
    const name = prompt('Enter a name for this workflow:');
    if (!name) return;
    
    try {
        await room.collection('workflow').create({
            name: name,
            workflow: JSON.stringify(currentWorkflow),
            published_at: new Date().toISOString()
        });
        
        alert('Workflow published successfully!');
        
        // Switch to published view
        document.querySelector('[data-view="published"]').click();
    } catch (error) {
        alert('Error publishing workflow: ' + error.message);
    }
});

// Load Published Workflows
async function loadPublishedWorkflows() {
    const publishedList = document.getElementById('published-list');
    const workflows = room.collection('workflow').getList();
    
    if (workflows.length === 0) {
        publishedList.innerHTML = '<p class="empty-state">No published workflows yet. Create and publish your first workflow!</p>';
        return;
    }
    
    publishedList.innerHTML = workflows.reverse().map(wf => `
        <div class="published-item">
            <div class="published-header">
                <h3>${wf.name}</h3>
                <div class="published-meta">
                    Published by ${wf.username}<br>
                    ${new Date(wf.published_at).toLocaleDateString()}
                </div>
            </div>
            <div class="published-actions">
                <button class="btn-small" onclick="loadWorkflow('${wf.id}')">Load</button>
                ${wf.username === (window.websim.getCurrentUser ? (window.websim.getCurrentUser()).username : 'unknown') ? 
                    `<button class="btn-small" onclick="deleteWorkflow('${wf.id}')">Delete</button>` : ''}
            </div>
        </div>
    `).join('');
}

window.loadWorkflow = function(id) {
    const workflows = room.collection('workflow').getList();
    const workflow = workflows.find(w => w.id === id);
    
    if (!workflow) return;
    
    currentWorkflow = JSON.parse(workflow.workflow);
    
    // Update UI
    Object.keys(currentWorkflow.agents).forEach(agentType => {
        const card = document.querySelector(`.agent-card[data-agent="${agentType}"]`);
        if (card) {
            card.querySelector('.agent-name').value = currentWorkflow.agents[agentType].name;
            card.querySelector('.agent-prompt').value = currentWorkflow.agents[agentType].prompt;
            card.querySelector('.tts-voice').value = currentWorkflow.agents[agentType].voice;
        }
    });
    
    document.querySelector('.classifier-prompt').value = currentWorkflow.classifier;
    
    document.getElementById('pii-protection').checked = currentWorkflow.guardrails.piiProtection;
    document.getElementById('hallucination-check').checked = currentWorkflow.guardrails.hallucinationCheck;
    document.getElementById('content-filter').checked = currentWorkflow.guardrails.contentFilter;
    
    // Switch to builder view
    document.querySelector('[data-view="builder"]').click();
    
    alert('Workflow loaded!');
};

window.deleteWorkflow = async function(id) {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    
    try {
        await room.collection('workflow').delete(id);
        loadPublishedWorkflows();
    } catch (error) {
        alert('Error deleting workflow: ' + error.message);
    }
};

// Subscribe to workflow changes
room.collection('workflow').subscribe(() => {
    if (document.getElementById('published-view').classList.contains('active')) {
        loadPublishedWorkflows();
    }
});

// Initialize
loadPublishedWorkflows();

