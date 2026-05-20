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

// Manual Scan Control
let scanningEnabled = false;

// Add attendance row to table
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

// Helper to update the visual status label
function updateStatus(message, isSuccess) {
  statusLabel.textContent = message;
  if (isSuccess) {
    statusLabel.className = "status-label status-success";
  } else {
    statusLabel.className = "status-label status-error";
  }
}

// Save attendance to Firebase
async function saveAttendance(studentName) {
  try {
    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString();

    // Prevent duplicate attendance same day
    const todayKey = `${studentName}_${date}`;
    const attendanceRef = doc(db, "attendance", todayKey);
    const existing = await getDoc(attendanceRef);

    // Already scanned today
    if (existing.exists()) {
      updateStatus(`Error: Attendance already recorded today for ${studentName}`, false);
      return;
    }

    // Save attendance to Firestore
    await setDoc(attendanceRef, {
      student: studentName,
      date: date,
      time: time,
      timestamp: serverTimestamp()
    });

    // Add instantly to UI table
    addToTable(studentName, date, time);

    // Update label to SUCCESS (Green)
    updateStatus(`Successfully scanned: ${studentName}`, true);

  } catch (error) {
    console.error("Firebase save error:", error);
    updateStatus("Error: Failed saving to database.", false);
  }
}

// Prevent repeated instant scans
let lastScanned = "";
let lastScanTime = 0;

// QR Scan Success
function onScanSuccess(decodedText) {
  // Ignore if scan button not pressed
  if (!scanningEnabled) {
    return;
  }

  const currentTime = Date.now();

  // Ignore duplicate scans within 3 seconds
  if (
    decodedText === lastScanned &&
    currentTime - lastScanTime < 3000
  ) {
    return;
  }

  // Disable scanning immediately after one scan happens
  scanningEnabled = false;

  lastScanned = decodedText;
  lastScanTime = currentTime;

  console.log("Scanned:", decodedText);
  saveAttendance(decodedText);
}

// Start Scanner Engine
async function startScanner(cameraId) {
  try {
    // Stop old scanner safely
    if (html5QrCode && scannerRunning) {
      await html5QrCode.stop();
      await html5QrCode.clear();
      scannerRunning = false;
    }

    // Create scanner
    html5QrCode = new Html5Qrcode("reader");

    // Start camera stream
    await html5QrCode.start(
      cameraId,
      {
        fps: 20,
        qrbox: { width: 300, height: 300 },
        aspectRatio: 1.0,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      },
      (decodedText) => {
        console.log("QR Detected:", decodedText);
        onScanSuccess(decodedText);
      },
      (errorMessage) => {
        // Ignore internal scanner lookup chatter safely
      }
    );

    scannerRunning = true;
    console.log("Scanner Started");

  } catch (err) {
    console.error("Scanner Error:", err);
    updateStatus("Critical: Failed to access video feed.", false);
  }
}

// Initialize System Cameras
async function initScanner() {
  try {
    cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      updateStatus("Initialization Error: No cameras found.", false);
      return;
    }

    console.log("Available Cameras:", cameras);

    // Auto-select rear camera
    let backCameraIndex = 0;
    cameras.forEach((camera, index) => {
      const label = camera.label.toLowerCase();
      if (
        label.includes("back") ||
        label.includes("rear") ||
        label.includes("environment")
      ) {
        backCameraIndex = index;
      }
    });

    currentCameraIndex = backCameraIndex;

    // Run camera initialization
    await startScanner(cameras[currentCameraIndex].id);

  } catch (err) {
    console.error("Camera Init Error:", err);
    updateStatus("Initialization Error: Check camera browser permissions.", false);
  }
}

// Switch Active Camera
async function switchCamera() {
  if (cameras.length <= 1) {
    updateStatus("System Info: Only one camera detected.", false);
    return;
  }

  currentCameraIndex++;
  if (currentCameraIndex >= cameras.length) {
    currentCameraIndex = 0;
  }

  console.log("Switching To:", cameras[currentCameraIndex].label);
  await startScanner(cameras[currentCameraIndex].id);
}

// Manual Scan Button handler
function enableScan() {
  scanningEnabled = true;
  updateStatus("Scanning active... point at a QR code", true); 
  // Displays white/neutral text until success or failure changes it
  statusLabel.className = "status-label"; 
}

// Event Listeners
document.getElementById("switchCamera").addEventListener("click", switchCamera);
document.getElementById("scanButton").addEventListener("click", enableScan);

// Boot up everything on page ready
initScanner();
