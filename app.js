const SUPABASE_CONFIG = window.SUPABASE_CONFIG || {};
const SUPABASE_URL = SUPABASE_CONFIG.url || "";
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey || "";
const STORAGE_BUCKET = SUPABASE_CONFIG.storageBucket || "qc-attachments";
const isSupabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes("YOUR_PROJECT_REF") &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY");
const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

const loginScreen = document.querySelector("#loginScreen");
const loginForm = document.querySelector("#loginForm");
const loginUsername = document.querySelector("#loginUsername");
const loginPassword = document.querySelector("#loginPassword");
const confirmPassword = document.querySelector("#confirmPassword");
const loginError = document.querySelector("#loginError");
const authEyebrow = document.querySelector("#authEyebrow");
const authHelp = document.querySelector("#authHelp");
const authSubmitBtn = document.querySelector("#authSubmitBtn");
const loginModeBtn = document.querySelector("#loginModeBtn");
const registerModeBtn = document.querySelector("#registerModeBtn");
const registerOnlyElements = document.querySelectorAll(".register-only");
const appOnlyElements = document.querySelectorAll(".app-only");
const form = document.querySelector("#reportForm");
const reportList = document.querySelector("#reportList");
const photoInput = document.querySelector("#photos");
const documentInput = document.querySelector("#documents");
const photoPreview = document.querySelector("#photoPreview");
const documentPreview = document.querySelector("#documentPreview");
const openCameraBtn = document.querySelector("#openCameraBtn");
const capturePhotoBtn = document.querySelector("#capturePhotoBtn");
const closeCameraBtn = document.querySelector("#closeCameraBtn");
const cameraBox = document.querySelector("#cameraBox");
const cameraVideo = document.querySelector("#cameraVideo");
const cameraCanvas = document.querySelector("#cameraCanvas");
const qcModal = document.querySelector("#qcModal");
const modalTitle = document.querySelector("#modalTitle");
const modalDetails = document.querySelector("#modalDetails");
const qcNote = document.querySelector("#qcNote");
const approveBtn = document.querySelector("#approveBtn");
const revisionBtn = document.querySelector("#revisionBtn");
const clearSignature = document.querySelector("#clearSignature");
const signatureCanvas = document.querySelector("#signatureCanvas");
const exportBtn = document.querySelector("#exportBtn");
const resetBtn = document.querySelector("#resetBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const activeUserBadge = document.querySelector("#activeUserBadge");
const searchInput = document.querySelector("#searchInput");
const dateInput = document.querySelector("#dateInput");
const editModal = document.querySelector("#editModal");
const editForm = document.querySelector("#editForm");
const closeEditModal = document.querySelector("#closeEditModal");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const editPhotos = document.querySelector("#editPhotos");
const editDocuments = document.querySelector("#editDocuments");
const previewModal = document.querySelector("#previewModal");
const previewModalTitle = document.querySelector("#previewModalTitle");
const previewBody = document.querySelector("#previewBody");
const closePreviewModal = document.querySelector("#closePreviewModal");
const closePreviewBtn = document.querySelector("#closePreviewBtn");

let activeUser = null;
let activeUsername = "";
let reports = [];
let activeDateFilter = "all";
let activeStatusFilter = "Menunggu QC";
let selectedDate = "";
let searchQuery = "";
let authMode = "login";
let activeReportId = null;
let activeEditReportId = null;
let signatureHasInk = false;
let cameraStream = null;
let cameraPhotos = [];

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function usernameToEmail(username) {
  if (username.includes("@")) return username;
  return `${username}@cvputrafarma-qc.local`;
}

async function fetchReports() {
  if (!activeUser) return [];
  const { data, error } = await supabaseClient
    .from("qc_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const mappedReports = (data || []).map(rowToReport);
  await hydrateAttachmentUrls(mappedReports);
  return mappedReports;
}

async function saveReport(report) {
  const { error } = await supabaseClient.from("qc_reports").upsert(reportToRow(report), {
    onConflict: "id",
  });
  if (error) throw error;
}

async function refreshReports() {
  reports = await fetchReports();
  render();
}

async function handleLogin(event) {
  event.preventDefault();

  const username = normalizeUsername(loginUsername.value);
  const password = loginPassword.value;
  const passwordConfirmation = confirmPassword.value;

  if (!isSupabaseConfigured) {
    loginError.textContent = "Supabase belum dikonfigurasi. Isi config.js terlebih dahulu.";
    return;
  }
  if (!username || !password) {
    loginError.textContent = "Nama akun dan password wajib diisi.";
    return;
  }

  try {
    if (password.length < 4) {
      loginError.textContent = "Password minimal 4 karakter.";
      return;
    }
    if (authMode === "register" && password !== passwordConfirmation) {
      loginError.textContent = "Ulangi password belum sama.";
      return;
    }

    const email = usernameToEmail(username);
    const authResult =
      authMode === "register"
        ? await supabaseClient.auth.signUp({
            email,
            password,
            options: {
              data: {
                username,
              },
            },
          })
        : await supabaseClient.auth.signInWithPassword({
            email,
            password,
          });

    if (authResult.error) throw authResult.error;
    if (!authResult.data.session && authMode === "register") {
      throw new Error("Akun dibuat, tapi perlu verifikasi email. Nonaktifkan email confirmation di Supabase untuk login langsung.");
    }

    activeUser = authResult.data.user;
    activeUsername = activeUser.user_metadata?.username || username;
    reports = await fetchReports();
    loginForm.reset();
    loginError.textContent = "";
    showApp();
  } catch (error) {
    loginError.textContent = error.message;
  }
}

function logout() {
  activeUser = "";
  activeUsername = "";
  reports = [];
  if (supabaseClient) supabaseClient.auth.signOut();
  showLogin();
}

function showApp() {
  loginScreen.classList.add("hidden");
  appOnlyElements.forEach((element) => element.classList.remove("hidden"));
  activeUserBadge.textContent = `Akun: ${activeUsername}`;
  render();
}

function showLogin() {
  appOnlyElements.forEach((element) => element.classList.add("hidden"));
  loginScreen.classList.remove("hidden");
  setAuthMode("login");
  loginUsername.focus();
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegister = mode === "register";
  loginModeBtn.classList.toggle("active", !isRegister);
  registerModeBtn.classList.toggle("active", isRegister);
  registerOnlyElements.forEach((element) => element.classList.toggle("hidden", !isRegister));
  confirmPassword.required = isRegister;
  confirmPassword.value = "";
  loginError.textContent = "";
  authEyebrow.textContent = isRegister ? "Daftar Akun QC" : "Login QC Produksi";
  authHelp.textContent = isRegister
    ? "Buat akun baru. Data laporan akun ini akan tersimpan di Supabase."
    : "Masuk dengan akun yang sudah terdaftar di Supabase.";
  authSubmitBtn.textContent = isRegister ? "Daftar dan Masuk" : "Masuk";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function reportToRow(report) {
  return {
    id: report.id,
    user_id: activeUser.id,
    created_at: report.createdAt,
    division: report.division,
    batch_name: report.batchName,
    quantity: report.quantity,
    unit: report.unit,
    reporter: report.reporter,
    note: report.note,
    photos: report.photos || [],
    documents: report.documents || [],
    status: report.status,
    qc_note: report.qcNote || "",
    signature: report.signature || "",
    reviewed_at: report.reviewedAt || null,
    resubmitted_at: report.resubmittedAt || null,
  };
}

function rowToReport(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    division: row.division,
    batchName: row.batch_name,
    quantity: row.quantity,
    unit: row.unit,
    reporter: row.reporter,
    note: row.note || "",
    photos: row.photos || [],
    documents: row.documents || [],
    status: row.status,
    qcNote: row.qc_note || "",
    signature: row.signature || "",
    reviewedAt: row.reviewed_at || "",
    resubmittedAt: row.resubmitted_at || "",
  };
}

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function uploadAttachment(file, reportId, kind) {
  const path = `${activeUser.id}/${reportId}/${kind}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });

  if (error) throw error;

  return {
    name: file.name,
    size: file.size,
    type: file.type || "Dokumen",
    path,
    kind,
  };
}

async function hydrateAttachmentUrls(reportList) {
  const paths = reportList.flatMap((report) => [
    ...(report.photos || []).map((item) => item.path).filter(Boolean),
    ...(report.documents || []).map((item) => item.path).filter(Boolean),
  ]);

  if (paths.length === 0) return;

  const { data, error } = await supabaseClient.storage.from(STORAGE_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw error;

  const urlByPath = new Map(data.map((item) => [item.path, item.signedUrl]));
  reportList.forEach((report) => {
    report.photos = (report.photos || []).map((item) => ({
      ...item,
      dataUrl: item.dataUrl || urlByPath.get(item.path) || "",
    }));
    report.documents = (report.documents || []).map((item) => ({
      ...item,
      dataUrl: item.dataUrl || urlByPath.get(item.path) || "",
    }));
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status) {
  if (status === "ACC QC") return "status-approved";
  if (status === "Revisi") return "status-revision";
  return "status-pending";
}

function cardStatusClass(status) {
  if (status === "ACC QC") return "card-approved";
  if (status === "Revisi") return "card-revision";
  return "card-pending";
}

function statusLabel(status) {
  if (status === "ACC QC") return "Selesai";
  if (status === "Revisi") return "Reject";
  return "Perlu QC";
}

function matchesDateFilter(report) {
  if (selectedDate) {
    return toDateInputValue(report.createdAt) === selectedDate;
  }

  if (activeDateFilter === "all") return true;

  const reportDate = new Date(report.createdAt);
  const now = new Date();
  const sameYear = reportDate.getFullYear() === now.getFullYear();
  const sameMonth = sameYear && reportDate.getMonth() === now.getMonth();
  const sameDay = sameMonth && reportDate.getDate() === now.getDate();

  if (activeDateFilter === "day") return sameDay;
  if (activeDateFilter === "month") return sameMonth;
  if (activeDateFilter === "year") return sameYear;
  return true;
}

function toDateInputValue(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getVisibleReports() {
  return reports.filter(matchesDateFilter).filter(matchesSearch).filter(matchesStatusFilter);
}

function matchesStatusFilter(report) {
  return report.status === activeStatusFilter;
}

function matchesSearch(report) {
  if (!searchQuery) return true;

  const searchableText = [
    report.division,
    report.batchName,
    report.quantity,
    report.unit,
    report.reporter,
    report.note,
    report.status,
    report.qcNote,
    report.documents.map((doc) => doc.name).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(searchQuery);
}

function updatePreviews() {
  photoPreview.innerHTML = "";
  [...photoInput.files].forEach((file) => {
    const img = document.createElement("img");
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    photoPreview.append(img);
  });
  cameraPhotos.forEach((file) => {
    const img = document.createElement("img");
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    photoPreview.append(img);
  });

  documentPreview.innerHTML = "";
  [...documentInput.files].forEach((file) => {
    const item = document.createElement("li");
    item.textContent = `${file.name} (${Math.ceil(file.size / 1024)} KB)`;
    documentPreview.append(item);
  });
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("Browser/perangkat ini belum mendukung akses kamera.");
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
      },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
    cameraBox.classList.remove("hidden");
    capturePhotoBtn.classList.remove("hidden");
    closeCameraBtn.classList.remove("hidden");
    openCameraBtn.classList.add("hidden");
  } catch {
    alert("Kamera tidak bisa dibuka. Pastikan izin kamera sudah diberikan.");
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
  }
  cameraStream = null;
  cameraVideo.srcObject = null;
  cameraBox.classList.add("hidden");
  capturePhotoBtn.classList.add("hidden");
  closeCameraBtn.classList.add("hidden");
  openCameraBtn.classList.remove("hidden");
}

function captureCameraPhoto() {
  if (!cameraStream) return;

  const width = cameraVideo.videoWidth || 1280;
  const height = cameraVideo.videoHeight || 960;
  cameraCanvas.width = width;
  cameraCanvas.height = height;
  const ctx = cameraCanvas.getContext("2d");
  ctx.drawImage(cameraVideo, 0, 0, width, height);
  cameraCanvas.toBlob((blob) => {
    if (!blob) return;
    const file = new File([blob], `kamera-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`, {
      type: "image/jpeg",
    });
    cameraPhotos.push(file);
    updatePreviews();
  }, "image/jpeg", 0.88);
}

async function handleSubmit(event) {
  event.preventDefault();
  const reportId = crypto.randomUUID();
  const selectedPhotos = [...photoInput.files, ...cameraPhotos];

  const photos = await Promise.all(
    selectedPhotos.map((file) => uploadAttachment(file, reportId, "photos")),
  );

  const documents = await Promise.all(
    [...documentInput.files].map((file) => uploadAttachment(file, reportId, "documents")),
  );

  const report = {
    id: reportId,
    createdAt: new Date().toISOString(),
    division: document.querySelector("#division").value,
    batchName: document.querySelector("#batchName").value.trim(),
    quantity: document.querySelector("#quantity").value,
    unit: document.querySelector("#unit").value,
    reporter: document.querySelector("#reporter").value.trim(),
    note: document.querySelector("#note").value.trim(),
    photos,
    documents,
    status: "Menunggu QC",
    qcNote: "",
    signature: "",
    reviewedAt: "",
  };

  reports.unshift(report);
  await saveReport(report);
  await hydrateAttachmentUrls([report]);
  form.reset();
  cameraPhotos = [];
  closeCamera();
  updatePreviews();
  render();
}

function renderSummary() {
  const filteredReports = reports.filter(matchesDateFilter).filter(matchesSearch);
  document.querySelector("#totalCount").textContent = filteredReports.length;
  document.querySelector("#pendingCount").textContent = filteredReports.filter((item) => item.status === "Menunggu QC").length;
  document.querySelector("#approvedCount").textContent = filteredReports.filter((item) => item.status === "ACC QC").length;
  document.querySelector("#revisionCount").textContent = filteredReports.filter((item) => item.status === "Revisi").length;
}

function renderReports() {
  const filteredReports = reports.filter(matchesDateFilter).filter(matchesSearch);
  document.querySelector("#pendingColumnCount").textContent = filteredReports.filter((item) => item.status === "Menunggu QC").length;
  document.querySelector("#revisionColumnCount").textContent = filteredReports.filter((item) => item.status === "Revisi").length;
  document.querySelector("#doneColumnCount").textContent = filteredReports.filter((item) => item.status === "ACC QC").length;

  const visibleReports = getVisibleReports();
  reportList.innerHTML = "";

  if (visibleReports.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `Belum ada laporan ${statusLabel(activeStatusFilter)}.`;
    reportList.append(empty);
    return;
  }

  visibleReports.forEach((report) => {
    reportList.append(createReportCard(report));
  });
}

function createReportCard(report) {
  const card = document.createElement("article");
  card.className = `report-card ${cardStatusClass(report.status)}`;

  const photos = report.photos
    .slice(0, 4)
    .map(
      (photo, index) => `
        <a class="attachment-thumb" href="${photo.dataUrl}" download="${escapeHtml(photo.name)}" target="_blank" rel="noreferrer">
          <img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}">
          <span>Foto ${index + 1}</span>
        </a>
      `,
    )
    .join("");
  const documents = report.documents
    .map((documentFile) => {
      const size = documentFile.size ? `${Math.ceil(documentFile.size / 1024)} KB` : "file lama";
      if (!documentFile.dataUrl) {
        return `<li><span>${escapeHtml(documentFile.name)} (${size})</span></li>`;
      }

      return `
        <li>
          <span>${escapeHtml(documentFile.name)} (${size})</span>
          <a href="${documentFile.dataUrl}" target="_blank" rel="noreferrer">Preview</a>
          <a href="${documentFile.dataUrl}" download="${escapeHtml(documentFile.name)}">Download</a>
        </li>
      `;
    })
    .join("");
  const editButton =
    report.status === "Revisi"
      ? `<button class="primary-button" data-edit="${report.id}" type="button">Perbaiki</button>`
      : report.status === "ACC QC"
        ? `
          <button class="ghost-button" data-pdf="${report.id}" type="button">Download PDF</button>
          <button class="primary-button" data-preview="${report.id}" type="button">Preview</button>
        `
      : `<button class="primary-button" data-review="${report.id}" type="button">Review QC</button>`;

  card.innerHTML = `
      <div class="report-card-top">
        <div class="report-title">
          <strong>${escapeHtml(report.batchName)}</strong>
          <span>${escapeHtml(report.division)} - ${formatDate(report.createdAt)}</span>
        </div>
        <span class="status-pill ${statusClass(report.status)}">${statusLabel(report.status)}</span>
      </div>
      <div class="meta-grid">
        <div><span>Jumlah</span><br><strong>${escapeHtml(report.quantity)} ${escapeHtml(report.unit)}</strong></div>
        <div><span>Pelapor</span><br><strong>${escapeHtml(report.reporter)}</strong></div>
        <div><span>Dokumen</span><br><strong>${report.documents.length} file</strong></div>
      </div>
      ${report.note ? `<p>${escapeHtml(report.note)}</p>` : ""}
      ${
        photos || documents
          ? `
            <div class="attachment-box">
              ${photos ? `<div class="thumb-row">${photos}</div>` : ""}
              ${documents ? `<ul class="document-links">${documents}</ul>` : ""}
            </div>
          `
          : ""
      }
      ${
        report.qcNote
          ? `<p><strong>Catatan QC:</strong> ${escapeHtml(report.qcNote)}</p>`
          : ""
      }
      <div class="report-card-bottom">
        <span>${report.reviewedAt ? `Direview: ${formatDate(report.reviewedAt)}` : "Menunggu keputusan QC"}</span>
        <div class="header-actions">
          ${report.status === "ACC QC" ? "" : `<button class="ghost-button" data-delete="${report.id}" type="button">Hapus</button>`}
          ${editButton}
        </div>
      </div>
    `;

  return card;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  renderSummary();
  renderReports();
}

function openReview(reportId) {
  const report = reports.find((item) => item.id === reportId);
  if (!report) return;

  activeReportId = report.id;
  signatureHasInk = Boolean(report.signature);
  modalTitle.textContent = report.batchName;
  qcNote.value = report.qcNote || "";
  modalDetails.innerHTML = `
    <dt>Divisi</dt><dd>${escapeHtml(report.division)}</dd>
    <dt>Jumlah</dt><dd>${escapeHtml(report.quantity)} ${escapeHtml(report.unit)}</dd>
    <dt>Pelapor</dt><dd>${escapeHtml(report.reporter)}</dd>
    <dt>Foto</dt><dd>${report.photos.length} file</dd>
    <dt>Dokumen</dt><dd>${report.documents.map((doc) => escapeHtml(doc.name)).join("<br>") || "-"}</dd>
  `;
  qcModal.showModal();
  requestAnimationFrame(() => {
    clearCanvas();
    if (report.signature) {
      const ctx = signatureCanvas.getContext("2d");
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, signatureCanvas.width, signatureCanvas.height);
      img.src = report.signature;
    }
  });
}

async function updateReportStatus(status) {
  const report = reports.find((item) => item.id === activeReportId);
  if (!report) return;

  if (status === "ACC QC" && !signatureHasInk) {
    alert("Tanda tangan QC wajib diisi sebelum ACC.");
    return;
  }

  report.status = status;
  report.qcNote = qcNote.value.trim();
  report.reviewedAt = new Date().toISOString();
  report.signature = signatureCanvas.toDataURL("image/png");
  await saveReport(report);
  qcModal.close();
  render();
}

async function deleteReport(reportId) {
  const report = reports.find((item) => item.id === reportId);
  if (!report) return;

  if (!confirm(`Hapus laporan "${report.batchName}"?`)) return;
  const { error } = await supabaseClient.from("qc_reports").delete().eq("id", reportId);
  if (error) {
    alert(error.message);
    return;
  }
  reports = reports.filter((item) => item.id !== reportId);
  render();
}

function renderPhotoLinks(report) {
  return report.photos
    .map(
      (photo, index) => `
        <a class="attachment-thumb" href="${photo.dataUrl}" download="${escapeHtml(photo.name)}" target="_blank" rel="noreferrer">
          <img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}">
          <span>Foto ${index + 1}</span>
        </a>
      `,
    )
    .join("");
}

function renderDocumentLinks(report) {
  return report.documents
    .map((documentFile) => {
      const size = documentFile.size ? `${Math.ceil(documentFile.size / 1024)} KB` : "file lama";
      if (!documentFile.dataUrl) {
        return `<li><span>${escapeHtml(documentFile.name)} (${size})</span></li>`;
      }

      return `
        <li>
          <span>${escapeHtml(documentFile.name)} (${size})</span>
          <a href="${documentFile.dataUrl}" target="_blank" rel="noreferrer">Preview</a>
          <a href="${documentFile.dataUrl}" download="${escapeHtml(documentFile.name)}">Download</a>
        </li>
      `;
    })
    .join("");
}

function openPreview(reportId) {
  const report = reports.find((item) => item.id === reportId);
  if (!report) return;

  const photos = renderPhotoLinks(report);
  const documents = renderDocumentLinks(report);
  previewModalTitle.textContent = report.batchName;
  previewBody.innerHTML = `
    <dl class="detail-list">
      <dt>Status</dt><dd>${escapeHtml(report.status)}</dd>
      <dt>Divisi</dt><dd>${escapeHtml(report.division)}</dd>
      <dt>Jumlah</dt><dd>${escapeHtml(report.quantity)} ${escapeHtml(report.unit)}</dd>
      <dt>Pelapor</dt><dd>${escapeHtml(report.reporter)}</dd>
      <dt>Tanggal Input</dt><dd>${formatDate(report.createdAt)}</dd>
      <dt>Tanggal ACC</dt><dd>${report.reviewedAt ? formatDate(report.reviewedAt) : "-"}</dd>
    </dl>

    <section class="preview-section">
      <h3>Catatan Divisi</h3>
      <p>${escapeHtml(report.note || "-")}</p>
    </section>

    <section class="preview-section">
      <h3>Catatan QC</h3>
      <p>${escapeHtml(report.qcNote || "-")}</p>
    </section>

    <section class="preview-section">
      <h3>Lampiran</h3>
      ${
        photos || documents
          ? `
            <div class="attachment-box">
              ${photos ? `<div class="thumb-row">${photos}</div>` : ""}
              ${documents ? `<ul class="document-links">${documents}</ul>` : ""}
            </div>
          `
          : "<p>Tidak ada lampiran.</p>"
      }
    </section>

    <section class="preview-section">
      <h3>Tanda Tangan QC</h3>
      ${report.signature ? `<img class="signature-preview" src="${report.signature}" alt="Tanda tangan QC">` : "<p>Belum ada tanda tangan.</p>"}
    </section>
  `;
  previewModal.showModal();
}

function addPdfText(doc, label, value, x, y, maxWidth = 160) {
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(value || "-", maxWidth);
  doc.text(lines, x + 38, y);
  return y + Math.max(lines.length, 1) * 6;
}

function addWrappedSection(doc, title, value, y) {
  doc.setFont("helvetica", "bold");
  doc.text(title, 16, y);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(value || "-", 178);
  doc.text(lines, 16, y + 7);
  return y + 13 + lines.length * 5;
}

async function downloadReportPdf(reportId) {
  const report = reports.find((item) => item.id === reportId);
  if (!report) return;

  if (!window.jspdf?.jsPDF) {
    alert("Library PDF belum termuat. Cek koneksi internet lalu coba lagi.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const fileName = `laporan-qc-${safeFileName(report.batchName)}.pdf`;

  doc.setFillColor(18, 53, 47);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CV Putra Farma Yogyakarta", 16, 12);
  doc.setFontSize(11);
  doc.text("Laporan Quality Control", 16, 20);

  doc.setTextColor(32, 36, 44);
  doc.setFontSize(11);
  let y = 40;
  y = addPdfText(doc, "Status", report.status, 16, y);
  y = addPdfText(doc, "Batch", report.batchName, 16, y + 2);
  y = addPdfText(doc, "Divisi", report.division, 16, y + 2);
  y = addPdfText(doc, "Jumlah", `${report.quantity} ${report.unit}`, 16, y + 2);
  y = addPdfText(doc, "Pelapor", report.reporter, 16, y + 2);
  y = addPdfText(doc, "Tanggal Input", formatDate(report.createdAt), 16, y + 2);
  y = addPdfText(doc, "Tanggal ACC", report.reviewedAt ? formatDate(report.reviewedAt) : "-", 16, y + 2);

  y += 6;
  doc.setDrawColor(217, 222, 231);
  doc.line(16, y, 194, y);
  y += 10;

  y = addWrappedSection(doc, "Catatan Divisi", report.note || "-", y);
  y = addWrappedSection(doc, "Catatan QC", report.qcNote || "-", y + 4);

  doc.setFont("helvetica", "bold");
  doc.text("Lampiran", 16, y + 4);
  doc.setFont("helvetica", "normal");
  const attachmentLines = [
    `Foto: ${(report.photos || []).length} file`,
    `Dokumen: ${(report.documents || []).length} file`,
    ...(report.documents || []).map((item) => `- ${item.name}`),
  ];
  doc.text(doc.splitTextToSize(attachmentLines.join("\n"), 178), 16, y + 11);
  y += 25 + attachmentLines.length * 4;

  if (y > 230) {
    doc.addPage();
    y = 24;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Tanda Tangan QC", 16, y);
  doc.setFont("helvetica", "normal");
  if (report.signature) {
    try {
      doc.addImage(report.signature, "PNG", 16, y + 6, 70, 26);
    } catch {
      doc.text("Tanda tangan tidak bisa dimuat ke PDF.", 16, y + 10);
    }
  } else {
    doc.text("Belum ada tanda tangan.", 16, y + 10);
  }

  doc.setFontSize(9);
  doc.setTextColor(102, 112, 133);
  doc.text(`Dicetak dari aplikasi QC pada ${formatDate(new Date().toISOString())}`, 16, 287);
  doc.save(fileName);
}

function openEdit(reportId) {
  const report = reports.find((item) => item.id === reportId);
  if (!report) return;

  activeEditReportId = report.id;
  document.querySelector("#editModalTitle").textContent = report.batchName;
  document.querySelector("#editDivision").value = report.division;
  document.querySelector("#editBatchName").value = report.batchName;
  document.querySelector("#editQuantity").value = report.quantity;
  document.querySelector("#editUnit").value = report.unit;
  document.querySelector("#editReporter").value = report.reporter;
  document.querySelector("#editNote").value = report.note || "";
  document.querySelector("#editQcNote").textContent = report.qcNote || "-";
  editPhotos.value = "";
  editDocuments.value = "";
  editModal.showModal();
}

async function handleEditSubmit(event) {
  event.preventDefault();
  const report = reports.find((item) => item.id === activeEditReportId);
  if (!report) return;

  const newPhotos = await Promise.all(
    [...editPhotos.files].map((file) => uploadAttachment(file, report.id, "photos")),
  );
  const newDocuments = await Promise.all(
    [...editDocuments.files].map((file) => uploadAttachment(file, report.id, "documents")),
  );

  report.division = document.querySelector("#editDivision").value;
  report.batchName = document.querySelector("#editBatchName").value.trim();
  report.quantity = document.querySelector("#editQuantity").value;
  report.unit = document.querySelector("#editUnit").value;
  report.reporter = document.querySelector("#editReporter").value.trim();
  report.note = document.querySelector("#editNote").value.trim();
  report.status = "Menunggu QC";
  report.reviewedAt = "";
  report.signature = "";
  report.resubmittedAt = new Date().toISOString();

  if (newPhotos.length > 0) report.photos = newPhotos;
  if (newDocuments.length > 0) report.documents = newDocuments;

  await saveReport(report);
  await hydrateAttachmentUrls([report]);
  editModal.close();
  render();
}

function setupSignature() {
  const ctx = signatureCanvas.getContext("2d");
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#20242c";

  let drawing = false;
  let lastPoint = null;

  function getPoint(event) {
    const rect = signatureCanvas.getBoundingClientRect();
    const pointer = event.touches ? event.touches[0] : event;
    return {
      x: ((pointer.clientX - rect.left) / rect.width) * signatureCanvas.width,
      y: ((pointer.clientY - rect.top) / rect.height) * signatureCanvas.height,
    };
  }

  function start(event) {
    drawing = true;
    signatureHasInk = true;
    lastPoint = getPoint(event);
  }

  function move(event) {
    if (!drawing) return;
    event.preventDefault();
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint = point;
  }

  function end() {
    drawing = false;
    lastPoint = null;
  }

  signatureCanvas.addEventListener("mousedown", start);
  signatureCanvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  signatureCanvas.addEventListener("touchstart", start, { passive: false });
  signatureCanvas.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", end);
}

function clearCanvas() {
  const ctx = signatureCanvas.getContext("2d");
  ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);
}

function exportCsv() {
  const rows = [
    ["Tanggal", "Divisi", "Batch", "Jumlah", "Satuan", "Pelapor", "Status", "Catatan Divisi", "Catatan QC"],
    ...reports.map((report) => [
      formatDate(report.createdAt),
      report.division,
      report.batchName,
      report.quantity,
      report.unit,
      report.reporter,
      report.status,
      report.note,
      report.qcNote,
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laporan-qc-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

photoInput.addEventListener("change", updatePreviews);
documentInput.addEventListener("change", updatePreviews);
openCameraBtn.addEventListener("click", openCamera);
capturePhotoBtn.addEventListener("click", captureCameraPhoto);
closeCameraBtn.addEventListener("click", closeCamera);
form.addEventListener("submit", handleSubmit);
approveBtn.addEventListener("click", () => updateReportStatus("ACC QC"));
revisionBtn.addEventListener("click", () => updateReportStatus("Revisi"));
clearSignature.addEventListener("click", () => {
  clearCanvas();
  signatureHasInk = false;
});
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  render();
});
dateInput.addEventListener("change", () => {
  selectedDate = dateInput.value;
  render();
});
exportBtn.addEventListener("click", exportCsv);
resetBtn.addEventListener("click", async () => {
  if (!confirm(`Hapus semua data laporan untuk akun "${activeUsername}"?`)) return;
  const { error } = await supabaseClient.from("qc_reports").delete().eq("user_id", activeUser.id);
  if (error) {
    alert(error.message);
    return;
  }
  reports = [];
  render();
});
loginForm.addEventListener("submit", handleLogin);
loginModeBtn.addEventListener("click", () => setAuthMode("login"));
registerModeBtn.addEventListener("click", () => setAuthMode("register"));
logoutBtn.addEventListener("click", logout);
editForm.addEventListener("submit", handleEditSubmit);
closeEditModal.addEventListener("click", () => editModal.close());
cancelEditBtn.addEventListener("click", () => editModal.close());
closePreviewModal.addEventListener("click", () => previewModal.close());
closePreviewBtn.addEventListener("click", () => previewModal.close());

document.querySelectorAll("[data-date-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-date-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeDateFilter = button.dataset.dateFilter;
    selectedDate = "";
    dateInput.value = "";
    render();
  });
});

document.querySelectorAll("[data-status-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-status-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeStatusFilter = button.dataset.statusFilter;
    render();
  });
});

reportList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-review]");
  if (button) openReview(button.dataset.review);

  const editButton = event.target.closest("[data-edit]");
  if (editButton) openEdit(editButton.dataset.edit);

  const previewButton = event.target.closest("[data-preview]");
  if (previewButton) openPreview(previewButton.dataset.preview);

  const pdfButton = event.target.closest("[data-pdf]");
  if (pdfButton) downloadReportPdf(pdfButton.dataset.pdf);

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) deleteReport(deleteButton.dataset.delete);
});

setupSignature();
async function initializeApp() {
  if (!isSupabaseConfigured) {
    showLogin();
    loginError.textContent = "Supabase belum dikonfigurasi. Isi config.js terlebih dahulu.";
    return;
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session?.user) {
    showLogin();
    return;
  }

  try {
    activeUser = session.user;
    activeUsername = activeUser.user_metadata?.username || activeUser.email || "user";
    reports = await fetchReports();
    showApp();
  } catch {
    logout();
    loginError.textContent = "Silakan login ulang untuk terhubung ke Supabase.";
  }
}

initializeApp();
