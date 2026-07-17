const teacherKey = "teacherVerification.teacher";
const recordsKey = "teacherVerification.records";
const supabaseUrl = "https://kjjaqkmlqwcqbjegjjxv.supabase.co";
const supabasePublishableKey = "sb_publishable_pRUM3in809296ymaAFKj2g_bg_i_Zzb";
const verificationsEndpoint = `${supabaseUrl}/rest/v1/teacher_mobile_verifications`;

const activationPanel = document.getElementById("activationPanel");
const scannerPanel = document.getElementById("scannerPanel");
const teacherUserName = document.getElementById("teacherUserName");
const teacherPassword = document.getElementById("teacherPassword");
const activeTeacherUserName = document.getElementById("activeTeacherUserName");
const activateButton = document.getElementById("activateButton");
const resetActivationButton = document.getElementById("resetActivationButton");
const lecturePortalButton = document.getElementById("lecturePortalButton");
const infoPortalButton = document.getElementById("infoPortalButton");
const messagesPortalButton = document.getElementById("messagesPortalButton");
const attendancePortalButton = document.getElementById("attendancePortalButton");
const lectureActions = document.getElementById("lectureActions");
const attendancePanel = document.getElementById("attendancePanel");
const attendanceInButton = document.getElementById("attendanceInButton");
const attendanceOutButton = document.getElementById("attendanceOutButton");
const backFromAttendanceButton = document.getElementById("backFromAttendanceButton");
const startActionButton = document.getElementById("startActionButton");
const endActionButton = document.getElementById("endActionButton");
const methodsPanel = document.getElementById("methodsPanel");
const methodTitle = document.getElementById("methodTitle");
const scanCodeButton = document.getElementById("scanCodeButton");
const showManualButton = document.getElementById("showManualButton");
const showOfflineButton = document.getElementById("showOfflineButton");
const backToActionsButton = document.getElementById("backToActionsButton");
const cameraBox = document.getElementById("cameraBox");
const cameraPreview = document.getElementById("cameraPreview");
const cameraStatus = document.getElementById("cameraStatus");
const stopCameraButton = document.getElementById("stopCameraButton");
const manualCodeInput = document.getElementById("manualCodeInput");
const saveManualCodeButton = document.getElementById("saveManualCodeButton");
const manualBox = document.getElementById("manualBox");
const offlineBox = document.getElementById("offlineBox");
const offlineChallengeInput = document.getElementById("offlineChallengeInput");
const generateOfflineButton = document.getElementById("generateOfflineButton");
const offlineResult = document.getElementById("offlineResult");
const offlineResponseCode = document.getElementById("offlineResponseCode");
const recordsList = document.getElementById("recordsList");
const syncButton = document.getElementById("syncButton");
const toast = document.getElementById("toast");

let activeStream = null;
let activeScanType = null;
let scanTimer = null;
let activeScanMode = "lecture";

function getTeacher() {
  const value = localStorage.getItem(teacherKey);
  return value ? JSON.parse(value) : null;
}

function saveTeacher(teacher) {
  localStorage.setItem(teacherKey, JSON.stringify(teacher));
}

function getRecords() {
  const value = localStorage.getItem(recordsKey);
  return value ? JSON.parse(value) : [];
}

function saveRecords(records) {
  localStorage.setItem(recordsKey, JSON.stringify(records));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.setTimeout(() => toast.classList.add("hidden"), 3500);
}

function createDeviceId() {
  const existing = localStorage.getItem("teacherVerification.deviceId");
  if (existing) return existing;

  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  localStorage.setItem("teacherVerification.deviceId", id);
  return id;
}

function render() {
  const teacher = getTeacher();
  activationPanel.classList.toggle("hidden", !!teacher);
  scannerPanel.classList.toggle("hidden", !teacher);

  if (teacher) {
    activeTeacherUserName.textContent = teacher.userName;
  }

  renderRecords();
}

function renderRecords() {
  const records = getRecords().filter(record => !record.synced);

  if (records.length === 0) {
    recordsList.innerHTML = '<p class="hint">لا توجد سجلات بانتظار الرفع.</p>';
    return;
  }

  recordsList.innerHTML = records.map(record => `
    <div class="record-item">
      <strong>${record.type === "START" ? "بداية جلسة" : record.type === "END" ? "نهاية جلسة" : record.type === "ATTENDANCE_IN" ? "تسجيل حضور" : "تسجيل انصراف"}</strong>
      <span>الوقت: ${new Date(record.capturedAt).toLocaleString("ar-IQ")}</span>
      <span>الموقع: ${formatLocation(record.location)}</span>
    </div>
  `).join("");
}

function formatLocation(location) {
  if (!location) {
    return "لم يتم التقاط الموقع";
  }

  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} - دقة ${Math.round(location.accuracy)} م`;
}

function validateCode(code, expectedType) {
  const entered = code.trim().toUpperCase();
  const prefix = expectedType === "START" ? "START-" : "END-";
  const digits = entered.startsWith(prefix) ? entered.substring(prefix.length) : entered;
  if (!/^\d{4}$/.test(digits)) {
    throw new Error("رمز شاشة التدريسي يجب أن يتكون من أربعة أرقام.");
  }
  return `${prefix}${digits}`;
}

function getLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: new Date().toISOString()
      }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  });
}

async function saveVerification(code, type) {
  const teacher = getTeacher();
  if (!teacher) {
    showToast("فعّل حساب التدريسي أولاً.");
    return;
  }

  let normalized;
  try {
    normalized = validateCode(code, type);
  } catch (error) {
    showToast(error.message);
    return;
  }

  showToast("جار التقاط الموقع وحفظ التوثيق...");
  const location = await getLocation();
  const records = getRecords();

  records.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    teacherUserName: teacher.userName,
    teacherFullName: teacher.fullName,
    deviceId: teacher.deviceId,
    type,
    code: normalized,
    location,
    capturedAt: new Date().toISOString(),
    synced: false
  });

  saveRecords(records);
  renderRecords();
  showToast(location ? "تم حفظ التوثيق مع الموقع." : "تم الحفظ، لكن لم يتم التقاط الموقع.");

  if (navigator.onLine) {
    await syncPendingRecords(false);
  }
}

async function startCamera(type, mode = "lecture") {
  if (!("BarcodeDetector" in window)) {
    showToast("المتصفح لا يدعم المسح المباشر. استخدم الإدخال اليدوي للكود.");
    activeScanType = type;
    return;
  }

  activeScanType = type;
  cameraBox.classList.remove("hidden");
  cameraStatus.textContent = "جار تشغيل الكاميرا...";

  try {
    activeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    cameraPreview.srcObject = activeStream;
    await cameraPreview.play();
    scanLoop();
  } catch {
    cameraStatus.textContent = "تعذر تشغيل الكاميرا. استخدم الإدخال اليدوي.";
  }
}

async function scanLoop() {
  const detector = new BarcodeDetector({ formats: ["qr_code"] });
  cameraStatus.textContent = "وجّه الكاميرا نحو الكود.";

  scanTimer = window.setInterval(async () => {
    try {
      const codes = await detector.detect(cameraPreview);
      if (codes.length > 0) {
        const code = codes[0].rawValue;
        stopCamera();
        if (activeScanMode === "attendance") await saveAttendance(code, activeScanType);
        else await saveVerification(code, activeScanType);
      }
    } catch {
      cameraStatus.textContent = "تعذر قراءة الكود. حاول مرة أخرى.";
    }
  }, 900);
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = value => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseAttendancePoint(raw) {
  const parts = raw.split("|");
  if (parts[0] !== "ATTENDANCE_POINT" || parts.length < 4) throw new Error("هذا الباركود لا يعود إلى موقع حضور معتمد.");
  const latitude = Number(parts[2]), longitude = Number(parts[3]), radius = Number(parts[4] || 50);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("بيانات موقع الباركود غير صحيحة.");
  return { token: parts[1], latitude, longitude, radius: Number.isFinite(radius) && radius > 0 ? radius : 50, name: decodeURIComponent(parts[5] || "موقع حضور"), number: parts[6] || "" };
}

async function saveAttendance(rawCode, type) {
  if (!navigator.onLine) { showToast("تسجيل الحضور والانصراف يحتاج إلى اتصال بالإنترنت."); return; }
  const teacher = getTeacher();
  if (!teacher) { showToast("فعّل حساب التدريسي أولاً."); return; }
  let point;
  try { point = parseAttendancePoint(rawCode); } catch (error) { showToast(error.message); return; }
  showToast("جار التحقق من موقع الهاتف...");
  const location = await getLocation();
  if (!location) { showToast("تعذر الحصول على الموقع. فعّل GPS واسمح للمتصفح باستخدامه."); return; }
  const distance = distanceMeters(location.latitude, location.longitude, point.latitude, point.longitude);
  const allowed = point.radius + Math.max(0, location.accuracy || 0);
  if (distance > allowed) { showToast(`أنت خارج نطاق الموقع المعتمد بمسافة ${Math.round(distance)} متر.`); return; }
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    teacherUserName: teacher.userName, teacherFullName: teacher.fullName, deviceId: teacher.deviceId,
    type, code: `POINT-${point.token}`, pointName: point.name, pointNumber: point.number,
    pointLatitude: point.latitude, pointLongitude: point.longitude, pointRadius: point.radius,
    distanceMeters: Math.round(distance), location, capturedAt: new Date().toISOString(), synced: false
  };
  try {
    await uploadRecord(record); record.synced = true; record.syncedAt = new Date().toISOString();
    const records = getRecords(); records.push(record); saveRecords(records); renderRecords();
    showToast(`تم تسجيل ${type === "ATTENDANCE_IN" ? "الحضور" : "الانصراف"} في ${point.name}.`);
  } catch { showToast("تعذر الاتصال بالسيرفر، ولم تُسجل العملية. حاول مرة أخرى."); }
}

function stopCamera() {
  if (scanTimer) {
    window.clearInterval(scanTimer);
    scanTimer = null;
  }

  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }

  cameraPreview.srcObject = null;
  cameraBox.classList.add("hidden");
}

async function hashText(value) {
  const bytes = new TextEncoder().encode(value);
  if (!crypto.subtle) return btoa(value).slice(0, 32);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
}

activateButton.addEventListener("click", async () => {
  const userName = teacherUserName.value.trim();
  const password = teacherPassword.value;

  if (!userName || !password) {
    showToast("اكتب حساب التدريسي وكلمة المرور.");
    return;
  }

  saveTeacher({
    userName,
    fullName: userName,
    passwordFingerprint: await hashText(password),
    deviceId: createDeviceId(),
    activatedAt: new Date().toISOString()
  });
  teacherPassword.value = "";

  showToast("تم تفعيل الجهاز.");
  render();
});

resetActivationButton.addEventListener("click", () => {
  localStorage.removeItem(teacherKey);
  render();
});

function selectAction(type) {
  activeScanType = type;
  activeScanMode = mode;
  methodTitle.textContent = type === "START" ? "طرق مصادقة بداية الجلسة" : "طرق مصادقة نهاية الجلسة";
  methodsPanel.classList.remove("hidden"); manualBox.classList.add("hidden"); offlineBox.classList.add("hidden"); offlineResult.classList.add("hidden");
  methodsPanel.scrollIntoView({ behavior: "smooth" });
}
startActionButton.addEventListener("click", () => selectAction("START"));
endActionButton.addEventListener("click", () => selectAction("END"));
lecturePortalButton.addEventListener("click", () => { lectureActions.classList.remove("hidden"); attendancePanel.classList.add("hidden"); });
attendancePortalButton.addEventListener("click", () => { attendancePanel.classList.remove("hidden"); lectureActions.classList.add("hidden"); methodsPanel.classList.add("hidden"); });
infoPortalButton.addEventListener("click", () => showToast("سيتم ربط صفحة معلومات التدريسي في المرحلة القادمة."));
messagesPortalButton.addEventListener("click", () => showToast("سيتم ربط الرسائل والإشعارات في المرحلة القادمة."));
attendanceInButton.addEventListener("click", () => startCamera("ATTENDANCE_IN", "attendance"));
attendanceOutButton.addEventListener("click", () => startCamera("ATTENDANCE_OUT", "attendance"));
backFromAttendanceButton.addEventListener("click", () => { stopCamera(); attendancePanel.classList.add("hidden"); });
scanCodeButton.addEventListener("click", () => startCamera(activeScanType));
showManualButton.addEventListener("click", () => { manualBox.classList.remove("hidden"); offlineBox.classList.add("hidden"); });
showOfflineButton.addEventListener("click", () => { offlineBox.classList.remove("hidden"); manualBox.classList.add("hidden"); });
backToActionsButton.addEventListener("click", () => { stopCamera(); methodsPanel.classList.add("hidden"); manualBox.classList.add("hidden"); offlineBox.classList.add("hidden"); });
stopCameraButton.addEventListener("click", stopCamera);

saveManualCodeButton.addEventListener("click", () => {
  const code = manualCodeInput.value.trim();
  if (!code) {
    showToast("اكتب الكود أولاً.");
    return;
  }

  saveVerification(code, activeScanType || "START");
  manualCodeInput.value = "";
});

generateOfflineButton.addEventListener("click", async () => {
  const teacher = getTeacher(); const challenge = offlineChallengeInput.value.trim();
  if (!teacher || !/^\d{4}$/.test(challenge)) { showToast("أدخل رمز شاشة التدريسي المكون من أربعة أرقام."); return; }
  showToast("جار تسجيل الوقت والموقع...");
  const location = await getLocation();
  const response = String(Math.floor(10000000 + Math.random() * 90000000));
  const type = activeScanType || "START"; const prefix = type === "START" ? "START-" : "END-";
  const records = getRecords(); records.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    teacherUserName: teacher.userName, teacherFullName: teacher.fullName, deviceId: teacher.deviceId,
    type, code: `${prefix}${challenge}#${response}`, challengeCode: challenge, offlineResponse: response,
    location, capturedAt: new Date().toISOString(), offline: true, synced: false
  });
  saveRecords(records); renderRecords(); offlineResponseCode.textContent = response; offlineResult.classList.remove("hidden");
  showToast(location ? "تم إنشاء رمز Offline وحفظ الموقع." : "تم إنشاء الرمز، لكن تعذر التقاط الموقع.");
});

async function uploadRecord(record) {
  const location = record.location || {};
  const payload = {
    teacher_user_name: record.teacherUserName,
    teacher_full_name: record.teacherFullName,
    device_id: record.deviceId,
    verification_type: record.type,
    verification_code: record.code,
    captured_at: record.capturedAt,
    latitude: typeof location.latitude === "number" ? location.latitude : null,
    longitude: typeof location.longitude === "number" ? location.longitude : null,
    accuracy: typeof location.accuracy === "number" ? location.accuracy : null,
    location_captured_at: location.capturedAt || null
  };

  const response = await fetch(verificationsEndpoint, {
    method: "POST",
    headers: {
      "apikey": supabasePublishableKey,
      "Authorization": `Bearer ${supabasePublishableKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `HTTP ${response.status}`);
  }
}

async function syncPendingRecords(showDoneMessage = true) {
  const records = getRecords();
  const pending = records.filter(record => !record.synced);

  if (pending.length === 0) {
    if (showDoneMessage) showToast("لا توجد بيانات للرفع.");
    return;
  }

  if (!navigator.onLine) {
    showToast("لا يوجد إنترنت الآن. بقيت البيانات محفوظة بالموبايل.");
    return;
  }

  let uploadedCount = 0;
  const failedIds = new Set();

  for (const record of pending) {
    try {
      await uploadRecord(record);
      record.synced = true;
      record.syncedAt = new Date().toISOString();
      uploadedCount++;
    } catch {
      failedIds.add(record.id);
    }
  }

  saveRecords(records);
  renderRecords();

  if (failedIds.size === 0) {
    showToast(`تم رفع ${uploadedCount} سجل إلى السيرفر.`);
  } else {
    showToast(`تم رفع ${uploadedCount} سجل، وبقي ${failedIds.size} سجل محفوظ محلياً.`);
  }
}

syncButton.addEventListener("click", () => syncPendingRecords(true));

window.addEventListener("online", () => {
  syncPendingRecords(false);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    // يعمل بدون تسجيل الخدمة، لكن لن يكون Offline كاملاً.
  });
}

render();
