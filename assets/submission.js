const form = document.getElementById('submission-form');
const config = window.INFO2_GAS_CONFIG || {};
const DRAFT_KEY = 'info2_submission_draft';
const PROFILE_KEY = 'info2_submission_profiles';
const BASIC_FIELDS = ['group', 'representative', 'members', 'project', 'problem'];
const ACTIVITY_FIELDS = [
  'recordDate', 'cardReason', 'rows', 'source', 'period', 'unit', 'dataCare', 'process', 'artifact',
  'result', 'claim', 'limit', 'decision', 'next', 'help'
];

let idToken = '';
let signedUser = null;
let submitTimer = null;
let submitting = false;
let activeMode = 'グループ';
let profiles = loadJson(PROFILE_KEY, { lastMode: 'グループ', グループ: {}, 個人: {} });
let profileSaveTimer = null;

const MAX_IMAGES = 3;
const MAX_IMAGE_DIMENSION = 1600;
const MAX_COMPRESSED_IMAGE_BYTES = 1_500_000;
const MAX_TOTAL_IMAGE_BYTES = 4_500_000;
const MAX_ORIGINAL_IMAGE_BYTES = 20_000_000;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
let selectedImages = [];
let imageProcessing = false;
let clientSubmissionId = createClientSubmissionId();

const $ = id => document.getElementById(id);
const CALENDAR_MIN_YEAR = 2000;
let calendarViewYear = null;
let calendarViewMonth = null;


function toHalfWidthDigits(value) {
  return String(value || '').replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
}

function todayIsoInJapan() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isoToDisplayDate(iso) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : '';
}

function normalizeDateText(value) {
  let text = toHalfWidthDigits(value).trim().replace(/[／]/g, '/').replace(/[.．\-－−]/g, '/');
  if (/^\d{8}$/.test(text)) text = `${text.slice(0, 4)}/${text.slice(4, 6)}/${text.slice(6, 8)}`;
  const match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return text;
  return `${match[1]}/${String(Number(match[2])).padStart(2, '0')}/${String(Number(match[3])).padStart(2, '0')}`;
}

function parseDisplayDate(value) {
  const normalized = normalizeDateText(value);
  const match = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return { valid: false, normalized, reason: 'format' };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { valid: false, normalized, reason: 'calendar' };
  }
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  if (iso > todayIsoInJapan()) return { valid: false, normalized, iso, reason: 'future' };
  return { valid: true, normalized, iso, date };
}

function dateValidationMessage(value) {
  if (!String(value || '').trim()) return '記録日を入力してください';
  const parsed = parseDisplayDate(value);
  if (parsed.valid) return '';
  if (parsed.reason === 'format') return '記録日は yyyy/MM/dd の形式で入力してください';
  if (parsed.reason === 'calendar') return '存在する日付を入力してください';
  if (parsed.reason === 'future') return '記録日に未来の日付は指定できません';
  return '記録日を確認してください';
}

function setDateFieldState(message = '') {
  const input = $('record-date');
  const error = $('record-date-error');
  const shell = input?.closest('.date-input-shell');
  if (!input || !error) return;
  const isValid = !message && Boolean(input.value);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  error.textContent = message;
  error.classList.toggle('hidden', !message);
  shell?.classList.toggle('valid', isValid);
}

function setRecordDateFromIso(iso, { closeCalendar = false } = {}) {
  const input = $('record-date');
  const display = isoToDisplayDate(iso);
  if (input) input.value = display;
  setDateFieldState(display ? '' : '記録日を確認してください');
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    calendarViewYear = Number(match[1]);
    calendarViewMonth = Number(match[2]) - 1;
    renderRecordCalendar();
  }
  if (closeCalendar) closeRecordCalendar();
}

function syncDateControls({ normalize = false } = {}) {
  const input = $('record-date');
  if (!input) return false;
  if (normalize) input.value = normalizeDateText(input.value);
  const message = dateValidationMessage(input.value);
  setDateFieldState(message);
  const parsed = parseDisplayDate(input.value);
  if (parsed.valid) {
    calendarViewYear = parsed.date.getUTCFullYear();
    calendarViewMonth = parsed.date.getUTCMonth();
  }
  return !message;
}

function calendarTodayParts() {
  const [year, month, day] = todayIsoInJapan().split('-').map(Number);
  return { year, month: month - 1, day };
}

function selectedRecordIso() {
  const parsed = parseDisplayDate($('record-date')?.value || '');
  return parsed.valid ? parsed.iso : '';
}

function populateCalendarSelects() {
  const yearSelect = $('calendar-year');
  const monthSelect = $('calendar-month');
  if (!yearSelect || !monthSelect) return;
  const today = calendarTodayParts();
  if (!yearSelect.options.length) {
    for (let year = today.year; year >= CALENDAR_MIN_YEAR; year -= 1) {
      yearSelect.add(new Option(String(year), String(year)));
    }
  }
  if (!monthSelect.options.length) {
    for (let month = 1; month <= 12; month += 1) {
      monthSelect.add(new Option(String(month), String(month - 1)));
    }
  }
}

function renderRecordCalendar() {
  const daysRoot = $('calendar-days');
  const yearSelect = $('calendar-year');
  const monthSelect = $('calendar-month');
  const prevButton = $('calendar-prev');
  const nextButton = $('calendar-next');
  if (!daysRoot || !yearSelect || !monthSelect || !prevButton || !nextButton) return;

  populateCalendarSelects();
  const today = calendarTodayParts();
  if (!Number.isInteger(calendarViewYear)) calendarViewYear = today.year;
  if (!Number.isInteger(calendarViewMonth)) calendarViewMonth = today.month;
  if (calendarViewYear < CALENDAR_MIN_YEAR) calendarViewYear = CALENDAR_MIN_YEAR;
  if (calendarViewYear > today.year || (calendarViewYear === today.year && calendarViewMonth > today.month)) {
    calendarViewYear = today.year;
    calendarViewMonth = today.month;
  }

  yearSelect.value = String(calendarViewYear);
  Array.from(monthSelect.options).forEach(option => {
    option.disabled = calendarViewYear === today.year && Number(option.value) > today.month;
  });
  if (calendarViewYear === today.year && calendarViewMonth > today.month) calendarViewMonth = today.month;
  monthSelect.value = String(calendarViewMonth);

  const selectedIso = selectedRecordIso();
  const todayIso = todayIsoInJapan();
  const firstWeekday = new Date(Date.UTC(calendarViewYear, calendarViewMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(calendarViewYear, calendarViewMonth + 1, 0)).getUTCDate();
  const previousMonthDays = new Date(Date.UTC(calendarViewYear, calendarViewMonth, 0)).getUTCDate();
  daysRoot.replaceChildren();

  for (let cell = 0; cell < 42; cell += 1) {
    const offsetDay = cell - firstWeekday + 1;
    let year = calendarViewYear;
    let month = calendarViewMonth;
    let day = offsetDay;
    let outside = false;
    if (offsetDay < 1) {
      outside = true;
      month -= 1;
      if (month < 0) { month = 11; year -= 1; }
      day = previousMonthDays + offsetDay;
    } else if (offsetDay > daysInMonth) {
      outside = true;
      day = offsetDay - daysInMonth;
      month += 1;
      if (month > 11) { month = 0; year += 1; }
    }
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    button.textContent = String(day);
    button.dataset.iso = iso;
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', `${year}年${month + 1}月${day}日`);
    if (outside) button.classList.add('outside-month');
    if (iso === todayIso) button.classList.add('today');
    if (iso === selectedIso) {
      button.classList.add('selected');
      button.setAttribute('aria-selected', 'true');
    }
    if (iso > todayIso || year < CALENDAR_MIN_YEAR) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.addEventListener('click', () => setRecordDateFromIso(iso, { closeCalendar: true }));
    }
    daysRoot.append(button);
  }

  prevButton.disabled = calendarViewYear === CALENDAR_MIN_YEAR && calendarViewMonth === 0;
  nextButton.disabled = calendarViewYear === today.year && calendarViewMonth === today.month;
}

function isRecordCalendarOpen() {
  return !$('record-date-calendar')?.classList.contains('hidden');
}

function openRecordCalendar() {
  const popover = $('record-date-calendar');
  const input = $('record-date');
  const button = $('open-calendar');
  const shell = $('date-input-shell');
  if (!popover || !input || !button || !shell) return;
  const parsed = parseDisplayDate(input.value);
  if (parsed.valid) {
    calendarViewYear = parsed.date.getUTCFullYear();
    calendarViewMonth = parsed.date.getUTCMonth();
  } else {
    const today = calendarTodayParts();
    calendarViewYear = today.year;
    calendarViewMonth = today.month;
  }
  renderRecordCalendar();
  popover.classList.remove('hidden');
  shell.classList.add('calendar-open');
  input.setAttribute('aria-expanded', 'true');
  button.setAttribute('aria-expanded', 'true');
}

function closeRecordCalendar({ returnFocus = false } = {}) {
  const popover = $('record-date-calendar');
  const input = $('record-date');
  const button = $('open-calendar');
  const shell = $('date-input-shell');
  if (!popover || !input || !button || !shell) return;
  popover.classList.add('hidden');
  shell.classList.remove('calendar-open');
  input.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-expanded', 'false');
  if (returnFocus) input.focus();
}

function shiftCalendarMonth(amount) {
  const date = new Date(Date.UTC(calendarViewYear, calendarViewMonth + amount, 1));
  calendarViewYear = date.getUTCFullYear();
  calendarViewMonth = date.getUTCMonth();
  renderRecordCalendar();
}

function initDateControls() {
  const input = $('record-date');
  const todayButton = $('set-today');
  const calendarButton = $('open-calendar');
  const shell = $('date-input-shell');
  const yearSelect = $('calendar-year');
  const monthSelect = $('calendar-month');
  const prevButton = $('calendar-prev');
  const nextButton = $('calendar-next');
  const calendarTodayButton = $('calendar-today');
  const closeButton = $('calendar-close');
  if (!input || !todayButton || !calendarButton || !shell || !yearSelect || !monthSelect || !prevButton || !nextButton || !calendarTodayButton || !closeButton) return;

  populateCalendarSelects();
  if (!String(input.value || '').trim()) setRecordDateFromIso(todayIsoInJapan());
  else syncDateControls({ normalize: true });

  todayButton.addEventListener('click', () => setRecordDateFromIso(todayIsoInJapan()));
  calendarTodayButton.addEventListener('click', () => setRecordDateFromIso(todayIsoInJapan(), { closeCalendar: true }));
  calendarButton.addEventListener('click', event => {
    event.stopPropagation();
    if (isRecordCalendarOpen()) closeRecordCalendar({ returnFocus: true });
    else openRecordCalendar();
  });
  input.addEventListener('click', () => openRecordCalendar());
  input.addEventListener('keydown', event => {
    if ((event.key === 'ArrowDown' && event.altKey) || event.key === 'Enter') {
      event.preventDefault();
      openRecordCalendar();
    } else if (event.key === 'Escape') {
      closeRecordCalendar();
    }
  });
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    $('record-date-error').textContent = '';
    $('record-date-error').classList.add('hidden');
    input.closest('.date-input-shell')?.classList.remove('valid');
    const parsed = parseDisplayDate(input.value);
    if (parsed.valid) {
      calendarViewYear = parsed.date.getUTCFullYear();
      calendarViewMonth = parsed.date.getUTCMonth();
      if (isRecordCalendarOpen()) renderRecordCalendar();
    }
  });
  input.addEventListener('blur', () => syncDateControls({ normalize: true }));

  prevButton.addEventListener('click', () => shiftCalendarMonth(-1));
  nextButton.addEventListener('click', () => shiftCalendarMonth(1));
  yearSelect.addEventListener('change', () => {
    calendarViewYear = Number(yearSelect.value);
    const today = calendarTodayParts();
    if (calendarViewYear === today.year && calendarViewMonth > today.month) calendarViewMonth = today.month;
    renderRecordCalendar();
  });
  monthSelect.addEventListener('change', () => {
    calendarViewMonth = Number(monthSelect.value);
    renderRecordCalendar();
  });
  closeButton.addEventListener('click', () => closeRecordCalendar({ returnFocus: true }));
  shell.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', () => closeRecordCalendar());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isRecordCalendarOpen()) closeRecordCalendar({ returnFocus: true });
  });
}


function createClientSubmissionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const random = Math.random().toString(36).slice(2);
  return `client-${Date.now()}-${random}`;
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function setImageStatus(message = '', type = 'info') {
  const status = $('image-upload-status');
  if (!status) return;
  status.textContent = message;
  status.className = `status-banner ${type} mt-4${message ? '' : ' hidden'}`;
}

function imageExtension(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function sanitizeImageBaseName(name) {
  const stem = String(name || 'image').replace(/\.[^.]+$/, '');
  const normalized = stem.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return (normalized || 'image').slice(0, 70);
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`${file.name}を画像として読み込めませんでした。`));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('画像の圧縮に失敗しました。'));
    }, mimeType, quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('画像データを読み取れませんでした。'));
    reader.readAsDataURL(blob);
  });
}

async function encodeCompressedImage(image, width, height, originalType, originalSize) {
  let currentWidth = width;
  let currentHeight = height;
  let quality = 0.86;
  let mimeType = originalType === 'image/webp' ? 'image/webp' : 'image/jpeg';

  // 小さなPNGは文字や図の輪郭を保つため、まずPNGのまま縮小を試す。
  if (originalType === 'image/png' && originalSize <= MAX_COMPRESSED_IMAGE_BYTES) mimeType = 'image/png';

  for (let attempt = 0; attempt < 9; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(currentWidth));
    canvas.height = Math.max(1, Math.round(currentHeight));
    const context = canvas.getContext('2d', { alpha: mimeType === 'image/png' });
    if (!context) throw new Error('画像処理を開始できませんでした。');
    if (mimeType !== 'image/png') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, mimeType, mimeType === 'image/png' ? undefined : quality);
    if (blob.size <= MAX_COMPRESSED_IMAGE_BYTES) {
      return { blob, width: canvas.width, height: canvas.height, mimeType: blob.type || mimeType };
    }

    if (mimeType === 'image/png') {
      mimeType = 'image/jpeg';
      quality = 0.84;
      continue;
    }
    if (quality > 0.58) {
      quality -= 0.08;
    } else {
      currentWidth *= 0.84;
      currentHeight *= 0.84;
      quality = 0.78;
    }
  }
  throw new Error('画像を送信できる大きさまで圧縮できませんでした。別の画像を選んでください。');
}

async function imageContentId(blob) {
  try {
    if (window.crypto?.subtle && blob.arrayBuffer) {
      const digest = await window.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const hex = Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
      return `img-${hex.slice(0, 40)}`;
    }
  } catch (_) {}
  return window.crypto?.randomUUID ? `img-${window.crypto.randomUUID()}` : `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function compressImage(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`${file.name}は対応していない形式です。JPEG・PNG・WebPを選んでください。`);
  }
  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
    throw new Error(`${file.name}は元のファイルサイズが大きすぎます。20MB以下の画像を選んでください。`);
  }

  const image = await loadImageElement(file);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  if (!naturalWidth || !naturalHeight) throw new Error(`${file.name}の大きさを確認できませんでした。`);

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(naturalWidth, naturalHeight));
  const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(naturalHeight * scale));
  const encoded = await encodeCompressedImage(image, targetWidth, targetHeight, file.type, file.size);
  const dataUrl = await blobToDataUrl(encoded.blob);
  const id = await imageContentId(encoded.blob);
  const extension = imageExtension(encoded.mimeType);
  return {
    id,
    originalName: file.name,
    storedName: `${sanitizeImageBaseName(file.name)}.${extension}`,
    originalSize: file.size,
    size: encoded.blob.size,
    mimeType: encoded.mimeType,
    width: encoded.width,
    height: encoded.height,
    dataUrl
  };
}

function totalSelectedImageBytes() {
  return selectedImages.reduce((sum, image) => sum + Number(image.size || 0), 0);
}

function renderImagePreviews() {
  const root = $('image-preview-grid');
  const clearButton = $('clear-images');
  if (!root) return;
  root.replaceChildren();

  if (!selectedImages.length) {
    const empty = document.createElement('p');
    empty.className = 'image-preview-empty';
    empty.textContent = '画像はまだ選ばれていません。';
    root.append(empty);
    if (clearButton) clearButton.disabled = true;
    return;
  }

  selectedImages.forEach((image, index) => {
    const card = document.createElement('article');
    card.className = 'image-preview-card';
    const img = document.createElement('img');
    img.src = image.dataUrl;
    img.alt = `提出画像${index + 1}のプレビュー`;
    const body = document.createElement('div');
    body.className = 'image-preview-body';
    const name = document.createElement('b');
    name.textContent = image.originalName;
    const meta = document.createElement('p');
    meta.textContent = `${image.width}×${image.height}px／${formatBytes(image.size)}`;
    const reduction = document.createElement('p');
    reduction.className = 'image-preview-reduction';
    const percent = image.originalSize > 0 ? Math.max(0, Math.round((1 - image.size / image.originalSize) * 100)) : 0;
    reduction.textContent = image.size < image.originalSize ? `元画像から約${percent}%小さくしました` : '送信に適した大きさです';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'image-remove-button';
    remove.setAttribute('aria-label', `${image.originalName}を提出画像から外す`);
    remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    remove.addEventListener('click', () => {
      selectedImages = selectedImages.filter(item => item.id !== image.id);
      renderImagePreviews();
      setImageStatus(selectedImages.length ? `${selectedImages.length}枚を選択中（合計${formatBytes(totalSelectedImageBytes())}）` : '', 'info');
    });
    body.append(name, meta, reduction);
    card.append(img, body, remove);
    root.append(card);
  });

  const summary = document.createElement('div');
  summary.className = 'image-preview-summary';
  summary.textContent = `${selectedImages.length}枚／合計 ${formatBytes(totalSelectedImageBytes())}`;
  root.append(summary);
  if (clearButton) clearButton.disabled = false;
}

async function addImageFiles(fileList) {
  if (imageProcessing) return;
  const files = Array.from(fileList || []);
  if (!files.length) return;
  imageProcessing = true;
  setImageStatus('画像を読み込み、送信用に圧縮しています。', 'info');

  const errors = [];
  try {
    for (const file of files) {
      if (selectedImages.length >= MAX_IMAGES) {
        errors.push(`画像は最大${MAX_IMAGES}枚までです。`);
        break;
      }
      try {
        const compressed = await compressImage(file);
        if (selectedImages.some(image => image.id === compressed.id)) {
          errors.push(`${file.name}はすでに選ばれています。`);
          continue;
        }
        const nextTotal = totalSelectedImageBytes() + compressed.size;
        if (nextTotal > MAX_TOTAL_IMAGE_BYTES) {
          errors.push(`${file.name}を追加すると画像全体が大きくなりすぎます。別の画像を選ぶか、枚数を減らしてください。`);
          continue;
        }
        selectedImages.push(compressed);
        renderImagePreviews();
      } catch (error) {
        errors.push(error?.message || `${file.name}を処理できませんでした。`);
      }
    }
  } finally {
    imageProcessing = false;
    const fileInput = $('record-images');
    const cameraInput = $('camera-image');
    if (fileInput) fileInput.value = '';
    if (cameraInput) cameraInput.value = '';
  }

  if (errors.length) {
    setImageStatus(errors.join(' '), 'error');
  } else {
    setImageStatus(`${selectedImages.length}枚を選択中（合計${formatBytes(totalSelectedImageBytes())}）。提出前に画像の内容を確認してください。`, 'ok');
  }
}

function clearSelectedImages() {
  selectedImages = [];
  renderImagePreviews();
  setImageStatus('', 'info');
  const fileInput = $('record-images');
  const cameraInput = $('camera-image');
  if (fileInput) fileInput.value = '';
  if (cameraInput) cameraInput.value = '';
}

function attachmentPayload() {
  return selectedImages.map(image => {
    const comma = image.dataUrl.indexOf(',');
    return {
      clientImageId: image.id,
      originalName: image.originalName,
      storedName: image.storedName,
      mimeType: image.mimeType,
      size: image.size,
      originalSize: image.originalSize,
      width: image.width,
      height: image.height,
      dataBase64: comma >= 0 ? image.dataUrl.slice(comma + 1) : ''
    };
  });
}

function initImageControls() {
  const fileInput = $('record-images');
  const cameraInput = $('camera-image');
  const dropzone = $('image-dropzone');
  const clearButton = $('clear-images');

  fileInput?.addEventListener('change', () => addImageFiles(fileInput.files));
  cameraInput?.addEventListener('change', () => addImageFiles(cameraInput.files));
  clearButton?.addEventListener('click', clearSelectedImages);

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', event => {
      if (event.target.closest('button, label, input')) return;
      fileInput.click();
    });
    dropzone.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput.click();
      }
    });
    ['dragenter', 'dragover'].forEach(type => {
      dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(type => {
      dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', event => addImageFiles(event.dataTransfer?.files));
  }
  renderImagePreviews();
}

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch (_) {
    return fallback;
  }
}

function cardTitle(key) {
  return (window.INFO2_CARDS || []).find(card => card.key === key)?.title || key;
}

function selectedMode() {
  return form.querySelector('[name="mode"]:checked')?.value || 'グループ';
}

function getData({ includeImages = false } = {}) {
  const fd = new FormData(form);
  const data = {};
  for (const [key, value] of fd.entries()) {
    if (key === 'cards') {
      data.cards = data.cards || [];
      data.cards.push(value);
    } else {
      data[key] = String(value).trim();
    }
  }
  data.cards = data.cards || [];
  data.recordDate = normalizeDateText(data.recordDate || '');
  data.mode = selectedMode();
  if (data.mode === '個人') {
    data.group = '';
    data.members = '';
  }
  data.submittedBy = signedUser?.email || '';
  data.clientSubmissionId = clientSubmissionId;
  data.imageCount = selectedImages.length;
  data.attachments = includeImages ? attachmentPayload() : [];
  data.updatedAt = new Date().toISOString();
  return data;
}

function fill(data, { basicOnly = false } = {}) {
  if (!data || typeof data !== 'object') return;
  Object.entries(data).forEach(([key, value]) => {
    if (basicOnly && !BASIC_FIELDS.includes(key)) return;
    if (key === 'mode') {
      const radio = form.querySelector(`[name="mode"][value="${CSS.escape(String(value))}"]`);
      if (radio) radio.checked = true;
      return;
    }
    if (key === 'cards') {
      if (basicOnly) return;
      form.querySelectorAll('[name="cards"]').forEach(input => {
        input.checked = Array.isArray(value) && value.includes(input.value);
      });
      return;
    }
    const input = form.elements[key];
    if (input && typeof value !== 'object' && 'value' in input) input.value = value ?? '';
  });
}

function profileFor(mode) {
  return profiles?.[mode] && typeof profiles[mode] === 'object' ? profiles[mode] : {};
}

function captureProfile(mode = activeMode) {
  const current = {};
  BASIC_FIELDS.forEach(name => {
    const input = form.elements[name];
    if (input && 'value' in input) current[name] = String(input.value || '').trim();
  });
  if (mode === '個人') {
    current.group = '';
    current.members = '';
  }
  profiles[mode] = current;
  profiles.lastMode = mode;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
}

function scheduleProfileSave() {
  clearTimeout(profileSaveTimer);
  profileSaveTimer = setTimeout(() => captureProfile(activeMode), 250);
}

function applyMode(mode, { loadSaved = false } = {}) {
  const normalized = mode === '個人' ? '個人' : 'グループ';
  activeMode = normalized;
  const radio = form.querySelector(`[name="mode"][value="${normalized}"]`);
  if (radio) radio.checked = true;

  const isGroup = normalized === 'グループ';
  form.querySelectorAll('[data-group-only]').forEach(element => {
    element.classList.toggle('hidden-by-mode', !isGroup);
  });
  form.elements.group.required = isGroup;
  $('representative-label').innerHTML = `${isGroup ? '代表者氏名' : '氏名'} <span class="text-rose-600">*</span>`;
  form.elements.representative.placeholder = isGroup ? '例：山田 太郎' : '例：山田 太郎';

  if (loadSaved) fill(profileFor(normalized), { basicOnly: true });
  profiles.lastMode = normalized;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
}

function switchMode(nextMode) {
  captureProfile(activeMode);
  applyMode(nextMode, { loadSaved: true });
}

function advisorFill() {
  try {
    const result = JSON.parse(localStorage.getItem('info2_advisor_result') || 'null');
    if (!result) return;
    const selected = [...(result.required || []), ...(result.support || [])];
    form.querySelectorAll('[name="cards"]').forEach(input => {
      input.checked = selected.includes(input.value);
    });
    const map = {
      measure: 'センサで現実の状態を測りたい',
      explore: 'データの特徴や傾向を知りたい',
      predict: '数値を予測したい',
      classify: '種類や状態を分類したい',
      group: '似たものをグループ分けしたい',
      survey: 'アンケートから傾向を見つけたい',
      system: '使いやすい仕組みや画面を作りたい',
      present: '結果を検証して発表したい'
    };
    form.elements.cardReason.value = `カード選びで「${map[result.answers?.goal] || result.answers?.goal || ''}」を選択し、使うデータと目指す成果に合わせてカードを選んだ。`;
  } catch (_) {}
}

function validate() {
  const missing = [];
  for (const input of form.querySelectorAll('[required]')) {
    if (input.name === 'recordDate') continue;
    if (input.closest('.hidden-by-mode')) continue;
    if (!String(input.value || '').trim()) {
      missing.push(input.previousElementSibling?.textContent?.replace('*', '').trim() || input.name);
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  }
  const dateMessage = dateValidationMessage(form.elements.recordDate?.value);
  setDateFieldState(dateMessage);
  if (dateMessage) missing.push(dateMessage);
  if (!form.querySelector('[name="cards"]:checked')) missing.push('利用したカード');
  if (imageProcessing) missing.push('画像の圧縮が終わるまで待ってください');
  if (selectedImages.length > MAX_IMAGES) missing.push(`画像は最大${MAX_IMAGES}枚までです`);
  if (totalSelectedImageBytes() > MAX_TOTAL_IMAGE_BYTES) missing.push('画像全体のファイルサイズを減らしてください');
  if (!idToken) missing.push('学校のGoogleアカウントでのログイン');
  return [...new Set(missing)];
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function confirmHtml(data) {
  const rows = [
    ['提出者', data.submittedBy],
    ['記録の種類', data.mode],
    ['記録日', data.recordDate]
  ];
  if (data.mode === 'グループ') {
    rows.push(['班番号・班名', data.group], ['代表者氏名', data.representative], ['班員氏名', data.members]);
  } else {
    rows.push(['氏名', data.representative]);
  }
  rows.push(
    ['プロジェクト名', data.project],
    ['解決したい問題・問い', data.problem],
    ['利用したカード', data.cards.map(cardTitle).join('、')],
    ['カードを選んだ理由', data.cardReason],
    ['データの種類', data.dataType],
    ['データ件数', data.rows],
    ['出典・取得方法', data.source],
    ['年次・測定期間', data.period],
    ['単位', data.unit],
    ['データへの対応', data.dataCare],
    ['実施した処理', data.process],
    ['成果物URL・ファイル名', data.artifact],
    ['得られた結果', data.result],
    ['結果から言えること', data.claim],
    ['まだ言えないこと・限界', data.limit],
    ['判断したこと・変更したこと', data.decision],
    ['次回最初にすること', data.next],
    ['先生に相談したいこと', data.help]
  );
  rows.push(['本日の記録画像', selectedImages.length ? `${selectedImages.length}枚` : 'なし']);
  const imagePreview = selectedImages.length
    ? `<section class="confirm-image-section"><h3>画像の確認</h3><div class="confirm-image-grid">${selectedImages.map((image, index) => `<figure><img src="${image.dataUrl}" alt="提出画像${index + 1}の確認"><figcaption>${esc(image.originalName)}<br>${esc(`${image.width}×${image.height}px／${formatBytes(image.size)}`)}</figcaption></figure>`).join('')}</div><p>氏名、顔、名札、通知、位置情報など、提出に不要な個人情報が写っていないか確認してください。</p></section>`
    : '';
  return `<dl>${rows.map(([label, value]) => `<div class="confirm-row"><dt>${esc(label)}</dt><dd>${esc(value || '—')}</dd></div>`).join('')}</dl>${imagePreview}`;
}

function showError(items) {
  $('form-error').innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i>次の項目を確認してください：${items.map(esc).join('、')}`;
  $('form-error').classList.remove('hidden');
  $('form-error').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderAuth() {
  const status = $('auth-status');
  const dot = status.querySelector('.auth-dot');
  const text = status.querySelector('span:last-child');
  if (signedUser) {
    dot.classList.add('ok');
    text.textContent = `${signedUser.email} でログイン中`;
    form.elements.email.value = signedUser.email;
    $('signout-button').classList.remove('hidden');
  } else {
    dot.classList.remove('ok');
    text.textContent = 'ログインしていません';
    form.elements.email.value = '';
    $('signout-button').classList.add('hidden');
  }
}

function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(char => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

window.handleGoogleCredential = response => {
  idToken = response.credential;
  sessionStorage.setItem('info2_id_token', idToken);
  signedUser = decodeJwt(idToken);
  const suffix = config.allowedDomainSuffix || '.ed.jp';
  if (!signedUser?.email?.endsWith(suffix)) {
    idToken = '';
    signedUser = null;
    sessionStorage.removeItem('info2_id_token');
    showError([`${suffix}で終わる学校アカウントを使用してください`]);
  }
  renderAuth();
};

function initGoogle() {
  const warning = $('config-warning');
  if (!config.googleClientId || !config.webAppUrl) {
    warning.classList.remove('hidden');
    warning.textContent = 'Google連携はまだ設定されていません。先生が setup.html の手順で設定すると、ログインと提出が使えるようになります。';
  }
  const saved = sessionStorage.getItem('info2_id_token');
  if (saved) {
    const user = decodeJwt(saved);
    if (user && Number(user.exp) * 1000 > Date.now()) {
      idToken = saved;
      signedUser = user;
      renderAuth();
    }
  }
  if (!config.googleClientId) return;
  const wait = () => {
    if (!window.google?.accounts?.id) {
      setTimeout(wait, 100);
      return;
    }
    google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: window.handleGoogleCredential,
      auto_select: false
    });
    google.accounts.id.renderButton($('google-signin-button'), {
      theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ja', width: 260
    });
  };
  wait();
}

function submitToGas(data) {
  if (submitting) return;
  if (!config.webAppUrl) {
    showError(['Google Apps ScriptのURLが未設定です']);
    return;
  }
  captureProfile(data.mode);
  submitting = true;
  const post = document.createElement('form');
  post.method = 'POST';
  post.action = config.webAppUrl;
  post.target = 'gas-submit-frame';
  post.enctype = 'multipart/form-data';
  post.className = 'hidden';
  const fields = { action: 'submit', idToken, payload: JSON.stringify(data) };
  Object.entries(fields).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    post.appendChild(input);
  });
  document.body.appendChild(post);
  $('submit-log').disabled = true;
  $('submit-log').innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>送信中';
  post.submit();
  setTimeout(() => post.remove(), 3000);
  clearTimeout(submitTimer);
  submitTimer = setTimeout(() => {
    submitting = false;
    $('submit-log').disabled = false;
    $('submit-log').innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i>提出';
    showError(['送信処理は完了している可能性があります。「自分のログを見る」または先生のスプレッドシートで確認してから、再送信してください。']);
  }, 60000);
}

function clearActivityFields() {
  form.querySelectorAll('[name="cards"]').forEach(input => { input.checked = false; });
  ACTIVITY_FIELDS.forEach(name => {
    const input = form.elements[name];
    if (input && 'value' in input) input.value = '';
  });
  form.elements.dataType.value = '公式データ';
  setRecordDateFromIso(todayIsoInJapan());
  clearSelectedImages();
  localStorage.removeItem(DRAFT_KEY);
}

function beginNewLog() {
  captureProfile(activeMode);
  clientSubmissionId = createClientSubmissionId();
  clearActivityFields();
  $('success-overlay').classList.add('hidden');
  $('confirm-overlay').classList.add('hidden');
  $('form-error').classList.add('hidden');
  document.body.style.overflow = '';
  document.querySelector('.form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.addEventListener('message', event => {
  const data = event.data || {};
  if (data.source !== 'info2-tech-cards-gas') return;
  clearTimeout(submitTimer);
  submitting = false;
  $('submit-log').disabled = false;
  $('submit-log').innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i>提出';
  if (data.ok) {
    captureProfile(activeMode);
    localStorage.removeItem(DRAFT_KEY);
    $('confirm-overlay').classList.add('hidden');
    const imageMessage = Number(data.imageCount || 0) > 0 ? `画像${Number(data.imageCount)}枚をGoogle Driveへ保存しました。` : '添付画像はありません。';
    const duplicateMessage = data.duplicate ? '同じ送信内容は重複登録せず、前回の提出結果を表示しています。' : '';
    $('success-message').textContent = `提出番号：${data.submissionId || ''}　先生のスプレッドシートに記録しました。${imageMessage}${duplicateMessage}`;
    $('success-overlay').classList.remove('hidden');
  } else {
    showError([data.message || '送信に失敗しました']);
    $('confirm-overlay').classList.add('hidden');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const draft = loadJson(DRAFT_KEY, null);
  clientSubmissionId = String(draft?.clientSubmissionId || '').trim() || createClientSubmissionId();
  const initialMode = draft?.mode || profiles.lastMode || 'グループ';
  applyMode(initialMode, { loadSaved: !draft });
  if (draft) {
    fill(draft);
    applyMode(draft.mode || initialMode, { loadSaved: false });
  }
  initDateControls();
  initImageControls();

  const query = new URLSearchParams(location.search);
  if (query.get('from') === 'advisor') advisorFill();
  if (query.get('card')) {
    const input = form.querySelector(`[name="cards"][value="${CSS.escape(query.get('card'))}"]`);
    if (input) input.checked = true;
  }

  form.querySelectorAll('[name="mode"]').forEach(radio => {
    radio.addEventListener('change', () => switchMode(radio.value));
  });
  BASIC_FIELDS.forEach(name => {
    const input = form.elements[name];
    if (input) input.addEventListener('input', scheduleProfileSave);
  });

  initGoogle();
  renderAuth();

  $('clear-profile').onclick = () => {
    if (!confirm('保存した基本情報を消しますか？現在表示中の基本情報も空欄になります。')) return;
    profiles[activeMode] = {};
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    BASIC_FIELDS.forEach(name => {
      const input = form.elements[name];
      if (input && 'value' in input) input.value = '';
    });
  };

  $('save-draft').onclick = () => {
    captureProfile(activeMode);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(getData()));
    alert('このブラウザに下書きを保存しました。基本情報は次のログにも引き継がれます。');
  };

  $('open-confirm').onclick = () => {
    const missing = validate();
    if (missing.length) {
      showError(missing);
      return;
    }
    $('form-error').classList.add('hidden');
    const data = getData();
    captureProfile(data.mode);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    $('confirm-content').innerHTML = confirmHtml(data);
    $('confirm-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  $('back-to-form').onclick = () => {
    $('confirm-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  };
  $('submit-log').onclick = () => submitToGas(getData({ includeImages: true }));
  $('new-log-after-submit').onclick = beginNewLog;
  $('close-success').onclick = () => {
    $('success-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  };
  $('signout-button').onclick = () => {
    if (signedUser?.email && window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    idToken = '';
    signedUser = null;
    sessionStorage.removeItem('info2_id_token');
    renderAuth();
  };
});
