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
    id: "useVEA",
    name: "Use VEA",
    examples: [
      "Let me leverage VEA to find the best solution for you.",
      "I'll consult with VEA to resolve this efficiently.",
      "Using VEA, I'll ensure we address this issue effectively."
    ],
    encouragements: [
      "Great use of VEA!"
    ],
  },
  {
    id: "fixFlow",
    name: "Use the Fix Flow",
    examples: [
      "I'm following our Fix Flow to troubleshoot this systematically.",
      "Let's use the Fix Flow to make sure we cover all bases.",
      "The Fix Flow will guide us to the right solution."
    ],
    encouragements: [
      "Nice work using the Fix Flow!"
    ],
  },
  {
    id: "assureCallback",
    name: "Assure No Callback",
    examples: [
      "I'm here to make sure you don't have to call back, thank you for your time.",
      "Let's get this sorted so you don't need to call back.",
      "Your time is important, I'll resolve this to avoid future calls."
    ],
    encouragements: [
      "Excellent focus on customer satisfaction!"
    ],
  },
  {
    id: "accountDetails",
    name: "Go Over Account Details",
    examples: [
      "Let's review your current plan to see if you're missing out on any features.",
      "Checking your account, I see you might not be using all your benefits.",
      "Here's how we can enhance your experience with your current plan."
    ],
    encouragements: [
      "Good eye for detail!"
    ],
  },
  {
    id: "checkAdjacent",
    name: "Check for Adjacent Issues",
    examples: [
      "Before we dive in, let's make sure there's nothing else we need to address.",
      "Did we overlook another issue that needs attention?",
      "Let's tackle all related concerns upfront for efficiency."
    ],
    encouragements: [
      "Efficient thinking!"
    ],
  },
  {
    id: "selfHelp",
    name: "Send Self Help Links",
    examples: [
      "I'll email you some self-help resources so you can manage this issue later.",
      "Here's a link with tools to help you troubleshoot in the future.",
      "I'm sending you an email with guides for your account management."
    ],
    encouragements: [
      "Empowering customers with resources!"
    ],
  },
  {
    id: "tLifeApp",
    name: "Inform About T-Life App",
    examples: [
      "Did you know we have a new T-Life app? It can really enhance your T-Mobile experience.",
      "I recommend our new T-Life app for better control over your account.",
      "You might want to check out the T-Life app for more features."
    ],
    encouragements: [
      "Sharing the value of T-Life!"
    ],
  },
  {
    id: "personalGuarantee",
    name: "Send Personal Guarantee SMS",
    examples: [
      "I’m sending you a quick text to assure you we’ve got this covered.",
      "Here’s a personal guarantee message to give you peace of mind.",
      "I'll follow up with a text so you know we're committed to your satisfaction."
    ],
    encouragements: [
      "Exemplary trust-building!"
    ],
  },
  {
    id: "collectPastDue",
    name: "Account Status Check",
    examples: [
      "I noticed your account is past due, can we discuss a payment?",
      "To keep your service running smoothly, let's update your payment.",
      "Would you like to secure your service by adding a payment method?"
    ],
    encouragements: [
      "Proactive billing support!"
    ],
  },
  {
    id: "noCallbackEnd",
    name: "Reinforce No Callback",
    examples: [
      "Remember, you don't need to call back, we've got this covered.",
      "I've made sure you won't need to call us again for this issue.",
      "No need to call back, everything is settled."
    ],
    encouragements: [
      "Exceptional customer assurance!"
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
(｡◕‿◕｡)
`;


});
