import { db } from './firebase-config.js';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const table = document.getElementById('attendanceTable');

// Scanner Variables
let html5QrCode;
let cameras = [];
let currentCameraIndex = 0;

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

  if (existing.exists()) {

    alert("Attendance already recorded today");

    return;
  }

  // Save to Firebase
  await setDoc(attendanceRef, {
    student: studentName,
    date: date,
    time: time,
    timestamp: serverTimestamp()
  });

  // Add to table instantly
  addToTable(studentName, date, time);

  alert(`Attendance Saved For ${studentName}`);
}

// Prevent repeated instant scans
let lastScanned = "";
let lastScanTime = 0;

// QR Scan Success
function onScanSuccess(decodedText) {

  const currentTime = Date.now();

  // Ignore same QR within 3 seconds
  if (
    decodedText === lastScanned &&
    currentTime - lastScanTime < 3000
  ) {
    return;
  }

  lastScanned = decodedText;
  lastScanTime = currentTime;

  console.log("Scanned:", decodedText);

  saveAttendance(decodedText);
}

// Start Scanner
async function startScanner(cameraId) {

  if (html5QrCode) {

    try {
      await html5QrCode.stop();
    } catch (e) {
      console.log("Scanner already stopped");
    }
  }

  html5QrCode = new Html5Qrcode("reader");

  html5QrCode.start(
    cameraId,
    {
      fps: 15,

      qrbox: {
        width: 250,
        height: 250
      },

      aspectRatio: 1.7778
    },
    onScanSuccess
  )

  .then(() => {

    console.log("Camera Started");

  })

  .catch(err => {

    console.error("Start Error:", err);

    alert("Failed to start camera");
  });
}

// Initialize Cameras
Html5Qrcode.getCameras()

.then(devices => {

  if (!devices || devices.length === 0) {

    alert("No cameras found");

    return;
  }

  cameras = devices;

  console.log("Available Cameras:", cameras);

  // Try to auto-select back camera
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
  startScanner(cameras[currentCameraIndex].id);

})

.catch(err => {

  console.error("Camera Error:", err);

  alert("Unable to access camera");

});

// Switch Camera Button
document.getElementById("switchCamera")
.addEventListener("click", async () => {

  if (cameras.length <= 1) {

    alert("Only one camera found");

    return;
  }

  // Next camera
  currentCameraIndex++;

  if (currentCameraIndex >= cameras.length) {
    currentCameraIndex = 0;
  }

  console.log(
    "Switching To:",
    cameras[currentCameraIndex].label
  );

  await startScanner(cameras[currentCameraIndex].id);

});
