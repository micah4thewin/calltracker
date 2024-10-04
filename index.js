document.addEventListener('DOMContentLoaded', () => {
    AOS.init();

    // Configuration Object for Behaviors
    const behaviorsConfig = [
        {
            id: 'empathy',
            name: 'Empathy Statement',
            example: 'I understand how you feel.'
        },
        {
            id: 'ownership',
            name: 'Ownership Statement',
            example: 'I will take care of this for you.'
        },
        {
            id: 'accountAudit',
            name: 'Account Audit',
            example: 'Let me review your account status and balance.'
        },
        {
            id: 'checkIssues',
            name: 'Check for Adjacent Issues',
            example: 'Is there anything else I can assist you with?'
        },
        {
            id: 'nbaTool',
            name: 'NBA Tool Offer',
            example: 'I have some offers that might interest you.'
        },
        {
            id: 'selfHelp',
            name: 'Self Help Information',
            example: 'I can send you a link with helpful information.'
        },
        {
            id: 'callRecap',
            name: 'Call Recap',
            example: 'To recap, here is what we discussed today...'
        }
    ];

    // Initialize LocalForage
    localforage.config({
        name: 'tMobileCallTracker'
    });

    // Elements
    const startCallBtn = document.getElementById('startCallBtn');
    const endCallBtn = document.getElementById('endCallBtn');
    const behaviorSection = document.getElementById('behaviorSection');
    const behaviorsList = document.getElementById('behaviorsList');
    const totalCallsEl = document.getElementById('totalCalls');
    const behaviorStats = document.getElementById('behaviorStats');
    const downloadBtn = document.getElementById('downloadBtn');
    const callIdInput = document.getElementById('callId');
    const summaryCards = document.querySelectorAll('.summary-card');

    let currentCall = null;
    let dailyData = {
        calls: [],
        behaviors: {}
    };

    // Load or Initialize Data
    async function loadData() {
        try {
            const data = await localforage.getItem('dailyData');
            if (data) {
                dailyData = data;
            } else {
                dailyData.behaviors = {};
                behaviorsConfig.forEach(b => {
                    dailyData.behaviors[b.id] = 0;
                });
            }
            updateSummary();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    loadData();

    // Render Behavior Buttons
    function renderBehaviors() {
        behaviorsConfig.forEach(behavior => {
            const btn = document.createElement('button');
            btn.classList.add('btn', 'behavior-btn', 'btn-outline-primary');
            btn.textContent = behavior.name;
            btn.title = behavior.example;
            btn.dataset.id = behavior.id;
            btn.addEventListener('click', () => toggleBehavior(btn, behavior.id));
            behaviorsList.appendChild(btn);
        });
    }

    renderBehaviors();

    // Toggle Behavior Selection
    function toggleBehavior(button, id) {
        if (!currentCall.behaviors.includes(id)) {
            currentCall.behaviors.push(id);
            button.classList.add('active');
            // Update behavior count
            dailyData.behaviors[id] += 1;
            // Highlight summary cards
            summaryCards.forEach(card => card.classList.add('active'));
        } else {
            currentCall.behaviors = currentCall.behaviors.filter(b => b !== id);
            button.classList.remove('active');
            dailyData.behaviors[id] -= 1;
            // Remove highlight if no behaviors are active
            if (currentCall.behaviors.length === 0) {
                summaryCards.forEach(card => card.classList.remove('active'));
            }
        }
        updateSummary();
        saveData();
    }

    // Start Call Session
    startCallBtn.addEventListener('click', () => {
        const callId = callIdInput.value.trim();
        if (!callId) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Please enter a valid Account Number or ID.',
                timer: 3000,
                showConfirmButton: false
            });
            return;
        }
        if (currentCall) {
            Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'A call is already in progress.',
                timer: 3000,
                showConfirmButton: false
            });
            return;
        }
        currentCall = {
            id: callId,
            behaviors: []
        };
        behaviorSection.classList.remove('d-none');
        callIdInput.value = '';
        Swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Call session started.',
            timer: 2000,
            showConfirmButton: false
        });
    });

    // End Call Session
    endCallBtn.addEventListener('click', () => {
        if (!currentCall) return;
        dailyData.calls.push(currentCall);
        currentCall = null;
        behaviorSection.classList.add('d-none');
        resetBehaviorButtons();
        summaryCards.forEach(card => card.classList.remove('active'));
        updateSummary();
        saveData();
        Swal.fire({
            icon: 'info',
            title: 'Ended',
            text: 'Call session ended.',
            timer: 2000,
            showConfirmButton: false
        });
    });

    // Reset Behavior Buttons
    function resetBehaviorButtons() {
        const buttons = document.querySelectorAll('.behavior-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
    }

    // Update Summary Dashboard
    function updateSummary() {
        totalCallsEl.textContent = dailyData.calls.length;
        behaviorStats.innerHTML = '';
        behaviorsConfig.forEach(behavior => {
            const li = document.createElement('li');
            li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
            li.textContent = behavior.name;
            const count = dailyData.behaviors[behavior.id] || 0;
            const percentage = dailyData.calls.length > 0 ? ((count / dailyData.calls.length) * 100).toFixed(2) : 0;
            li.innerHTML += `<span>${percentage}%</span>`;
            behaviorStats.appendChild(li);
        });
    }

    // Save Data to LocalForage
    function saveData() {
        localforage.setItem('dailyData', dailyData).catch(err => {
            console.error('Error saving data:', err);
        });
    }

    // Download Summary
    downloadBtn.addEventListener('click', () => {
        if (dailyData.calls.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'No Data',
                text: 'There is no data to download.',
                timer: 3000,
                showConfirmButton: false
            });
            return;
        }
        let summary = 'T-Mobile Call Center Summary\n\n';
        dailyData.calls.forEach(call => {
            summary += `ID: ${call.id}\n`;
            summary += `Behaviors Completed: ${call.behaviors.join(', ') || 'None'}\n\n`;
        });
        // Add overall statistics
        summary += 'Daily Summary:\n';
        summary += `Total Calls: ${dailyData.calls.length}\n`;
        behaviorsConfig.forEach(behavior => {
            const count = dailyData.behaviors[behavior.id] || 0;
            const percentage = ((count / dailyData.calls.length) * 100).toFixed(2);
            summary += `${behavior.name}: ${percentage}%\n`;
        });
        // Create a blob and download
        const blob = new Blob([summary], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'call_summary.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Handle Page Reload
    window.addEventListener('beforeunload', () => {
        if (currentCall) {
            dailyData.calls.push(currentCall);
        }
        saveData();
    });
});
