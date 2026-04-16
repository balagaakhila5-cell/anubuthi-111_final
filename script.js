const app = document.getElementById("app");
const mobileInput = document.getElementById("mobileNumber");
const loginBtn = document.getElementById("loginBtn");
const errorMessage = document.getElementById("errorMessage");

let loggedInStudent = null;
let activeTab = "admit";

const SHEET_ID = "1hHFM29EDbvxaX1HWizPgO_2XdQW1yaF1hPhxn9c0WJQ";
const SHEET_GID = "1906196581";

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
  const mobile = String(row["Mob No"] || "")
    .replace(/\D/g, "")
    .trim();

  const name = String(row["Candidate Name"] || "Student").trim();
  const city = String(row["Centre"] || "Hyderabad").trim();

  const correct = Number(row["Correct"] || 0);
  const incorrect = Number(row["Incorrect"] || 0);
  const blank = Number(row["Blank"] || 0);
  const sheetScore = Number(row["Score"] || 0);

  return {
    mobile,
    name,
    city,
    examDate: "April 18th Saturday , 2026",
    rank: generateRankFromScore(sheetScore),
    papers: [
      {
        paper: "Paper 1 : General Studies",
        correct,
        incorrect,
        blank,
        score: sheetScore
      },
      {
        paper: "Paper 2 : CSAT",
        correct,
        incorrect,
        blank,
        score: sheetScore
      }
    ],
    instructions: [
      "The mobile number filled in the OMR sheet will be treated as the registered roll number, and results can be accessed using the same mobile number only.",
      "You must report at the Examination Center 30 minutes prior to the commencement of the exam.",
      "Candidates can give tests only at the assigned examination venue and allotted examination time.",
      "Admit card must be produced whenever required by the authorities.",
      "Candidates should verify all details printed on the admit card carefully.",
      "Any mismatch in candidate details should be reported immediately."
    ],
    originalScore: sheetScore
  };
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
  if (student.originalScore && !Number.isNaN(student.originalScore)) {
    return Number(student.originalScore);
  }

  const firstPaper = student.papers[0];
  return calculateScore(firstPaper.correct, firstPaper.incorrect);
}

function getAnalysisData(student) {
  const firstPaper = student.papers[0];
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
          <img src="./assets/logos-40-years 1.png" class="sidebar-years-logo" />
          <img src="./assets/SRIRAM's-IAS.png" class="sidebar-logo" />
        </div>

        <div class="side-nav">
          <button class="side-btn ${activeTab === "admit" ? "active" : ""}" id="admitTabBtn">Admit Card</button>
          <button class="side-btn ${activeTab === "result" ? "active" : ""}" id="resultTabBtn">Result</button>
        </div>

        <div class="general-info">
          <div class="general-info-title">General Information :</div>
          <ul class="general-info-list">
            <li>Result of ANUBHUTI III will be declared within 72 hours.</li>
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

  const animatedInstructions = [...student.instructions, ...student.instructions]
    .map((item) => `<div class="instruction-item">${item}</div>`)
    .join("");

  return `
    <div class="admit-page-wrap">
      <h1 class="admit-page-title">ANUBUTHI III</h1>

      <div class="admit-layout">
        <div class="admit-center-column">
          <div class="student-card">
            <div class="student-card-title">CANDIDATE DETAILS</div>

            <div class="avatar-circle">👤</div>

            <div class="student-name">${student.name}</div>
            <div class="student-mobile">${student.mobile}</div>
            <div class="student-city">📍 ${student.city}</div>

            <button id="downloadAdmitBtn" class="download-btn">
              Download Admit Card &nbsp; ⬇
            </button>
          </div>

          <div class="bottom-assistance">
            <span>🎧</span>
            <div>For any Assistance call <span>9811489560</span></div>
          </div>
        </div>

        <div class="instructions-box">
          <div class="instructions-title">IMPORTANT INSTRUCTION</div>

          <div class="instructions-marquee">
            <div class="instructions-track">
              ${animatedInstructions}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderResultPage() {
  const student = loggedInStudent;
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

  const correctPercent = ((analysis.correct / analysis.total) * 100).toFixed(2);
  const incorrectPercent = ((analysis.incorrect / analysis.total) * 100).toFixed(2);

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
          ${student.name} <span>|</span> ${student.mobile}
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
            <div class="chart-dot" style="bottom:${(Math.min(trendScore, 100) / 100) * 220}px;"></div>
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

  if (!printBox) return;

  printBox.innerHTML = `
    <div class="print-wrapper">
      <div class="print-header">
        <h1>ANUBUTHI III - ADMIT CARD</h1>
        <p>All India Open Mock Test 2026</p>
      </div>

      <div class="print-card">
        <div class="watermark">SRIRAM IAS</div>
        <div><strong>Name:</strong> ${student.name}</div>
        <div><strong>Mobile Number:</strong> ${student.mobile}</div>
        <div><strong>City:</strong> ${student.city}</div>
        <div><strong>Examination Date:</strong> ${student.examDate}</div>
        <div><strong>All India Rank:</strong> ${student.rank}</div>
      </div>
    </div>
  `;

  const originalContent = document.body.innerHTML;

  document.body.innerHTML = `
    <style>
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }

      .print-wrapper {
        width: 800px;
        padding: 40px;
        font-family: Arial, sans-serif;
        background: white;
      }

      .print-header {
        text-align: center;
        margin-bottom: 30px;
        color: #0c0b58;
      }

      .print-header h1 {
        font-family: Georgia, serif;
        font-size: 28px;
        margin-bottom: 6px;
      }

      .print-card {
        position: relative;
        padding: 28px 32px;
        border-radius: 12px;
        background: linear-gradient(
          135deg,
          rgba(12, 11, 88, 0.08) 0%,
          rgba(255, 255, 255, 1) 40%,
          rgba(255, 0, 0, 0.08) 100%
        );
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        font-size: 18px;
        line-height: 2;
      }

      .watermark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 70px;
        font-weight: 700;
        font-family: Georgia, serif;
        color: rgba(12, 11, 88, 0.05);
        white-space: nowrap;
        pointer-events: none;
      }
    </style>

    ${printBox.innerHTML}
  `;

  window.print();

  document.body.innerHTML = originalContent;
  location.reload();
}