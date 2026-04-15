import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../api/client';

export default function ChatPanel({ sessionId, onSessionId, messages, onMessages, onFieldsUpdate }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Send initial greeting on mount
  useEffect(() => {
    if (messages.length === 0) {
      handleSend('__INIT__: Start the intake conversation now. Begin your greeting as the ARB Intake Assistant.', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend(text, isInit = false) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Don't show __INIT__ as a user message
    if (!isInit) {
      onMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    }
    setInput('');
    setLoading(true);

    try {
      const data = await sendChatMessage(sessionId, trimmed);

      if (data.session_id && !sessionId) {
        onSessionId(data.session_id);
      }

      onMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);

      if (data.extracted_fields && Object.keys(data.extracted_fields).length > 0) {
        onFieldsUpdate(data.extracted_fields);
      }
    } catch (err) {
      onMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, something went wrong: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  return (
    <div className="w-[58%] flex flex-col border-r border-border bg-white">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-surface-secondary shrink-0 flex items-center gap-3">
        <div className="w-[34px] h-[34px] rounded-cooley bg-cooley-red flex items-center justify-center font-mono text-[0.55rem] font-semibold text-white">
          ARB
        </div>
        <div>
          <div className="text-[0.84rem] font-semibold text-text leading-tight">ARB Intake Assistant</div>
          <div className="text-[0.67rem] text-text-muted font-mono">Enterprise Architecture &amp; Infrastructure</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[0.67rem] font-mono text-text-muted">
          <div className="w-1.5 h-1.5 rounded-full bg-semantic-green animate-pulse" />
          Active
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-6 h-6 rounded shrink-0 flex items-center justify-center font-mono text-[0.5rem] font-semibold mt-0.5 ${
                msg.role === 'user'
                  ? 'bg-surface-tertiary border border-border-strong text-text-dim'
                  : 'bg-cooley-red text-white'
              }`}
            >
              {msg.role === 'user' ? 'You' : 'ARB'}
            </div>
            <div
              className={`max-w-[78%] px-3.5 py-2.5 text-[0.845rem] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cooley-red-light border border-cooley-red-mid rounded-tl-[7px] rounded-tr-[2px] rounded-b-[7px]'
                  : 'bg-surface-secondary border border-border rounded-tl-[2px] rounded-tr-[7px] rounded-b-[7px]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 items-start">
            <div className="w-6 h-6 rounded bg-cooley-red flex items-center justify-center font-mono text-[0.5rem] font-semibold text-white">
              ARB
            </div>
            <div className="bg-surface-secondary border border-border rounded-tl-[2px] rounded-tr-[7px] rounded-b-[7px] px-3.5 py-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:0.15s]" />
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:0.3s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-3 border-t border-border bg-surface-secondary shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type your response…"
            className="flex-1 bg-white border-[1.5px] border-border rounded-cooley px-3 py-2 text-text text-[0.845rem] leading-normal resize-none min-h-[38px] max-h-[110px] overflow-y-auto focus:outline-none focus:border-cooley-red transition-colors"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            className="bg-cooley-red text-white text-[0.76rem] font-semibold px-4 h-[38px] rounded-cooley hover:bg-cooley-red-hover disabled:bg-text-muted disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
        <div className="mt-1.5 text-[0.63rem] text-text-muted font-mono">
          Enter to send · Shift+Enter for new line · Incidents → ServiceNow
        </div>
      </div>
    </div>
  );
}
