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

function loadSavedAttendance() {
  const savedData = localStorage.getItem('attendanceRecords');
  if (savedData) {
    const records = JSON.parse(savedData);
    table.innerHTML = ""; 
    records.forEach(record => {
      addToTable(record.student, record.date, record.time);
    });
  }
}

function saveAttendanceLocally(studentName) {
  const now = new Date();
  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString();

  let records = [];
  const savedData = localStorage.getItem('attendanceRecords');
  if (savedData) {
    records = JSON.parse(savedData);
  }

  const isDuplicate = records.some(record => record.student === studentName && record.date === date);
  if (isDuplicate) {
    updateStatus(`Error: Attendance already recorded today for ${studentName}`, false);
    return;
  }

  records.push({ student: studentName, date: date, time: time });
  localStorage.setItem('attendanceRecords', JSON.stringify(records));

  addToTable(studentName, date, time);
  updateStatus(`Successfully scanned: ${studentName}`, true);
}

function clearAllRecords() {
  if (confirm("Are you sure you want to clear all attendance data from this phone?")) {
    localStorage.removeItem('attendanceRecords');
    table.innerHTML = "";
    updateStatus("All records cleared successfully.", true);
  }
}

// ==========================================
// EXPORT TO PDF ENGINE
// ==========================================
function exportToPDF() {
  const element = document.getElementById('pdfTarget');
  
  // Quick safety check: don't export a blank table layout shell
  if (table.rows.length === 0) {
    alert("There are no attendance records to export yet!");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  
  // Setup configuration options for the PDF rendering generator
    const options = {
    margin:       15,
    filename:     `Attendance_Report_${today}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: "#ffffff" }, // Changed to clean white background for PDF!
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  updateStatus("Generating PDF sheet...", true);

  // Execute the engine command sequence
  html2pdf().set(options).from(element).save().then(() => {
    updateStatus("PDF downloaded successfully!", true);
  }).catch(err => {
    console.error("PDF engine crash:", err);
    updateStatus("Error: Failed to build layout document.", false);
  });
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
        fps: 30,
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
      (errorMessage) => {}
    );

    scannerRunning = true;
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

function enableScan() {
  scanningEnabled = true;
  updateStatus("Scanning active... point lens at QR code", true);
  statusLabel.className = "status-label";
}

// Bind event triggers
script.onload = () => {
  document.getElementById("scanButton").addEventListener("click", enableScan);
  document.getElementById("clearData").addEventListener("click", clearAllRecords);
  document.getElementById("exportPdf").addEventListener("click", exportToPDF);
  
  loadSavedAttendance();
  initScanner();
};
