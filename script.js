const app = document.getElementById("app");
const mobileInput = document.getElementById("mobileNumber");
const loginBtn = document.getElementById("loginBtn");
const errorMessage = document.getElementById("errorMessage");

let loggedInStudent = null;
let activeTab = "admit";

const SHEET_ID = "14rrufXMffaHXUnLc3Vdim1-DwPOl0aTSIXe-7SWIuwM";
const SHEET_GID = "2097186827";

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
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch CSV from Google Sheet");
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText);

  if (!rows.length) {
    throw new Error("No data found in sheet");
  }

  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);

  const rawData = dataRows.map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ? row[index].trim() : "";
    });
    return obj;
  });

  return rawData.map(normalizeStudentRow).filter((item) => item.mobile);
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

function normalizeStudentRow(row) {
  const mobile = String(
    row["Phone Number"] ||
      row["Mob No"] ||
      row["Mobile"] ||
      row["Mobile No"] ||
      ""
  )
    .replace(/\D/g, "")
    .trim();

  const name = String(
    row["Name"] ||
      row["Candidate Name"] ||
      "Student"
  ).trim();

  const venue = String(
    row["Venue"] ||
      row["Centre"] ||
      row["Center"] ||
      row["City"] ||
      "Delhi"
  ).trim();

  const correct = normalizeNumber(
    row["Correct"] ||
      row["Paper I Correct"] ||
      row["GS Correct"]
  );

  const incorrect = normalizeNumber(
    row["Incorrect"] ||
      row["Paper I Incorrect"] ||
      row["GS Incorrect"]
  );

  const blank = normalizeNumber(
    row["Blank"] ||
      row["Paper I Blank"] ||
      row["GS Blank"]
  );

  const sheetScore = normalizeNumber(
    row["Score"] ||
      row["Paper I Score"] ||
      row["GS Score"]
  );

  const hasResultData =
    rowHasValue(row["Correct"]) ||
    rowHasValue(row["Incorrect"]) ||
    rowHasValue(row["Blank"]) ||
    rowHasValue(row["Score"]) ||
    rowHasValue(row["Paper I Correct"]) ||
    rowHasValue(row["Paper I Incorrect"]) ||
    rowHasValue(row["Paper I Blank"]) ||
    rowHasValue(row["Paper I Score"]) ||
    rowHasValue(row["GS Correct"]) ||
    rowHasValue(row["GS Incorrect"]) ||
    rowHasValue(row["GS Blank"]) ||
    rowHasValue(row["GS Score"]);

  const derivedScore =
    hasResultData && !Number.isNaN(sheetScore)
      ? sheetScore
      : calculateScore(correct, incorrect);

  return {
    mobile,
    name,
    venue,
    examDate: "April 18th Saturday, 2026",
    rank: hasResultData ? generateRankFromScore(derivedScore) : "-",
    papers: hasResultData
      ? [
          {
            paper: "Paper I : General Studies",
            correct,
            incorrect,
            blank,
            score: !Number.isNaN(sheetScore) ? sheetScore : derivedScore
          },
          {
            paper: "Paper II : CSAT",
            correct: 0,
            incorrect: 0,
            blank: 0,
            score: 0
          }
        ]
      : [],
    instructions: [
      "The mobile number filled in the OMR Sheet will be treated as the roll number and results can be accessed using the same mobile number only.",
      "You must report at the Examination Center 30 minutes prior to the commencement of the exam.",
      "Candidates can give tests only at the assigned examination venue and allotted examination time.",
      "Fill Name, Mobile no. and other details carefully."
    ],
    timings: [
      {
        subject: "Paper I (General Studies)",
        time: row["GS Paper I Slot"] || "9:30 AM - 11:30 AM"
      },
      {
        subject: "Paper II (CSAT)",
        time: row["CSAT"] || "2:30 PM - 4:30 PM"
      }
    ],
    originalScore: hasResultData ? derivedScore : null,
    hasResultData
  };
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
          <div class="rank-box">${student.rank}</div>
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

      .print-instructions {
        padding-left: 18px;
        margin-top: 0;
        margin-bottom: 18px;
      }

      .print-instructions li {
        margin-bottom: 8px;
        line-height: 1.45;
        font-size: 13px;
      }

      .print-time-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }

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
}