import { apiClient } from './apiClient.js';
import { WalletService } from './WalletService.js';
import { FacebookApiService } from './FacebookApiService.js';

export const TASK_TYPES = [
  { id: 'like_post', name: 'Like chéo', icon: '👍', defaultPrice: 500, category: 'Like' },
  { id: 'like_high_val', name: 'Like chéo giá cao', icon: '💎', defaultPrice: 1200, category: 'Like' },
  { id: 'like_multi', name: 'Like chéo 3', icon: '🔥', defaultPrice: 800, category: 'Like' },
  { id: 'like_page', name: 'Like page chéo', icon: '🚩', defaultPrice: 1000, category: 'Page' },
  { id: 'reaction_post', name: 'Cảm xúc chéo', icon: '❤️', defaultPrice: 600, category: 'Reaction' },
  { id: 'reaction_comment', name: 'Cảm xúc CMT chéo', icon: '💬', defaultPrice: 700, category: 'Reaction' },
  { id: 'follow_profile', name: 'Theo dõi chéo', icon: '👤', defaultPrice: 900, category: 'Follow' },
  { id: 'share_post', name: 'Share chéo', icon: '🔄', defaultPrice: 1500, category: 'Share' },
  { id: 'join_group', name: 'Tham gia nhóm chéo', icon: '👥', defaultPrice: 1100, category: 'Group' },
];

export const FacebookTaskService = {
  extractFacebookId(url) {
    return FacebookApiService.extractFacebookId(url);
  },

  async verifyFacebookAccount(url, facebookId) {
    return FacebookApiService.verifyFacebookProfile({ facebookId, profileUrl: url });
  },

  /**
   * Create a new Facebook Interaction Task (Người A). The BE atomically debits
   * the creator's wallet and creates the task in one transaction.
   */
  async createTask({
    creatorId,
    taskType = 'like_post',
    postUrl = '',
    targetQuantity = 10,
    unitPrice = 500,
    note = '',
  }) {
    if (!creatorId) throw new Error('Cần thông tin Khách hàng để đăng nhiệm vụ.');
    if (!postUrl) throw new Error('Vui lòng nhập đường dẫn Facebook (URL bài viết / trang / nhóm).');
    const quantity = Number(targetQuantity);
    const price = Number(unitPrice);
    if (isNaN(quantity) || quantity < 1) throw new Error('Số lượng cần làm phải là số nguyên > 0.');
    if (isNaN(price) || price < 100) throw new Error('Đơn giá mỗi lượt tối thiểu là 100 đ.');

    const totalCost = quantity * price;

    // Pre-check balance so the UI can offer a topup (BE re-checks authoritatively).
    const walletInfo = await WalletService.getWalletInfo(creatorId);
    if (walletInfo.totalAvailable < totalCost) {
      const missing = totalCost - walletInfo.totalAvailable;
      throw new Error(`INSUFFICIENT_WALLET:${totalCost}:${walletInfo.totalAvailable}:${missing}`);
    }

    const task = await apiClient.post('/facebook-tasks', {
      taskType,
      postUrl: postUrl.trim(),
      targetQuantity: quantity,
      unitPrice: price,
      note: note.trim() || undefined,
    });

    return { success: true, task, totalCost };
  },

  /**
   * List active tasks available in the Task Marketplace (Người B). The BE
   * already excludes the worker's own tasks and ones they've submitted.
   */
  async listActiveTasks({ taskType = '' } = {}) {
    try {
      return await apiClient.get('/facebook-tasks', taskType ? { taskType } : undefined);
    } catch (err) {
      console.warn('[FacebookTaskService] Failed to list active tasks:', err);
      return { data: [] };
    }
  },

  /**
   * List tasks created by the authenticated user (Người A).
   */
  async listTasksByCreator(creatorId) {
    if (!creatorId) return { data: [] };
    try {
      return await apiClient.get('/facebook-tasks/mine');
    } catch (err) {
      console.warn('[FacebookTaskService] Failed to list creator tasks:', err);
      return { data: [] };
    }
  },

  /**
   * Worker B submits proof of work. The BE records a pending submission for
   * manual admin review (cross-interaction can't be auto-verified via Graph API).
   */
  async submitTaskWork({ taskId, proofImageUrl = '' }) {
    if (!taskId) throw new Error('Nhiệm vụ không hợp lệ.');
    return await apiClient.post(`/facebook-tasks/${taskId}/submit`, {
      proofImageUrl: proofImageUrl || undefined,
    });
  },

  /**
   * Admin approves a task submission & credits the worker's wallet (BE, atomic).
   */
  async approveSubmission(submissionId) {
    return await apiClient.post(`/facebook-tasks/submissions/${submissionId}/approve`);
  },

  /**
   * Admin rejects a task submission (BE).
   */
  async rejectSubmission(submissionId, reason = '') {
    return await apiClient.post(`/facebook-tasks/submissions/${submissionId}/reject`, {
      reason: reason || undefined,
    });
  },

  /**
   * List pending submissions awaiting manual review (admin only, BE).
   */
  async listPendingSubmissions() {
    try {
      return await apiClient.get('/facebook-tasks/submissions/pending');
    } catch (err) {
      console.warn('[FacebookTaskService] Failed to list pending submissions:', err);
      return { data: [] };
    }
  },

  /**
   * Cancel a task & refund the remaining unperformed cost to the creator (BE, atomic).
   */
  async cancelTask(taskId) {
    return await apiClient.post(`/facebook-tasks/${taskId}/cancel`);
  },
};
