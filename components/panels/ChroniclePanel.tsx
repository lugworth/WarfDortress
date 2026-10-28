'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useGame } from '@/components/GameProvider';
import { PixelIcon, PixelSprite } from '@/components/pixel/PixelIcon';
import { serializeAdvisorRequest } from '@/lib/advisor-request';
import { speakFortressText } from '@/lib/audio';
import { collectClanAnecdotes, getSentimentBadge } from '@/lib/thoughts';
import type { ChronicleEntry } from '@/lib/types';
import { groupChronicle } from '@/lib/ui-model';

type Tab = 'log' | 'thoughts' | 'advisor';
type Filter = 'ALL' | ChronicleEntry['type'];
// Mirrors ADVISOR_MODELS in lib/gemini-server.ts, which is server-only.
type Model = 'gemini-3.5-flash-lite' | 'gemini-3.8-flash' | 'gemini-4-argon';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Everything' },
  { value: 'ALERT', label: 'Alerts' },
  { value: 'COMBAT', label: 'Combat' },
  { value: 'WORK', label: 'Work' },
  { value: 'CRAFT', label: 'Crafting' },
  { value: 'LORE', label: 'Lore' },
  { value: 'INFO', label: 'Notes' },
];

const TYPE_CLASS: Record<ChronicleEntry['type'], string> = {
  ALERT: 'px-bad', COMBAT: 'px-ember', WORK: 'px-muted', CRAFT: 'px-good', LORE: 'px-violet', INFO: 'px-info',
};

const SENTIMENT_CLASS: Record<string, string> = {
  EUPHORIC: 'px-info', POSITIVE: 'px-good', NEUTRAL: 'px-muted', NEGATIVE: 'px-ember', TERRIFIED: 'px-bad',
};

const PROMPTS = [
  { label: 'Priorities', text: 'What should our first 3 priorities be for this fortress?' },
  { label: 'Delving', text: 'How do I excavate deeper levels safely?' },
  { label: 'Lore', text: 'Tell me a legend from our world history.' },
  { label: 'Tales', text: 'Weave a vivid tale from our dwarves’ recent Thoughts & Feelings log!' },
];

interface Message { role: 'user' | 'model'; content: string }

export default function ChroniclePanel() {
  const { gameState } = useGame();
  const [tab, setTab] = useState<Tab>('log');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [dwarfFilter, setDwarfFilter] = useState('ALL');
  const [model, setModel] = useState<Model>('gemini-3.5-flash-lite');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'Hail, Overseer! I am Royal Chronicler **Bomrek Anvilward**. Mark the eastern cliff for **mining (D)**, or ask me how to lay out your halls.' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [status, setStatus] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => groupChronicle(gameState.chronicle.filter((e) => filter === 'ALL' || e.type === filter)), [gameState.chronicle, filter]);
  const allAnecdotes = useMemo(() => collectClanAnecdotes(gameState.dwarves, { limit: 24 }), [gameState.dwarves]);
  const anecdotes = useMemo(() => collectClanAnecdotes(gameState.dwarves, { dwarfId: dwarfFilter, limit: 20 }), [gameState.dwarves, dwarfFilter]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [messages, typing, tab]);

  const speak = async (text: string) => {
    if (!text || speaking) return;
    setSpeaking(true);
    try { await speakFortressText(text); } finally { setSpeaking(false); }
  };

  const reply = (content: string) => {
    setMessages((m) => [...m, { role: 'model', content }]);
    if (autoSpeak) speak(content);
  };

  const send = async (prompt?: string) => {
    const content = (prompt ?? input).trim();
    if (!content || typing) return;
    setTab('advisor');
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next);
    if (!prompt) setInput('');
    setTyping(true);
    try {
      const summary = {
        fortressName: gameState.world.dwarvenName,
        year: gameState.year,
        season: gameState.season,
        resources: gameState.resources,
        population: gameState.dwarves.length,
        activeCommission: gameState.guild.commissions.find((c) => c.status === 'ACTIVE'),
        factionFavor: gameState.guild.favor,
        carriedRelics: gameState.guild.relics.filter((r) => r.mode === 'EQUIPPED').slice(0, 10).map((r) => ({ name: r.name, ownerId: r.ownerId })),
        thoughtsAndFeelings: allAnecdotes.slice(0, 16).map((a) => ({
          dwarfName: a.dwarfName, dwarfTitle: a.dwarfTitle, tick: a.tick, year: a.year, season: a.season,
          category: a.category, sentiment: a.sentiment, moraleDelta: a.moraleDelta, text: a.text.slice(0, 160),
        })),
        dwarvesStates: gameState.dwarves.slice(0, 20).map((d) => ({
          name: d.name, state: d.state, quirk: d.quirk, z: d.z, happiness: d.happiness, thought: d.thought.slice(0, 160),
          recentThoughts: (d.thoughtLog || []).slice(0, 4).map((t) => t.text.slice(0, 140)),
        })),
      };
      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializeAdvisorRequest(model, next, summary),
      });
      const data = await res.json();
      setStatus(data.modelUsed === 'deterministic-chronicler' || data.fallback || !res.ok ? 'Offline advice · AI unavailable' : 'AI advisor');
      reply(data.text || 'Keep the picks ringing in the granite and never let the plump helmet stores run dry!');
    } catch (error) {
      setStatus(error instanceof RangeError ? error.message : 'Offline advice · AI unavailable');
      reply('By the ancestors, strike the eastern ore veins and build a Brewer’s Still before winter!');
    } finally {
      setTyping(false);
    }
  };

  const uploadSketch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || typing) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_000_000) {
      setStatus('Choose a PNG, JPEG, or WebP image under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setMessages((m) => [...m, { role: 'user', content: `Shared the sketch “${file.name}” for the architect.` }]);
      setTyping(true);
      try {
        const res = await fetch('/api/advisor/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: (reader.result as string).split(',')[1],
            mimeType: file.type,
            prompt: 'Analyze this image as a Dwarven Master Architect. Suggest how it inspires a fortress hall layout, defense trap, or legendary artifact.',
          }),
        });
        const data = await res.json();
        setStatus(data.fallback || !res.ok ? 'Offline advice · the image was not analyzed' : 'AI image analysis');
        reply(data.text || 'A worthy blueprint for our halls!');
      } catch {
        reply('The parchment is smudged with coal dust, Overseer, but the geometry looks sturdy!');
      } finally {
        setTyping(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="chronicle">
      <div className="drawer-tabs" role="tablist" aria-label="Chronicle sections">
        {([['log', 'Chronicle', 'icon_scroll'], ['thoughts', 'Thoughts', 'icon_heart'], ['advisor', 'Advisor', 'icon_chronicle']] as const).map(([id, label, icon]) => (
          <button key={id} type="button" role="tab" id={`chronicle-tab-${id}`} aria-selected={tab === id} aria-controls={`chronicle-${id}`} onClick={() => setTab(id)}>
            <PixelIcon name={icon} scale={1} /> {label}
          </button>
        ))}
      </div>

      {tab === 'log' && (
        <div id="chronicle-log" role="tabpanel" aria-labelledby="chronicle-tab-log" className="drawer-body px-scroll">
          <div className="px-row px-row--between">
            <select className="px-input" aria-label="Chronicle category" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <button type="button" className="px-btn px-btn--small" disabled={speaking} onClick={() => speak(entries[0]?.text || 'The chronicle is quiet.')}>
              <PixelIcon name="icon_sound" /> Read latest
            </button>
          </div>
          <ol className="log-list" aria-label="Fortress chronicle">
            {entries.map((entry) => (
              <li key={entry.id}>
                <time>Y{entry.year} T{entry.tick}</time>
                <span><span className={TYPE_CLASS[entry.type]}>■</span> {entry.text}{entry.count > 1 && <strong className="px-gold" aria-label={`${entry.count} times`}> ×{entry.count}</strong>}</span>
              </li>
            ))}
            {entries.length === 0 && <li><span /> <span className="px-dim">Nothing recorded in this category yet.</span></li>}
          </ol>
        </div>
      )}

      {tab === 'thoughts' && (
        <div id="chronicle-thoughts" role="tabpanel" aria-labelledby="chronicle-tab-thoughts" className="drawer-body px-scroll" data-testid="advisor-thoughts-panel">
          <div className="px-row px-row--between">
            <select className="px-input" aria-label="Whose thoughts" value={dwarfFilter} onChange={(e) => setDwarfFilter(e.target.value)}>
              <option value="ALL">Whole clan ({gameState.dwarves.length})</option>
              {gameState.dwarves.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="button" className="px-btn px-btn--small px-btn--violet" data-testid="advisor-weave-tale-btn"
              onClick={() => {
                const top = anecdotes[0];
                send(top ? `Weave a vivid dwarven story from our Thoughts & Feelings log, especially ${top.dwarfName} who "${top.text}"!` : 'Weave a story from our dwarves’ recent Thoughts & Feelings log!');
              }}>
              <PixelIcon name="icon_star" /> Weave a tale
            </button>
          </div>
          <ol className="px-stack px-stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Dwarf thoughts">
            {anecdotes.map((a) => {
              const badge = getSentimentBadge(a.sentiment);
              return (
                <li key={a.id} className="px-card" data-testid="advisor-anecdote-item" style={{ fontSize: '0.85em' }}>
                  <div className="px-row px-row--between">
                    <span><span className={SENTIMENT_CLASS[a.sentiment]} title={badge.label}>{badge.glyph}</span> <strong>{a.dwarfName}</strong> <span className="px-dim">depth {a.dwarfZ} · T{a.tick}</span></span>
                    <span className="px-row">
                      {a.moraleDelta !== 0 && <strong className={a.moraleDelta > 0 ? 'px-good' : 'px-bad'}>{a.moraleDelta > 0 ? '+' : ''}{a.moraleDelta}</strong>}
                      <button type="button" className="px-link" onClick={() => send(`Tell a chronicle tale about ${a.dwarfName} (${a.dwarfTitle}), who recently "${a.text}".`)}>Tale</button>
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontStyle: 'italic' }}>“{a.text}”</p>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {tab === 'advisor' && (
        <div id="chronicle-advisor" role="tabpanel" aria-labelledby="chronicle-tab-advisor" className="advisor">
          <div className="advisor-bar">
            <PixelSprite name="dwarf_helm_idle" scale={2} />
            <div className="min-w-0" style={{ flex: 1 }}>
              <strong>Bomrek Anvilward</strong>
              <small className="px-muted" style={{ display: 'block' }}>{status || 'Royal chronicler'}</small>
            </div>
            <select className="px-input" aria-label="Advisor model" value={model} onChange={(e) => setModel(e.target.value as Model)}>
              <option value="gemini-3.5-flash-lite">Lite</option>
              <option value="gemini-3.8-flash">Flash</option>
              <option value="gemini-4-argon">Argon</option>
            </select>
            <button type="button" className="px-btn px-btn--icon px-btn--small" aria-pressed={autoSpeak} aria-label="Read replies aloud" onClick={() => setAutoSpeak((v) => !v)}>
              <PixelIcon name={autoSpeak ? 'icon_sound' : 'icon_mute'} />
            </button>
          </div>
          <div className="advisor-prompts">
            {PROMPTS.map((p) => <button key={p.label} type="button" className="px-btn px-btn--small px-btn--ghost" disabled={typing} onClick={() => send(p.text)}>{p.label}</button>)}
          </div>
          <div ref={chatRef} className="chat-log px-scroll" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className="chat-msg px-card" data-role={m.role}>
                <div className="who">{m.role === 'user' ? <><PixelIcon name="icon_banner" scale={1} /> You</> : <><PixelIcon name="icon_chronicle" scale={1} /> Bomrek</>}</div>
                <ReactMarkdown>{m.content}</ReactMarkdown>
                {m.role === 'model' && <button type="button" className="px-link" style={{ fontSize: '0.8em' }} disabled={speaking} onClick={() => speak(m.content)}>Read aloud</button>}
              </div>
            ))}
            {typing && <p className="px-gold typing">Bomrek is reading the runes<span className="dots" /></p>}
          </div>
          <form className="advisor-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label className="px-btn px-btn--icon px-btn--small" title="Share a sketch or blueprint">
              <PixelIcon name="icon_image" />
              <span className="sr-only">Share a sketch</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={typing} onChange={uploadSketch} />
            </label>
            <input className="px-input" maxLength={3000} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the advisor…" aria-label="Message the advisor" />
            <button type="submit" className="px-btn px-btn--icon px-btn--gold" aria-label="Send" disabled={typing || !input.trim()}>
              <PixelIcon name="icon_send" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
