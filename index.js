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
        "I understand how you feel.",
        "I can see why that would be frustrating.",
        "I'm sorry you're experiencing this.",
      ],
      encouragements: [
        "Great empathy!",
        "Empathy at its best!",
        "You're showing excellent understanding!",
      ],
    },
    {
      id: "ownership",
      name: "Ownership Statement",
      examples: [
        "I will take care of this for you.",
        "Let me handle that for you.",
        "I'll ensure this gets resolved.",
      ],
      encouragements: [
        "Taking ownership!",
        "Excellent responsibility!",
        "Great initiative!",
      ],
    },
    {
      id: "accountAudit",
      name: "Account Audit",
      examples: [
        "Let me review your account status and balance.",
        "I'll check your account details.",
        "Allow me to audit your account for any discrepancies.",
      ],
      encouragements: [
        "Thorough audit!",
        "Detailed review!",
        "Comprehensive account check!",
      ],
    },
    {
      id: "checkIssues",
      name: "Check for Adjacent Issues",
      examples: [
        "Is there anything else I can assist you with?",
        "Do you have any other concerns?",
        "Can I help you with anything else today?",
      ],
      encouragements: [
        "Proactive support!",
        "Great initiative to help further!",
        "Ensuring complete assistance!",
      ],
    },
    {
      id: "nbaTool",
      name: "NBA Tool Offer",
      examples: [
        "I have some offers that might interest you.",
        "Let me share some exclusive deals with you.",
        "Would you like to hear about our latest offers?",
      ],
      encouragements: [
        "Offering great deals!",
        "Excellent offer presentation!",
        "Great value proposition!",
      ],
    },
    {
      id: "selfHelp",
      name: "Self Help Information",
      examples: [
        "I can send you a link with helpful information.",
        "Would you like some resources to help you further?",
        "Let me provide you with some self-help materials.",
      ],
      encouragements: [
        "Empowering the customer!",
        "Great support with resources!",
        "Providing valuable information!",
      ],
    },
    {
      id: "callRecap",
      name: "Call Recap",
      examples: [
        "To recap, here is what we discussed today...",
        "Let me summarize our conversation.",
        "Here's a summary of our call.",
      ],
      encouragements: [
        "Clear recap!",
        "Excellent summary!",
        "Well-articulated recap!",
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

  let currentCall = null;

  let dailyData = {
    calls: [],
    behaviors: {},
  };

  // Update Progress Bar
  function updateProgress() {
    if (!currentCall) {
      // Reset progress bar when no call is active
      const progressBar = document.getElementById("behaviorProgress");
      progressBar.style.width = "0%";
      progressBar.setAttribute("aria-valuenow", 0);
      document.getElementById("behaviorCount").textContent = "0";
      document.getElementById("totalBehaviors").textContent =
        behaviorsConfig.length.toString();
      return;
    }

    const totalBehaviors = behaviorsConfig.length;
    const completedBehaviors = currentCall.behaviors.length;
    const progressPercentage = (completedBehaviors / totalBehaviors) * 100;
    const progressBar = document.getElementById("behaviorProgress");
    progressBar.style.width = `${progressPercentage}%`;
    progressBar.setAttribute("aria-valuenow", Math.round(progressPercentage));
    document.getElementById("behaviorCount").textContent =
      completedBehaviors.toString();
    document.getElementById("totalBehaviors").textContent =
      totalBehaviors.toString();
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
      }
      updateSummary(); // Ensure updateSummary() is called after data is loaded or initialized
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
    };

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
    document.body.style.backgroundColor = "#e20074";
    startCallCard.style.display = "none";
  });

  const cat = `
  /\\_/\\
 ( o.o )
  > ^ <
`;

console.log(cat);


  // End Call Session with Auto-Copy
// End Call Session with Auto-Copy
endCallBtn.addEventListener("click", () => {
  if (!currentCall) return;

  // Map behavior IDs to their full names
  const behaviorNames = currentCall.behaviors.map(id => {
    const behavior = behaviorsConfig.find(b => b.id === id);
    return behavior ? behavior.name : id;
  });

  // Construct Call Recap
  let callRecap = `Call Recap:\n${
    behaviorNames.join(", ") || "None"
  }\n\n`;
  
  let fullRecap = `${cat}\nhttps://micah4thewin.github.io/calltracker/ \n${callRecap}`;

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
      summary += `ID: ${call.id}\n`;
      summary += `Behaviors Completed: ${
        call.behaviors.join(", ") || "None"
      }\n\n`;
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
});
