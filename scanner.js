// Load the QR Scanner engine directly into local scope
const script = document.createElement('script');
script.src = "https://unpkg.com/html5-qrcode";
document.head.appendChild(script);

// DOM Elements
const table = document.getElementById('attendanceTable');
const statusLabel = document.getElementById('scanStatus');

// Scanner Variables
let html5QrCode = null;
let cameras = [];
let currentCameraIndex = 0;
let scannerRunning = false;
let scanningEnabled = false;

// Append a visual row to the web table
function addToTable(student, date, time) {
  const row = `<tr><td>${student}</td><td>${date}</td><td>${time}</td></tr>`;
  table.innerHTML += row;
}

// Update the message color text layout
function updateStatus(message, isSuccess) {
  statusLabel.textContent = message;
  if (isSuccess) {
    statusLabel.className = "status-label status-success";
  } else {
    statusLabel.className = "status-label status-error";
  }
}

// ==========================================
// LOCAL STORAGE ATTENDANCE ENGINE
// ==========================================

// Load saved data from browser memory and display it in the table on start
function loadSavedAttendance() {
  const savedData = localStorage.getItem('attendanceRecords');
  if (savedData) {
    const records = JSON.parse(savedData);
    table.innerHTML = ""; // Clear table layout skeleton
    records.forEach(record => {
      addToTable(record.student, record.date, record.time);
    });
  }
}

// Save attendance data locally
function saveAttendanceLocally(studentName) {
  const now = new Date();
  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString();

  // Get current records array or make a new one if empty
  let records = [];
  const savedData = localStorage.getItem('attendanceRecords');
  if (savedData) {
    records = JSON.parse(savedData);
  }

  // Prevent duplicate attendance for the same student on the same day
  const isDuplicate = records.some(record => record.student === studentName && record.date === date);
  if (isDuplicate) {
    updateStatus(`Error: Attendance already recorded today for ${studentName}`, false);
    return;
  }

  // Push new record object into the local array
  records.push({ student: studentName, date: date, time: time });

  // Save the array back into the browser's permanent storage
  localStorage.setItem('attendanceRecords', JSON.stringify(records));

  // Instantly append to table interface
  addToTable(studentName, date, time);
  updateStatus(`Successfully scanned: ${studentName}`, true);
}

// Clear all local records function
function clearAllRecords() {
  if (confirm("Are you sure you want to clear all attendance data from this phone?")) {
    localStorage.removeItem('attendanceRecords');
    table.innerHTML = "";
    updateStatus("All records cleared successfully.", true);
  }
}

// Anti-spam timers
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

  console.log("Locally Parsed QR:", decodedText);
  saveAttendanceLocally(decodedText);
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
        fps: 30, // High-speed framing scan track speed
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.floor(minEdge * 0.75);
          return { width: boxSize, height: boxSize };
        },
        aspectRatio: 1.0,
        disableFlip: false
      },
      (decodedText) => {
        onScanSuccess(decodedText);
      },
      (errorMessage) => { /* Background tracker bypass */ }
    );

    scannerRunning = true;
    console.log("Scanner live.");

  } catch (err) {
    console.error(err);
    updateStatus("Critical: Camera initialization failed.", false);
  }
}

async function initScanner() {
  try {
    if (typeof Html5Qrcode === 'undefined') {
      setTimeout(initScanner, 200);
      return;
    }

    cameras = await Html5Qrcode.getCameras();
    if (!cameras || cameras.length === 0) {
      updateStatus("Error: No cameras detected.", false);
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
    updateStatus("Error: Grant camera access permissions.", false);
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

// Bind components securely on script execution run
script.onload = () => {
  document.getElementById("switchCamera").addEventListener("click", switchCamera);
  document.getElementById("scanButton").addEventListener("click", enableScan);
  document.getElementById("clearData").addEventListener("click", clearAllRecords);
  
  // Load any existing past student data out of the memory block
  loadSavedAttendance();
  initScanner();
};
