const table = document.getElementById('attendanceTable');

function formatDate(date) {
  return date.toLocaleDateString();
}

function formatTime(date) {
  return date.toLocaleTimeString();
}

async function saveAttendance(studentName) {
  const now = new Date();

  const date = formatDate(now);
  const time = formatTime(now);

  const todayKey = `${studentName}_${date}`;

  const existing = await db.collection('attendance').doc(todayKey).get();

  if (existing.exists) {
    alert('Attendance already recorded today');
    return;
  }

  await db.collection('attendance').doc(todayKey).set({
    student: studentName,
    date: date,
    time: time,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  addToTable(studentName, date, time);

  alert('Attendance Saved');
}

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

function onScanSuccess(decodedText) {
  saveAttendance(decodedText);
}

const html5QrCode = new Html5Qrcode("reader");

Html5Qrcode.getCameras().then(devices => {
  if (devices && devices.length) {
    html5QrCode.start(
      devices[0].id,
      {
        fps: 10,
        qrbox: 250
      },
      onScanSuccess
    );
  }
});