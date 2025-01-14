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

  // Configuration Object for Behaviors
const behaviorsConfig = [
    {
        id: "empathy",
        name: "Empathy Statement",
        examples: [
            "I truly understand how you feel.",
            "I can see why that would be frustrating, and I'm here to help.",
            "I'm genuinely sorry you're experiencing this, let's resolve it together."
        ],
        encouragements: [
            "Empathy with impact!",
            "Your empathy is transformative!",
            "You're connecting on a deep level!"
        ],
    },
    {
        id: "ownership",
        name: "Ownership Statement",
        examples: [
            "I will personally take care of this for you.",
            "Let me handle that for you, ensuring it's resolved.",
            "I'll make sure this gets resolved quickly and effectively."
        ],
        encouragements: [
            "Exemplary ownership!",
            "Outstanding responsibility!",
            "You're leading with initiative!"
        ],
    },
    {
        id: "confidence",
        name: "Confidence Statement",
        examples: [
            "I’m glad to assist you with this today.",
            "Let me provide you with the solution right away.",
            "I’m confident we’ll resolve this for you smoothly."
        ],
        encouragements: [
            "Commanding confidence!",
            "Leading with expertise!",
            "You’re inspiring trust and assurance!"
        ],
    },
    {
        id: "personalization",
        name: "Personalization",
        examples: [
            "Thank you so much for being such a loyal customer!",
            "I love how proactive you’ve been with your account.",
            "It’s great to hear you’re making the most of our services."
        ],
        encouragements: [
            "Bringing a personal touch!",
            "Building strong customer connections!",
            "Personalization at its best!"
        ],
    },
    {
        id: "accountAudit",
        name: "Account Health Check",
        examples: [
            "Let me perform a detailed review of your account status.",
            "I'll ensure your account details are accurate and up-to-date.",
            "Allow me to audit your account for any discrepancies and ensure optimal health."
        ],
        encouragements: [
            "Thorough and precise audit!",
            "Comprehensive account health check!",
            "Ensuring account excellence!"
        ],
    },
    {
        id: "collectPastDue",
        name: "Past Due Collection",
        examples: [
            "I notice your account is past due. Can we set up a payment arrangement today?",
            "Your account doesn't have a payment method for future payments. Would you like to add one now?",
            "To avoid further late fees, shall we discuss payment options for your overdue balance?"
        ],
        encouragements: [
            "Proactive approach to resolving overdue accounts!",
            "Excellent initiative in securing future payments!",
            "Ensuring timely collection while maintaining customer relationships!"
        ],
    },
    {
        id: "nbaTool",
        name: "Enhance Value Offer",
        examples: [
            "I have some exclusive offers that might enhance your experience.",
            "Let me share some deals that add great value for you.",
            "Would you like to hear about our latest offers that could benefit you?"
        ],
        encouragements: [
            "Offering exceptional value!",
            "Excellent presentation of offers!",
            "Providing valuable enhancements!"
        ],
    },
    {
        id: "selfHelp",
        name: "Teach Self-Sufficiency",
        examples: [
            "I can send you a link with resources to empower your self-service capabilities.",
            "Would you like some tools to help you manage things independently?",
            "Let me provide you with materials that enhance your self-sufficiency."
        ],
        encouragements: [
            "Empowering customers through knowledge!",
            "Supporting independence with resources!",
            "Providing valuable self-help tools!"
        ],
    },
    {
        id: "callRecap",
        name: "Resolution Summary",
        examples: [
            "To summarize, here's what we resolved today...",
            "Let me recap our conversation to ensure clarity.",
            "Here's a summary of our call, confirming all details discussed."
        ],
        encouragements: [
            "Clear and concise recap!",
            "Excellent summary ensuring understanding!",
            "Well-articulated resolution summary!"
        ],
    },
    {
        id: "pride",
        name: "Pride in Service",
        examples: [
            "At T-Mobile, we take pride in ensuring customer satisfaction.",
            "I’m proud to offer you the best solutions today.",
            "It’s my pleasure to provide you with top-notch support."
        ],
        encouragements: [
            "Outstanding representation of pride!",
            "Elevating the customer experience!",
            "Radiating positivity and excellence!"
        ],
    },
    {
        id: "proactiveFuture",
        name: "Solve the Next Call",
        examples: [
            "Let’s set up Autopay to make things easier moving forward.",
            "I see your handset is not 5G-compatible. Would you like to explore upgrade options?",
            "I'll make sure we proactively address any future issues for you."
        ],
        encouragements: [
            "Staying one step ahead!",
            "Proactively solving future concerns!",
            "Setting customers up for success!"
        ],
    },
    {
        id: "efficiency",
        name: "Efficiency in Action",
        examples: [
            "Let me quickly handle that for you while I check the system.",
            "I’ll prioritize efficiency to get this resolved immediately.",
            "I’m multitasking to ensure this is done promptly and correctly."
        ],
        encouragements: [
            "Masterful multitasking!",
            "Seamless and efficient handling!",
            "Delivering quick solutions with precision!"
        ],
    },
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
    const clearHistoryBtn = document.getElementById("clearHistoryBtn"); // Assuming there is a clearHistoryBtn
    const timerDisplay = document.getElementById("callTimer"); // New Timer Element

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
            // Reset progress bar when no call is active
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
            } else {
                dailyData.behaviors = {};
                behaviorsConfig.forEach((b) => {
                    dailyData.behaviors[b.id] = 0;
                });
                updateSummary(); // Ensure updateSummary() is called after data is loaded or initialized
            }
        } catch (error) {
            console.error("Error loading data:", error);
        }
    }

    loadData();

    // Render Behavior Buttons
    function renderBehaviors() {
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
            dailyData.behaviors[id] += 1;

            // Display encouraging statement
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
            dailyData.behaviors[id] -= 1;
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
            duration: 0, // Initialize duration
        };

        // Start Timer
        startTimer();

        // Add active class to change button color
        startCallBtn.classList.add("active");
        behaviorSection.classList.remove("d-none");
        callIdInput.value = "";
        Swal.fire({
            icon: "success",
            title: "Success",
            text: "Call session started.",
            timer: 2000,
            showConfirmButton: false,
        });
        updateProgress();

        // Change background color when call is active
        document.body.style.backgroundColor = "#e2f0cb"; // Calm green color

        startCallCard.style.display = "none";
    });

    // Start Timer Function
    function startTimer() {
        elapsedSeconds = 0;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            elapsedSeconds += 1;
            updateTimerDisplay();

            if (elapsedSeconds === 15 * 60) {
                // 15 minutes reached
                Swal.fire({
                    icon: "info",
                    title: "15 Minutes Reached",
                    text: "Please check in with the customer.",
                    timer: 3000,
                    showConfirmButton: false,
                });
                // Change timer color to indicate time exceeded
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

        // Stop Timer
        clearInterval(timerInterval);
        currentCall.duration = elapsedSeconds; // Record duration in seconds

        // Map behavior IDs to their full names
        const behaviorNames = currentCall.behaviors.map(id => {
            const behavior = behaviorsConfig.find(b => b.id === id);
            return behavior ? behavior.name : id;
        });

        // Construct Call Recap
        const minutes = Math.floor(currentCall.duration / 60);
        const seconds = currentCall.duration % 60;
        const formattedDuration = `${padZero(minutes)}:${padZero(seconds)}`;

        let callRecap = `Call Recap:\n${behaviorNames.join(", ") || "None"}\nDuration: ${formattedDuration}\n\n`;
        let fullRecap = `${cat}\nhttps://micah4thewin.github.io/calltracker/\n${callRecap}`;

        // Copy Recap to Clipboard
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
                console.log("Call recap copied to clipboard!");
            })
            .catch((err) => {
                console.error("Error copying text: ", err);
            });

        // Reset and update UI
        dailyData.calls.push(currentCall);
        currentCall = null;
        startCallBtn.classList.remove("active");
        behaviorSection.classList.add("d-none");
        resetBehaviorButtons();
        summaryCards.forEach((card) => card.classList.remove("active"));
        updateProgress();
        updateSummary();
        saveData();

        // Reset background color after call ends
        document.body.style.backgroundColor = "#f4f6f9";

        // Reset Timer Display
        timerDisplay.textContent = "00:00";
        timerDisplay.classList.remove("time-exceeded");

        startCallCard.style.display = "block";
        AOS.refresh(); // Refresh AOS to apply animations
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

        let summary = "T-Mobile Call Center Summary\n\n";
        dailyData.calls.forEach((call) => {
            const callDurationMinutes = Math.floor(call.duration / 60);
            const callDurationSeconds = call.duration % 60;
            const formattedDuration = `${padZero(callDurationMinutes)}:${padZero(callDurationSeconds)}`;
            summary += `ID: ${call.id}\n`;
            summary += `Behaviors Completed: ${call.behaviors.join(", ") || "None"}\n`;
            summary += `Duration: ${formattedDuration}\n\n`;
        });

        // Add overall statistics
        summary += "Daily Summary:\n";
        summary += `Total Calls: ${dailyData.calls.length}\n`;
        behaviorsConfig.forEach((behavior) => {
            const count = dailyData.behaviors[behavior.id] || 0;
            const percentage = ((count / dailyData.calls.length) * 100).toFixed(2);
            summary += `${behavior.name}: ${percentage}%\n`;
        });

        // Create a blob and download
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

    // Call updateProgress on page load and every time a behavior is toggled
    window.addEventListener("DOMContentLoaded", updateProgress);
    behaviorsList.addEventListener("click", updateProgress);

    // ASCII Art for Call Recap
    const cat = `
/\\_/\\
( o.o )
> ^ <
`;
});
