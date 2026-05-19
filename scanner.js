import { db } from './firebase-config.js';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const table = document.getElementById('attendanceTable');

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

  // Save attendance
  await setDoc(attendanceRef, {
    student: studentName,
    date: date,
    time: time,
    timestamp: serverTimestamp()
  });

  // Add to table instantly
  addToTable(studentName, date, time);

  // Success message
  alert("Attendance Saved Successfully");
}

// Prevent scanner from scanning same QR repeatedly instantly
let lastScanned = "";
let lastScanTime = 0;

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

  console.log("Scanned:", decodedText);

  saveAttendance(decodedText);
}

// Initialize Scanner
const html5QrCode = new Html5Qrcode("reader");

// Start Rear Camera
html5QrCode.start(
  {
    facingMode: "environment"
  },
  {
    fps: 15,
    qrbox: {
      width: 250,
      height: 250
    },
    aspectRatio: 1.7778
  },
  onScanSuccess
).catch(err => {

  console.error("Camera Error:", err);

  alert("Unable to access camera");
});
