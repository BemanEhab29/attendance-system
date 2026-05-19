import { db } from './firebase-config.js';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Attendance Table
const table = document.getElementById('attendanceTable');

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

// Save attendance to Firebase
async function saveAttendance(studentName) {

  const now = new Date();

  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString();

  // Prevent duplicate attendance same day
  const todayKey = `${studentName}_${date}`;

  const attendanceRef = doc(db, "attendance", todayKey);

  const existing = await getDoc(attendanceRef);

  // Already scanned today
  if (existing.exists()) {

    alert("Attendance already recorded today");

    return;
  }

  // Save attendance
  await setDoc(attendanceRef, {
    student: studentName,
    date: date,
    time: time,
    timestamp: serverTimestamp()
  });

  // Add instantly to table
  addToTable(studentName, date, time);

  // Success
  alert(`Attendance Saved For ${studentName}`);
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

  // Disable scanning immediately after one scan
  scanningEnabled = false;

  lastScanned = decodedText;
  lastScanTime = currentTime;

  console.log("Scanned:", decodedText);

  saveAttendance(decodedText);
}

// Start Scanner
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

    // Start camera
    await html5QrCode.start(

      cameraId,

      {
        fps: 20,

        qrbox: {
          width: 300,
          height: 300
        },

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
        // Ignore scan errors silently
      }
    );

    scannerRunning = true;

    console.log("Scanner Started");

  } catch (err) {

    console.error("Scanner Error:", err);

    alert("Failed to start camera");
  }
}

// Initialize Cameras
async function initScanner() {

  try {

    cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {

      alert("No cameras found");

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

    // Start selected camera
    await startScanner(cameras[currentCameraIndex].id);

  } catch (err) {

    console.error("Camera Init Error:", err);

    alert("Unable to access camera");
  }
}

// Switch Camera
async function switchCamera() {

  if (cameras.length <= 1) {

    alert("Only one camera found");

    return;
  }

  currentCameraIndex++;

  if (currentCameraIndex >= cameras.length) {
    currentCameraIndex = 0;
  }

  console.log(
    "Switching To:",
    cameras[currentCameraIndex].label
  );

  await startScanner(cameras[currentCameraIndex].id);
}

// Manual Scan Button
function enableScan() {

  scanningEnabled = true;

  console.log("Ready To Scan...");
}

// Switch Camera Button
document
.getElementById("switchCamera")
.addEventListener("click", switchCamera);

// Scan QR Button
document
.getElementById("scanButton")
.addEventListener("click", enableScan);

// Start Everything
initScanner();
