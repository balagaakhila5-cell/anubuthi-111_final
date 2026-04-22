<<<<<<< HEAD
const app = document.getElementById("app");
const mobileInput = document.getElementById("mobileNumber");
const loginBtn = document.getElementById("loginBtn");
const errorMessage = document.getElementById("errorMessage");

let loggedInStudent = null;
let activeTab = "admit";

const SHEET_ID = "1BpM8tATcqrShbne4fS_kLFQV7uuee1AX7u3Q5uC772I";

const SHEETS = [
  { gid: "1370512469", slot: "NEW DELHI GS" },
  { gid: "1628651856", slot: "PUNE GS" },
  { gid: "998425198", slot: "HYDERABAD GS" },
  { gid: "1425456635", slot: "GS ONLINE" },
  { gid: "153930879", slot: "NEW DELHI CSAT" },
  { gid: "61722243", slot: "PUNE CSAT" },
  { gid: "1578514353", slot: "HYDERABAD CSAT" },
  { gid: "1191610167", slot: "CSAT ONLINE" }
];

if (mobileInput && loginBtn) {
  mobileInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "");
    errorMessage.textContent = "";
  });

  loginBtn.addEventListener("click", async function () {
    const mobileNumber = mobileInput.value.trim();

    if (mobileNumber === "") {
      alert("Please enter your 10 digit mobile number");
      return;
    }

    if (mobileNumber.length < 10) {
      alert("User must enter 10 digits");
      return;
    }

    if (mobileNumber.length > 10) {
      alert("Mobile number should contain only 10 digits");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      errorMessage.textContent =
        "Invalid credential please enter correct phone number";
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Checking...";
    errorMessage.textContent = "";

    try {
      const students = await fetchStudentsFromGoogleSheetCSV();

      const student = students.find((item) => {
        return String(item.mobile).replace(/\D/g, "") === mobileNumber;
      });

      if (!student) {
        errorMessage.textContent =
          "Invalid credential please enter correct phone number";
        return;
      }

      loggedInStudent = student;
      activeTab = "admit";
      renderDashboard();
    } catch (err) {
      console.error("Sheet fetch error:", err);
      errorMessage.textContent =
        "Unable to fetch data. Please check Google Sheet sharing settings.";
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Login →";
    }
  });
}

async function fetchStudentsFromGoogleSheetCSV() {
  const studentMap = new Map();

  for (let i = 0; i < SHEETS.length; i++) {
    const sheetInfo = SHEETS[i];
    const gid = sheetInfo.gid;
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;

    const response = await fetch(url);

    if (!response.ok) continue;

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (!rows.length) continue;

    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1);

    const rawData = dataRows.map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] ? row[index].trim() : "";
      });
      return obj;
    });

    for (const row of rawData) {
      const normalizedRow = normalizeStudentRow(row, sheetInfo);

      if (!normalizedRow.mobile) continue;

      if (!studentMap.has(normalizedRow.mobile)) {
        studentMap.set(
          normalizedRow.mobile,
          createBaseStudent(normalizedRow.mobile, normalizedRow)
        );
      }

      const existingStudent = studentMap.get(normalizedRow.mobile);
      mergeStudentData(existingStudent, normalizedRow);
    }
  }

  const finalStudents = Array.from(studentMap.values()).map(finalizeStudent);
  return finalStudents;
}

function createBaseStudent(mobile, rowData = {}) {
  return {
    mobile,
    name: rowData.name || "Student",
    city: rowData.city || "",
    venue: rowData.venue || "",
    examDate: "April 18th Saturday, 2026",
    rank: "-",
    gsPaper: null,
    csatPaper: null,
    gsAir: "",
    csatAir: "",
    timings: {
      gs: "9:30 AM - 11:30 AM",
      csat: "2:30 PM - 4:30 PM"
    },
    instructions: [
      "The mobile number filled in the OMR Sheet will be treated as the roll number and results can be accessed using the same mobile number only.",
      "You must report at the Examination Center 30 minutes prior to the commencement of the exam.",
      "Candidates can give tests only at the assigned examination venue and allotted examination time.",
      "Fill Name, Mobile no. and other details carefully."
    ]
  };
}

function mergeStudentData(existingStudent, incomingRow) {
  if (!existingStudent.name || existingStudent.name === "Student") {
    existingStudent.name = incomingRow.name || existingStudent.name;
  }

  if (!existingStudent.city) {
    existingStudent.city = incomingRow.city || existingStudent.city;
  }

  if (!existingStudent.venue) {
    existingStudent.venue = incomingRow.venue || existingStudent.venue;
  }

  if (incomingRow.gsTiming) {
    existingStudent.timings.gs = incomingRow.gsTiming;
  }

  if (incomingRow.csatTiming) {
    existingStudent.timings.csat = incomingRow.csatTiming;
  }

  if (incomingRow.paperType === "GS" && incomingRow.paperData) {
    existingStudent.gsPaper = incomingRow.paperData;

    if (incomingRow.airValue !== "") {
      existingStudent.gsAir = incomingRow.airValue;
      existingStudent.rank = incomingRow.airValue;
    }

    if (!existingStudent.city && incomingRow.city) {
      existingStudent.city = incomingRow.city;
    }

    if (!existingStudent.venue && incomingRow.venue) {
      existingStudent.venue = incomingRow.venue;
    }
  }

  if (incomingRow.paperType === "CSAT" && incomingRow.paperData) {
    existingStudent.csatPaper = incomingRow.paperData;

    if (incomingRow.airValue !== "" && !existingStudent.rank) {
      existingStudent.csatAir = incomingRow.airValue;
      existingStudent.rank = incomingRow.airValue;
    }

    if (!existingStudent.city && incomingRow.city) {
      existingStudent.city = incomingRow.city;
    }

    if (!existingStudent.venue && incomingRow.venue) {
      existingStudent.venue = incomingRow.venue;
    }
  }
}

function finalizeStudent(student) {
  const papers = [];

  if (student.gsPaper) {
    papers.push(student.gsPaper);
  }

  if (student.csatPaper) {
    papers.push(student.csatPaper);
  }

  const hasResultData = papers.length > 0;

  let rank = student.rank;
  if (
    (!rank || rank === "-") &&
    student.gsPaper &&
    student.gsPaper.score !== undefined
  ) {
    rank = generateRankFromScore(student.gsPaper.score);
  }

  return {
    mobile: student.mobile,
    name: student.name || "Student",
    city: student.city || "",
    venue: student.venue || student.city || "Delhi",
    examDate: student.examDate,
    rank: rank || "-",
    papers,
    instructions: student.instructions,
    timings: [
      {
        subject: "Paper I (General Studies)",
        time: student.timings.gs || "9:30 AM - 11:30 AM"
      },
      {
        subject: "Paper II (CSAT)",
        time: student.timings.csat || "2:30 PM - 4:30 PM"
      }
    ],
    originalScore: student.gsPaper ? Number(student.gsPaper.score || 0) : null,
    hasResultData
  };
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }

      row.push(current);

      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getField(row, possibleKeys) {
  const rowKeys = Object.keys(row);
  const normalizedMap = {};

  rowKeys.forEach((key) => {
    normalizedMap[normalizeKey(key)] = row[key];
  });

  for (const key of possibleKeys) {
    const value = normalizedMap[normalizeKey(key)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function normalizeStudentRow(row, sheetInfo = {}) {
  const mobile = getField(row, [
    "Phone Number",
    "PhoneNumber",
    "Phone",
    "Mob No",
    "Mob No.",
    "Mobile",
    "Mobile No",
    "Mobile Number",
    "Contact Number"
  ])
    .replace(/\D/g, "")
    .trim();

  const name =
    getField(row, ["Name", "Candidate Name", "Student Name"]) || "Student";

  const city =
    getField(row, ["City", "Centre", "Center", "Venue"]) ||
    extractCityFromSlot(sheetInfo.slot);

  const venue =
    getField(row, [
      "Venue",
      "Centre",
      "Center",
      "Test Centre",
      "Test Center",
      "City"
    ]) ||
    city ||
    "Delhi";

  const gsTiming =
    getField(row, [
      "GS Paper I Slot",
      "GS Slot",
      "Paper I Slot",
      "Paper 1 Slot",
      "General Studies",
      "GS Paper"
    ]) || "9:30 AM - 11:30 AM";

  const csatTiming =
    getField(row, [
      "CSAT",
      "CSAT Slot",
      "Paper II Slot",
      "Paper 2 Slot",
      "GS Pap CSAT",
      "Paper II : CSAT"
    ]) || "2:30 PM - 4:30 PM";

  const correct = normalizeNumber(
    getField(row, ["Correct", "Paper I Correct", "GS Correct"])
  );

  const incorrect = normalizeNumber(
    getField(row, ["Incorrect", "Paper I Incorrect", "GS Incorrect"])
  );

  const blank = normalizeNumber(
    getField(row, ["Blank", "Paper I Blank", "GS Blank"])
  );

  const sheetScore = normalizeNumber(
    getField(row, ["Score", "Paper I Score", "GS Score"])
  );

  const airValue = getField(row, ["AIR", "Air", "Rank", "RANK"]);

  const hasScoreColumns =
    rowHasValue(getField(row, ["Correct"])) ||
    rowHasValue(getField(row, ["Incorrect"])) ||
    rowHasValue(getField(row, ["Blank"])) ||
    rowHasValue(getField(row, ["Score"])) ||
    rowHasValue(getField(row, ["Paper I Correct"])) ||
    rowHasValue(getField(row, ["Paper I Incorrect"])) ||
    rowHasValue(getField(row, ["Paper I Blank"])) ||
    rowHasValue(getField(row, ["Paper I Score"])) ||
    rowHasValue(getField(row, ["GS Correct"])) ||
    rowHasValue(getField(row, ["GS Incorrect"])) ||
    rowHasValue(getField(row, ["GS Blank"])) ||
    rowHasValue(getField(row, ["GS Score"]));

  const derivedScore =
    hasScoreColumns && !Number.isNaN(sheetScore)
      ? sheetScore
      : calculateScore(correct, incorrect);

  const isCSATSheet = String(sheetInfo.slot || "").toUpperCase().includes("CSAT");
  const isGSSheet =
    String(sheetInfo.slot || "").toUpperCase().includes("GS") && !isCSATSheet;

  let paperType = "";
  let paperData = null;

  if (isGSSheet && hasScoreColumns) {
    paperType = "GS";
    paperData = {
      paper: "Paper I : General Studies",
      correct,
      incorrect,
      blank,
      score: !Number.isNaN(sheetScore) ? sheetScore : derivedScore
    };
  }

  if (isCSATSheet && hasScoreColumns) {
    paperType = "CSAT";
    paperData = {
      paper: "Paper II : CSAT",
      correct,
      incorrect,
      blank,
      score: !Number.isNaN(sheetScore) ? sheetScore : derivedScore
    };
  }

  return {
    mobile,
    name,
    city,
    venue,
    gsTiming,
    csatTiming,
    paperType,
    paperData,
    airValue
  };
}

function extractCityFromSlot(slot) {
  const value = String(slot || "").toLowerCase();

  if (value.includes("hyderabad")) return "Hyderabad";
  if (value.includes("pune")) return "Pune";
  if (value.includes("delhi")) return "Delhi";
  if (value.includes("online")) return "Online";

  return "";
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isNaN(parsed) ? 0 : parsed;
}

function rowHasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function calculateScore(correct, incorrect) {
  const score = Number(correct) * 2 - Number(incorrect) * 0.67;
  return Number(score.toFixed(2));
}

function generateRankFromScore(score) {
  if (score >= 110) return 25;
  if (score >= 100) return 50;
  if (score >= 90) return 90;
  if (score >= 80) return 140;
  if (score >= 70) return 200;
  if (score >= 60) return 260;
  if (score >= 50) return 320;
  if (score >= 40) return 400;
  return 500;
}

function calculateTrendScore(student) {
  if (
    student.originalScore !== null &&
    student.originalScore !== undefined &&
    !Number.isNaN(student.originalScore)
  ) {
    return Number(student.originalScore);
  }

  const firstPaper = student.papers[0];
  if (!firstPaper) return 0;

  return calculateScore(firstPaper.correct, firstPaper.incorrect);
}

function getAnalysisData(student) {
  const firstPaper = student.papers[0];

  if (!firstPaper) {
    return {
      correct: 0,
      incorrect: 0,
      blank: 0,
      total: 0
    };
  }

  const total = firstPaper.correct + firstPaper.incorrect + firstPaper.blank;

  return {
    correct: firstPaper.correct,
    incorrect: firstPaper.incorrect,
    blank: firstPaper.blank,
    total
  };
}

function renderDashboard() {
  if (!loggedInStudent) return;

  app.innerHTML = `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar-logo-row">
          <img src="./assets/logos-40-years 1.png" class="sidebar-years-logo" alt="40 years" />
          <img src="./assets/SRIRAM's-IAS.png" class="sidebar-logo" alt="Sriram IAS" />
        </div>

        <div class="side-nav">
          <button class="side-btn ${activeTab === "admit" ? "active" : ""}" id="admitTabBtn">Admit Card</button>
          <button class="side-btn ${activeTab === "result" ? "active" : ""}" id="resultTabBtn">Result</button>
        </div>

        <div class="general-info">
          <div class="general-info-title">General Information</div>
          <ul class="general-info-list">
            <li>Result of ANUBHUTHI III will be declared within 72 hours.</li>
            <li>Detailed video analysis and test discussion will be available on our official YouTube channel.</li>
            <li>For updates, keep visiting our website.</li>
          </ul>
        </div>

        <div class="logout-wrap">
          <button id="logoutBtn" class="logout-btn">↪ Logout</button>
        </div>
      </aside>

      <main class="main-panel">
        ${activeTab === "admit" ? renderAdmitCardPage() : renderResultPage()}
      </main>
    </div>

    <div id="printAdmitCard" class="print-admit"></div>
  `;

  const admitBtn = document.getElementById("admitTabBtn");
  const resultBtn = document.getElementById("resultTabBtn");
  const downloadBtn = document.getElementById("downloadAdmitBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      loggedInStudent = null;
      activeTab = "admit";
      location.reload();
    });
  }

  if (admitBtn) {
    admitBtn.addEventListener("click", function () {
      activeTab = "admit";
      renderDashboard();
    });
  }

  if (resultBtn) {
    resultBtn.addEventListener("click", function () {
      if (!loggedInStudent.hasResultData) {
        alert("The result will be released soon! Stay updated with our official website.");
        return;
      }

      activeTab = "result";
      renderDashboard();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadAdmitCard);
  }
}

function renderAdmitCardPage() {
  const student = loggedInStudent;

  const instructionsHtml = student.instructions
    .map((item) => `<div class="instruction-item">${escapeHtml(item)}</div>`)
    .join("");

  return `
    <div class="admit-page-wrap">
      <h1 class="admit-page-title">ANUBUTHI III</h1>

      <div class="admit-layout">
        <div class="admit-center-column">
          <div class="student-card">
            <div class="student-card-title">CANDIDATE DETAILS</div>

            <div class="avatar-circle">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"></path>
                <path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path>
              </svg>
            </div>

            <div class="student-name">${escapeHtml(student.name)}</div>
            <div class="student-mobile">${escapeHtml(student.mobile)}</div>

            <div class="student-city">
              <span class="location-icon-svg" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"></path>
                  <circle cx="12" cy="10" r="2.3"></circle>
                </svg>
              </span>
              <span>${escapeHtml(student.venue)}</span>
            </div>

            <button id="downloadAdmitBtn" class="download-btn">
              Download Admit Card ⬇
            </button>
          </div>

          <div class="bottom-assistance">
            <span>🎧</span>
            <div>For any Assistance call <span>9811489560</span></div>
          </div>
        </div>

        <div class="instructions-box">
          <div class="instructions-title">IMPORTANT INSTRUCTIONS</div>
          <div class="instructions-marquee">
            <div class="instructions-track">
              ${instructionsHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderResultPage() {
  const student = loggedInStudent;

  if (!student.hasResultData) {
    return `
      <div class="result-page-wrap">
        <div class="result-main-title">CANDIDATE DETAILS</div>
        <div class="result-coming-soon">
          <h3>The result will be released soon!</h3>
          <p>Stay updated with our official website.</p>
        </div>
      </div>
    `;
  }

  const trendScore = calculateTrendScore(student);
  const analysis = getAnalysisData(student);

  const paperRows = student.papers
    .map((paper) => {
      const displayScore =
        paper.score !== undefined && paper.score !== null && paper.score !== ""
          ? Number(paper.score).toFixed(2)
          : calculateScore(paper.correct, paper.incorrect).toFixed(2);

      return `
        <tr>
          <td>${paper.paper}</td>
          <td class="correct">${paper.correct}</td>
          <td class="incorrect">${paper.incorrect}</td>
          <td>${paper.blank}</td>
          <td class="score">${displayScore}</td>
        </tr>
      `;
    })
    .join("");

  const total = analysis.total || 1;
  const correctPercent = ((analysis.correct / total) * 100).toFixed(2);
  const incorrectPercent = ((analysis.incorrect / total) * 100).toFixed(2);

  const donutStyle = `
    conic-gradient(
      #22c55e 0% ${correctPercent}%,
      #ef4444 ${correctPercent}% ${Number(correctPercent) + Number(incorrectPercent)}%,
      #f97316 ${Number(correctPercent) + Number(incorrectPercent)}% 100%
    )
  `;

  return `
    <div class="result-page-wrap">
      <div class="result-main-title">CANDIDATE DETAILS</div>

      <div class="student-top-row">
        <div class="student-meta">
          <span>${escapeHtml(student.name)}</span>
          <span>|</span>
          <span>${escapeHtml(student.mobile)}</span>
        </div>

        <div class="rank-box-wrap">
          <div class="rank-title">All India Rank</div>
          <div class="rank-box">${escapeHtml(student.rank)}</div>
        </div>
      </div>

      <div class="card-box">
        <div class="section-heading">📋 Detailed Results</div>

        <table class="detail-table">
          <thead>
            <tr>
              <th>Paper</th>
              <th>Correct</th>
              <th>Incorrect</th>
              <th>Blank</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${paperRows}
          </tbody>
        </table>
      </div>

      <div class="result-bottom-grid">
        <div class="chart-box">
          <div class="section-heading">📈 Performance Trend</div>

          <div class="chart-area">
            ${renderChartGrid()}
            <div 
              class="chart-dot-with-tooltip"
              style="bottom:${(Math.min(trendScore, 100) / 100) * 220}px;"
            >
              <div class="chart-tooltip">
                <div>Current Test</div>
                <div>Score: ${trendScore.toFixed(2)}</div>
              </div>
              <div class="chart-dot"></div>
            </div>
            <div class="x-label">Current Test</div>
          </div>
        </div>

        <div class="chart-box">
          <div class="section-heading">📋 Analysis Breakdown</div>

          <div class="donut-wrap">
            <div class="donut-chart" style="background:${donutStyle}">
              <div class="donut-center">${trendScore.toFixed(2)}</div>
            </div>
          </div>

          <div class="legend">
            <div class="legend-item"><span class="legend-color" style="background:#22c55e;"></span>Correct</div>
            <div class="legend-item"><span class="legend-color" style="background:#ef4444;"></span>Incorrect</div>
            <div class="legend-item"><span class="legend-color" style="background:#f97316;"></span>Blank</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderChartGrid() {
  const labels = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

  return labels
    .map((label, index) => {
      const top = (index / (labels.length - 1)) * 220;
      return `
        <div class="grid-line" style="top:${top}px;"></div>
        <div class="y-label" style="top:${top - 8}px;">${label}</div>
      `;
    })
    .join("");
}

function downloadAdmitCard() {
  const student = loggedInStudent;
  const printBox = document.getElementById("printAdmitCard");

  if (!printBox || !student) return;

  printBox.innerHTML = `
  <div class="print-sheet">

    <div class="print-logo-row">
      <img src="./assets/logos-40-years 1.png" class="print-years-logo" />
      <img src="./assets/SRIRAM's-IAS.png" class="print-main-logo" />
    </div>

    <div class="print-brand-line">
      Serving The Nation Since 1985
    </div>

    <div class="print-main-title">ANUBUTHI III</div>
    <div class="print-sub-title">All India Open Mock Test 2026</div>
    <div class="print-admit-title">e-Admit Card</div>

    <table class="print-info-table">
      <tr>
        <td>Name</td>
        <td>${escapeHtml(student.name)}</td>
      </tr>
      <tr>
        <td>Mobile No.</td>
        <td>${escapeHtml(student.mobile)}</td>
      </tr>
      <tr>
        <td>Venue of Examination</td>
        <td>${escapeHtml(student.venue)}</td>
      </tr>
    </table>

    <table class="print-time-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Timing</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(student.timings[0]?.subject || "Paper I (General Studies)")}</td>
          <td>${escapeHtml(student.timings[0]?.time || "9:30 AM - 11:30 AM")}</td>
        </tr>
        <tr>
          <td>${escapeHtml(student.timings[1]?.subject || "Paper II (CSAT)")}</td>
          <td>${escapeHtml(student.timings[1]?.time || "2:30 PM - 4:30 PM")}</td>
        </tr>
      </tbody>
    </table>

    <div class="print-instruction-heading">INSTRUCTIONS</div>

    <ul class="print-instructions">
      <li>The mobile number filled in the OMR Sheet will be treated as the roll number and results can be accessed using the same mobile number only.</li>
      <li>You must report at the Examination Center 30 minutes prior to the commencement of the exam.</li>
      <li>Candidates can give tests only at the assigned examination venue and allotted examination time.</li>
      <li>Fill Name, Mobile no. and other details carefully.</li>
    </ul>

    <div class="print-assistance">
      <span class="headphone-icon">🎧</span>
      <span>For any Assistance call <b>9811489560</b></span>
    </div>

  </div>
`;

  const originalContent = document.body.innerHTML;

  document.body.innerHTML = `
    <style>
      @page {
        size: A4;
        margin: 16mm;
      }

      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
      }

      .print-sheet {
        width: 100%;
        background: #ffffff;
        color: #111111;
      }

      .print-top-title {
        text-align: center;
        margin-bottom: 16px;
      }

      .print-top-title h1 {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 30px;
        color: #0c0b58;
        margin: 0 0 4px;
      }

      .mock-line {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 2px;
      }

      .admit-line {
        font-size: 19px;
        font-weight: 700;
      }

      .print-info-row {
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 10px;
        padding: 8px 0;
        font-size: 17px;
      }

      .print-info-label {
        font-weight: 700;
      }

      .print-section-title {
        margin-top: 20px;
        margin-bottom: 10px;
        font-size: 20px;
        color: #0c0b58;
        font-weight: 700;
      }

      .print-info-table,
      .print-time-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }

      .print-info-table td,
      .print-time-table th,
      .print-time-table td {
        border: 1px solid #111111;
        padding: 10px 12px;
        font-size: 15px;
        text-align: left;
      }

      .print-time-table th {
        background: #f2f4f7;
        font-weight: 700;
      }

      .print-instruction-heading {
        margin-top: 18px;
        margin-bottom: 10px;
        font-size: 18px;
        font-weight: 700;
      }

      .print-instructions {
        padding-left: 18px;
        margin-top: 0;
        margin-bottom: 12px;
      }

      .print-instructions li {
        margin-bottom: 8px;
        line-height: 1.45;
        font-size: 13px;
      }

      .print-assistance {
        margin-top: 10px;
        font-size: 14px;
        font-weight: 600;
      }

      .headphone-icon {
        margin-right: 6px;
      }
    </style>

    ${printBox.innerHTML}
  `;

  window.print();
  document.body.innerHTML = originalContent;
  location.reload();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
=======
const app = document.getElementById("app");
const mobileInput = document.getElementById("mobileNumber");
const loginBtn = document.getElementById("loginBtn");
const errorMessage = document.getElementById("errorMessage");

let loggedInStudent = null;
let activeTab = "admit";

const SHEET_ID = "1BpM8tATcqrShbne4fS_kLFQV7uuee1AX7u3Q5uC772I";

const SHEETS = [
  { gid: "1370512469", slot: "NEW DELHI GS" },
  { gid: "1628651856", slot: "PUNE GS" },
  { gid: "998425198", slot: "HYDERABAD GS" },
  { gid: "1425456635", slot: "GS ONLINE" },
  { gid: "153930879", slot: "NEW DELHI CSAT" },
  { gid: "61722243", slot: "PUNE CSAT" },
  { gid: "1578514353", slot: "HYDERABAD CSAT" },
  { gid: "1191610167", slot: "CSAT ONLINE" }
];

if (mobileInput && loginBtn) {
  mobileInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "");
    errorMessage.textContent = "";
  });

  loginBtn.addEventListener("click", async function () {
    const mobileNumber = mobileInput.value.trim();

    if (mobileNumber === "") {
      alert("Please enter your 10 digit mobile number");
      return;
    }

    if (mobileNumber.length < 10) {
      alert("User must enter 10 digits");
      return;
    }

    if (mobileNumber.length > 10) {
      alert("Mobile number should contain only 10 digits");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      errorMessage.textContent =
        "Invalid credential please enter correct phone number";
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Checking...";
    errorMessage.textContent = "";

    try {
      const students = await fetchStudentsFromGoogleSheetCSV();

      const student = students.find((item) => {
        return String(item.mobile).replace(/\D/g, "") === mobileNumber;
      });

      if (!student) {
        errorMessage.textContent =
          "Invalid credential please enter correct phone number";
        return;
      }

      loggedInStudent = student;
      activeTab = "admit";
      renderDashboard();
    } catch (err) {
      console.error("Sheet fetch error:", err);
      errorMessage.textContent =
        "Unable to fetch data. Please check Google Sheet sharing settings.";
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Login →";
    }
  });
}

async function fetchStudentsFromGoogleSheetCSV() {
  const studentMap = new Map();

  for (let i = 0; i < SHEETS.length; i++) {
    const sheetInfo = SHEETS[i];
    const gid = sheetInfo.gid;
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;

    const response = await fetch(url);

    if (!response.ok) continue;

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    if (!rows.length) continue;

    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1);

    const rawData = dataRows.map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] ? row[index].trim() : "";
      });
      return obj;
    });

    for (const row of rawData) {
      const normalizedRow = normalizeStudentRow(row, sheetInfo);

      if (!normalizedRow.mobile) continue;

      if (!studentMap.has(normalizedRow.mobile)) {
        studentMap.set(
          normalizedRow.mobile,
          createBaseStudent(normalizedRow.mobile, normalizedRow)
        );
      }

      const existingStudent = studentMap.get(normalizedRow.mobile);
      mergeStudentData(existingStudent, normalizedRow);
    }
  }

  const finalStudents = Array.from(studentMap.values()).map(finalizeStudent);
  return finalStudents;
}

function createBaseStudent(mobile, rowData = {}) {
  return {
    mobile,
    name: rowData.name || "Student",
    city: rowData.city || "",
    venue: rowData.venue || "",
    examDate: "April 18th Saturday, 2026",
    rank: "-",
    gsPaper: null,
    csatPaper: null,
    gsAir: "",
    csatAir: "",
    timings: {
      gs: "9:30 AM - 11:30 AM",
      csat: "2:30 PM - 4:30 PM"
    },
    instructions: [
      "The mobile number filled in the OMR Sheet will be treated as the roll number and results can be accessed using the same mobile number only.",
      "You must report at the Examination Center 30 minutes prior to the commencement of the exam.",
      "Candidates can give tests only at the assigned examination venue and allotted examination time.",
      "Fill Name, Mobile no. and other details carefully."
    ]
  };
}

function mergeStudentData(existingStudent, incomingRow) {
  if (!existingStudent.name || existingStudent.name === "Student") {
    existingStudent.name = incomingRow.name || existingStudent.name;
  }

  if (!existingStudent.city) {
    existingStudent.city = incomingRow.city || existingStudent.city;
  }

  if (!existingStudent.venue) {
    existingStudent.venue = incomingRow.venue || existingStudent.venue;
  }

  if (incomingRow.gsTiming) {
    existingStudent.timings.gs = incomingRow.gsTiming;
  }

  if (incomingRow.csatTiming) {
    existingStudent.timings.csat = incomingRow.csatTiming;
  }

  if (incomingRow.paperType === "GS" && incomingRow.paperData) {
    existingStudent.gsPaper = incomingRow.paperData;

    if (incomingRow.airValue !== "") {
      existingStudent.gsAir = incomingRow.airValue;
      existingStudent.rank = incomingRow.airValue;
    }

    if (!existingStudent.city && incomingRow.city) {
      existingStudent.city = incomingRow.city;
    }

    if (!existingStudent.venue && incomingRow.venue) {
      existingStudent.venue = incomingRow.venue;
    }
  }

  if (incomingRow.paperType === "CSAT" && incomingRow.paperData) {
    existingStudent.csatPaper = incomingRow.paperData;

    if (incomingRow.airValue !== "" && !existingStudent.rank) {
      existingStudent.csatAir = incomingRow.airValue;
      existingStudent.rank = incomingRow.airValue;
    }

    if (!existingStudent.city && incomingRow.city) {
      existingStudent.city = incomingRow.city;
    }

    if (!existingStudent.venue && incomingRow.venue) {
      existingStudent.venue = incomingRow.venue;
    }
  }
}

function finalizeStudent(student) {
  const papers = [];

  if (student.gsPaper) {
    papers.push(student.gsPaper);
  }

  if (student.csatPaper) {
    papers.push(student.csatPaper);
  }

  const hasResultData = papers.length > 0;

  let rank = student.rank;
  if (
    (!rank || rank === "-") &&
    student.gsPaper &&
    student.gsPaper.score !== undefined
  ) {
    rank = generateRankFromScore(student.gsPaper.score);
  }

  return {
    mobile: student.mobile,
    name: student.name || "Student",
    city: student.city || "",
    venue: student.venue || student.city || "Delhi",
    examDate: student.examDate,
    rank: rank || "-",
    papers,
    instructions: student.instructions,
    timings: [
      {
        subject: "Paper I (General Studies)",
        time: student.timings.gs || "9:30 AM - 11:30 AM"
      },
      {
        subject: "Paper II (CSAT)",
        time: student.timings.csat || "2:30 PM - 4:30 PM"
      }
    ],
    originalScore: student.gsPaper ? Number(student.gsPaper.score || 0) : null,
    hasResultData
  };
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }

      row.push(current);

      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getField(row, possibleKeys) {
  const rowKeys = Object.keys(row);
  const normalizedMap = {};

  rowKeys.forEach((key) => {
    normalizedMap[normalizeKey(key)] = row[key];
  });

  for (const key of possibleKeys) {
    const value = normalizedMap[normalizeKey(key)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function normalizeStudentRow(row, sheetInfo = {}) {
  const mobile = getField(row, [
    "Phone Number",
    "PhoneNumber",
    "Phone",
    "Mob No",
    "Mob No.",
    "Mobile",
    "Mobile No",
    "Mobile Number",
    "Contact Number"
  ])
    .replace(/\D/g, "")
    .trim();

  const name =
    getField(row, ["Name", "Candidate Name", "Student Name"]) || "Student";

  const city =
    getField(row, ["City", "Centre", "Center", "Venue"]) ||
    extractCityFromSlot(sheetInfo.slot);

  const venue =
    getField(row, [
      "Venue",
      "Centre",
      "Center",
      "Test Centre",
      "Test Center",
      "City"
    ]) ||
    city ||
    "Delhi";

  const gsTiming =
    getField(row, [
      "GS Paper I Slot",
      "GS Slot",
      "Paper I Slot",
      "Paper 1 Slot",
      "General Studies",
      "GS Paper"
    ]) || "9:30 AM - 11:30 AM";

  const csatTiming =
    getField(row, [
      "CSAT",
      "CSAT Slot",
      "Paper II Slot",
      "Paper 2 Slot",
      "GS Pap CSAT",
      "Paper II : CSAT"
    ]) || "2:30 PM - 4:30 PM";

  const correct = normalizeNumber(
    getField(row, ["Correct", "Paper I Correct", "GS Correct"])
  );

  const incorrect = normalizeNumber(
    getField(row, ["Incorrect", "Paper I Incorrect", "GS Incorrect"])
  );

  const blank = normalizeNumber(
    getField(row, ["Blank", "Paper I Blank", "GS Blank"])
  );

  const sheetScore = normalizeNumber(
    getField(row, ["Score", "Paper I Score", "GS Score"])
  );

  const airValue = getField(row, ["AIR", "Air", "Rank", "RANK"]);

  const hasScoreColumns =
    rowHasValue(getField(row, ["Correct"])) ||
    rowHasValue(getField(row, ["Incorrect"])) ||
    rowHasValue(getField(row, ["Blank"])) ||
    rowHasValue(getField(row, ["Score"])) ||
    rowHasValue(getField(row, ["Paper I Correct"])) ||
    rowHasValue(getField(row, ["Paper I Incorrect"])) ||
    rowHasValue(getField(row, ["Paper I Blank"])) ||
    rowHasValue(getField(row, ["Paper I Score"])) ||
    rowHasValue(getField(row, ["GS Correct"])) ||
    rowHasValue(getField(row, ["GS Incorrect"])) ||
    rowHasValue(getField(row, ["GS Blank"])) ||
    rowHasValue(getField(row, ["GS Score"]));

  const derivedScore =
    hasScoreColumns && !Number.isNaN(sheetScore)
      ? sheetScore
      : calculateScore(correct, incorrect);

  const isCSATSheet = String(sheetInfo.slot || "").toUpperCase().includes("CSAT");
  const isGSSheet =
    String(sheetInfo.slot || "").toUpperCase().includes("GS") && !isCSATSheet;

  let paperType = "";
  let paperData = null;

  if (isGSSheet && hasScoreColumns) {
    paperType = "GS";
    paperData = {
      paper: "Paper I : General Studies",
      correct,
      incorrect,
      blank,
      score: !Number.isNaN(sheetScore) ? sheetScore : derivedScore
    };
  }

  if (isCSATSheet && hasScoreColumns) {
    paperType = "CSAT";
    paperData = {
      paper: "Paper II : CSAT",
      correct,
      incorrect,
      blank,
      score: !Number.isNaN(sheetScore) ? sheetScore : derivedScore
    };
  }

  return {
    mobile,
    name,
    city,
    venue,
    gsTiming,
    csatTiming,
    paperType,
    paperData,
    airValue
  };
}

function extractCityFromSlot(slot) {
  const value = String(slot || "").toLowerCase();

  if (value.includes("hyderabad")) return "Hyderabad";
  if (value.includes("pune")) return "Pune";
  if (value.includes("delhi")) return "Delhi";
  if (value.includes("online")) return "Online";

  return "";
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isNaN(parsed) ? 0 : parsed;
}

function rowHasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function calculateScore(correct, incorrect) {
  const score = Number(correct) * 2 - Number(incorrect) * 0.67;
  return Number(score.toFixed(2));
}

function generateRankFromScore(score) {
  if (score >= 110) return 25;
  if (score >= 100) return 50;
  if (score >= 90) return 90;
  if (score >= 80) return 140;
  if (score >= 70) return 200;
  if (score >= 60) return 260;
  if (score >= 50) return 320;
  if (score >= 40) return 400;
  return 500;
}

function calculateTrendScore(student) {
  if (
    student.originalScore !== null &&
    student.originalScore !== undefined &&
    !Number.isNaN(student.originalScore)
  ) {
    return Number(student.originalScore);
  }

  const firstPaper = student.papers[0];
  if (!firstPaper) return 0;

  return calculateScore(firstPaper.correct, firstPaper.incorrect);
}

function getAnalysisData(student) {
  const firstPaper = student.papers[0];

  if (!firstPaper) {
    return {
      correct: 0,
      incorrect: 0,
      blank: 0,
      total: 0
    };
  }

  const total = firstPaper.correct + firstPaper.incorrect + firstPaper.blank;

  return {
    correct: firstPaper.correct,
    incorrect: firstPaper.incorrect,
    blank: firstPaper.blank,
    total
  };
}

function renderDashboard() {
  if (!loggedInStudent) return;

  app.innerHTML = `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar-logo-row">
          <img src="./assets/logos-40-years 1.png" class="sidebar-years-logo" alt="40 years" />
          <img src="./assets/SRIRAM's-IAS.png" class="sidebar-logo" alt="Sriram IAS" />
        </div>

        <div class="side-nav">
          <button class="side-btn ${activeTab === "admit" ? "active" : ""}" id="admitTabBtn">Admit Card</button>
          <button class="side-btn ${activeTab === "result" ? "active" : ""}" id="resultTabBtn">Result</button>
        </div>

        <div class="general-info">
          <div class="general-info-title">General Information</div>
          <ul class="general-info-list">
            <li>Result of ANUBHUTHI III will be declared within 72 hours.</li>
            <li>Detailed video analysis and test discussion will be available on our official YouTube channel.</li>
            <li>For updates, keep visiting our website.</li>
          </ul>
        </div>

        <div class="logout-wrap">
          <button id="logoutBtn" class="logout-btn">↪ Logout</button>
        </div>
      </aside>

      <main class="main-panel">
        ${activeTab === "admit" ? renderAdmitCardPage() : renderResultPage()}
      </main>
    </div>

    <div id="printAdmitCard" class="print-admit"></div>
  `;

  const admitBtn = document.getElementById("admitTabBtn");
  const resultBtn = document.getElementById("resultTabBtn");
  const downloadBtn = document.getElementById("downloadAdmitBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      loggedInStudent = null;
      activeTab = "admit";
      location.reload();
    });
  }

  if (admitBtn) {
    admitBtn.addEventListener("click", function () {
      activeTab = "admit";
      renderDashboard();
    });
  }

  if (resultBtn) {
    resultBtn.addEventListener("click", function () {
      if (!loggedInStudent.hasResultData) {
        alert("The result will be released soon! Stay updated with our official website.");
        return;
      }

      activeTab = "result";
      renderDashboard();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadAdmitCard);
  }
}

function renderAdmitCardPage() {
  const student = loggedInStudent;

  const instructionsHtml = student.instructions
    .map((item) => `<div class="instruction-item">${escapeHtml(item)}</div>`)
    .join("");

  return `
    <div class="admit-page-wrap">
      <h1 class="admit-page-title">ANUBUTHI III</h1>

      <div class="admit-layout">
        <div class="admit-center-column">
          <div class="student-card">
            <div class="student-card-title">CANDIDATE DETAILS</div>

            <div class="avatar-circle">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"></path>
                <path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path>
              </svg>
            </div>

            <div class="student-name">${escapeHtml(student.name)}</div>
            <div class="student-mobile">${escapeHtml(student.mobile)}</div>

            <div class="student-city">
              <span class="location-icon-svg" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"></path>
                  <circle cx="12" cy="10" r="2.3"></circle>
                </svg>
              </span>
              <span>${escapeHtml(student.venue)}</span>
            </div>

            <button id="downloadAdmitBtn" class="download-btn">
              Download Admit Card ⬇
            </button>
          </div>

          <div class="bottom-assistance">
            <span>🎧</span>
            <div>For any Assistance call <span>9811489560</span></div>
          </div>
        </div>

        <div class="instructions-box">
          <div class="instructions-title">IMPORTANT INSTRUCTIONS</div>
          <div class="instructions-marquee">
            <div class="instructions-track">
              ${instructionsHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderResultPage() {
  const student = loggedInStudent;

  if (!student.hasResultData) {
    return `
      <div class="result-page-wrap">
        <div class="result-main-title">CANDIDATE DETAILS</div>
        <div class="result-coming-soon">
          <h3>The result will be released soon!</h3>
          <p>Stay updated with our official website.</p>
        </div>
      </div>
    `;
  }

  const trendScore = calculateTrendScore(student);
  const analysis = getAnalysisData(student);

  const paperRows = student.papers
    .map((paper) => {
      const displayScore =
        paper.score !== undefined && paper.score !== null && paper.score !== ""
          ? Number(paper.score).toFixed(2)
          : calculateScore(paper.correct, paper.incorrect).toFixed(2);

      return `
        <tr>
          <td>${paper.paper}</td>
          <td class="correct">${paper.correct}</td>
          <td class="incorrect">${paper.incorrect}</td>
          <td>${paper.blank}</td>
          <td class="score">${displayScore}</td>
        </tr>
      `;
    })
    .join("");

  const total = analysis.total || 1;
  const correctPercent = ((analysis.correct / total) * 100).toFixed(2);
  const incorrectPercent = ((analysis.incorrect / total) * 100).toFixed(2);

  const donutStyle = `
    conic-gradient(
      #22c55e 0% ${correctPercent}%,
      #ef4444 ${correctPercent}% ${Number(correctPercent) + Number(incorrectPercent)}%,
      #f97316 ${Number(correctPercent) + Number(incorrectPercent)}% 100%
    )
  `;

  return `
    <div class="result-page-wrap">
      <div class="result-main-title">CANDIDATE DETAILS</div>

      <div class="student-top-row">
        <div class="student-meta">
          <span>${escapeHtml(student.name)}</span>
          <span>|</span>
          <span>${escapeHtml(student.mobile)}</span>
        </div>

        <div class="rank-box-wrap">
          <div class="rank-title">All India Rank</div>
          <div class="rank-box">${escapeHtml(student.rank)}</div>
        </div>
      </div>

      <div class="card-box">
        <div class="section-heading">📋 Detailed Results</div>

        <table class="detail-table">
          <thead>
            <tr>
              <th>Paper</th>
              <th>Correct</th>
              <th>Incorrect</th>
              <th>Blank</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${paperRows}
          </tbody>
        </table>
      </div>

      <div class="result-bottom-grid">
        <div class="chart-box">
          <div class="section-heading">📈 Performance Trend</div>

          <div class="chart-area">
            ${renderChartGrid()}
            <div 
              class="chart-dot-with-tooltip"
              style="bottom:${(Math.min(trendScore, 100) / 100) * 220}px;"
            >
              <div class="chart-tooltip">
                <div>Current Test</div>
                <div>Score: ${trendScore.toFixed(2)}</div>
              </div>
              <div class="chart-dot"></div>
            </div>
            <div class="x-label">Current Test</div>
          </div>
        </div>

        <div class="chart-box">
          <div class="section-heading">📋 Analysis Breakdown</div>

          <div class="donut-wrap">
            <div class="donut-chart" style="background:${donutStyle}">
              <div class="donut-center">${trendScore.toFixed(2)}</div>
            </div>
          </div>

          <div class="legend">
            <div class="legend-item"><span class="legend-color" style="background:#22c55e;"></span>Correct</div>
            <div class="legend-item"><span class="legend-color" style="background:#ef4444;"></span>Incorrect</div>
            <div class="legend-item"><span class="legend-color" style="background:#f97316;"></span>Blank</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderChartGrid() {
  const labels = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

  return labels
    .map((label, index) => {
      const top = (index / (labels.length - 1)) * 220;
      return `
        <div class="grid-line" style="top:${top}px;"></div>
        <div class="y-label" style="top:${top - 8}px;">${label}</div>
      `;
    })
    .join("");
}

function downloadAdmitCard() {
  const student = loggedInStudent;
  const printBox = document.getElementById("printAdmitCard");

  if (!printBox || !student) return;

  printBox.innerHTML = `
  <div class="print-sheet">

    <div class="print-logo-row">
      <img src="./assets/logos-40-years 1.png" class="print-years-logo" />
      <img src="./assets/SRIRAM's-IAS.png" class="print-main-logo" />
    </div>

    <div class="print-brand-line">
      Serving The Nation Since 1985
    </div>

    <div class="print-main-title">ANUBUTHI III</div>
    <div class="print-sub-title">All India Open Mock Test 2026</div>
    <div class="print-admit-title">e-Admit Card</div>

    <table class="print-info-table">
      <tr>
        <td>Name</td>
        <td>${escapeHtml(student.name)}</td>
      </tr>
      <tr>
        <td>Mobile No.</td>
        <td>${escapeHtml(student.mobile)}</td>
      </tr>
      <tr>
        <td>Venue of Examination</td>
        <td>${escapeHtml(student.venue)}</td>
      </tr>
    </table>

    <table class="print-time-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Timing</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(student.timings[0]?.subject || "Paper I (General Studies)")}</td>
          <td>${escapeHtml(student.timings[0]?.time || "9:30 AM - 11:30 AM")}</td>
        </tr>
        <tr>
          <td>${escapeHtml(student.timings[1]?.subject || "Paper II (CSAT)")}</td>
          <td>${escapeHtml(student.timings[1]?.time || "2:30 PM - 4:30 PM")}</td>
        </tr>
      </tbody>
    </table>

    <div class="print-instruction-heading">INSTRUCTIONS</div>

    <ul class="print-instructions">
      <li>The mobile number filled in the OMR Sheet will be treated as the roll number and results can be accessed using the same mobile number only.</li>
      <li>You must report at the Examination Center 30 minutes prior to the commencement of the exam.</li>
      <li>Candidates can give tests only at the assigned examination venue and allotted examination time.</li>
      <li>Fill Name, Mobile no. and other details carefully.</li>
    </ul>

    <div class="print-assistance">
      <span class="headphone-icon">🎧</span>
      <span>For any Assistance call <b>9811489560</b></span>
    </div>

  </div>
`;

  const originalContent = document.body.innerHTML;

  document.body.innerHTML = `
    <style>
      @page {
        size: A4;
        margin: 16mm;
      }

      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
      }

      .print-sheet {
        width: 100%;
        background: #ffffff;
        color: #111111;
      }

      .print-top-title {
        text-align: center;
        margin-bottom: 16px;
      }

      .print-top-title h1 {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 30px;
        color: #0c0b58;
        margin: 0 0 4px;
      }

      .mock-line {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 2px;
      }

      .admit-line {
        font-size: 19px;
        font-weight: 700;
      }

      .print-info-row {
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 10px;
        padding: 8px 0;
        font-size: 17px;
      }

      .print-info-label {
        font-weight: 700;
      }

      .print-section-title {
        margin-top: 20px;
        margin-bottom: 10px;
        font-size: 20px;
        color: #0c0b58;
        font-weight: 700;
      }

      .print-info-table,
      .print-time-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }

      .print-info-table td,
      .print-time-table th,
      .print-time-table td {
        border: 1px solid #111111;
        padding: 10px 12px;
        font-size: 15px;
        text-align: left;
      }

      .print-time-table th {
        background: #f2f4f7;
        font-weight: 700;
      }

      .print-instruction-heading {
        margin-top: 18px;
        margin-bottom: 10px;
        font-size: 18px;
        font-weight: 700;
      }

      .print-instructions {
        padding-left: 18px;
        margin-top: 0;
        margin-bottom: 12px;
      }

      .print-instructions li {
        margin-bottom: 8px;
        line-height: 1.45;
        font-size: 13px;
      }

      .print-assistance {
        margin-top: 10px;
        font-size: 14px;
        font-weight: 600;
      }

      .headphone-icon {
        margin-right: 6px;
      }
    </style>

    ${printBox.innerHTML}
  `;

  window.print();
  document.body.innerHTML = originalContent;
  location.reload();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
>>>>>>> 21c60a98a9b8e7a4e981c34bf01fba9f37295755
}