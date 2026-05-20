import { db } from './firebase-config.js';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Load the QR Scanner directly as a module to fix the silent loading crash!
import { Html5Qrcode } from "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/+esm";

// DOM Elements
const table = document.getElementById('attendanceTable');
const statusLabel = document.getElementById('scanStatus');

// Scanner Variables
let html5QrCode = null;
let cameras = [];
let currentCameraIndex = 0;
let scannerRunning = false;
let scanningEnabled = false;

function addToTable(student, date, time) {
  const row = `<tr><td>${student}</td><td>${date}</td><td>${time}</td></tr>`;
  table.innerHTML += row;
}

function updateStatus(message, isSuccess) {
  statusLabel.textContent = message;
  if (isSuccess) {
    statusLabel.className = "status-label status-success";
  } else {
    statusLabel.className = "status-label status-error";
  }
}

async function saveAttendance(studentName) {
  try {
    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString();

    const todayKey = `${studentName}_${date}`;
    const attendanceRef = doc(db, "attendance", todayKey);
    const existing = await getDoc(attendanceRef);

    if (existing.exists()) {
      updateStatus(`Error: Attendance already recorded today for ${studentName}`, false);
      return;
    }

    await setDoc(attendanceRef, {
      student: studentName,
      date: date,
      time: time,
      timestamp: serverTimestamp()
    });

    addToTable(studentName, date, time);
    updateStatus(`Successfully scanned: ${studentName}`, true);

  } catch (error) {
    console.error("Firebase save error:", error);
    updateStatus("Error: Failed saving to database.", false);
  }
}

let lastScanned = "";
let lastScanTime = 0;

function onScanSuccess(decodedText) {
  if (!scanningEnabled) return;

  const currentTime = Date.now();
  if (decodedText === lastScanned && currentTime - lastScanTime < 3000) {
    return;
  }

  scanningEnabled = false; 
  lastScanned = decodedText;
  lastScanTime = currentTime;

  console.log("Scanned:", decodedText);
  saveAttendance(decodedText);
}

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
        fps: 24,
        // Using a fluid bounding box calculation to help the lens focus cleanly
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.floor(minEdge * 0.75); // 75% of screen size
          return { width: boxSize, height: boxSize };
        },
        aspectRatio: 1.0,
        disableFlip: false
      },
      (decodedText) => {
        onScanSuccess(decodedText);
      },
      (errorMessage) => {
        // Silent catch
      }
    );

    scannerRunning = true;
    console.log("Scanner engine is live!");

  } catch (err) {
    console.error("Scanner Start Error:", err);
    updateStatus("Critical: Camera initialization failed.", false);
  }
}

async function initScanner() {
  try {
    cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      updateStatus("Error: No cameras found.", false);
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
    console.error("Camera Init Error:", err);
    updateStatus("Error: Please grant camera access permissions.", false);
  }
}

async function switchCamera() {
  if (cameras.length <= 1) return;
  currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
  await startScanner(cameras[currentCameraIndex].id);
}

function enableScan() {
  scanningEnabled = true;
  updateStatus("Scanning active... point lens at QR code", true);
  statusLabel.className = "status-label";
}

// Boot setup securely after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("switchCamera").addEventListener("click", switchCamera);
    document.getElementById("scanButton").addEventListener("click", enableScan);
    initScanner();
  });
} else {
  document.getElementById("switchCamera").addEventListener("click", switchCamera);
  document.getElementById("scanButton").addEventListener("click", enableScan);
  initScanner();
}
