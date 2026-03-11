/*
 * This file is part of Call Tracker.
 * 
 * Copyright (C) 2024 Micah Levason.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

document.addEventListener("DOMContentLoaded", () => {
    AOS.init();

// ─── Action Plan: 7-Day FCR Focus (Coaching 03/10/26) ───────────────────────
// Focus Behavior: Restate the issue + get verbal confirmation at the start of
// every call. Optional extra credit: "I want to make sure you don't have to
// call back."
// ─────────────────────────────────────────────────────────────────────────────

const behaviorsConfig = [
  {
    id: "restateIssue",
    name: "Restate issue & get verbal confirmation",
    examples: [
      "So just to make sure I understand, you're calling in because [issue] — is that right?",
      "I want to confirm — you're reaching out today about [issue], correct?",
      "Let me restate what you've told me: [issue]. Does that sound right?",
      "So what I'm hearing is [issue] — am I understanding that correctly?"
    ],
    encouragements: [
      "Great restate! That's 7-day FCR gold! 🏆",
      "Nice job confirming the issue upfront!",
      "Excellent verbal confirmation — keep it up!",
      "That's exactly the behavior! Way to nail the restate!"
    ],
  },
  {
    id: "dontHaveToCallBack",
    name: "\"I want to make sure you don't have to call back\" (+extra credit)",
    examples: [
      "I want to make sure you don't have to call back, so let me take care of everything for you today.",
      "My goal is to get this fully resolved so you don't have to call back.",
      "I want to make sure you don't have to call back — let's make sure we cover everything.",
      "Let me make sure we get this 100% taken care of so you don't have to call back."
    ],
    encouragements: [
      "Extra credit earned! 🌟 That phrase is a game-changer for FCR!",
      "Boom! That's the line that keeps customers from calling back!",
      "That extra credit phrase is so powerful — great job!",
      "You're building trust and reducing callbacks — amazing!"
    ],
  }
];

    // Helper function to get a random item from an array
    function getRandomItem(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // Initialize LocalForage
    localforage.config({
        name: "tMobileCallTracker",
    });

    // Elements
    const startCallBtn = document.getElementById("startCallBtn");
    const endCallBtn = document.getElementById("endCallBtn");
    const behaviorSection = document.getElementById("behaviorSection");
    const behaviorsList = document.getElementById("behaviorsList");
    const totalCallsEl = document.getElementById("totalCalls");
    const behaviorStats = document.getElementById("behaviorStats");
    const downloadBtn = document.getElementById("downloadBtn");
    const callIdInput = document.getElementById("callId");
    const summaryCards = document.querySelectorAll(".summary-card");
    const startCallCard = document.getElementById("startCallCard");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");
    const timerDisplay = document.getElementById("callTimer");

    let currentCall = null;
    let dailyData = {
        calls: [],
        behaviors: {},
    };
    let timerInterval = null;
    let elapsedSeconds = 0;

    // Update Progress Bar
    function updateProgress() {
        if (!currentCall) {
            const progressBar = document.getElementById("behaviorProgress");
            progressBar.style.width = "0%";
            progressBar.setAttribute("aria-valuenow", 0);
            document.getElementById("behaviorCount").textContent = "0";
            document.getElementById("totalBehaviors").textContent = behaviorsConfig.length.toString();
            return;
        }

        const totalBehaviors = behaviorsConfig.length;
        const completedBehaviors = currentCall.behaviors.length;
        const progressPercentage = (completedBehaviors / totalBehaviors) * 100;
        const progressBar = document.getElementById("behaviorProgress");
        progressBar.style.width = `${progressPercentage}%`;
        progressBar.setAttribute("aria-valuenow", Math.round(progressPercentage));
        document.getElementById("behaviorCount").textContent = completedBehaviors.toString();
        document.getElementById("totalBehaviors").textContent = totalBehaviors.toString();
    }

    // Load or Initialize Data
    async function loadData() {
        try {
            const data = await localforage.getItem("dailyData");
            if (data) {
                dailyData = data;
                behaviorsConfig.forEach((b) => {
                    if (!(b.id in dailyData.behaviors)) {
                        dailyData.behaviors[b.id] = 0;
                    }
                });
            } else {
                dailyData.behaviors = {};
                behaviorsConfig.forEach((b) => {
                    dailyData.behaviors[b.id] = 0;
                });
            }
            updateSummary();
        } catch (error) {
            console.error("Error loading data:", error);
        }
    }

    loadData();

    // Render Behavior Buttons
    function renderBehaviors() {
        behaviorsList.innerHTML = "";
        behaviorsConfig.forEach((behavior) => {
            const btn = document.createElement("button");
            btn.classList.add("btn", "behavior-btn", "btn-outline-primary");
            btn.textContent = behavior.name;
            btn.title = getRandomItem(behavior.examples);
            btn.dataset.id = behavior.id;
            btn.addEventListener("click", () => toggleBehavior(btn, behavior.id));
            behaviorsList.appendChild(btn);
        });
    }

    renderBehaviors();

    // Toggle Behavior Selection
    function toggleBehavior(button, id) {
        const behavior = behaviorsConfig.find((b) => b.id === id);
        if (!currentCall.behaviors.includes(id)) {
            currentCall.behaviors.push(id);
            button.classList.add("active");
            dailyData.behaviors[id] = (dailyData.behaviors[id] || 0) + 1;

            Swal.fire({
                icon: "success",
                title: getRandomItem(behavior.encouragements),
                position: "top-end",
                timer: 2000,
                showConfirmButton: false,
                toast: true,
            });
            summaryCards.forEach((card) => card.classList.add("active"));
        } else {
            currentCall.behaviors = currentCall.behaviors.filter((b) => b !== id);
            button.classList.remove("active");
            dailyData.behaviors[id] = Math.max(0, (dailyData.behaviors[id] || 1) - 1);
            if (currentCall.behaviors.length === 0) {
                summaryCards.forEach((card) => card.classList.remove("active"));
            }
        }
        updateProgress();
        updateSummary();
        saveData();
    }

    // Start Call Session
    startCallBtn.addEventListener("click", () => {
        const callId = callIdInput.value.trim();
        if (!callId) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "Please enter a valid Account Number or ID.",
                timer: 3000,
                showConfirmButton: false,
            });
            return;
        }

        if (currentCall) {
            Swal.fire({
                icon: "warning",
                title: "Warning",
                text: "A call is already in progress.",
                timer: 3000,
                showConfirmButton: false,
            });
            return;
        }

        currentCall = {
            id: callId,
            behaviors: [],
            duration: 0,
        };

        startTimer();
        startCallBtn.classList.add("active");
        behaviorSection.classList.remove("d-none");
        callIdInput.value = "";
        document.body.style.backgroundColor = "#e2f0cb";
        startCallCard.style.display = "none";
        updateProgress();
    });

    // Start Timer Function
    function startTimer() {
        elapsedSeconds = 0;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            elapsedSeconds += 1;
            updateTimerDisplay();

            if (elapsedSeconds === 15 * 60) {
                Swal.fire({
                    icon: "info",
                    title: "15 Minutes Reached",
                    text: "Please check in with the customer.",
                    timer: 3000,
                    showConfirmButton: false,
                });
                timerDisplay.classList.add("time-exceeded");
            }
        }, 1000);
    }

    // Update Timer Display
    function updateTimerDisplay() {
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        timerDisplay.textContent = `${padZero(minutes)}:${padZero(seconds)}`;
    }

    // Pad Zero Function
    function padZero(num) {
        return num.toString().padStart(2, '0');
    }

    // End Call Session with Auto-Copy
    endCallBtn.addEventListener("click", () => {
        if (!currentCall) return;

        clearInterval(timerInterval);
        currentCall.duration = elapsedSeconds;

        const behaviorNames = currentCall.behaviors.map(id => {
            const behavior = behaviorsConfig.find(b => b.id === id);
            return behavior ? `${behavior.name} +1` : `${id} +1`;
        });

        const minutes = Math.floor(currentCall.duration / 60);
        const seconds = currentCall.duration % 60;
        const formattedDuration = `${padZero(minutes)}:${padZero(seconds)}`;

        const formattedBehaviors = behaviorNames.length > 0
            ? behaviorNames.join(",\n") + ","
            : "None";

        const didRestate = currentCall.behaviors.includes("restateIssue");
        const didExtraCredit = currentCall.behaviors.includes("dontHaveToCallBack");
        let fcrNote = "";
        if (didRestate && didExtraCredit) {
            fcrNote = "✅ Full action plan completed (restate + extra credit)";
        } else if (didRestate) {
            fcrNote = "✅ Restate completed | ⭐ Try adding \"don't have to call back\" next time!";
        } else {
            fcrNote = "⚠️ Remember to restate the issue & get verbal confirmation next call!";
        }

        let callRecap = `Call Recap:\n${formattedBehaviors}\nDuration: ${formattedDuration}\n${fcrNote}\n\n`;
        let fullRecap = `${cat}\n${callRecap}https://micah4thewin.github.io/calltracker/\n`;

        navigator.clipboard
            .writeText(fullRecap)
            .then(() => {
                Swal.fire({
                    icon: "success",
                    title: "Great job!",
                    text: "Call recap copied to clipboard!",
                    timer: 1200,
                    showConfirmButton: false,
                });
            })
            .catch((err) => {
                console.error("Error copying text: ", err);
            });

        dailyData.calls.push(currentCall);
        currentCall = null;
        startCallBtn.classList.remove("active");
        behaviorSection.classList.add("d-none");
        resetBehaviorButtons();
        summaryCards.forEach((card) => card.classList.remove("active"));
        updateProgress();
        updateSummary();
        saveData();

        document.body.style.backgroundColor = "#f4f6f9";
        timerDisplay.textContent = "00:00";
        timerDisplay.classList.remove("time-exceeded");
        startCallCard.style.display = "block";
        AOS.refresh();
    });

    // Reset Behavior Buttons
    function resetBehaviorButtons() {
        const buttons = document.querySelectorAll(".behavior-btn");
        buttons.forEach((btn) => btn.classList.remove("active"));
    }

    // Update Summary Dashboard
    function updateSummary() {
        totalCallsEl.textContent = dailyData.calls.length;
        behaviorStats.innerHTML = "";

        behaviorsConfig.forEach((behavior) => {
            const li = document.createElement("li");
            li.classList.add(
                "list-group-item",
                "d-flex",
                "justify-content-between",
                "align-items-center",
                "bg-secondary",
                "text-white"
            );
            const count = dailyData.behaviors[behavior.id] || 0;
            const percentage =
                dailyData.calls.length > 0
                    ? ((count / dailyData.calls.length) * 100).toFixed(2)
                    : 0;
            li.innerHTML = `${behavior.name}: ${percentage}%`;
            behaviorStats.appendChild(li);
        });
    }

    // Save Data to LocalForage
    function saveData() {
        localforage.setItem("dailyData", dailyData).catch((err) => {
            console.error("Error saving data:", err);
        });
    }

    // Download Summary
    downloadBtn.addEventListener("click", () => {
        if (dailyData.calls.length === 0) {
            Swal.fire({
                icon: "info",
                title: "No Data",
                text: "There is no data to download.",
                timer: 3000,
                showConfirmButton: false,
            });
            return;
        }

        let summary = "T-Mobile Call Center Summary\nAction Plan Focus: 7-Day FCR\n\n";
        dailyData.calls.forEach((call) => {
            const callDurationMinutes = Math.floor(call.duration / 60);
            const callDurationSeconds = call.duration % 60;
            const formattedDuration = `${padZero(callDurationMinutes)}:${padZero(callDurationSeconds)}`;
            summary += `ID: ${call.id}\n`;
            summary += `Behaviors Completed: ${call.behaviors.join(", ") || "None"}\n`;
            summary += `Duration: ${formattedDuration}\n\n`;
        });

        summary += "Daily Summary:\n";
        summary += `Total Calls: ${dailyData.calls.length}\n`;
        behaviorsConfig.forEach((behavior) => {
            const count = dailyData.behaviors[behavior.id] || 0;
            const percentage = ((count / dailyData.calls.length) * 100).toFixed(2);
            summary += `${behavior.name}: ${percentage}%\n`;
        });

        const blob = new Blob([summary], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "call_summary.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Clear Call History
    clearHistoryBtn.addEventListener("click", () => {
        Swal.fire({
            title: "Are you sure?",
            text: "This will clear all call history and cannot be undone.",
            icon: "warning",
            showCancelButton: true,
            customClass: {
                confirmButton: 'sweetAlert'
            },
            confirmButtonText: "Yes, clear it!",
            cancelButtonText: "Cancel",
        }).then((result) => {
            if (result.isConfirmed) {
                localforage
                    .removeItem("dailyData")
                    .then(() => {
                        dailyData = { calls: [], behaviors: {} };
                        behaviorsConfig.forEach((b) => {
                            dailyData.behaviors[b.id] = 0;
                        });
                        resetBehaviorButtons();
                        updateSummary();
                        updateProgress();
                        Swal.fire({
                            icon: "success",
                            title: "Cleared!",
                            text: "Call history has been cleared.",
                            timer: 2000,
                            showConfirmButton: false,
                        });
                    })
                    .catch((err) => {
                        console.error("Error clearing data:", err);
                        Swal.fire({
                            icon: "error",
                            title: "Error",
                            text: "There was an error clearing the call history.",
                            timer: 2000,
                            showConfirmButton: false,
                        });
                    });
            }
        });
    });

    // Handle Page Reload
    window.addEventListener("beforeunload", () => {
        if (currentCall) {
            dailyData.calls.push(currentCall);
            saveData();
        }
    });

    window.addEventListener("DOMContentLoaded", updateProgress);
    behaviorsList.addEventListener("click", updateProgress);

    // ASCII Art for Call Recap
const cat = `
(｡◕‿◕｡)
`;

});
