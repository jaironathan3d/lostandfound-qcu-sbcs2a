import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { useAuth } from '../lib/AuthContext';
import { apiRequest } from '../lib/apiClient';
import './MessagesPage.css';

type ConversationSummary = {
  id: string;
  itemId: string;
  itemTitle: string;
  otherParticipantName: string;
  lastMessage: { content: string; senderId: string; createdAt: string } | null;
  updatedAt: string;
};
type ConversationMessage = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};
type ConversationDetails = {
  id: string;
  itemTitle: string;
  messages: ConversationMessage[];
};
type NotificationRecord = {
  id: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};
type NotificationResponse = {
  notifications: NotificationRecord[];
  unreadCount: number;
};
type ConversationReportReason = 'HARASSMENT' | 'SCAM_OR_FRAUD' | 'SHARED_PERSONAL_INFORMATION' | 'OTHER';

const reportReasons: Array<{ value: ConversationReportReason; label: string }> = [
  { value: 'HARASSMENT', label: 'Harassment or abusive messages' },
  { value: 'SCAM_OR_FRAUD', label: 'Scam or fraud' },
  { value: 'SHARED_PERSONAL_INFORMATION', label: 'Shared personal information' },
  { value: 'OTHER', label: 'Other safety concern' },
];

export const MessagesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('conversation') ?? '';
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [itemTitle, setItemTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ConversationReportReason>('OTHER');
  const [reportDetails, setReportDetails] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadConversations = useCallback(async () => {
    try {
      const records = await apiRequest<ConversationSummary[]>('/conversations');
      setConversations(records);
      return records;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your messages could not be loaded.');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await apiRequest<NotificationResponse>('/notifications');
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your notifications could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    void loadNotifications();
  }, [loadConversations, loadNotifications]);

  useEffect(() => {
    let active = true;
    if (!selectedId) {
      setMessages([]);
      setItemTitle('');
      return () => { active = false; };
    }
    apiRequest<ConversationDetails>(`/conversations/${selectedId}`)
      .then((details) => {
        if (!active) return;
        setMessages(details.messages);
        setItemTitle(details.itemTitle);
        setError('');
        void loadConversations();
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'This conversation could not be opened.');
      });
    return () => { active = false; };
  }, [loadConversations, selectedId]);

  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSearchParams({ conversation: conversations[0].id }, { replace: true });
    }
  }, [conversations, selectedId, setSearchParams]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!selectedId || !content) return;
    setIsSending(true);
    setError('');
    try {
      await apiRequest(`/conversations/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setDraft('');
      const details = await apiRequest<ConversationDetails>(`/conversations/${selectedId}`);
      setMessages(details.messages);
      await loadConversations();
      await loadNotifications();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your message could not be sent.');
    } finally {
      setIsSending(false);
    }
  };

  const submitConversationReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) return;
    setIsReporting(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/conversations/${selectedId}/reports`, {
        method: 'POST',
        body: JSON.stringify({ reason: reportReason, details: reportDetails }),
      });
      setReportOpen(false);
      setReportDetails('');
      setNotice('Your report was sent to administrators for review.');
      await loadNotifications();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This conversation could not be reported.');
    } finally {
      setIsReporting(false);
    }
  };

  const openNotification = async (notification: NotificationRecord) => {
    setError('');
    if (!notification.readAt) {
      try {
        const result = await apiRequest<{ readAt: string }>(`/notifications/${notification.id}/read`, {
          method: 'PATCH',
        });
        setNotifications((current) => current.map((entry) => (
          entry.id === notification.id ? { ...entry, readAt: result.readAt } : entry
        )));
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'The notification could not be marked as read.');
        return;
      }
    }
    if (notification.href) navigate(notification.href);
  };

  const markAllNotificationsRead = async () => {
    setError('');
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' });
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })));
      setUnreadCount(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Notifications could not be marked as read.');
    }
  };

  const selectedConversation = conversations.find((entry) => entry.id === selectedId);

  return (
    <div className="messages-page">
      <PublicHeader />
      <main className="messages-main">
        <header className="messages-heading">
          <div><p>YOUR ACCOUNT</p><h1>Messages</h1><span>Private conversations about approved item reports.</span></div>
          <Link to="/items">Browse items</Link>
        </header>
        {error && <p className="messages-error" role="alert">{error}</p>}
        {notice && <p className="messages-notice" role="status">{notice}</p>}
        <div className="messages-layout">
          <aside className="messages-inbox" aria-label="Conversations">
            <section className="messages-notifications" aria-label="Notifications">
              <div className="messages-notifications__heading">
                <h2>Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}</h2>
                {unreadCount > 0 && <button type="button" onClick={() => void markAllNotificationsRead()}>Mark all read</button>}
              </div>
              {notifications.length === 0 ? <p>No notifications yet.</p>
                : notifications.map((notification) => (
                  <button
                    type="button"
                    key={notification.id}
                    className={notification.readAt ? 'notification-entry' : 'notification-entry notification-entry--unread'}
                    onClick={() => void openNotification(notification)}
                  >
                    <span>{notification.message}</span>
                    <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
                  </button>
                ))}
            </section>
            <h2>Inbox</h2>
            {isLoading ? <p>Loading conversations…</p>
              : conversations.length === 0 ? <p>Your item conversations will appear here.</p>
                : conversations.map((conversation) => (
                  <button
                    type="button"
                    key={conversation.id}
                    className={selectedId === conversation.id ? 'conversation-preview conversation-preview--active' : 'conversation-preview'}
                    onClick={() => setSearchParams({ conversation: conversation.id })}
                  >
                    <strong>{conversation.otherParticipantName}</strong>
                    <span>{conversation.itemTitle}</span>
                    <small>{conversation.lastMessage?.content ?? 'No messages yet'}</small>
                  </button>
                ))}
          </aside>
          <section className="messages-conversation" aria-label="Selected conversation">
            {selectedConversation ? (
              <>
                <header className="messages-conversation__heading">
                  <div><span>About item</span><h2>{itemTitle || selectedConversation.itemTitle}</h2></div>
                  <div className="messages-conversation__actions">
                    <span>{selectedConversation.otherParticipantName}</span>
                    <button type="button" onClick={() => setReportOpen((isOpen) => !isOpen)}>
                      {reportOpen ? 'Cancel report' : 'Report conversation'}
                    </button>
                  </div>
                </header>
                {reportOpen && (
                  <form className="conversation-report-form" onSubmit={(event) => void submitConversationReport(event)}>
                    <label htmlFor="conversation-report-reason">Why are you reporting this conversation?</label>
                    <select id="conversation-report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value as ConversationReportReason)}>
                      {reportReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                    </select>
                    <label htmlFor="conversation-report-details">Additional detail (optional)</label>
                    <textarea id="conversation-report-details" maxLength={1000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} />
                    <p>Administrators can review the conversation to investigate your report.</p>
                    <button type="submit" disabled={isReporting}>{isReporting ? 'Sending…' : 'Send report'}</button>
                  </form>
                )}
                <div className="messages-list" aria-live="polite">
                  {messages.map((message) => (
                    <article key={message.id} className={message.senderId === user?.id ? 'private-message private-message--mine' : 'private-message'}>
                      <strong>{message.senderId === user?.id ? 'You' : message.senderName}</strong>
                      <p>{message.content}</p>
                      <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
                    </article>
                  ))}
                </div>
                <form className="messages-compose" onSubmit={(event) => void sendMessage(event)}>
                  <label htmlFor="private-message-draft">Reply privately</label>
                  <textarea id="private-message-draft" required maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Keep the conversation respectful and about the item." />
                  <button type="submit" disabled={isSending}>{isSending ? 'Sending…' : 'Send message'}</button>
                </form>
              </>
            ) : <div className="messages-empty">{isLoading ? 'Loading conversation…' : 'Select a conversation to read and reply.'}</div>}
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
};
