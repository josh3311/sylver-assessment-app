// ============================================================
// Sylver Post-Training Impact Assessment (SPTIA) — Core JS
// Admin Passcode: Jesus1234
// ============================================================

// --- Data Structures ---
const ADMIN_PASSCODE   = 'Jesus1234';
const MANAGER_PASSCODE = '12345';         // shared by all managers — change this to whatever you want
const ADMIN_EMAIL      = 'brunonkengp@gmail.com';

// Employees can no longer submit new assessments after this date/time.
// Manager and Admin access are NOT affected by this — only the employee submission form.
const SUBMISSION_DEADLINE = new Date('2026-07-23T23:59:59');

// --- EmailJS Config (silent background delivery to advisor) ---
const EMAILJS_PUBLIC_KEY  = '4mLZceB-FggPGIMpw';
const EMAILJS_SERVICE_ID  = 'service_ev6unkm';
const EMAILJS_TEMPLATE_ID = 'template_kvr98am';

if (window.emailjs) {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

const questionsData = {
    sectionA: [
        { id: 1, text: "I have a better understanding of strategic sales principles." },
        { id: 2, text: "I better analyse customer needs before proposing solutions." },
        { id: 3, text: "I prepare more effectively before customer meetings." },
        { id: 4, text: "I now adopt a more structured sales approach." },
        { id: 5, text: "I make better sales decisions." },
        { id: 6, text: "I identify sales opportunities more easily." },
        { id: 7, text: "I negotiate more confidently." },
        { id: 8, text: "I have improved my customer relationship management." }
    ],
    sectionB: [
        { id: 9,  text: "I apply the techniques learned during the training." },
        { id: 10, text: "I spend more time planning my sales activities." },
        { id: 11, text: "I follow up customers more consistently." },
        { id: 12, text: "I use questioning and listening techniques more effectively." },
        { id: 13, text: "I better anticipate customer objections." },
        { id: 14, text: "I collaborate better with colleagues to achieve sales objectives." },
        { id: 15, text: "I demonstrate greater confidence during customer interactions." },
        { id: 16, text: "My overall way of selling has changed positively." }
    ],
    sectionC: [
        { id: 17, text: "My productivity has improved." },
        { id: 18, text: "I achieve my sales objectives more consistently." },
        { id: 19, text: "My customer relationships have improved." },
        { id: 20, text: "My conversion rate has improved." },
        { id: 21, text: "I contribute more effectively to my team's objectives." },
        { id: 22, text: "Overall, this training has improved my performance." }
    ],
    sectionD: [
        { id: 23, text: "The knowledge acquired is directly applicable to my work." },
        { id: 24, text: "I continue to use what I learned." },
        { id: 25, text: "I would recommend this training to other colleagues." }
    ]
};

const supervisorCompetencies = [
    { key: "comp_strategic",    label: "Strategic thinking" },
    { key: "comp_planning",     label: "Sales planning" },
    { key: "comp_relationship", label: "Customer relationship" },
    { key: "comp_negotiation",  label: "Negotiation skills" },
    { key: "comp_initiative",   label: "Initiative" },
    { key: "comp_problem",      label: "Problem solving" },
    { key: "comp_objectives",   label: "Achievement of objectives" },
    { key: "comp_performance",  label: "Overall performance" }
];

// ============================================================
// TOAST NOTIFICATION SYSTEM (BUG FIX #4: Add user feedback)
// ============================================================
function showToast(message, type = 'info') {
    // Remove previous toast if still visible
    const existing = document.querySelector('.app-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `app-toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- State ---
let assessments = [];
let activeStage  = 1;
let isAdminMode  = false;
let isManagerMode = false;
let pendingImportRecord = null;   // holds a record just pulled in via ?import= (dad's remote email link) until passcode is entered
// (no longer used — Supervisor Portal is now a standalone form, not a department queue)
let chartInstances = {};

// --- DOM Refs ---
const dashboardView    = document.getElementById('dashboardView');
const formView         = document.getElementById('formView');
const analysisView     = document.getElementById('analysisView');
const thankYouView     = document.getElementById('thankYouView');
const assessmentGrid   = document.getElementById('assessmentGrid');
const emptyState       = document.getElementById('emptyState');
const themeToggle      = document.getElementById('themeToggle');
const sunIcon          = document.getElementById('sunIcon');
const moonIcon         = document.getElementById('moonIcon');
const assessmentForm   = document.getElementById('assessmentForm');
const formBackBtn      = document.getElementById('formBackBtn');
const formNextBtn      = document.getElementById('formNextBtn');
const formSubmitBtn    = document.getElementById('formSubmitBtn');
const cancelFormBtn    = document.getElementById('cancelFormBtn');
const stageTabs        = document.querySelectorAll('.tab-btn[data-stage]');
const passcodeModal    = document.getElementById('passcodeModal');
const passcodeInput    = document.getElementById('passcodeInput');
const passcodeError    = document.getElementById('passcodeError');
const adminHeaderActions = document.getElementById('adminHeaderActions');
const adminLoginBtn    = document.getElementById('adminLoginBtn');

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    loadAssessments();
    generateQuestionsUI();
    generateSupervisorUI();
    setupEventListeners();

    // Check for import param in URL (?import=<base64>)
    // Only used for the ADMIN remote path (dad opening a completed report email
    // from a different device). Managers now review locally — no import needed.
    const urlParams = new URLSearchParams(window.location.search);
    const importPayload = urlParams.get('import');
    if (importPayload) {
        try {
            const bytes = Uint8Array.from(atob(importPayload), c => c.charCodeAt(0));
            const record = JSON.parse(new TextDecoder().decode(bytes));
            const isValidRecord = record && record.id &&
                (record.metadata || (record.type === 'supervisor_only' && record.employeeName));
            if (isValidRecord) {
                const idx = assessments.findIndex(a => a.id === record.id);
                if (idx > -1) assessments[idx] = record; else assessments.push(record);
                saveAssessments();
                // Remove query param from URL without reload
                history.replaceState(null, '', window.location.pathname);

                pendingImportRecord = record;
                enterClientMode();   // neutral screen underneath the modal
                passcodeInput.value = '';
                passcodeError.style.display = 'none';
                passcodeModal.style.display = 'flex';
                setTimeout(() => passcodeInput.focus(), 100);
            }
        } catch (e) {
            console.warn('URL import failed:', e);
            enterClientMode();
            showToast('⚠ Import link was invalid or expired. Please ask for a new link.', 'error');
        }
    } else {
        // Always start in Client Kiosk mode — show blank form
        enterClientMode();

        // Restore admin session if still active (in-tab session)
        if (sessionStorage.getItem('sylver_admin_unlocked') === 'true') {
            enterAdminPortal(false);
        }
    }

    // Set default assessment date to today
    document.getElementById('assessmentDate').valueAsDate = new Date();
});

// ============================================================

// ============================================================
// LOCAL STORAGE
// ============================================================
function loadAssessments() {
    const data = localStorage.getItem('sylver_assessments');
    assessments = data ? JSON.parse(data) : [];
}

function saveAssessments() {
    localStorage.setItem('sylver_assessments', JSON.stringify(assessments));
}

// ============================================================
// CLIENT KIOSK MODE
// ============================================================
function enterClientMode() {
    isAdminMode   = false;
    isManagerMode = false;
    sessionStorage.removeItem('sylver_admin_unlocked');

    // Hide admin tabs & header extras
    document.getElementById('tabStage4').style.display = 'none';
    document.getElementById('tabStage5').style.display = 'none';
    adminHeaderActions.style.display  = 'none';
    adminLoginBtn.style.display       = 'inline-flex';
    document.getElementById('headerSubtitle').innerText = 'Client Assessment Form';
    document.getElementById('deadlineBanner').style.display = 'block';

    // Submission deadline check — employees only. Manager/Admin login (header button)
    // remains available regardless, since it's outside this view entirely.
    if (new Date() > SUBMISSION_DEADLINE) {
        switchView(document.getElementById('submissionClosedView'));
        return;
    }

    // Clear any previous form data and go to form
    resetClientForm();
    switchView(formView);
}

function resetClientForm() {
    assessmentForm.reset();
    document.getElementById('assessmentId').value = '';
    document.getElementById('trainingDate').value = '2026-03-04';
    document.getElementById('assessmentDate').valueAsDate = new Date();
    goToStage(1);
}

// ============================================================
// ADMIN MODE
// ============================================================
function enterAdminMode(showAlert = true, skipDashboard = false) {
    isAdminMode   = true;
    isManagerMode = false;
    sessionStorage.setItem('sylver_admin_unlocked', 'true');

    // Show admin tabs & header extras
    document.getElementById('tabStage4').style.display = 'inline-block';
    document.getElementById('tabStage5').style.display = 'inline-block';
    adminHeaderActions.style.display  = 'flex';
    adminLoginBtn.style.display       = 'none';
    document.getElementById('importDataBtn').style.display = 'inline-flex';
    document.getElementById('exportAllBtn').style.display  = 'inline-flex';
    document.getElementById('headerSubtitle').innerText = 'Sylver Consulting Analytics';

    const leftoverChip = adminHeaderActions.querySelector('.role-chip');
    if (leftoverChip) leftoverChip.remove();

    if (showAlert) {
        // Brief visual confirmation
        const chip = document.createElement('span');
        chip.className = 'role-chip';
        chip.innerText = 'Advisor Unlocked';
        chip.style.marginRight = '10px';
        adminHeaderActions.prepend(chip);
        setTimeout(() => chip.remove(), 3000);
    }

    // FIX: when jumping straight to a specific report (e.g. from an email link),
    // skip the full dashboard render — no need to build the grid just to
    // immediately replace it, and it removes a possible crash path entirely.
    if (skipDashboard) return;

    loadAssessments();
    calculateSaaSMetrics();
    showDashboard();
}

// ============================================================
// ADMIN COMPLETED REPORTS — dad's primary, isolated landing page
// ============================================================
// Deliberately does NOT touch renderDashboard(), calculateSaaSMetrics(),
// or anything else that loops over pending/legacy records. Each row is
// wrapped in its own try/catch so one bad record can never break the list.
function enterAdminPortal(showAlert = true) {
    isAdminMode   = true;
    isManagerMode = false;
    sessionStorage.setItem('sylver_admin_unlocked', 'true');

    document.getElementById('tabStage4').style.display = 'inline-block';
    document.getElementById('tabStage5').style.display = 'inline-block';
    adminHeaderActions.style.display  = 'flex';
    adminLoginBtn.style.display       = 'none';
    document.getElementById('importDataBtn').style.display = 'inline-flex';
    document.getElementById('exportAllBtn').style.display  = 'inline-flex';
    document.getElementById('headerSubtitle').innerText = 'Sylver Consulting Analytics';

    const leftoverChip = adminHeaderActions.querySelector('.role-chip');
    if (leftoverChip) leftoverChip.remove();

    if (showAlert) {
        const chip = document.createElement('span');
        chip.className = 'role-chip';
        chip.innerText = 'Advisor Unlocked';
        chip.style.marginRight = '10px';
        adminHeaderActions.prepend(chip);
        setTimeout(() => chip.remove(), 3000);
    }

    renderAdminReports();
    switchView(document.getElementById('adminReportsView'));
}

function renderAdminReports() {
    loadAssessments();
    const list  = document.getElementById('adminReportsList');
    const empty = document.getElementById('adminReportsEmptyState');
    list.innerHTML = '';

    const records = assessments.filter(a => a && a.id &&
        ((a.metadata && (a.status === 'completed' || a.status === 'pending')) ||
         (a.type === 'supervisor_only' && a.status === 'completed')));
    // Newest first
    records.sort((a, b) => new Date(b.submittedAt || b.metadata?.assessmentDate || 0) - new Date(a.submittedAt || a.metadata?.assessmentDate || 0));
    empty.style.display = records.length ? 'none' : 'block';

    records.forEach(r => {
        if (r.type === 'supervisor_only') {
            const row = document.createElement('div');
            row.className = 'manager-row';
            row.innerHTML = `
                <div>
                    <div class="manager-row-title">${escapeHtml(r.employeeName || 'Unknown')}</div>
                    <div class="manager-row-sub">Supervisor: ${escapeHtml(r.supervisor?.name || '—')} — ${(r.submittedAt || '').slice(0,10)}</div>
                </div>
                <span class="status-badge completed" style="background: rgba(99,102,241,0.15); color:#818cf8;">Supervisor Assessment</span>
            `;
            row.addEventListener('click', () => {
                try {
                    showSupervisorReport(r);
                } catch (err) {
                    console.error('Failed to open supervisor report', r.id, err);
                    showToast('⚠ Could not open this report — the record may be corrupted.', 'error');
                }
            });
            list.appendChild(row);
            return;
        }

        let badge;
        if (r.status === 'completed') {
            let scoreLabel = '—';
            try {
                const s = calculateAssessmentScores(r);
                scoreLabel = `${s.overallScore.toFixed(0)}%`;
            } catch (err) {
                console.warn('Could not score record', r.id, err);
            }
            badge = `<span class="status-badge completed">${scoreLabel}</span>`;
        } else {
            badge = `<span class="status-badge pending">Awaiting Supervisor</span>`;
        }

        const row = document.createElement('div');
        row.className = 'manager-row';
        row.innerHTML = `
            <div>
                <div class="manager-row-title">${escapeHtml(r.metadata.participantName || 'Unknown')}</div>
                <div class="manager-row-sub">${escapeHtml(r.metadata.participantDept || '—')} — ${r.metadata.assessmentDate || ''}</div>
            </div>
            ${badge}
        `;
        row.addEventListener('click', () => {
            try {
                showReport(r);
            } catch (err) {
                console.error('Failed to open report', r.id, err);
                showToast('⚠ Could not open this report — the record may be corrupted.', 'error');
            }
        });
        list.appendChild(row);
    });
}

// ============================================================
// SUPERVISOR-ONLY REPORT VIEW
// ============================================================
// Simple, table-based (no charts) — this is a standalone supervisor
// submission, not merged with the employee's own self-assessment.
// Combining the two into one full analysis is Phase 3 (deferred).
function showSupervisorReport(record) {
    document.getElementById('svEmployeeName').innerText    = record.employeeName || '—';
    document.getElementById('svSupervisorName').innerText  = record.supervisor?.name || '—';
    document.getElementById('svSubmittedDate').innerText   = (record.submittedAt || '').slice(0, 10) || '—';

    // Competency ratings table
    const ratingsBody = document.getElementById('svRatingsTableRows');
    ratingsBody.innerHTML = '';
    supervisorCompetencies.forEach(comp => {
        const val = record.supervisor?.ratings?.[comp.key];
        ratingsBody.innerHTML += `<tr><td>${escapeHtml(comp.label)}</td><td>${val ?? '—'}</td></tr>`;
    });

    document.getElementById('svObservedChange').innerText      = record.supervisor?.observedChange      || '—';
    document.getElementById('svImprovedPerformance').innerText = record.supervisor?.improvedPerformance || '—';
    document.getElementById('svComments').innerText            = record.supervisor?.comments || 'No comments provided.';

    // KPI table
    const kpiBody = document.getElementById('svKpiTableRows');
    kpiBody.innerHTML = '';
    const k = record.kpis || {};
    const addRow = (label, b, a) => {
        if (b === null || b === undefined || a === null || a === undefined) return;
        const pct = b > 0 ? ((a - b) / b * 100) : 0;
        const color = pct > 0 ? '#34d399' : (pct < 0 ? '#ef4444' : 'var(--text-secondary)');
        kpiBody.innerHTML += `<tr><td>${label}</td><td>${b}</td><td>${a}</td>
            <td style="color:${color};font-weight:700;">${pct > 0 ? '+' : ''}${pct.toFixed(0)}%</td></tr>`;
    };
    addRow('Sales ($)', k.salesBefore, k.salesAfter);
    addRow('New Customers', k.custBefore, k.custAfter);
    addRow('Retention (%)', k.retBefore, k.retAfter);
    addRow('Target Achieved (%)', k.targetBefore, k.targetAfter);
    if (k.customBefore != null) addRow(k.customName || 'Custom KPI', k.customBefore, k.customAfter);
    if (!kpiBody.innerHTML) kpiBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);">No KPI metrics recorded</td></tr>';

    switchView(document.getElementById('supervisorReportView'));
}

// ============================================================
// MANAGER PORTAL — department picker + filtered pending queue
// ============================================================
// Fully local: no email/import needed. Department is taken straight from
// whatever the employee typed on Stage 1 — no manual manager list to maintain.
function enterManagerPortal() {
    isAdminMode   = false;
    isManagerMode = true;

    document.getElementById('tabStage4').style.display = 'inline-block';
    document.getElementById('tabStage5').style.display = 'inline-block';
    adminHeaderActions.style.display = 'flex';
    adminLoginBtn.style.display      = 'none';
    document.getElementById('importDataBtn').style.display = 'none';
    document.getElementById('exportAllBtn').style.display  = 'none';
    document.getElementById('headerSubtitle').innerText = 'Supervisor Portal';

    const existingChip = adminHeaderActions.querySelector('.role-chip');
    if (existingChip) existingChip.remove();
    const chip = document.createElement('span');
    chip.className = 'role-chip';
    chip.innerText = 'Supervisor Mode';
    chip.style.marginRight = '10px';
    adminHeaderActions.prepend(chip);

    // Reset the entry field each time the portal is entered
    const nameField = document.getElementById('supervisorPortalEmployeeName');
    if (nameField) nameField.value = '';

    switchView(document.getElementById('managerDeptView'));
}

// Supervisor typed a name and clicked "Begin Assessment" — jump straight to
// Stage 4, skipping Stages 1-3 entirely. No existing employee record involved:
// this is always a fresh, standalone supervisor submission.
function beginSupervisorAssessment() {
    const nameField = document.getElementById('supervisorPortalEmployeeName');
    const name = nameField.value.trim();
    if (!name) {
        showToast('Please enter the employee\'s name first.', 'warning');
        nameField.focus();
        return;
    }

    assessmentForm.reset();
    document.getElementById('assessmentId').value = '';
    document.getElementById('supervisorAssessEmployeeName').value = name;

    goToStage(4);
    switchView(formView);
    showToast(`Assessing ${name} — complete the questions below.`, 'info');
}

function showManagerThankYou(employeeName) {
    document.getElementById('thankYouTitle').innerText = 'Sent to Admin!';
    document.getElementById('thankYouMessage').innerHTML =
        `The completed supervisor assessment for <strong>${employeeName}</strong> has been emailed to the Admin.`;
    document.getElementById('registerNewClientBtn').innerText = 'Assess Another Employee';
    document.getElementById('thankYouBranding').style.display = 'none';   // Supervisor screen: no client-facing branding
    switchView(thankYouView);
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    // Theme
    themeToggle.addEventListener('click', toggleTheme);

    // Admin Login button → open modal
    adminLoginBtn.addEventListener('click', () => {
        passcodeInput.value = '';
        passcodeError.style.display = 'none';
        passcodeModal.style.display = 'flex';
        setTimeout(() => passcodeInput.focus(), 100);
    });

    // Close modal
    document.getElementById('closePasscodeBtn').addEventListener('click', () => {
        passcodeModal.style.display = 'none';
    });

    // Passcode submit — also allow Enter key
    document.getElementById('submitPasscodeBtn').addEventListener('click', validatePasscode);
    passcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') validatePasscode();
    });

    // Lock portal back to client mode
    document.getElementById('adminLockBtn').addEventListener('click', () => {
        if (confirm('Lock the portal back to Client Mode?')) enterClientMode();
    });

    // Supervisor: "Begin Assessment" button on the entry screen
    document.getElementById('supervisorPortalBeginBtn').addEventListener('click', beginSupervisorAssessment);

    // Dashboard new assessment
    document.getElementById('createNewBtn').addEventListener('click', () => {
        openAssessmentForm(null, true);
    });

    // Form stage navigation
    formNextBtn.addEventListener('click', handleNextStage);
    formBackBtn.addEventListener('click', handlePrevStage);

    // Tab direct-click navigation
    stageTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const target = parseInt(e.target.dataset.stage);
            if (target !== activeStage) {
                if (target > activeStage && !validateCurrentStage()) return;
                goToStage(target);
            }
        });
    });

    // Reset / cancel button
    cancelFormBtn.addEventListener('click', () => {
        if (isManagerMode) {
            if (confirm('Discard this assessment and return to the Supervisor Portal?')) enterManagerPortal();
        } else if (!isAdminMode) {
            if (confirm('Reset form and start over?')) resetClientForm();
        } else {
            if (confirm('Discard all form edits?')) showDashboard();
        }
    });

    // Form submit
    assessmentForm.addEventListener('submit', handleFormSubmit);

    // Dashboard grid click delegation
    assessmentGrid.addEventListener('click', handleDashboardGridClick);

    // Report view controls
    document.getElementById('backToDashBtn').addEventListener('click', () => {
        if (isAdminMode) enterAdminPortal(false);
        else showDashboard();
    });
    document.getElementById('adminAdvancedBtn').addEventListener('click', () => {
        loadAssessments();
        calculateSaaSMetrics();
        showDashboard();
    });
    document.getElementById('backToReportsBtn').addEventListener('click', () => enterAdminPortal(false));
    document.getElementById('backToReportsFromSupervisorBtn').addEventListener('click', () => enterAdminPortal(false));
    document.getElementById('editAssessmentBtn').addEventListener('click', handleEditAssessment);
    document.getElementById('downloadPdfBtn').addEventListener('click', exportToPDF);

    // Import / Export
    document.getElementById('exportAllBtn').addEventListener('click', exportAllData);
    document.getElementById('importDataBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', handleImportData);

    // Thank-You view buttons
    document.getElementById('registerNewClientBtn').addEventListener('click', () => {
        if (isManagerMode) {
            // Supervisor: back to the entry screen, ready for the next employee
            document.getElementById('thankYouTitle').innerText = 'Thank You!';
            document.getElementById('thankYouMessage').innerHTML =
                'Your responses have been successfully submitted.<br>Please hand the device back to your Sylver Consulting advisor.';
            document.getElementById('registerNewClientBtn').innerText = 'Restart Form (Kiosk Mode)';
            document.getElementById('thankYouBranding').style.display = '';   // restore for next client use
            enterManagerPortal();
        } else {
            // Reset the Thank You copy back to the default client wording
            document.getElementById('thankYouTitle').innerText = 'Thank You!';
            document.getElementById('thankYouMessage').innerHTML =
                'Your responses have been successfully submitted.<br>Please hand the device back to your Sylver Consulting advisor.';
            document.getElementById('registerNewClientBtn').innerText = 'Restart Form (Kiosk Mode)';
            document.getElementById('thankYouBranding').style.display = '';   // ensure visible for client mode
            resetClientForm();
            switchView(formView);
        }
    });
    // Note: Supervisor's "Assess Another Employee" flow is handled by showManagerThankYou() + enterManagerPortal()
}

// ============================================================
// PASSCODE VALIDATION
// ============================================================
function validatePasscode() {
    const entered = passcodeInput.value.trim();

    if (entered === ADMIN_PASSCODE) {
        passcodeModal.style.display = 'none';
        enterAdminPortal(true);

        if (pendingImportRecord) {
            const rec = pendingImportRecord;
            pendingImportRecord = null;
            // Record is already saved to localStorage and will show in the list above.
            // Try to open it directly for convenience; if anything about this specific
            // record is malformed, the list itself is unaffected — just fall back to it.
            try {
                if (rec.type === 'supervisor_only') {
                    showSupervisorReport(rec);
                    showToast(`Supervisor assessment for "${rec.employeeName}" loaded.`, 'success');
                } else {
                    showReport(rec);
                    showToast(`Report for "${rec.metadata.participantName}" loaded.`, 'success');
                }
            } catch (err) {
                console.error('Failed to auto-open imported record:', err);
                showToast('Saved — find it in your Completed Reports list below.', 'info');
            }
        }
        return;
    }

    if (entered === MANAGER_PASSCODE) {
        passcodeModal.style.display = 'none';
        enterManagerPortal();
        return;
    }

    // Wrong passcode
    passcodeError.innerText = 'Invalid passcode. Access Denied.';
    passcodeError.style.display = 'block';
    passcodeInput.value = '';
    // Brief shake animation
    passcodeInput.style.borderColor = 'var(--color-danger)';
    passcodeInput.focus();
    setTimeout(() => {
        passcodeInput.style.borderColor = '';
        passcodeError.style.display = 'none';
    }, 2500);
}

// ============================================================
// THEME TOGGLE
// ============================================================
function toggleTheme() {
    const root = document.documentElement;
    const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', newTheme);
    sunIcon.style.display  = newTheme === 'dark' ? 'block' : 'none';
    moonIcon.style.display = newTheme === 'light' ? 'block' : 'none';

    // Re-render active report charts with correct color scheme
    if (analysisView.classList.contains('active')) {
        const id = document.getElementById('assessmentId').value;
        const rec = assessments.find(a => a.id === id);
        if (rec) setTimeout(() => renderCharts(rec), 80);
    }
}

// ============================================================
// DYNAMIC QUESTIONS & SUPERVISOR TABLE GENERATION
// ============================================================
function generateQuestionsUI() {
    const createLikert = (qId) => {
        let html = `<div class="likert-scale">`;
        for (let v = 1; v <= 5; v++) {
            html += `
                <div class="likert-option">
                    <input type="radio" name="q_${qId}" value="${v}" required>
                    <div class="likert-label">${v}</div>
                </div>`;
        }
        return html + `</div>`;
    };

    const fill = (containerId, questions) => {
        document.getElementById(containerId).innerHTML = questions.map(q =>
            `<div class="question-row">
                <div class="question-text">
                    <span class="question-number">${q.id}.</span> ${q.text}
                </div>
                ${createLikert(q.id)}
            </div>`
        ).join('');
    };

    fill('sectionAQuestions', questionsData.sectionA);
    fill('sectionBQuestions', questionsData.sectionB);
    fill('sectionCQuestions', questionsData.sectionC);
    fill('sectionDQuestions', questionsData.sectionD);
}

function generateSupervisorUI() {
    document.getElementById('supervisorCompetencyRows').innerHTML =
        supervisorCompetencies.map(comp =>
            `<tr>
                <td style="font-weight:500;">${comp.label}</td>
                ${[1,2,3,4,5].map(v =>
                    `<td class="center-align">
                        <input type="radio" name="${comp.key}" value="${v}"
                            style="width:18px;height:18px;cursor:pointer;accent-color:var(--color-success);" required>
                    </td>`
                ).join('')}
            </tr>`
        ).join('');
}

// ============================================================
// VIEW ROUTER
// ============================================================
function switchView(targetView) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    targetView.classList.add('active');
}

function showDashboard() {
    if (!isAdminMode) return;
    loadAssessments();
    calculateSaaSMetrics();
    renderDashboard();
    switchView(dashboardView);
}

// ============================================================
// FORM — OPEN / RESET
// ============================================================
function openAssessmentForm(record = null, adminCreatedNew = false) {
    assessmentForm.reset();
    document.getElementById('assessmentId').value = '';
    document.getElementById('trainingDate').value  = '2026-03-04';
    document.getElementById('assessmentDate').valueAsDate = new Date();

    // Show/hide admin-only tabs based on mode
    const showStages45 = isAdminMode || isManagerMode;
    document.getElementById('tabStage4').style.display = showStages45 ? 'inline-block' : 'none';
    document.getElementById('tabStage5').style.display = showStages45 ? 'inline-block' : 'none';
    document.getElementById('deadlineBanner').style.display = showStages45 ? 'none' : 'block';

    let startStage = 1;

    if (record) {
        // Populate all fields
        document.getElementById('assessmentId').value    = record.id;
        document.getElementById('trainingTitle').value   = record.metadata.trainingTitle;
        document.getElementById('trainingDate').value    = record.metadata.trainingDate;
        document.getElementById('participantName').value = record.metadata.participantName;
        document.getElementById('participantDept').value = record.metadata.participantDept;
        document.getElementById('assessmentDate').value  = record.metadata.assessmentDate;
        document.getElementById('supervisorAssessEmployeeName').value = record.metadata.participantName || '';

        // Likert answers
        Object.entries(record.responses || {}).forEach(([key, val]) => {
            const inp = assessmentForm.querySelector(`input[name="${key}"][value="${val}"]`);
            if (inp) inp.checked = true;
        });

        // Barriers
        (record.barriers || []).forEach(b => {
            const cb = assessmentForm.querySelector(`input[name="barriers"][value="${b}"]`);
            if (cb) cb.checked = true;
        });

        // Open questions
        document.getElementById('openQ1').value = record.feedback?.openQ1 || '';
        document.getElementById('openQ2').value = record.feedback?.openQ2 || '';

        // Supervisor
        if (record.supervisor) {
            document.getElementById('supervisorName').value     = record.supervisor.name || '';
            document.getElementById('supervisorComments').value = record.supervisor.comments || '';
            supervisorCompetencies.forEach(comp => {
                const v = record.supervisor.ratings?.[comp.key];
                if (v) {
                    const inp = assessmentForm.querySelector(`input[name="${comp.key}"][value="${v}"]`);
                    if (inp) inp.checked = true;
                }
            });
            const oc = assessmentForm.querySelector(`input[name="observedChange"][value="${record.supervisor.observedChange}"]`);
            if (oc) oc.checked = true;
            const ip = assessmentForm.querySelector(`input[name="improvedPerformance"][value="${record.supervisor.improvedPerformance}"]`);
            if (ip) ip.checked = true;
        }

        // KPIs
        if (record.kpis) {
            const k = record.kpis;
            const set = (id, val) => { if (val !== null) document.getElementById(id).value = val; };
            set('kpiSalesBefore',  k.salesBefore);
            set('kpiSalesAfter',   k.salesAfter);
            set('kpiCustBefore',   k.custBefore);
            set('kpiCustAfter',    k.custAfter);
            set('kpiRetBefore',    k.retBefore);
            set('kpiRetAfter',     k.retAfter);
            set('kpiTargetBefore', k.targetBefore);
            set('kpiTargetAfter',  k.targetAfter);
            if (k.customName) document.getElementById('kpiCustomName').value = k.customName;
            set('kpiCustomBefore', k.customBefore);
            set('kpiCustomAfter',  k.customAfter);
        }

        // If pending, open at Supervisor Validation tab
        if (record.status === 'pending' && (isAdminMode || isManagerMode)) startStage = 4;
    }

    goToStage(startStage);
    switchView(formView);
}

// ============================================================
// FORM STAGE NAVIGATION
// ============================================================
function goToStage(n) {
    document.querySelectorAll('.form-stage').forEach(s => s.style.display = 'none');
    document.getElementById(`stage${n}`).style.display = 'block';

    stageTabs.forEach(tab => {
        tab.classList.toggle('active', parseInt(tab.dataset.stage) === n);
    });

    activeStage = n;
    formBackBtn.style.visibility = n === 1 ? 'hidden' : 'visible';

    // Determine the LAST stage for current role
    const lastStage = (isAdminMode || isManagerMode) ? 5 : 3;
    if (n >= lastStage) {
        formNextBtn.style.display   = 'none';
        formSubmitBtn.style.display = 'inline-flex';
        formSubmitBtn.innerText = isManagerMode ? 'Send Completed Report to Admin'
                                : isAdminMode    ? 'Generate Report'
                                : 'Submit Assessment';
    } else {
        formNextBtn.style.display   = 'inline-flex';
        formSubmitBtn.style.display = 'none';
    }
}

function handleNextStage() {
    if (validateCurrentStage()) goToStage(activeStage + 1);
}

function handlePrevStage() {
    goToStage(activeStage - 1);
}

// ============================================================
// FORM VALIDATION — ROLE-AWARE (BUG FIX #2)
// ============================================================
// Previously: Validated ALL required fields, including hidden admin-only stages 4-5
// This caused clients to fail validation on stage 3 because hidden stages were empty
// Now: Only validates fields accessible to the current user's role
function validateCurrentStage() {
    const container = document.getElementById(`stage${activeStage}`);
    const required  = container.querySelectorAll('[required]');
    let valid = true;

    // Determine max stage accessible by current user
    const maxAccessibleStage = (isAdminMode || isManagerMode) ? 5 : 3;
    
    // Skip validation if user is somehow on a stage they shouldn't access
    if (activeStage > maxAccessibleStage) return true;

    // Text/date inputs
    required.forEach(inp => {
        if (inp.type !== 'radio' && !inp.checkValidity()) {
            valid = false;
            inp.reportValidity();
        }
    });

    // Radio groups — FIXED: Filter out admin-only fields for client mode
    const radioGroups = [...new Set(
        [...required]
            .filter(i => i.type === 'radio' && !i.closest('.admin-only'))
            .map(i => i.name)
    )];
    
    for (const name of radioGroups) {
        const checked = container.querySelector(`input[name="${name}"]:checked`);
        if (!checked) {
            const row = container.querySelector(`input[name="${name}"]`)
                ?.closest('.question-row') || container.querySelector(`input[name="${name}"]`)?.closest('tr');
            if (row) {
                row.style.borderColor = 'var(--color-danger)';
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => row.style.borderColor = '', 2500);
            }
            showToast('Please complete all ratings before proceeding.', 'warning');
            return false;
        }
    }

    return valid;
}

// ============================================================
// FORM SUBMIT
// ============================================================
function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('assessmentId').value || generateUUID();

    // Collect Likert answers 1-25
    const responses = {};
    for (let i = 1; i <= 25; i++) {
        const checked = assessmentForm.querySelector(`input[name="q_${i}"]:checked`);
        responses[`q_${i}`] = checked ? parseInt(checked.value) : 3;
    }

    // Collect barriers
    const barriers = [...assessmentForm.querySelectorAll('input[name="barriers"]:checked')].map(cb => cb.value);

    const parseNum = (elId) => {
        const v = document.getElementById(elId).value;
        return v === '' ? null : parseFloat(v);
    };

    // ---- CLIENT SUBMISSION ----
    if (!isAdminMode && !isManagerMode) {
        // Safety check: form may have been left open across the deadline boundary
        if (new Date() > SUBMISSION_DEADLINE) {
            switchView(document.getElementById('submissionClosedView'));
            showToast('The submission window has closed.', 'warning');
            return;
        }

        const record = {
            id,
            status: 'pending',
            metadata: {
                trainingTitle:   document.getElementById('trainingTitle').value,
                trainingDate:    document.getElementById('trainingDate').value,
                participantName: document.getElementById('participantName').value,
                participantDept: document.getElementById('participantDept').value,
                assessmentDate:  document.getElementById('assessmentDate').value
            },
            responses,
            barriers,
            feedback: {
                openQ1: document.getElementById('openQ1').value,
                openQ2: document.getElementById('openQ2').value
            },
            supervisor: null,
            kpis:       null
        };

        const idx = assessments.findIndex(a => a.id === id);
        if (idx > -1) assessments[idx] = record; else assessments.push(record);
        saveAssessments();

        // Email employee responses directly to Admin for immediate visibility
        sendAssessmentEmail(record, ADMIN_EMAIL);

        showToast('✓ Assessment submitted successfully!', 'success');
        switchView(thankYouView);
        return;
    }

    // ---- MANAGER SUBMISSION (Stages 4-5, then forward to Admin) ----
    if (isManagerMode) {
        const employeeName = document.getElementById('supervisorAssessEmployeeName').value.trim() || 'Unknown';

        const ratings = {};
        supervisorCompetencies.forEach(comp => {
            const chk = assessmentForm.querySelector(`input[name="${comp.key}"]:checked`);
            ratings[comp.key] = chk ? parseInt(chk.value) : null;
        });

        const supervisorData = {
            name:                document.getElementById('supervisorName').value,
            ratings,
            observedChange:      assessmentForm.querySelector('input[name="observedChange"]:checked')?.value || 'No',
            improvedPerformance: assessmentForm.querySelector('input[name="improvedPerformance"]:checked')?.value || 'No',
            comments:            document.getElementById('supervisorComments').value
        };

        const kpiData = {
            salesBefore:  parseNum('kpiSalesBefore'),
            salesAfter:   parseNum('kpiSalesAfter'),
            custBefore:   parseNum('kpiCustBefore'),
            custAfter:    parseNum('kpiCustAfter'),
            retBefore:    parseNum('kpiRetBefore'),
            retAfter:     parseNum('kpiRetAfter'),
            targetBefore: parseNum('kpiTargetBefore'),
            targetAfter:  parseNum('kpiTargetAfter'),
            customName:   document.getElementById('kpiCustomName').value || null,
            customBefore: parseNum('kpiCustomBefore'),
            customAfter:  parseNum('kpiCustomAfter')
        };

        // Standalone record — no existing employee submission involved.
        // Supervisor never sees or references the employee's own answers (Phase 2 requirement).
        // Merging this with the employee's Sections A-D self-assessment is Phase 3 (final analysis).
        const record = {
            id,
            type:   'supervisor_only',
            status: 'completed',
            employeeName,
            supervisor:  supervisorData,
            kpis:        kpiData,
            submittedAt: new Date().toISOString()
        };

        assessments.push(record);
        saveAssessments();
        showToast('✓ Assessment complete! Sending to Admin...', 'success');

        sendAssessmentEmail(record, ADMIN_EMAIL, 'supervisor');
        showManagerThankYou(employeeName);
        return;
    }

    // ---- ADMIN SUBMISSION ----
    const ratings = {};
    supervisorCompetencies.forEach(comp => {
        const chk = assessmentForm.querySelector(`input[name="${comp.key}"]:checked`);
        ratings[comp.key] = chk ? parseInt(chk.value) : null;
    });

    const hasSupervisor = Object.values(ratings).some(v => v !== null);
    const supervisorData = hasSupervisor ? {
        name:                document.getElementById('supervisorName').value,
        ratings,
        observedChange:      assessmentForm.querySelector('input[name="observedChange"]:checked')?.value || 'No',
        improvedPerformance: assessmentForm.querySelector('input[name="improvedPerformance"]:checked')?.value || 'No',
        comments:            document.getElementById('supervisorComments').value
    } : null;

    const kpiData = {
        salesBefore:  parseNum('kpiSalesBefore'),
        salesAfter:   parseNum('kpiSalesAfter'),
        custBefore:   parseNum('kpiCustBefore'),
        custAfter:    parseNum('kpiCustAfter'),
        retBefore:    parseNum('kpiRetBefore'),
        retAfter:     parseNum('kpiRetAfter'),
        targetBefore: parseNum('kpiTargetBefore'),
        targetAfter:  parseNum('kpiTargetAfter'),
        customName:   document.getElementById('kpiCustomName').value || null,
        customBefore: parseNum('kpiCustomBefore'),
        customAfter:  parseNum('kpiCustomAfter')
    };

    const record = {
        id,
        status: 'completed',
        metadata: {
            trainingTitle:   document.getElementById('trainingTitle').value,
            trainingDate:    document.getElementById('trainingDate').value,
            participantName: document.getElementById('participantName').value,
            participantDept: document.getElementById('participantDept').value,
            assessmentDate:  document.getElementById('assessmentDate').value
        },
        responses,
        barriers,
        feedback: {
            openQ1: document.getElementById('openQ1').value,
            openQ2: document.getElementById('openQ2').value
        },
        supervisor: supervisorData,
        kpis:       kpiData
    };

    const idx = assessments.findIndex(a => a.id === id);
    if (idx > -1) assessments[idx] = record; else assessments.push(record);
    saveAssessments();
    calculateSaaSMetrics();
    
    // BUG FIX #4: Add user feedback for admin submission
    showToast('✓ Assessment completed! Generating report...', 'success');
    
    showReport(record);
}

// ============================================================
// SAAS DASHBOARD METRICS
// ============================================================
function calculateSaaSMetrics() {
    const completed = assessments.filter(a => a.status === 'completed' && a.type !== 'supervisor_only');
    document.getElementById('statsTotal').innerText = assessments.length;

    if (completed.length === 0) {
        document.getElementById('statsAvgScore').innerText = '0%';
        document.getElementById('statsTopBarrier').innerText = 'None';
        document.getElementById('statsTopComp').innerText   = 'None';
        return;
    }

    // Average overall score
    const avg = completed.reduce((sum, a) => sum + calculateAssessmentScores(a).overallScore, 0) / completed.length;
    document.getElementById('statsAvgScore').innerText = `${avg.toFixed(0)}%`;

    // Top barrier
    const barrierMap = {};
    assessments.forEach(a => (a.barriers || []).filter(b => b !== 'No barriers').forEach(b => {
        barrierMap[b] = (barrierMap[b] || 0) + 1;
    }));
    const topBarrier = Object.entries(barrierMap).sort((a,b) => b[1]-a[1])[0]?.[0] || 'None';
    document.getElementById('statsTopBarrier').innerText = topBarrier;

    // Highest avg supervisor competency
    const compSums = {}, compCnt = {};
    completed.forEach(a => {
        if (a.supervisor?.ratings) {
            supervisorCompetencies.forEach(c => {
                const v = a.supervisor.ratings[c.key];
                if (v) { compSums[c.key] = (compSums[c.key]||0)+v; compCnt[c.key] = (compCnt[c.key]||0)+1; }
            });
        }
    });
    const topComp = supervisorCompetencies
        .map(c => ({ label: c.label, avg: compCnt[c.key] ? compSums[c.key]/compCnt[c.key] : 0 }))
        .sort((a,b) => b.avg-a.avg)[0];
    document.getElementById('statsTopComp').innerText = topComp?.avg > 0 ? topComp.label : 'None';
}

// ============================================================
// DASHBOARD RENDER
// ============================================================
function renderDashboard() {
    assessmentGrid.innerHTML = '';
    // Defensive: drop any malformed/legacy records (from earlier testing) that could crash the render
    const validAssessments = assessments.filter(a => a && a.metadata && a.id);
    if (validAssessments.length === 0) { emptyState.style.display = 'block'; return; }
    emptyState.style.display = 'none';

    validAssessments.forEach(item => {
        const isPending = item.status === 'pending';
        let score = 0;
        let scoreClass = 'improvement';

        if (!isPending) {
            score = calculateAssessmentScores(item).overallScore;
            if (score >= 90) scoreClass = 'exceptional';
            else if (score >= 80) scoreClass = 'high';
            else if (score >= 70) scoreClass = 'good';
            else if (score >= 60) scoreClass = 'moderate';
        }

        const card = document.createElement('div');
        card.className = `assessment-item${isPending ? ' pending-item' : ''}`;
        card.dataset.id = item.id;

        card.innerHTML = `
            <div class="assessment-item-info">
                <h3>${escapeHtml(item.metadata.participantName)}</h3>
                <p><strong>Dept:</strong> ${escapeHtml(item.metadata.participantDept)}</p>
                <p><strong>Date:</strong> ${item.metadata.assessmentDate}</p>
            </div>
            <div class="assessment-item-footer">
                ${isPending
                    ? `<span class="status-badge pending">⏳ Pending Validation</span>`
                    : `<span class="score-badge ${scoreClass}">${score.toFixed(0)}%</span>`
                }
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-secondary btn-sm edit-btn" data-id="${item.id}">
                        ${isPending ? 'Complete' : 'Edit'}
                    </button>
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${item.id}">Delete</button>
                </div>
            </div>`;

        assessmentGrid.appendChild(card);
    });
}

function handleDashboardGridClick(e) {
    const id = e.target.dataset.id || e.target.closest('.assessment-item')?.dataset.id;
    if (!id) return;

    if (e.target.classList.contains('delete-btn')) {
        e.stopPropagation();
        if (confirm('Delete this assessment permanently?')) {
            assessments = assessments.filter(a => a.id !== id);
            saveAssessments();
            renderDashboard();
            calculateSaaSMetrics();
        }
    } else if (e.target.classList.contains('edit-btn')) {
        e.stopPropagation();
        const rec = assessments.find(a => a.id === id);
        if (rec) openAssessmentForm(rec);
    } else {
        const rec = assessments.find(a => a.id === id);
        if (rec && rec.status === 'completed') showReport(rec);
        else if (rec && rec.status === 'pending') openAssessmentForm(rec);
    }
}

// ============================================================
// SCORE CALCULATIONS
// ============================================================
function calculateAssessmentScores(data) {
    const avg = (questions) =>
        questions.reduce((s,q) => s + parseInt(data.responses?.[`q_${q.id}`] || 3), 0) / questions.length;

    const lti = (avg(questionsData.sectionA) / 5) * 100;
    const bci = (avg(questionsData.sectionB) / 5) * 100;
    const pii = (avg(questionsData.sectionC) / 5) * 100;
    const tei = (avg(questionsData.sectionD) / 5) * 100;

    const supRatings = data.supervisor ? Object.values(data.supervisor.ratings).filter(v => v !== null) : [];
    const svi = supRatings.length
        ? (supRatings.reduce((s,v) => s+parseInt(v), 0) / (supRatings.length * 5)) * 100
        : 0;

    let kpiSum = 0, kpiCount = 0;
    if (data.kpis) {
        [
            [data.kpis.salesBefore,  data.kpis.salesAfter],
            [data.kpis.custBefore,   data.kpis.custAfter],
            [data.kpis.retBefore,    data.kpis.retAfter],
            [data.kpis.targetBefore, data.kpis.targetAfter],
            [data.kpis.customBefore, data.kpis.customAfter]
        ].forEach(([b, a]) => {
            if (b !== null && a !== null && !isNaN(b) && !isNaN(a) && b > 0) {
                kpiSum += Math.min(100, (a / b) * 100);
                kpiCount++;
            }
        });
    }
    const bii = kpiCount > 0 ? kpiSum / kpiCount : 0;

    // Weighted overall (exclude missing sections)
    let weights = { lti: 0.20, bci: 0.30, pii: 0.25, svi: 0.15, bii: 0.10 };
    if (!supRatings.length) { weights.svi = 0; }
    if (!kpiCount)          { weights.bii = 0; }
    const total = Object.values(weights).reduce((s,w) => s+w, 0);

    const overallScore = total > 0
        ? (lti*weights.lti + bci*weights.bci + pii*weights.pii + svi*weights.svi + bii*weights.bii) / total
        : 0;

    let interpretation = 'Improvement Required', badgeClass = 'rating-improvement';
    if (overallScore >= 90) { interpretation = 'Exceptional Impact'; badgeClass = 'rating-exceptional'; }
    else if (overallScore >= 80) { interpretation = 'High Impact';       badgeClass = 'rating-high'; }
    else if (overallScore >= 70) { interpretation = 'Good Impact';       badgeClass = 'rating-good'; }
    else if (overallScore >= 60) { interpretation = 'Moderate Impact';   badgeClass = 'rating-moderate'; }

    return { lti, bci, pii, tei, svi, bii, overallScore, interpretation, badgeClass };
}

// ============================================================
// REPORT VIEW
// ============================================================
function showReport(record) {
    document.getElementById('assessmentId').value = record.id;

    document.getElementById('reportParticipant').innerText    = record.metadata.participantName;
    document.getElementById('reportDept').innerText           = record.metadata.participantDept;
    document.getElementById('reportTrainingDate').innerText   = record.metadata.trainingDate;
    document.getElementById('reportAssessmentDate').innerText = record.metadata.assessmentDate;

    const s = calculateAssessmentScores(record);

    document.getElementById('ltiScore').innerText = `${s.lti.toFixed(0)}%`;
    document.getElementById('bciScore').innerText = `${s.bci.toFixed(0)}%`;
    document.getElementById('piiScore').innerText = `${s.pii.toFixed(0)}%`;
    document.getElementById('teiScore').innerText = `${s.tei.toFixed(0)}%`;
    document.getElementById('sviScore').innerText = record.supervisor ? `${s.svi.toFixed(0)}%` : 'N/A';
    document.getElementById('biiScore').innerText = s.bii > 0 ? `${s.bii.toFixed(0)}%` : 'N/A';

    document.getElementById('overallScoreText').innerText = `${s.overallScore.toFixed(0)}%`;

    const circumference = 439.8;
    document.getElementById('overallDialFill').style.strokeDashoffset =
        circumference - (circumference * s.overallScore / 100);

    const badge = document.getElementById('overallRatingBadge');
    badge.innerText   = s.interpretation;
    badge.className   = `rating-badge ${s.badgeClass}`;

    document.getElementById('reportOpenQ1').innerText = record.feedback?.openQ1 || 'No response provided.';
    document.getElementById('reportOpenQ2').innerText = record.feedback?.openQ2 || 'No response provided.';

    if (record.supervisor) {
        document.getElementById('reportObservedChange').innerText      = record.supervisor.observedChange;
        document.getElementById('reportImprovedPerformance').innerText = record.supervisor.improvedPerformance;
        document.getElementById('reportSupervisorComments').innerText  = record.supervisor.comments || 'No comments.';
    } else {
        const notYet = 'Not yet completed — awaiting supervisor review.';
        document.getElementById('reportObservedChange').innerText      = notYet;
        document.getElementById('reportImprovedPerformance').innerText = notYet;
        document.getElementById('reportSupervisorComments').innerText  = notYet;
    }

    // FIX: switch to the visible view BEFORE building charts — Chart.js needs
    // real canvas dimensions, which don't exist while the view is still display:none
    switchView(analysisView);
    renderCharts(record);
}

function handleEditAssessment() {
    const id  = document.getElementById('assessmentId').value;
    const rec = assessments.find(a => a.id === id);
    if (rec) openAssessmentForm(rec);
}

// ============================================================
// CHARTS (SCREEN)
// ============================================================
function renderCharts(record) {
    const s        = calculateAssessmentScores(record);
    const isDark   = document.documentElement.getAttribute('data-theme') !== 'light';
    const grid     = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const txtColor = isDark ? '#9ca3af' : '#475569';

    Chart.defaults.color       = txtColor;
    Chart.defaults.borderColor = grid;

    const destroy = (id) => { if (chartInstances[id]) { chartInstances[id].destroy(); } };

    // 1 — Radar (Supervisor competencies)
    destroy('radarChart');
    if (record.supervisor) {
        const labels = supervisorCompetencies.map(c => c.label);
        const data   = supervisorCompetencies.map(c => record.supervisor.ratings[c.key] || 0);
        chartInstances['radarChart'] = new Chart(document.getElementById('radarChart'), {
            type: 'radar',
            data: { labels, datasets: [{ data, backgroundColor: 'rgba(52,211,153,0.15)', borderColor: '#34d399', borderWidth: 2, pointBackgroundColor: '#34d399' }] },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { r: { angleLines: { color: grid }, grid: { color: grid },
                    pointLabels: { font: { family: 'Outfit', size: 10, weight:'600' }, color: txtColor },
                    suggestedMin: 0, suggestedMax: 5, ticks: { display: false } } },
                plugins: { legend: { display: false } } }
        });
    } else { drawEmpty('radarChart', 'No Supervisor Ratings'); }

    // 2 — Bar (Indices comparison)
    destroy('barChart');
    chartInstances['barChart'] = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: { labels: ['LTI','BCI','PII','TEI','SVI','BII'], datasets: [{
            data: [s.lti, s.bci, s.pii, s.tei, s.svi, s.bii],
            backgroundColor: ['#38bdf8','#a855f7','#ec4899','#f59e0b','#34d399','#6366f1'],
            borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false,
            scales: { y: { min:0, max:100, grid:{ color:grid }, ticks:{ callback:v=>v+'%' } }, x:{ grid:{ display:false } } },
            plugins: { legend: { display: false } } }
    });

    // 3 — KPI Before/After
    destroy('kpiChart');
    buildKPIChart('kpiChart', record, isDark, grid);

    // 4 — Barriers Doughnut
    destroy('barriersChart');
    buildBarriersChart('barriersChart', record, isDark);
}

function buildKPIChart(canvasId, record, isDark, grid) {
    const k = record.kpis;
    if (!k) { drawEmpty(canvasId, 'No KPI Metrics'); return; }

    const labels = [], before = [], after = [];
    const addKPI = (label, b, a) => {
        if (b !== null && a !== null) { labels.push(label); before.push(b); after.push(a); }
    };
    if (k.salesBefore !== null) { labels.push('Sales (Norm)'); before.push(100); after.push((k.salesAfter/k.salesBefore)*100); }
    addKPI('New Customers', k.custBefore,   k.custAfter);
    addKPI('Retention %',   k.retBefore,    k.retAfter);
    addKPI('Target %',      k.targetBefore, k.targetAfter);
    if (k.customBefore !== null) addKPI(k.customName || 'Custom', k.customBefore, k.customAfter);

    if (!labels.length) { drawEmpty(canvasId, 'No KPI Metrics'); return; }

    chartInstances[canvasId] = new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: { labels, datasets: [
            { label:'Before', data:before, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', borderRadius: 4 },
            { label:'After',  data:after,  backgroundColor: '#34d399', borderRadius: 4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false,
            scales: { y:{ grid:{color:grid} }, x:{ grid:{display:false} } },
            plugins: { legend:{ position:'bottom', labels:{ boxWidth:12 } } } }
    });
}

function buildBarriersChart(canvasId, record, isDark) {
    const barriers = (record.barriers || []).filter(b => b !== 'No barriers');
    if (!barriers.length) { drawEmpty(canvasId, '🎉 No Barriers Encountered'); return; }

    chartInstances[canvasId] = new Chart(document.getElementById(canvasId), {
        type: 'doughnut',
        data: { labels: barriers, datasets: [{
            data: barriers.map(() => 1),
            backgroundColor: ['#f87171','#f59e0b','#ec4899','#a855f7','#3b82f6','#38bdf8'],
            borderColor: isDark ? '#0b0f19' : '#fff', borderWidth: 2
        }]},
        options: { responsive: true, maintainAspectRatio: false, cutout:'60%',
            plugins: { legend:{ position:'right', labels:{ boxWidth:12, font:{ size:10 } } } } }
    });
}

function drawEmpty(canvasId, text) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#9ca3af' : '#475569';
    ctx.font = '14px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width/2, canvas.height/2);
}

// ============================================================
// PDF EXPORT — DEDICATED PRINT LAYOUT ENGINE
// ============================================================
function exportToPDF() {
    const id  = document.getElementById('assessmentId').value;
    const rec = assessments.find(a => a.id === id);
    if (!rec) return;

    const s = calculateAssessmentScores(rec);
    const printEl = document.getElementById('pdfPrintContainer');
    const overlay = document.getElementById('pdfGeneratingOverlay');

    // FIX: make the container genuinely visible on-screen BEFORE anything else —
    // charts must be created while it has real, non-zero dimensions, not after.
    // The opaque overlay covers it the whole time so the user only sees a spinner.
    printEl.classList.add('pdf-exporting');
    overlay.classList.add('active');

    // --- Populate text fields ---
    document.getElementById('pdfMetaParticipant').innerText = rec.metadata.participantName;
    document.getElementById('pdfMetaDept').innerText        = rec.metadata.participantDept;
    document.getElementById('pdfMetaDate').innerText        = rec.metadata.assessmentDate;
    document.getElementById('pdfMetaSupervisor').innerText  = rec.supervisor?.name || '—';

    document.getElementById('pdfOverallScore').innerText = `${s.overallScore.toFixed(0)}%`;
    const ratingEl = document.getElementById('pdfOverallRating');
    ratingEl.innerText = s.interpretation;

    const ratingColors = {
        'rating-exceptional': ['#d1fae5','#065f46'],
        'rating-high':        ['#e0f2fe','#075985'],
        'rating-good':        ['#fef3c7','#92400e'],
        'rating-moderate':    ['#fee2e2','#991b1b'],
        'rating-improvement': ['#fee2e2','#991b1b']
    };
    const [bg, col] = ratingColors[s.badgeClass] || ['#f3f4f6','#374151'];
    ratingEl.style.background = bg;
    ratingEl.style.color      = col;

    document.getElementById('pdfLti').innerText = `${s.lti.toFixed(0)}%`;
    document.getElementById('pdfBci').innerText = `${s.bci.toFixed(0)}%`;
    document.getElementById('pdfPii').innerText = `${s.pii.toFixed(0)}%`;
    document.getElementById('pdfTei').innerText = `${s.tei.toFixed(0)}%`;
    document.getElementById('pdfSvi').innerText = rec.supervisor ? `${s.svi.toFixed(0)}%` : 'N/A';
    document.getElementById('pdfBii').innerText = s.bii > 0 ? `${s.bii.toFixed(0)}%` : 'N/A';

    document.getElementById('pdfOpenQ1').innerText = rec.feedback?.openQ1 || 'No response provided.';
    document.getElementById('pdfOpenQ2').innerText = rec.feedback?.openQ2 || 'No response provided.';

    document.getElementById('pdfObservedChange').innerText      = rec.supervisor?.observedChange      || 'N/A';
    document.getElementById('pdfImprovedPerformance').innerText = rec.supervisor?.improvedPerformance || 'N/A';
    document.getElementById('pdfSupervisorComments').innerText  = rec.supervisor?.comments            || 'N/A';

    // KPI table
    const kpiBody = document.getElementById('pdfKpiTableRows');
    kpiBody.innerHTML = '';
    if (rec.kpis) {
        const addRow = (label, b, a) => {
            if (b === null || a === null) return;
            const pct = b > 0 ? ((a-b)/b*100) : 0;
            const col = pct > 0 ? '#10b981' : (pct < 0 ? '#ef4444' : '#374151');
            kpiBody.innerHTML += `<tr><td>${label}</td><td>${b}</td><td>${a}</td>
                <td style="color:${col};font-weight:700;">${pct>0?'+':''}${pct.toFixed(0)}%</td></tr>`;
        };
        if (rec.kpis.salesBefore !== null) addRow('Sales ($)', rec.kpis.salesBefore, rec.kpis.salesAfter);
        addRow('New Customers',     rec.kpis.custBefore,   rec.kpis.custAfter);
        addRow('Retention (%)',     rec.kpis.retBefore,    rec.kpis.retAfter);
        addRow('Target Achieved (%)', rec.kpis.targetBefore, rec.kpis.targetAfter);
        if (rec.kpis.customBefore !== null) addRow(rec.kpis.customName || 'Custom KPI', rec.kpis.customBefore, rec.kpis.customAfter);
    }
    if (!kpiBody.innerHTML) kpiBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#6b7280;">No KPI metrics recorded</td></tr>';

    // --- Prepare the always-rendered print element for capture ---
    clearPrintCharts(); // destroy any stale charts from previous exports

    // --- Render static print-specific charts ---
    const pc = []; // print charts to destroy after export
    const PG = 'rgba(0,0,0,0.07)';
    const PT = '#374151';


    // Radar
    if (rec.supervisor) {
        pc.push(new Chart(document.getElementById('radarChartPrint'), {
            type: 'radar',
            data: { labels: supervisorCompetencies.map(c=>c.label),
                datasets: [{ data: supervisorCompetencies.map(c=>rec.supervisor.ratings[c.key]||0),
                    backgroundColor:'rgba(79,70,229,0.12)', borderColor:'#4f46e5', borderWidth:1.5,
                    pointBackgroundColor:'#4f46e5', pointRadius:2 }] },
            options: { animation:false, responsive:true, maintainAspectRatio:false,
                scales: { r: { angleLines:{color:PG}, grid:{color:PG},
                    pointLabels:{font:{family:'Outfit',size:8,weight:'bold'},color:PT},
                    suggestedMin:0, suggestedMax:5, ticks:{display:false} } },
                plugins:{legend:{display:false}} }
        }));
    } else { drawEmpty('radarChartPrint','No Supervisor Ratings'); }

    // Bar
    pc.push(new Chart(document.getElementById('barChartPrint'), {
        type: 'bar',
        data: { labels:['LTI','BCI','PII','TEI','SVI','BII'],
            datasets:[{ data:[s.lti,s.bci,s.pii,s.tei,s.svi,s.bii],
                backgroundColor:['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#6366f1'],
                borderRadius:3 }] },
        options: { animation:false, responsive:true, maintainAspectRatio:false,
            scales:{ y:{min:0,max:100,grid:{color:PG},ticks:{font:{size:8},callback:v=>v+'%'}},
                x:{grid:{display:false},ticks:{font:{size:8,weight:'bold'}}} },
            plugins:{legend:{display:false}} }
    }));

    // KPI
    const k = rec.kpis;
    if (k) {
        const kLabels=[], kBefore=[], kAfter=[];
        if (k.salesBefore!==null){ kLabels.push('Sales'); kBefore.push(100); kAfter.push((k.salesAfter/k.salesBefore)*100); }
        if (k.custBefore!==null)  { kLabels.push('Customers'); kBefore.push(k.custBefore); kAfter.push(k.custAfter); }
        if (k.retBefore!==null)   { kLabels.push('Retention'); kBefore.push(k.retBefore); kAfter.push(k.retAfter); }
        if (k.targetBefore!==null){ kLabels.push('Target'); kBefore.push(k.targetBefore); kAfter.push(k.targetAfter); }
        if (k.customBefore!==null){ kLabels.push(k.customName||'Custom'); kBefore.push(k.customBefore); kAfter.push(k.customAfter); }

        if (kLabels.length) {
            pc.push(new Chart(document.getElementById('kpiChartPrint'), {
                type: 'bar',
                data: { labels:kLabels, datasets:[
                    { label:'Before', data:kBefore, backgroundColor:'#d1d5db', borderRadius:2 },
                    { label:'After',  data:kAfter,  backgroundColor:'#10b981', borderRadius:2 }
                ]},
                options:{ animation:false, responsive:true, maintainAspectRatio:false,
                    scales:{y:{grid:{color:PG},ticks:{font:{size:8}}},x:{grid:{display:false},ticks:{font:{size:8,weight:'bold'}}}},
                    plugins:{legend:{position:'bottom',labels:{boxWidth:8,font:{size:8}}}} }
            }));
        } else { drawEmpty('kpiChartPrint','No KPI Metrics'); }
    } else { drawEmpty('kpiChartPrint','No KPI Metrics'); }

    // Barriers
    const barrs = (rec.barriers||[]).filter(b=>b!=='No barriers');
    if (barrs.length) {
        pc.push(new Chart(document.getElementById('barriersChartPrint'), {
            type:'doughnut',
            data:{ labels:barrs, datasets:[{ data:barrs.map(()=>1),
                backgroundColor:['#ef4444','#f59e0b','#ec4899','#8b5cf6','#3b82f6','#10b981'],
                borderColor:'#fff', borderWidth:1.5 }] },
            options:{ animation:false, responsive:true, maintainAspectRatio:false, cutout:'60%',
                plugins:{legend:{position:'right',labels:{boxWidth:8,font:{size:8}}}} }
        }));
    } else { drawEmpty('barriersChartPrint','No Barriers Encountered'); }

    // --- BUG FIX #1: Proper async PDF export with feedback ---
    // ISSUE: Old code showed loading state but didn't keep container visible
    // during the async html2pdf() render process, causing blank PDFs
    // FIX: Keep container visible, increase timeout for chart rendering,
    // add proper success/error feedback, ensure charts fully render before export
    
    showToast('Generating PDF... This may take 10-15 seconds', 'info');
    
    // --- BUG FIX (final): render on-screen for capture, covered by opaque overlay ---
    // Off-screen positioning (top:-9999px) was confirmed unreliable — html2canvas
    // kept producing blank/incomplete output regardless of capture option overrides.
    // Rendering the container genuinely on-screen (behind a solid loading cover)
    // removes all ambiguity: html2canvas is capturing exactly what a normal,
    // visible, fully-laid-out element looks like. (Container was already made
    // visible at the top of this function, before charts were created.)
    function cleanupPdfUI() {
        printEl.classList.remove('pdf-exporting');
        overlay.classList.remove('active');
        pc.forEach(c => c.destroy());
    }

    setTimeout(() => {
        html2pdf()
            .set({
                margin: 0,
                filename: `SPTIA_${rec.metadata.participantName.replace(/\s+/g,'_')}.pdf`,
                image: { type:'jpeg', quality:1.0 },
                html2canvas: { scale:2.5, useCORS:true, logging:false, allowTaint:true },
                jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
            })
            .from(printEl)
            .save()
            .then(() => {
                cleanupPdfUI();
                showToast('✓ PDF downloaded successfully!', 'success');
            })
            .catch(err => {
                console.error('PDF Export Error:', err);
                cleanupPdfUI();
                showToast('⚠ PDF export failed: ' + (err.message || 'Unknown error'), 'error');
            });
    }, 800);  // Increased from 500ms to 800ms to allow full chart rendering
}

// ============================================================
// SILENT EMAIL DELIVERY (via EmailJS)
// ============================================================
// FIX: Neither the client nor the manager ever sees a link or access code.
// Used for TWO flows:
//   1) Client submits  -> emails the assigned MANAGER (record.status = 'pending')
//   2) Manager submits -> emails the ADMIN, dad         (record.status = 'completed')
// The recipient just clicks the link in their email — it opens the app,
// auto-imports the record, and prompts for the correct role passcode.
function sendAssessmentEmail(record, recipientEmail, kind = 'employee') {
    const payload    = unicodeStringToBase64(JSON.stringify(record));
    const importUrl  = `${window.location.origin}${window.location.pathname}?import=${encodeURIComponent(payload)}`;

    if (!recipientEmail) {
        console.error('No recipient email set — assessment was NOT emailed.');
        showToast('⚠ No recipient configured for this submission.', 'error');
        return;
    }

    if (!window.emailjs) {
        console.error('EmailJS not loaded — assessment was NOT emailed.');
        showToast('⚠ Could not reach the mailbox. Please notify your advisor manually.', 'error');
        return;
    }

    // Supervisor-only records have no `metadata` block (no training/department/dates —
    // the supervisor never touches the employee's own submission). Map fields safely
    // for either record shape so this single template/function covers both flows.
    const templateParams = kind === 'supervisor'
        ? {
            to_email:          recipientEmail,
            participant_name:  `${record.employeeName} (Supervisor Assessment)`,
            participant_dept:  record.supervisor?.name ? `Supervisor: ${record.supervisor.name}` : '—',
            training_title:    'Supervisor-Only Assessment',
            assessment_date:   (record.submittedAt || '').slice(0, 10) || '—',
            access_code:       importUrl
        }
        : {
            to_email:          recipientEmail,
            participant_name:  record.metadata?.participantName || 'Unknown',
            participant_dept:  record.metadata?.participantDept || '—',
            training_title:    record.metadata?.trainingTitle   || '—',
            assessment_date:   record.metadata?.assessmentDate  || '—',
            access_code:       importUrl   // clickable link — opens app, auto-imports, then asks for the right passcode
        };

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams).then(() => {
        console.log(`Assessment emailed to ${recipientEmail} successfully.`);
    }).catch(err => {
        console.error('EmailJS send failed:', err);
        showToast('⚠ Submission saved, but the automatic email failed to send.', 'warning');
    });
}

// ============================================================
// IMPORT / EXPORT BACKUP
// ============================================================
function exportAllData() {
    if (!assessments.length) { alert('No data to export.'); return; }
    const a = document.createElement('a');
    a.href     = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(assessments, null, 2));
    a.download = 'sylver_backup.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function handleImportData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            if (!Array.isArray(imported)) throw new Error('Not a valid array.');
            if (!imported.every(r => r.id && r.metadata && r.responses)) throw new Error('Invalid record structure.');
            imported.forEach(r => {
                const i = assessments.findIndex(a => a.id === r.id);
                if (i > -1) assessments[i] = r; else assessments.push(r);
            });
            saveAssessments();
            renderDashboard();
            calculateSaaSMetrics();
            alert(`Imported ${imported.length} record(s).`);
        } catch (err) { alert('Import failed: ' + err.message); }
    };
    reader.readAsText(file);
}

// ============================================================
// PRINT CHART CLEANUP UTILITY
// ============================================================
const PRINT_CANVAS_IDS = ['radarChartPrint','barChartPrint','kpiChartPrint','barriersChartPrint'];

function clearPrintCharts() {
    PRINT_CANVAS_IDS.forEach(id => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        // Destroy any existing Chart.js instance on the canvas
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();
        // Clear the raw canvas pixels
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
}

// ============================================================
// UTILITIES
// ============================================================
function unicodeStringToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function generateUUID() {
    return 'xxxx-xxxx-4xxx-yxxx-xxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
        return v.toString(16);
    });
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.innerText = str;
    return d.innerHTML;
}
