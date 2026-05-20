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

    // Prevent duplicate attendance entries on the same calendar day
    const todayKey = `${studentName}_${date}`;
    const attendanceRef = doc(db, "attendance", todayKey);
    const existing = await getDoc(attendanceRef);

    // Check if student already checked in today
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

// Triggered immediately when a QR code code matches successfully
function onScanSuccess(decodedText) {
  // Ignore processing if the physical "Scan QR" button wasn't armed
  if (!scanningEnabled) {
    return;
  }

  const currentTime = Date.now();

  // Ignore instant accidental double-scans of the exact same code within 3 seconds
  if (
    decodedText === lastScanned &&
    currentTime - lastScanTime < 3000
  ) {
    return;
  }

  // Lock the scanner immediately after one valid code is read
  scanningEnabled = false;

  lastScanned = decodedText;
  lastScanTime = currentTime;

  console.log("Scanned data target:", decodedText);
  saveAttendance(decodedText);
}

// Start Active Scanner Engine with Instant Full-Frame Reading configuration
async function startScanner(cameraId) {
  try {
    // Tear down any existing active stream cleanly before rebuilding
    if (html5QrCode && scannerRunning) {
      await html5QrCode.stop();
      await html5QrCode.clear();
      scannerRunning = false;
    }

    // Instantiate library scanner linked to the HTML view target
    html5QrCode = new Html5Qrcode("reader");

    // Initialize stream configurations
    await html5QrCode.start(
      cameraId,
      {
        fps: 30, // Increased frame rate to 30fps for ultra-fast response times

        // REMOVED rigid qrbox bounds completely. 
        // The engine now parses the entire live screen feed seamlessly.

        aspectRatio: 1.0,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Taps directly into native phone hardware acceleration
        }
      },
      (decodedText) => {
        console.log("QR Frame Catch:", decodedText);
        onScanSuccess(decodedText);
      },
      (errorMessage) => {
        // Suppress background noise framework frame logging text cleanly
      }
    );

    scannerRunning = true;
    console.log("Full-frame camera parser online.");

  } catch (err) {
    console.error("Scanner Video Crash:", err);
    updateStatus("Critical: Failed to hook video layout streams.", false);
  }
}

// Query browser camera peripherals 
async function initScanner() {
  try {
    cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      updateStatus("Initialization Error: No cameras detected on device.", false);
      return;
    }

    console.log("System Peripherals Found:", cameras);

    // Auto-fallback system to isolate rear structural lens models
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

    // Boot the primary chosen camera layout
    await startScanner(cameras[currentCameraIndex].id);

  } catch (err) {
    console.error("Device Capture Setup Crash:", err);
    updateStatus("Initialization Error: Check local browser hardware permissions.", false);
  }
}

// Toggle active phone lens sources 
async function switchCamera() {
  if (cameras.length <= 1) {
    updateStatus("System Info: Single physical lens detected.", false);
    return;
  }

  currentCameraIndex++;
  if (currentCameraIndex >= cameras.length) {
    currentCameraIndex = 0;
  }

  console.log("Toggling lens focus index target:", cameras[currentCameraIndex].label);
  await startScanner(cameras[currentCameraIndex].id);
}

// Triggered by "Scan QR" button to arm the camera lens scanner mechanism
function enableScan() {
  scanningEnabled = true;
  updateStatus("Scanning active... wave over a student QR code", true);
  // Revert back to neutral white text color status layout state while searching
  statusLabel.className = "status-label";
}

// Hook browser event triggers
document.getElementById("switchCamera").addEventListener("click", switchCamera);
document.getElementById("scanButton").addEventListener("click", enableScan);

// Fire application initialization routines immediately on component parse load
initScanner();
    updateStatus("Error: Failed saving data to the database.", false);
  }
}

// Anti-spam scan buffers
let lastScanned = "";
let lastScanTime = 0;

// Triggered immediately when a QR code code matches successfully
function onScanSuccess(decodedText) {
  // Ignore processing if the physical "Scan QR" button wasn't armed
  if (!scanningEnabled) {
    return;
  }

  const currentTime = Date.now();

  // Ignore instant accidental double-scans of the exact same code within 3 seconds
  if (
    decodedText === lastScanned &&
    currentTime - lastScanTime < 3000
  ) {
    return;
  }

  // Lock the scanner immediately after one valid code is read
  scanningEnabled = false;

  lastScanned = decodedText;
  lastScanTime = currentTime;

  console.log("Scanned data target:", decodedText);
  saveAttendance(decodedText);
}

// Start Active Scanner Engine with Instant Full-Frame Reading configuration
async function startScanner(cameraId) {
  try {
    // Tear down any existing active stream cleanly before rebuilding
    if (html5QrCode && scannerRunning) {
      await html5QrCode.stop();
      await html5QrCode.clear();
      scannerRunning = false;
    }

    // Instantiate library scanner linked to the HTML view target
    html5QrCode = new Html5Qrcode("reader");

    // Initialize stream configurations
    await html5QrCode.start(
      cameraId,
      {
        fps: 30, // Increased frame rate to 30fps for ultra-fast response times

        // REMOVED rigid qrbox bounds completely. 
        // The engine now parses the entire live screen feed seamlessly.

        aspectRatio: 1.0,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Taps directly into native phone hardware acceleration
        }
      },
      (decodedText) => {
        console.log("QR Frame Catch:", decodedText);
        onScanSuccess(decodedText);
      },
      (errorMessage) => {
        // Suppress background noise framework frame logging text cleanly
      }
    );

    scannerRunning = true;
    console.log("Full-frame camera parser online.");

  } catch (err) {
    console.error("Scanner Video Crash:", err);
    updateStatus("Critical: Failed to hook video layout streams.", false);
  }
}

// Query browser camera peripherals 
async function initScanner() {
  try {
    cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      updateStatus("Initialization Error: No cameras detected on device.", false);
      return;
    }

    console.log("System Peripherals Found:", cameras);

    // Auto-fallback system to isolate rear structural lens models
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

    // Boot the primary chosen camera layout
    await startScanner(cameras[currentCameraIndex].id);

  } catch (err) {
    console.error("Device Capture Setup Crash:", err);
    updateStatus("Initialization Error: Check local browser hardware permissions.", false);
  }
}

// Toggle active phone lens sources 
async function switchCamera() {
  if (cameras.length <= 1) {
    updateStatus("System Info: Single physical lens detected.", false);
    return;
  }

  currentCameraIndex++;
  if (currentCameraIndex >= cameras.length) {
    currentCameraIndex = 0;
  }

  console.log("Toggling lens focus index target:", cameras[currentCameraIndex].label);
  await startScanner(cameras[currentCameraIndex].id);
}

// Triggered by "Scan QR" button to arm the camera lens scanner mechanism
function enableScan() {
  scanningEnabled = true;
  updateStatus("Scanning active... wave over a student QR code", true);
  // Revert back to neutral white text color status layout state while searching
  statusLabel.className = "status-label";
}

// Hook browser event triggers
document.getElementById("switchCamera").addEventListener("click", switchCamera);
document.getElementById("scanButton").addEventListener("click", enableScan);

// Fire application initialization routines immediately on component parse load
initScanner();
