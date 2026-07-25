import { EmptyState } from '../components/EmptyState.js';
import { PageHeader } from '../components/PageHeader.js';
import { FacebookTaskService, TASK_TYPES } from '../services/FacebookTaskService.js';
import { formatCurrency } from '../utils/currency.js';
import { escapeHtml } from '../utils/html.js';

const state = { busyId: null };

function taskTypeLabel(taskType) {
  const t = TASK_TYPES.find((x) => x.id === taskType);
  return t ? `${t.icon} ${t.name}` : taskType || '—';
}

export function TaskReviewPage() {
  return `
    ${PageHeader({
      title: 'Duyệt bằng chứng nhiệm vụ Facebook',
      description: 'Kiểm tra bằng chứng tương tác chéo của người làm, duyệt để trả thưởng vào ví.',
    })}
    <div class="toolbar">
      <button id="task-review-reload" class="btn-secondary" type="button">Tải lại</button>
    </div>
    <div class="table-card">
      <table class="data-table">
        <thead><tr>
          <th>Loại nhiệm vụ</th><th>Đường dẫn</th><th>Người làm</th>
          <th>Bằng chứng</th><th>Thưởng</th><th>Ngày nộp</th><th>Thao tác</th>
        </tr></thead>
        <tbody id="task-review-body">
          ${loadingRow()}
        </tbody>
      </table>
    </div>
  `;
}

TaskReviewPage.afterRender = function afterRenderTaskReview() {
  document.getElementById('task-review-reload')?.addEventListener('click', loadSubmissions);
  document.getElementById('task-review-body')?.addEventListener('click', handleAction);
  loadSubmissions();
};

async function loadSubmissions() {
  const body = document.getElementById('task-review-body');
  if (!body) return;
  body.innerHTML = loadingRow();
  try {
    const { data } = await FacebookTaskService.listPendingSubmissions();
    renderRows(data || []);
  } catch (error) {
    body.innerHTML = stateRow('Không tải được bằng chứng', error?.message || 'Backend trả về lỗi.');
  }
}

function renderRows(rows) {
  const body = document.getElementById('task-review-body');
  if (!body) return;
  if (!rows.length) {
    body.innerHTML = stateRow('Không có bằng chứng chờ duyệt', 'Tất cả nhiệm vụ đã được xử lý.');
    return;
  }

  body.innerHTML = rows.map((item) => {
    const task = item.task || {};
    const proof = safeHref(item.proof_image_url)
      ? `<a class="table-link" href="${escapeHtml(safeHref(item.proof_image_url))}" target="_blank" rel="noreferrer">Xem ảnh</a>`
      : '<span class="muted-text">Không có ảnh</span>';
    const postLink = safeHref(task.post_url)
      ? `<a class="table-link" href="${escapeHtml(safeHref(task.post_url))}" target="_blank" rel="noreferrer">Mở bài viết</a>`
      : escapeHtml(task.post_url || '—');
    return `
      <tr>
        <td>${escapeHtml(taskTypeLabel(task.task_type))}</td>
        <td>${postLink}</td>
        <td><span class="muted-text">${escapeHtml(item.worker_id || '—')}</span></td>
        <td>${proof}</td>
        <td class="strong-cell">${formatCurrency(item.reward_amount || 0)}</td>
        <td>${formatDateTime(item.created_at)}</td>
        <td>${actionButtons(item)}</td>
      </tr>
    `;
  }).join('');
}

async function handleAction(event) {
  const button = event.target.closest('[data-submission-action]');
  if (!button || state.busyId) return;
  const id = button.dataset.submissionId;
  const action = button.dataset.submissionAction;
  if (!id) return;

  if (action === 'approve') {
    if (!window.confirm('Xác nhận bằng chứng hợp lệ và trả thưởng cho người làm?')) return;
  } else if (action === 'reject') {
    if (!window.confirm('Từ chối bằng chứng này?')) return;
  }

  state.busyId = id;
  setRowButtonsDisabled(id, true);
  try {
    if (action === 'approve') await FacebookTaskService.approveSubmission(id);
    if (action === 'reject') await FacebookTaskService.rejectSubmission(id);
    await loadSubmissions();
  } catch (error) {
    window.alert(error?.message || 'Không thể xử lý bằng chứng.');
  } finally {
    state.busyId = null;
    setRowButtonsDisabled(id, false);
  }
}

function actionButtons(item) {
  return `<div class="request-actions">
    <button class="table-approve-button" type="button" data-submission-action="approve" data-submission-id="${escapeHtml(item.id)}">Duyệt</button>
    <button class="table-cancel-button" type="button" data-submission-action="reject" data-submission-id="${escapeHtml(item.id)}">Từ chối</button>
  </div>`;
}

function setRowButtonsDisabled(id, disabled) {
  document.querySelectorAll(`[data-submission-id="${id}"]`).forEach((button) => {
    button.disabled = disabled;
  });
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function safeHref(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function loadingRow() {
  return stateRow('Đang tải bằng chứng', 'Đang đọc dữ liệu từ backend.');
}

function stateRow(title, message) {
  return `<tr><td colspan="7">${EmptyState({ title, message: escapeHtml(message) })}</td></tr>`;
}
