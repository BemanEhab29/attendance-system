import { db } from './firebase-config.js';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const table = document.getElementById('attendanceTable');

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

  // Prevent duplicate attendance on same day
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

  // Success message
  alert(`Attendance Saved For ${studentName}`);
}

// Prevent instant repeated scans
let lastScanned = "";
let lastScanTime = 0;

// QR Scan Success
function onScanSuccess(decodedText) {

  const currentTime = Date.now();

  // Ignore duplicate scans within 3 seconds
  if (
    decodedText === lastScanned &&
    currentTime - lastScanTime < 3000
  ) {
    return;
  }

  lastScanned = decodedText;
  lastScanTime = currentTime;

  console.log("Scanned QR:", decodedText);

  saveAttendance(decodedText);
}

// Create scanner
const html5QrCode = new Html5Qrcode("reader");

// Get all cameras
Html5Qrcode.getCameras()

.then(devices => {

  if (!devices || devices.length === 0) {

    alert("No cameras found");

    return;
  }

  console.log("Available Cameras:", devices);

  let selectedCameraId = devices[0].id;

  // Try to find rear/back camera
  devices.forEach(device => {

    const label = device.label.toLowerCase();

    console.log("Camera:", label);

    if (
      label.includes("back") ||
      label.includes("rear") ||
      label.includes("environment")
    ) {

      selectedCameraId = device.id;
    }
  });

  console.log("Selected Camera:", selectedCameraId);

  // Start scanner
  html5QrCode.start(
    selectedCameraId,
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

  .catch(err => {

    console.error("Scanner Start Error:", err);

    alert("Failed to start scanner");
  });

})

.catch(err => {

  console.error("Camera Error:", err);

  alert("Unable to access camera");

});
