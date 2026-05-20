import { db } from './firebase-config.js';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const table = document.getElementById('attendanceTable');
const statusLabel = document.getElementById('scanStatus');

// Scanner Variables
let html5QrCode = null;
let cameras = [];
let currentCameraIndex = 0;
let scannerRunning = false;
let scanningEnabled = false;

// Add attendance row to table UI
function addToTable(student, date, time) {
  const row = `
    <tr>
      <td>${student}</td>
      <td>${date}</td>
      <td>${time}</td>
    </tr>
  `;
  table.innerHTML += row;
}

// Helper to update the visual status label (Green for success, Red for error)
function updateStatus(message, isSuccess) {
  statusLabel.textContent = message;
  if (isSuccess) {
    statusLabel.className = "status-label status-success";
  } else {
    statusLabel.className = "status-label status-error";
  }
}

// Save attendance record to Firebase Firestore
async function saveAttendance(studentName) {
  try {
    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString();

    // Prevent duplicate entries on the exact same calendar day
    const todayKey = `${studentName}_${date}`;
    const attendanceRef = doc(db, "attendance", todayKey);
    const existing = await getDoc(attendanceRef);

    if (existing.exists()) {
      updateStatus(`Error: Attendance already recorded today for ${studentName}`, false);
      return;
    }

    // Write record to Firebase
    await setDoc(attendanceRef, {
      student: studentName,
      date: date,
      time: time,
      timestamp: serverTimestamp()
    });

    // Instantly append to the visual interface table
    addToTable(studentName, date, time);

    // Update label text to SUCCESS (Green)
    updateStatus(`Successfully scanned: ${studentName}`, true);

  } catch (error) {
    console.error("Firebase save error:", error);
    updateStatus("Error: Failed saving data to the database.", false);
  }
}

// Anti-spam scan buffers
let lastScanned = "";
let lastScanTime = 0;

// Triggered immediately when a QR code matches successfully
function onScanSuccess(decodedText) {
  if (!scanningEnabled) {
    return;
  }

  const currentTime = Date.now();

  // Ignore instant accidental double-scans within 3 seconds
  if (decodedText === lastScanned && currentTime - lastScanTime < 3000) {
    return;
  }

  scanningEnabled = false; // Lock scanning until button clicked again
  lastScanned = decodedText;
  lastScanTime = currentTime;

  console.log("Scanned data:", decodedText);
  saveAttendance(decodedText);
}

// Start Active Scanner Engine with Full-Frame Reading
async function startScanner(cameraId) {
  try {
    if (html5QrCode && scannerRunning) {
      await html5QrCode.stop();
      await html5QrCode.clear();
      scannerRunning = false;
    }

    html5QrCode = new Html5Qrcode("reader");

    await html5QrCode.start(
      cameraId,
      {
        fps: 30, // Fast frame scanning tracking
        aspectRatio: 1.0,
        disableFlip: false
      },
      (decodedText) => {
        onScanSuccess(decodedText);
      },
      (errorMessage) => {
        // Internal framework noise suppression
      }
    );

    scannerRunning = true;
    console.log("Camera parser online.");

  } catch (err) {
    console.error("Scanner Video Crash:", err);
    updateStatus("Critical: Failed to access camera feed.", false);
  }
}

// Query browser camera hardware 
async function initScanner() {
  try {
    if (typeof Html5Qrcode === 'undefined') {
      console.warn("Retrying camera initialization...");
      setTimeout(initScanner, 300);
      return;
    }

    cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      updateStatus("Initialization Error: No cameras detected.", false);
      return;
    }

    let backCameraIndex = 0;
    cameras.forEach((camera, index) => {
      const label = camera.label.toLowerCase();
      if (label.includes("back") || label.includes("rear") || label.includes("environment")) {
        backCameraIndex = index;
      }
    });

    currentCameraIndex = backCameraIndex;
    await startScanner(cameras[currentCameraIndex].id);

  } catch (err) {
    console.error("Device Capture Setup Crash:", err);
    updateStatus("Initialization Error: Check browser camera permissions.", false);
  }
}

// Toggle active phone lenses
async function switchCamera() {
  if (cameras.length <= 1) {
    updateStatus("System Info: Single physical lens detected.", false);
    return;
  }

  currentCameraIndex++;
  if (currentCameraIndex >= cameras.length) {
    currentCameraIndex = 0;
  }

  await startScanner(cameras[currentCameraIndex].id);
}

// Triggered by "Scan QR" button
function enableScan() {
  scanningEnabled = true;
  updateStatus("Scanning active... wave over a student QR code", true);
  statusLabel.className = "status-label"; // Neutral text color style while searching
}

// Register browser event triggers once DOM elements are stable
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("switchCamera").addEventListener("click", switchCamera);
  document.getElementById("scanButton").addEventListener("click", enableScan);
  initScanner();
});
