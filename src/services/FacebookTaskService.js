import { requireSupabaseClient, runQuery } from './BaseService.js';
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
   * Create a new Facebook Interaction Task (Dành cho Người A)
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

    // Check Wallet balance
    const walletInfo = await WalletService.getWalletInfo(creatorId);
    if (walletInfo.totalAvailable < totalCost) {
      const missing = totalCost - walletInfo.totalAvailable;
      throw new Error(`INSUFFICIENT_WALLET:${totalCost}:${walletInfo.totalAvailable}:${missing}`);
    }

    // Deduct cost from Creator's Virtual Wallet
    const typeObj = TASK_TYPES.find((t) => t.id === taskType) || TASK_TYPES[0];
    await WalletService.payWithWallet({
      customerId: creatorId,
      amount: totalCost,
      description: `Đăng nhiệm vụ ${typeObj.name} (x${quantity})`,
    });

    const facebookTargetId = FacebookApiService.extractFacebookId(postUrl);
    const supabase = requireSupabaseClient();
    if (!supabase) throw new Error('Chưa kết nối Supabase.');

    const { data: task } = await runQuery(
      supabase
        .from('facebook_tasks')
        .insert([{
          creator_id: creatorId,
          task_type: taskType,
          post_url: postUrl.trim(),
          facebook_target_id: facebookTargetId,
          target_quantity: quantity,
          completed_quantity: 0,
          unit_price: price,
          total_cost: totalCost,
          status: 'active',
          note: note.trim() || null,
        }])
        .select()
        .single(),
    );

    return {
      success: true,
      task,
      totalCost,
    };
  },

  /**
   * List active tasks available in the Task Marketplace (Dành cho Người B)
   */
  async listActiveTasks({ taskType = '', workerId = null } = {}) {
    const supabase = requireSupabaseClient();
    if (!supabase) return { data: [] };

    try {
      let query = supabase
        .from('facebook_tasks')
        .select('*, customers!facebook_tasks_creator_id_fkey(facebook_name, phone)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (taskType) {
        query = query.eq('task_type', taskType);
      }

      const { data: tasks } = await runQuery(query);
      if (!tasks) return { data: [] };

      // Filter out tasks already completed by workerId if specified
      if (workerId) {
        const { data: doneSubmissions } = await supabase
          .from('task_submissions')
          .select('task_id')
          .eq('worker_id', workerId);

        const doneSet = new Set((doneSubmissions || []).map((s) => s.task_id));
        return { data: tasks.filter((t) => !doneSet.has(t.id)) };
      }

      return { data: tasks };
    } catch (err) {
      console.warn('[FacebookTaskService] Failed to list active tasks:', err);
      return { data: [] };
    }
  },

  /**
   * List tasks created by a specific user (Dành cho Người A)
   */
  async listTasksByCreator(creatorId) {
    if (!creatorId) return { data: [] };
    const supabase = requireSupabaseClient();
    if (!supabase) return { data: [] };

    try {
      return await runQuery(
        supabase
          .from('facebook_tasks')
          .select('*, task_submissions(*)')
          .eq('creator_id', creatorId)
          .order('created_at', { ascending: false }),
      );
    } catch (err) {
      console.warn('[FacebookTaskService] Failed to list creator tasks:', err);
      return { data: [] };
    }
  },

  /**
   * Worker B submits task execution & triggers Facebook Graph API auto-verification
   */
  async submitTaskWork({ taskId, workerId, proofImageUrl = '' }) {
    if (!taskId || !workerId) throw new Error('Nhiệm vụ hoặc Người làm không hợp lệ.');

    const supabase = requireSupabaseClient();
    if (!supabase) throw new Error('Chưa kết nối Supabase.');

    // Fetch task info
    const { data: task } = await runQuery(
      supabase
        .from('facebook_tasks')
        .select('*')
        .eq('id', taskId)
        .single(),
    );

    if (!task || task.status !== 'active') {
      throw new Error('Nhiệm vụ này đã hoàn thành hoặc không còn hoạt động.');
    }

    // Call Facebook Graph API for automated verification
    const graphResult = await FacebookApiService.verifyInteractionViaGraphApi({
      objectId: task.facebook_target_id,
      taskType: task.task_type,
    });

    const isVerified = Boolean(graphResult.verified);

    // Record task submission
    const { data: submission } = await runQuery(
      supabase
        .from('task_submissions')
        .insert([{
          task_id: taskId,
          worker_id: workerId,
          proof_image_url: proofImageUrl || null,
          proof_data: graphResult,
          status: isVerified ? 'approved' : 'pending',
          reward_amount: task.unit_price,
          verified_via_api: isVerified,
        }])
        .select()
        .single(),
    );

    // If Graph API automatically verified it, credit reward to Worker B's wallet
    if (isVerified) {
      await FacebookTaskService.approveSubmission(submission.id, workerId, task.unit_price);
    }

    const typeObj = TASK_TYPES.find((t) => t.id === task.task_type) || TASK_TYPES[0];

    return {
      success: true,
      submission,
      verifiedViaApi: isVerified,
      message: isVerified
        ? `Graph API đã xác nhận nhiệm vụ ${typeObj.name}! Cộng ngay ${task.unit_price.toLocaleString('vi-VN')} đ vào Ví Ảo!`
        : 'Đã gửi bằng chứng nhiệm vụ, đang chờ đối soát trả thưởng.',
    };
  },

  /**
   * Approve task submission & credit reward to Worker B's wallet
   */
  async approveSubmission(submissionId, workerId, rewardAmount) {
    const supabase = requireSupabaseClient();
    if (!supabase) throw new Error('Chưa kết nối Supabase.');

    try {
      const { data, error } = await supabase.rpc('process_task_reward', {
        p_submission_id: submissionId,
        p_worker_id: workerId,
        p_reward_amount: Number(rewardAmount),
      });

      if (!error && data?.success) {
        return data;
      }
    } catch (err) {
      console.warn('[FacebookTaskService] RPC process_task_reward not available, running fallback:', err);
    }

    // Direct fallback logic
    await runQuery(
      supabase
        .from('task_submissions')
        .update({ status: 'approved' })
        .eq('id', submissionId),
    );

    // Credit Worker B balance
    const walletInfo = await WalletService.getWalletInfo(workerId);
    const newBalance = walletInfo.walletBalance + Number(rewardAmount);

    await runQuery(
      supabase
        .from('customers')
        .update({ wallet_balance: newBalance })
        .eq('id', workerId),
    );

    await supabase.from('wallet_transactions').insert([{
      customer_id: workerId,
      transaction_type: 'bonus',
      amount: Number(rewardAmount),
      status: 'completed',
      description: 'Thưởng hoàn thành nhiệm vụ chéo Facebook',
    }]);

    return { success: true };
  },

  /**
   * Cancel or Reject task & refund remaining unperformed cost to Creator A's wallet
   */
  async cancelTask(taskId, creatorId) {
    const supabase = requireSupabaseClient();
    if (!supabase) throw new Error('Chưa kết nối Supabase.');

    const { data: task } = await runQuery(
      supabase
        .from('facebook_tasks')
        .select('*')
        .eq('id', taskId)
        .single(),
    );

    if (!task) throw new Error('Không tìm thấy nhiệm vụ.');

    const remainingQty = Math.max(0, task.target_quantity - task.completed_quantity);
    const refundAmount = remainingQty * Number(task.unit_price);

    await runQuery(
      supabase
        .from('facebook_tasks')
        .update({ status: 'cancelled' })
        .eq('id', taskId),
    );

    if (refundAmount > 0) {
      const walletInfo = await WalletService.getWalletInfo(creatorId);
      const newBalance = walletInfo.walletBalance + refundAmount;

      await runQuery(
        supabase
          .from('customers')
          .update({ wallet_balance: newBalance })
          .eq('id', creatorId),
      );

      await supabase.from('wallet_transactions').insert([{
        customer_id: creatorId,
        transaction_type: 'refund',
        amount: refundAmount,
        status: 'completed',
        description: `Hoàn tiền hủy nhiệm vụ FB #${taskId.slice(0, 8)}`,
      }]);
    }

    return { success: true, refundAmount };
  },
};
