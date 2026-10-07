import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import client from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PageHeader, LoadingDots } from '../components/ui.jsx'
import { useModelStatus } from '../browser/modelStatus.js'

const SUGGESTIONS = [
  'Explain my last fasting glucose result',
  'What foods should I limit with high blood pressure?',
  'How is a cold different from the flu?',
  'What does a healthy lipid panel look like?',
]

export default function Assistant() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    client
      .get('/assistant/history')
      .then((res) => {
        setMessages(
          res.data.map((m) => ({ role: m.role, content: m.content, sources: [] }))
        )
      })
      .catch(() => {
        // History failed to load — chat still works from a blank slate.
      })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function send(text) {
    const messageText = text ?? input
    if (!messageText.trim() || sending) return

    setMessages((prev) => [...prev, { role: 'user', content: messageText, sources: [] }])
    setInput('')
    setSending(true)

    try {
      // A patient's questions are about themselves ("Explain my last fasting
      // glucose result"), so their own record goes along as context.
      const res = await client.post('/assistant/chat', {
        message: messageText,
        ...(user?.role === 'patient' && { patient_id: user.id }),
      })
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.answer, sources: res.data.sources },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, something went wrong reaching the assistant. Please try again.",
          sources: [],
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col md:h-[calc(100vh-6rem)]">
      <PageHeader
        title="AI Health Assistant"
        subtitle="Grounded in the MedVerse knowledge base — every answer shows its sources."
      />
      {__BROWSER_EDITION__ && <ModelStatusNote />}


      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="card px-4 py-3 text-left text-sm text-ink hover:border-pulse"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <ChatBubble key={i} message={m} />
        ))}

        {sending && (
          <div className="card max-w-md px-4 py-3">
            <LoadingDots />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="flex items-center gap-2 border-t border-line pt-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a symptom, lab result, or condition…"
          className="flex-1 rounded border border-line bg-surface px-4 py-2.5 text-sm focus:border-pulse"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex items-center justify-center rounded bg-ink p-2.5 text-paper hover:bg-pulse-dark disabled:opacity-50"
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}

// Browser edition: the embedding model downloads on first use (~25 MB).
function ModelStatusNote() {
  const { state, loaded, total } = useModelStatus()
  const mb = (bytes) => (bytes / 1e6).toFixed(1)
  let text = null
  if (state === 'loading') {
    text = total
      ? `Downloading the on-device language model: ${mb(loaded)} of ${mb(total)} MB (first visit only).`
      : 'Downloading the on-device language model (first visit only)…'
  } else if (state === 'ready') {
    text = 'On-device language model ready. Your questions stay on this device.'
  } else if (state === 'unavailable') {
    text = "Couldn't download the language model, so answers use keyword search for now."
  }
  if (!text) return null
  return (
    <p aria-live="polite" className="-mt-4 mb-4 text-xs text-muted">
      {text}
    </p>
  )
}

function ChatBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-lg ${isUser ? 'order-2' : ''}`}>
        <div
          className={`whitespace-pre-wrap rounded-lg px-4 py-3 text-sm ${
            isUser ? 'bg-ink text-paper' : 'card text-ink'
          }`}
        >
          {message.content}
        </div>
        {message.sources?.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="readout-label">Sources</div>
            {message.sources.map((s, idx) => (
              <div key={idx} className="rounded border border-line bg-pulse-dim px-3 py-1.5 text-xs text-ink/80">
                <span className="font-medium">{s.title}</span> — {s.snippet}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
