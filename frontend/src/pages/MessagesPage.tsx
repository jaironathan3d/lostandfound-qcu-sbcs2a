import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

export const MessagesPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('conversation') ?? '';
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [itemTitle, setItemTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
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

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your message could not be sent.');
    } finally {
      setIsSending(false);
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
        <div className="messages-layout">
          <aside className="messages-inbox" aria-label="Conversations">
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
                  <span>{selectedConversation.otherParticipantName}</span>
                </header>
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
