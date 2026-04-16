import { useState, useRef, useEffect } from 'react';
import { sendChatMessage, getUploadUrl, uploadFileToS3 } from '../api/client';

export default function ChatPanel({ sessionId, onSessionId, messages, onMessages, onFieldsUpdate, user, onAttachmentUploaded }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Send initial greeting on mount
  useEffect(() => {
    if (messages.length === 0) {
      const initMsg = user?.name
        ? `__INIT__: The logged-in user's name is ${user.name}. Greet them by first name. Explain that they can fill out the intake form directly in the panel to the right, or if they prefer, you can guide them through it conversationally. Ask how they'd like to proceed.`
        : '__INIT__: Greet the user. Explain that they can fill out the intake form directly in the panel to the right, or if they prefer, you can guide them through it conversationally. Ask how they\'d like to proceed.';
      handleSend(initMsg, true);
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
      const data = await sendChatMessage(sessionId, trimmed, user);

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

  const [pendingFile, setPendingFile] = useState(null);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFileUploadWithCategory(category) {
    const file = pendingFile;
    if (!file || !sessionId) return;
    setPendingFile(null);
    setUploading(true);

    onMessages((prev) => [...prev, { role: 'user', content: `📎 Uploading: ${file.name} (${category})` }]);

    try {
      const data = await getUploadUrl(
        sessionId,
        file.name,
        file.type || 'application/octet-stream',
        category
      );
      await uploadFileToS3(data.upload_url, file);

      onMessages((prev) => [...prev, { role: 'assistant', content: `Got it — "${file.name}" uploaded as ${category === 'logical-diagram' ? 'Logical Diagram' : category === 'vendor-doc' ? 'Vendor Document' : 'Other Artifact'}. 📎` }]);

      // Notify parent to refresh attachments
      if (onAttachmentUploaded) onAttachmentUploaded();
    } catch (err) {
      onMessages((prev) => [...prev, { role: 'assistant', content: `Upload failed: ${err.message}` }]);
    } finally {
      setUploading(false);
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
          <div className="text-[0.84rem] font-semibold text-text leading-tight">Architecture Review Board Intake Assistant</div>
          <div className="text-[0.67rem] text-text-muted font-mono">Enterprise Architecture &amp; Infrastructure</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[0.67rem] font-mono text-text-muted">
          <div className="w-1.5 h-1.5 rounded-full bg-semantic-green animate-pulse" />
          Active
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-scroll px-5 py-5 flex flex-col gap-4">
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

      {/* Category picker for file upload */}
      {pendingFile && (
        <div className="px-6 py-2.5 border-t border-border bg-amber-50 shrink-0">
          <div className="text-[0.75rem] text-text-dim mb-2">
            What type of attachment is <span className="font-semibold text-text">"{pendingFile.name}"</span>?
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'logical-diagram', label: 'Logical Diagram' },
              { key: 'vendor-doc', label: 'Vendor Document' },
              { key: 'other', label: 'Other Artifact' },
            ].map((cat) => (
              <button
                key={cat.key}
                onClick={() => handleFileUploadWithCategory(cat.key)}
                disabled={uploading}
                className="text-[0.72rem] font-semibold text-amber-700 bg-white border border-amber-300 rounded-cooley px-3 py-1.5 hover:bg-amber-500 hover:text-white transition-colors disabled:opacity-50"
              >
                {cat.label}
              </button>
            ))}
            <button
              onClick={() => setPendingFile(null)}
              className="text-[0.72rem] text-text-muted hover:text-text px-2 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-3 border-t border-border bg-surface-secondary shrink-0">
        <div className="flex gap-2 items-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.svg,.pptx,.xlsx,.txt,.drawio,.vsdx"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !sessionId}
            className="h-[38px] px-2.5 bg-surface-secondary border border-border rounded-cooley text-text-muted hover:text-cooley-red hover:border-cooley-red-mid transition-colors disabled:opacity-50"
            title="Attach file"
          >
            📎
          </button>
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
          Enter to send · Shift+Enter for new line · This form is for new work requests only. Please use ServiceNow for change requests.
        </div>
      </div>
    </div>
  );
}
