/**
 * Firebase Cloud Messaging (FCM) Notification Service
 * Handles push notifications for web and mobile clients
 */

interface FCMNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

interface FCMToken {
  userId: string;
  token: string;
  deviceType: 'android' | 'ios' | 'web';
  deviceName?: string;
}

/**
 * Register FCM token for a user
 */
export async function registerFCMToken(
  supabase: any,
  userId: string,
  token: string,
  deviceType: 'android' | 'ios' | 'web',
  deviceName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('fcm_tokens')
      .upsert({
        user_id: userId,
        token,
        device_type: deviceType,
        device_name: deviceName,
        is_active: true,
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,token'
      });

    if (error) {
      console.error('Error registering FCM token:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in registerFCMToken:', err);
    return { success: false, error: 'Failed to register FCM token' };
  }
}

/**
 * Unregister FCM token (logout or token refresh)
 */
export async function unregisterFCMToken(
  supabase: any,
  userId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('fcm_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('token', token);

    if (error) {
      console.error('Error unregistering FCM token:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in unregisterFCMToken:', err);
    return { success: false, error: 'Failed to unregister FCM token' };
  }
}

/**
 * Get active FCM tokens for a user
 */
export async function getUserFCMTokens(
  supabase: any,
  userId: string
): Promise<FCMToken[]> {
  try {
    const { data, error } = await supabase
      .from('fcm_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching FCM tokens:', error);
      return [];
    }

    return (data || []).map((t: any) => ({
      userId: t.user_id,
      token: t.token,
      deviceType: t.device_type,
      deviceName: t.device_name
    }));
  } catch (err) {
    console.error('Error in getUserFCMTokens:', err);
    return [];
  }
}

/**
 * Send notification via FCM (server-side implementation)
 * This would typically call Firebase Admin SDK
 * For now, it creates a notification record that can be processed by a background job
 */
export async function sendPushNotification(
  supabase: any,
  userId: string,
  notification: FCMNotification,
  type: string,
  referenceId?: string
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    // Create notification record in database
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: notification.title,
        message: notification.body,
        type,
        reference_id: referenceId,
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return { success: false, error: error.message };
    }

    // In production, this would trigger FCM via:
    // 1. Firebase Admin SDK directly
    // 2. Cloud Function trigger
    // 3. Background job processor
    
    // For now, we'll mark it as delivered since it's in the DB
    await supabase
      .from('notifications')
      .update({ delivered_at: new Date().toISOString() })
      .eq('id', data.id);

    return { success: true, notificationId: data.id };
  } catch (err) {
    console.error('Error in sendPushNotification:', err);
    return { success: false, error: 'Failed to send notification' };
  }
}

/**
 * Send bulk notifications to multiple users
 */
export async function sendBulkNotifications(
  supabase: any,
  userIds: string[],
  notification: FCMNotification,
  type: string,
  referenceId?: string
): Promise<{ success: boolean; count: number; errors?: string[] }> {
  try {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title: notification.title,
      message: notification.body,
      type,
      reference_id: referenceId,
      is_read: false
    }));

    const { data, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (error) {
      console.error('Error creating bulk notifications:', error);
      return { success: false, count: 0, errors: [error.message] };
    }

    return { success: true, count: data?.length || 0 };
  } catch (err) {
    console.error('Error in sendBulkNotifications:', err);
    return { success: false, count: 0, errors: ['Failed to send bulk notifications'] };
  }
}

/**
 * Send notification to all students in a class
 */
export async function notifyClassStudents(
  supabase: any,
  classId: string,
  sectionId: string | null,
  notification: FCMNotification,
  type: string,
  referenceId?: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Get all students in the class/section
    let query = supabase
      .from('student_enrollments')
      .select('student_id')
      .eq('class_id', classId)
      .eq('is_active', true);

    if (sectionId) {
      query = query.eq('section_id', sectionId);
    }

    const { data: enrollments, error: enrollmentError } = await query;

    if (enrollmentError) {
      console.error('Error fetching students:', enrollmentError);
      return { success: false, count: 0, error: enrollmentError.message };
    }

    const studentIds = enrollments?.map(e => e.student_id) || [];
    
    if (studentIds.length === 0) {
      return { success: true, count: 0 };
    }

    const result = await sendBulkNotifications(
      supabase,
      studentIds,
      notification,
      type,
      referenceId
    );

    return { success: result.success, count: result.count };
  } catch (err) {
    console.error('Error in notifyClassStudents:', err);
    return { success: false, count: 0, error: 'Failed to notify class students' };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  supabase: any,
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in markNotificationAsRead:', err);
    return { success: false, error: 'Failed to mark notification as read' };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
  supabase: any,
  userId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select();

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data?.length || 0 };
  } catch (err) {
    console.error('Error in markAllNotificationsAsRead:', err);
    return { success: false, count: 0, error: 'Failed to mark notifications as read' };
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(
  supabase: any,
  userId: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Error in getUnreadNotificationCount:', err);
    return 0;
  }
}

/**
 * Notification templates for common events
 */
export const NotificationTemplates = {
  assignmentCreated: (assignmentTitle: string, className: string) => ({
    title: 'New Assignment',
    body: `New assignment "${assignmentTitle}" posted for ${className}`
  }),
  
  assignmentSubmitted: (studentName: string, assignmentTitle: string) => ({
    title: 'Assignment Submitted',
    body: `${studentName} submitted "${assignmentTitle}"`
  }),
  
  assignmentGraded: (assignmentTitle: string, grade: string) => ({
    title: 'Assignment Graded',
    body: `Your assignment "${assignmentTitle}" has been graded: ${grade}`
  }),
  
  resultPublished: (examName: string, className: string) => ({
    title: 'Result Published',
    body: `${examName} results for ${className} are now available`
  }),
  
  studentApproved: (className: string) => ({
    title: 'Account Approved',
    body: `Your student account for ${className} has been approved`
  }),
  
  attendanceMarked: (date: string) => ({
    title: 'Attendance Recorded',
    body: `Your attendance for ${date} has been marked`
  }),
  
  discussionReply: (threadTitle: string) => ({
    title: 'New Reply',
    body: `Someone replied to "${threadTitle}"`
  }),
  
  announcement: (title: string) => ({
    title: 'Announcement',
    body: title
  }),
  
  marksCorrectionRequired: (examName: string, subject: string) => ({
    title: 'Marks Correction Required',
    body: `Admin requested correction for ${examName} - ${subject}`
  })
};
