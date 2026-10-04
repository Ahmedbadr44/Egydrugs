const CONFIG_KEY = "egydrugs-admin-config";
const PAGE_SIZE = 40;
const OPTIONS_BATCH_SIZE = 1000;
const DEFAULT_CONFIG = {
  url: "https://lfxdgtbsmomafyaolndh.supabase.co",
  key: "sb_publishable_A9K53JorCDERk7MtJG5wiw_z_Jm0bX0"
};
const fields = ["id", "commercial_name_en", "commercial_name_ar", "scientific_name", "manufacturer", "drug_class", "route", "price_egp", "dosage"];

let client;
let page = 0;
let hasMore = false;
let lastRows = [];
let searchTimer;
let fieldOptionsPromise;
let medicalLoaded = true;

const drugFieldOptions = [
  { field: "manufacturer", datalistId: "manufacturer-options", hintId: "manufacturer-hint", loadingText: "الشركة", emptyText: "اكتب شركة جديدة." },
  { field: "drug_class", datalistId: "drug-class-options", hintId: "drug-class-hint", loadingText: "التصنيف الدوائي", emptyText: "اكتب تصنيفًا جديدًا." },
  { field: "route", datalistId: "route-options", hintId: "route-hint", loadingText: "الشكل الدوائي", emptyText: "اكتب شكلًا دوائيًا جديدًا." }
];

const byId = (id) => document.getElementById(id);
const app = byId("app");
const loginView = byId("login-view");
const setupView = byId("setup-view");
const notice = byId("notice");
const body = byId("drugs-body");
const emptyState = byId("empty-state");
const dialog = byId("drug-dialog");

function refreshIcons() { window.lucide?.createIcons(); }
function savedConfig() {
  try { return { ...DEFAULT_CONFIG, ...(JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}")) }; }
  catch { return DEFAULT_CONFIG; }
}
function show(view) {
  app.hidden = view !== "app";
  loginView.hidden = view !== "login";
  setupView.hidden = view !== "setup";
  refreshIcons();
}
function setNotice(message = "", isError = false) {
  notice.textContent = message;
  notice.classList.toggle("error", isError);
}
function configuredClient() {
  const config = savedConfig();
  if (!config?.url || !config?.key) return false;
  client = window.supabase.createClient(config.url, config.key);
  return true;
}
function formattedPrice(value) {
  if (value === null || value === undefined) return "غير مسجل";
  return `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value)} ج.م`;
}
function safeSearchTerm(value) { return value.trim().replace(/[,%()]/g, ""); }
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
function rowMarkup(drug) {
  const arabicName = drug.commercial_name_ar ? `<small>${escapeHtml(drug.commercial_name_ar)}</small>` : "";
  return `<tr>
    <td class="medicine-name">${escapeHtml(drug.commercial_name_en)}${arabicName}</td>
    <td>${escapeHtml(drug.scientific_name || "-")}</td>
    <td class="muted-cell">${escapeHtml(drug.manufacturer || "-")}</td>
    <td class="price">${formattedPrice(drug.price_egp)}</td>
    <td><div class="row-actions">
      <button class="icon-button" type="button" data-action="edit" data-id="${drug.id}" title="تعديل" aria-label="تعديل ${escapeHtml(drug.commercial_name_en)}"><i data-lucide="pencil"></i></button>
      <button class="icon-button delete-button" type="button" data-action="delete" data-id="${drug.id}" title="حذف" aria-label="حذف ${escapeHtml(drug.commercial_name_en)}"><i data-lucide="trash-2"></i></button>
    </div></td>
  </tr>`;
}
function renderRows(rows, showEmptyState = true) {
  body.innerHTML = rows.map(rowMarkup).join("");
  emptyState.hidden = rows.length > 0 || !showEmptyState;
  byId("previous-page").disabled = page === 0;
  byId("next-page").disabled = !hasMore;
  byId("page-label").textContent = `صفحة ${page + 1}`;
  refreshIcons();
}

async function loadDrugFieldOptions() {
  if (!fieldOptionsPromise) {
    fieldOptionsPromise = (async () => {
      const valuesByField = new Map(drugFieldOptions.map(({ field }) => [field, new Set()]));
      let from = 0;

      while (true) {
        const { data, error } = await client
          .from("drugs")
          .select(`id,${drugFieldOptions.map(({ field }) => field).join(",")}`)
          .order("id", { ascending: true })
          .range(from, from + OPTIONS_BATCH_SIZE - 1);
        if (error) throw error;

        for (const drug of data) {
          for (const { field } of drugFieldOptions) {
            const value = drug[field]?.trim();
            if (value) valuesByField.get(field).add(value);
          }
        }
        if (data.length < OPTIONS_BATCH_SIZE) break;
        from += data.length;
      }

      for (const { field, datalistId, hintId, emptyText } of drugFieldOptions) {
        const datalist = byId(datalistId);
        datalist.replaceChildren();
        const values = [...valuesByField.get(field)].sort((first, second) => first.localeCompare(second, "ar"));
        for (const value of values) {
          const option = document.createElement("option");
          option.value = value;
          datalist.append(option);
        }
        byId(hintId).textContent = values.length ? "اختر من القائمة أو اكتب قيمة جديدة." : emptyText;
      }
    })().catch((error) => {
      fieldOptionsPromise = undefined;
      throw error;
    });
  }
  return fieldOptionsPromise;
}

async function loadDrugs() {
  if (!client) return;
  setNotice("جاري تحميل الأدوية...");
  const term = safeSearchTerm(byId("search").value);
  const from = page * PAGE_SIZE;
  let query = client.from("drugs").select(fields.join(",")).order("id", { ascending: false }).range(from, from + PAGE_SIZE);
  if (term) {
    const pattern = `%${term}%`;
    query = query.or([`commercial_name_en.ilike.${pattern}`, `commercial_name_ar.ilike.${pattern}`, `scientific_name.ilike.${pattern}`].join(","));
  }
  const { data, error } = await query;
  if (error) {
    renderRows([], false);
    setNotice(`تعذر تحميل الأدوية: ${error.message}`, true);
    return;
  }
  hasMore = data.length > PAGE_SIZE;
  lastRows = data.slice(0, PAGE_SIZE);
  renderRows(lastRows);
  setNotice("");
}
async function isDrugAdmin(userId) {
  const { data, error } = await client.from("drug_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
async function openApp(session) {
  if (!session?.user) {
    show("login");
    return;
  }
  let isAdmin;
  try {
    isAdmin = await isDrugAdmin(session.user.id);
  } catch (error) {
    byId("login-error").textContent = `تعذر التحقق من صلاحيات المشرف: ${error.message}`;
    show("login");
    return;
  }
  if (!isAdmin) {
    const { error } = await client.auth.signOut();
    byId("login-error").textContent = "هذا الحساب غير مسموح له بإدارة الأدوية.";
    if (error) byId("login-error").textContent += ` تعذر إنهاء الجلسة: ${error.message}`;
    show("login");
    return;
  }
  byId("account-email").textContent = session.user.email || "";
  show("app");
  page = 0;
  await loadDrugs();
}
function fillForm(drug) {
  byId("drug-id").value = drug?.id ?? "";
  byId("name-en").value = drug?.commercial_name_en ?? "";
  byId("name-ar").value = drug?.commercial_name_ar ?? "";
  byId("scientific-name").value = drug?.scientific_name ?? "";
  byId("manufacturer").value = drug?.manufacturer ?? "";
  byId("drug-class").value = drug?.drug_class ?? "";
  byId("route").value = drug?.route ?? "";
  byId("price").value = drug?.price_egp ?? "";
  byId("dosage").value = drug?.dosage ?? "";
  byId("uses").value = "";
  byId("medical-dosages").value = "";
  byId("side-effects").value = "";
  byId("warnings").value = "";
  byId("image-url").value = "";
  byId("image-source-name").value = "";
  byId("source-url").value = "";
  byId("source-name").value = "";
  byId("dialog-title").textContent = drug ? "تعديل دواء" : "إضافة دواء";
  byId("dialog-error").textContent = "";
}

function medicalLines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function fillMedicalForm(info) {
  byId("uses").value = (info?.uses || []).join("\n");
  byId("medical-dosages").value = (info?.dosages || []).join("\n");
  byId("side-effects").value = (info?.side_effects || []).join("\n");
  byId("warnings").value = (info?.warnings || []).join("\n");
  byId("image-url").value = info?.image_url || "";
  byId("image-source-name").value = info?.image_source_name || "";
  byId("source-url").value = info?.source_url || "";
  byId("source-name").value = info?.source_name || "";
}

async function loadMedicalInfo(drugId) {
  if (!drugId) {
    medicalLoaded = true;
    return;
  }
  medicalLoaded = false;
  byId("dialog-error").textContent = "جاري تحميل البيانات الطبية...";
  const { data, error } = await client
    .from("drug_medical_info")
    .select("uses,dosages,side_effects,warnings,image_url,image_source_name,source_url,source_name")
    .eq("drug_id", drugId)
    .maybeSingle();
  if (error) throw error;
  fillMedicalForm(data);
  medicalLoaded = true;
  byId("dialog-error").textContent = "";
}

async function openDialog(drug) {
  fillForm(drug);
  dialog.showModal();
  byId("name-en").focus();
  for (const { hintId, loadingText } of drugFieldOptions) {
    byId(hintId).textContent = `جاري تحميل خيارات ${loadingText}...`;
  }
  loadDrugFieldOptions().catch((error) => {
    byId("dialog-error").textContent = `تعذر تحميل خيارات القوائم: ${error.message} يمكنك كتابة قيم جديدة يدويًا.`;
  });
  try {
    await loadMedicalInfo(drug?.id);
  } catch (error) {
    medicalLoaded = false;
    byId("dialog-error").textContent = `تعذر تحميل البيانات الطبية: ${error.message}`;
  }
}
function drugPayload() {
  const rawPrice = byId("price").value.trim();
  return {
    commercial_name_en: byId("name-en").value.trim(), commercial_name_ar: byId("name-ar").value.trim(),
    scientific_name: byId("scientific-name").value.trim(), manufacturer: byId("manufacturer").value.trim(),
    drug_class: byId("drug-class").value.trim(), route: byId("route").value.trim(),
    price_egp: rawPrice === "" ? null : Number(rawPrice), dosage: byId("dosage").value.trim()
  };
}

function medicalPayload(drugId) {
  const imageUrl = byId("image-url").value.trim();
  const imageSourceName = byId("image-source-name").value.trim();
  const sourceUrl = byId("source-url").value.trim();
  const sourceName = byId("source-name").value.trim();
  return {
    drug_id: Number(drugId),
    uses: medicalLines(byId("uses").value),
    dosages: medicalLines(byId("medical-dosages").value),
    side_effects: medicalLines(byId("side-effects").value),
    warnings: medicalLines(byId("warnings").value),
    image_url: imageUrl || null,
    image_source_name: imageSourceName || null,
    source_url: sourceUrl || null,
    source_name: sourceName || null
  };
}

function hasMedicalContent(payload) {
  return payload.uses.length || payload.dosages.length || payload.side_effects.length || payload.warnings.length ||
    payload.image_url || payload.image_source_name || payload.source_url || payload.source_name;
}

async function saveMedicalInfo(drugId) {
  const payload = medicalPayload(drugId);
  if (hasMedicalContent(payload)) {
    const { error } = await client.from("drug_medical_info").upsert(payload, { onConflict: "drug_id" });
    if (error) throw error;
  } else {
    const { error } = await client.from("drug_medical_info").delete().eq("drug_id", drugId);
    if (error) throw error;
  }
}

async function saveDrug(event) {
  event.preventDefault();
  if (!medicalLoaded) {
    byId("dialog-error").textContent = "بيانات الدواء الطبية لم تكتمل بعد. أغلق النافذة وافتحها مرة أخرى.";
    return;
  }
  const payload = drugPayload();
  if (payload.price_egp !== null && (!Number.isFinite(payload.price_egp) || payload.price_egp < 0)) {
    byId("dialog-error").textContent = "السعر غير صحيح.";
    return;
  }
  const id = byId("drug-id").value;
  let savedId = id;
  let error;
  if (id) {
    ({ error } = await client.from("drugs").update(payload).eq("id", id));
  } else {
    const result = await client.from("drugs").insert(payload).select("id").single();
    savedId = result.data?.id;
    error = result.error;
  }
  if (error || !savedId) {
    byId("dialog-error").textContent = `تعذر حفظ الدواء: ${error?.message || "تعذر معرفة رقم الدواء بعد الحفظ"}`;
    return;
  }
  try {
    await saveMedicalInfo(savedId);
  } catch (medicalError) {
    byId("dialog-error").textContent = `تم حفظ الدواء لكن تعذر حفظ البيانات الطبية: ${medicalError.message}`;
    return;
  }
  dialog.close();
  setNotice(id ? "تم تعديل الدواء والبيانات الطبية." : "تمت إضافة الدواء والبيانات الطبية.");
  await loadDrugs();
}
async function deleteDrug(id) {
  const drug = lastRows.find((item) => String(item.id) === String(id));
  if (!drug || !window.confirm(`حذف ${drug.commercial_name_en} نهائيًا؟`)) return;
  const { error } = await client.from("drugs").delete().eq("id", id);
  if (error) { setNotice(`تعذر الحذف: ${error.message}`, true); return; }
  setNotice("تم حذف الدواء.");
  await loadDrugs();
}

function attachEvents() {
  byId("setup-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const url = byId("project-url").value.trim().replace(/\/$/, "");
    const key = byId("publishable-key").value.trim();
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      byId("setup-error").textContent = "Project URL غير صحيح.";
      return;
    }
    const isSupabaseHost = parsedUrl.protocol === "https:" && parsedUrl.hostname.endsWith(".supabase.co");
    const isLocalHttp = parsedUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedUrl.hostname);
    if ((!isSupabaseHost && !isLocalHttp) || !key) {
      byId("setup-error").textContent = "أدخل رابط مشروع Supabase آمنًا ومفتاح Publishable صالحًا.";
      return;
    }
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key }));
      location.reload();
    } catch (error) {
      byId("setup-error").textContent = `تعذر حفظ الإعدادات على هذا الجهاز: ${error.message}`;
    }
  });
  byId("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorElement = byId("login-error");
    errorElement.textContent = "";
    const { data, error } = await client.auth.signInWithPassword({ email: byId("login-email").value.trim(), password: byId("login-password").value });
    if (error) { errorElement.textContent = `تعذر تسجيل الدخول: ${error.message}`; return; }
    await openApp(data.session);
  });
  byId("change-config").addEventListener("click", () => show("setup"));
  byId("sign-out").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) { setNotice(`تعذر تسجيل الخروج: ${error.message}`, true); return; }
    show("login");
  });
  byId("add-drug").addEventListener("click", () => openDialog());
  byId("close-dialog").addEventListener("click", () => dialog.close());
  byId("cancel-dialog").addEventListener("click", () => dialog.close());
  byId("drug-form").addEventListener("submit", saveDrug);
  body.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const drug = lastRows.find((item) => String(item.id) === button.dataset.id);
    if (button.dataset.action === "edit") openDialog(drug);
    if (button.dataset.action === "delete") deleteDrug(button.dataset.id);
  });
  byId("search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { page = 0; loadDrugs(); }, 300);
  });
  byId("previous-page").addEventListener("click", () => { if (page > 0) { page -= 1; loadDrugs(); } });
  byId("next-page").addEventListener("click", () => { if (hasMore) { page += 1; loadDrugs(); } });
}
async function start() {
  attachEvents();
  if (!configuredClient()) { show("setup"); return; }
  const { data, error } = await client.auth.getSession();
  if (error) {
    show("login");
    byId("login-error").textContent = `تعذر استعادة جلسة الدخول: ${error.message}`;
    return;
  }
  const { session } = data;
  if (session) await openApp(session); else show("login");
}
start();
