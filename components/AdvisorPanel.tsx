'use client';
import { speakFortressText } from '@/lib/audio';
import { serializeAdvisorRequest } from '@/lib/advisor-request';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGame } from './GameProvider';
import ReactMarkdown from 'react-markdown';
import { groupChronicle } from '@/lib/ui-model';
import { collectClanAnecdotes, getSentimentBadge } from '@/lib/thoughts';
import type { ChronicleEntry } from '@/lib/types';
import AsciiSelect from './AsciiSelect';

type GeminiModelOption = 'gemini-3.8-flash' | 'gemini-4-argon' | 'gemini-3.5-flash-lite';
type ChronicleFilter = 'ALL' | ChronicleEntry['type'];

const chronicleCategories: { value: ChronicleFilter; label: string }[] = [
  { value: 'ALL', label: 'All entries' },
  { value: 'ALERT', label: 'Alerts' },
  { value: 'COMBAT', label: 'Combat' },
  { value: 'WORK', label: 'Work' },
  { value: 'CRAFT', label: 'Crafting' },
  { value: 'LORE', label: 'Lore' },
  { value: 'INFO', label: 'Information' },
];

const MODEL_OPTIONS: { value: GeminiModelOption; label: string }[] = [
  { value: 'gemini-3.8-flash', label: 'Flash' },
  { value: 'gemini-4-argon', label: 'Argon' },
  { value: 'gemini-3.5-flash-lite', label: 'Lite' },
];

export default function AdvisorPanel() {
  const { gameState } = useGame();
  const [selectedModel, setSelectedModel] = useState<GeminiModelOption>('gemini-3.5-flash-lite');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'model'; content: string }>>([
    {
      role: 'model',
      content:
        'Hail, Overseer! I am Royal Chronicler **Bomrek Anvilward**. Issue **Mine (D)** orders along the eastern rock cliff, or request colony layouts!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [advisorStatus, setAdvisorStatus] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [chronicleFilter, setChronicleFilter] = useState<ChronicleFilter>('ALL');
  const [thoughtsDwarfFilter, setThoughtsDwarfFilter] = useState<string>('ALL');
  const scrollRef = useRef<HTMLDivElement>(null);

  const chronicleEntries = useMemo(
    () => groupChronicle(gameState.chronicle.filter((entry) => chronicleFilter === 'ALL' || entry.type === chronicleFilter)),
    [gameState.chronicle, chronicleFilter]
  );

  const allClanAnecdotes = useMemo(
    () => collectClanAnecdotes(gameState.dwarves, { limit: 24 }),
    [gameState.dwarves]
  );

  const filteredAnecdotes = useMemo(
    () =>
      collectClanAnecdotes(gameState.dwarves, {
        dwarfId: thoughtsDwarfFilter,
        limit: 20,
      }),
    [gameState.dwarves, thoughtsDwarfFilter]
  );

  const dwarfFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: `All Dwarves (${gameState.dwarves.length})` },
      ...gameState.dwarves.map((d) => ({
        value: d.id,
        label: `${d.name} (${d.thoughtLog?.length || 1})`,
      })),
    ],
    [gameState.dwarves]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const speakText = async (text: string) => {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    try { await speakFortressText(text); }
    finally { setIsSpeaking(false); }
  };

  const sendMessage = async (promptText?: string) => {
    const contentToSend = (promptText ?? input).trim();
    if (!contentToSend || isTyping) return;

    const userMessage = { role: 'user' as const, content: contentToSend };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    if (!promptText) setInput('');
    setIsTyping(true);

    try {
      const fortressSummary = {
        fortressName: gameState.world.dwarvenName,
        year: gameState.year,
        season: gameState.season,
        resources: gameState.resources,
        population: gameState.dwarves.length,
        activeCommission: gameState.guild.commissions.find((c) => c.status === 'ACTIVE'),
        factionFavor: gameState.guild.favor,
        carriedRelics: gameState.guild.relics.filter((r) => r.mode === 'EQUIPPED').slice(0, 10).map((r) => ({ name: r.name, ownerId: r.ownerId })),
        thoughtsAndFeelings: allClanAnecdotes.slice(0, 16).map((a) => ({
          dwarfName: a.dwarfName,
          dwarfTitle: a.dwarfTitle,
          tick: a.tick,
          year: a.year,
          season: a.season,
          category: a.category,
          sentiment: a.sentiment,
          moraleDelta: a.moraleDelta,
          text: a.text.slice(0, 160),
        })),
        dwarvesStates: gameState.dwarves.slice(0, 20).map((d) => ({
          name: d.name,
          state: d.state,
          quirk: d.quirk,
          z: d.z,
          happiness: d.happiness,
          thought: d.thought.slice(0, 160),
          recentThoughts: (d.thoughtLog || []).slice(0, 4).map((t) => t.text.slice(0, 140)),
        })),
      };

      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializeAdvisorRequest(selectedModel, updatedMessages, fortressSummary),
      });
      const data = await res.json();
      setAdvisorStatus(data.modelUsed === 'deterministic-chronicler' || data.fallback || !res.ok ? 'Offline advice · AI unavailable' : 'AI advisor');
      const reply =
        data.text ||
        'Keep the picks ringing in the granite and ensure our Plump Helmet stores never run dry!';
      setMessages((prev) => [...prev, { role: 'model', content: reply }]);
      if (autoSpeak) {
        speakText(reply);
      }
    } catch (error) {
      setAdvisorStatus(error instanceof RangeError ? error.message : 'Offline advice · AI unavailable');
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content:
            'By the ancestors, strike the eastern ore veins and construct a Brewer’s Still before winter!',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isTyping) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_000_000) { setAdvisorStatus('Choose a PNG, JPEG, or WebP image under 2 MB.'); return; }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const userMessage = {
        role: 'user' as const,
        content: `Uploaded sketch "${file.name}" for Architect inspection.`,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);
      try {
        const res = await fetch('/api/advisor/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            mimeType: file.type,
            prompt:
              'Analyze this image as a Dwarven Master Architect. Suggest how it inspires a fortress hall layout, defense trap, or legendary artifact.',
          }),
        });
        const data = await res.json();
        setAdvisorStatus(data.fallback || !res.ok ? 'Offline advice · image was not analyzed' : 'AI image analysis');
        const reply = data.text || 'A worthy blueprint for our subterranean halls!';
        setMessages((prev) => [...prev, { role: 'model', content: reply }]);
        if (autoSpeak) speakText(reply);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            content: 'The parchment is smudged with coal dust, Overseer, but the geometry looks sturdy!',
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside className="w-full h-full bg-[var(--ui-bg)] border-l border-[var(--ui-border)] flex flex-col font-mono text-xs select-none text-[var(--ui-text)]">
      {/* Top Section: Fortress Chronicle */}
      <div className="h-36 shrink-0 border-b border-[var(--ui-border)] flex flex-col bg-[var(--ui-panel)]">
        <div className="px-2 py-1 border-b border-[var(--ui-border)] flex items-center justify-between gap-1 text-xs">
          <span className="text-[var(--ui-accent)] font-bold truncate whitespace-nowrap">┌─[ CHRONICLE ]</span>
          <button
            type="button"
            onClick={() => speakText(chronicleEntries[0]?.text || 'No entries in this chronicle category.')}
            className="text-[var(--ui-info)] hover:text-[var(--ui-bright)] hover:bg-[var(--ui-border)] px-1 transition-colors whitespace-nowrap shrink-0 text-[11px]"
            title="Read Latest Chronicle via Gemini TTS"
          >
            [ READ LATEST ]
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ui-border)] px-2 py-1 text-[var(--ui-muted)]">
          <span>Category</span>
          <AsciiSelect<ChronicleFilter>
            ariaLabel="Chronicle category"
            size="sm"
            className="min-w-0 flex-1"
            value={chronicleFilter}
            options={chronicleCategories}
            onChange={(next) => setChronicleFilter(next)}
          />
        </div>
        <ol aria-label="Fortress chronicle" className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-1 font-mono text-[11px] custom-scrollbar bg-[var(--ui-bg)]">
          {chronicleEntries.map((entry) => (
            <li
              key={entry.id}
              className="px-1.5 py-0.5 border-b border-[var(--ui-border)]/60 text-[var(--ui-text)] leading-snug"
            >
              <span className="text-[var(--ui-muted)] whitespace-nowrap shrink-0">
                [Y{entry.year}·T{entry.tick}]
              </span>{' '}
              <span className="text-[var(--ui-info)]">{entry.type}</span>{' '}
              {entry.text}
              {entry.count > 1 && <span className="ml-1 text-[var(--ui-accent)]" aria-label={`${entry.count} occurrences`}>×{entry.count}</span>}
            </li>
          ))}
          {chronicleEntries.length === 0 && <li className="p-1 text-[var(--ui-muted)]">No entries in this category.</li>}
        </ol>
      </div>

      {/* Middle Section: Automated Dwarf Thoughts & Feelings Log */}
      <div
        data-testid="advisor-thoughts-panel"
        className="h-44 shrink-0 border-b border-[var(--ui-border)] flex flex-col bg-[var(--ui-panel)]"
      >
        <div className="px-2 py-1 border-b border-[var(--ui-border)] flex items-center justify-between gap-1 text-xs">
          <span className="text-[#ff0099] font-bold truncate whitespace-nowrap">
            ┌─[ THOUGHTS &amp; FEELINGS ]
          </span>
          <button
            type="button"
            data-testid="advisor-weave-tale-btn"
            onClick={() => {
              const top = filteredAnecdotes[0];
              if (top) {
                sendMessage(
                  `Weave a vivid dwarven story from our Thoughts & Feelings log, especially ${top.dwarfName} who "${top.text}"!`
                );
              } else {
                sendMessage('Weave a story from our dwarves’ recent Thoughts & Feelings log!');
              }
            }}
            className="text-[#00ffff] hover:text-[#ffffff] hover:bg-[var(--ui-border)] px-1 transition-colors whitespace-nowrap shrink-0 text-[10px] font-bold"
            title="Have Advisor Bomrek weave a tale from recent dwarf anecdotes"
          >
            [ ☼ WEAVE TALE ]
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ui-border)] px-2 py-1 text-[var(--ui-muted)]">
          <span>Dwarf</span>
          <AsciiSelect<string>
            ariaLabel="Dwarf thoughts filter"
            size="sm"
            className="min-w-0 flex-1"
            value={thoughtsDwarfFilter}
            options={dwarfFilterOptions}
            onChange={(next) => setThoughtsDwarfFilter(next)}
          />
        </div>

        <ol
          aria-label="Dwarf thoughts and feelings"
          className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-1 font-mono text-[10px] custom-scrollbar bg-[var(--ui-bg)]"
        >
          {filteredAnecdotes.map((anecdote) => {
            const badge = getSentimentBadge(anecdote.sentiment);
            return (
              <li
                key={anecdote.id}
                data-testid="advisor-anecdote-item"
                className="px-1.5 py-1 border border-[var(--ui-border)]/70 bg-[var(--ui-panel)]/50 leading-snug space-y-0.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className={`font-bold ${badge.colorClass}`} title={badge.label}>
                      {badge.glyph}
                    </span>
                    <span className="font-bold truncate" style={{ color: anecdote.dwarfColor }}>
                      {anecdote.dwarfName}
                    </span>
                    <span className="text-[var(--ui-muted)] shrink-0">
                      [Z-{anecdote.dwarfZ}·T{anecdote.tick}]
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {anecdote.moraleDelta !== 0 && (
                      <span
                        className={`tabular-nums font-bold ${
                          anecdote.moraleDelta > 0 ? 'text-[#33ff00]' : 'text-[#ff0000]'
                        }`}
                      >
                        {anecdote.moraleDelta > 0
                          ? `+${anecdote.moraleDelta}`
                          : anecdote.moraleDelta}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        sendMessage(
                          `Tell a chronicle tale about ${anecdote.dwarfName} (${anecdote.dwarfTitle}), who recently "${anecdote.text}".`
                        )
                      }
                      className="text-[var(--ui-accent)] hover:text-[#ffffff] px-1 border border-[var(--ui-border)] text-[9px]"
                      title={`Ask Advisor Bomrek about ${anecdote.dwarfName}'s experience`}
                    >
                      [TALE]
                    </button>
                  </div>
                </div>
                <div className="text-[var(--ui-text)] italic">
                  &ldquo;{anecdote.text}&rdquo;
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Bottom Section: Royal Advisor Chat */}
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--ui-bg)]">
        <div className="px-2 py-1 border-b border-[var(--ui-border)] bg-[var(--ui-panel)] flex items-center justify-between gap-1 text-xs">
          <span className="text-[var(--ui-accent)] font-bold truncate whitespace-nowrap">
            ┌─[ ADVISOR BOMREK ]
          </span>

          <div className="flex items-center gap-1 shrink-0 text-[10px]">
            <AsciiSelect<GeminiModelOption>
              ariaLabel="Gemini Model"
              size="sm"
              align="right"
              value={selectedModel}
              options={MODEL_OPTIONS}
              onChange={(nextModel) => setSelectedModel(nextModel)}
            />

            <button
              type="button"
              onClick={() => setAutoSpeak((v) => !v)}
              className={`px-1 py-0.5 transition-colors whitespace-nowrap shrink-0 ${
                autoSpeak
                  ? 'text-[var(--ui-success)] bg-[var(--ui-border)] font-bold'
                  : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
              }`}
            >
              {autoSpeak ? '[VOICE:ON]' : '[VOICE:OFF]'}
            </button>
          </div>
        </div>

        {/* Quick Clickable Query Prompts */}
        <div className="px-2 py-1 bg-[var(--ui-panel)] border-b border-[var(--ui-border)] flex items-center gap-1 overflow-x-auto custom-scrollbar text-[10px]">
          <button
            type="button"
            onClick={() => sendMessage('What should our first 3 priorities be for this fortress?')}
            className="text-[var(--ui-info)] hover:bg-[var(--ui-border)] px-1 whitespace-nowrap shrink-0"
          >
            [ 1: PRIORITIES ]
          </button>
          <button
            type="button"
            onClick={() => sendMessage('How do I excavate deeper Z-levels safely?')}
            className="text-[var(--ui-accent)] hover:bg-[var(--ui-border)] px-1 whitespace-nowrap shrink-0"
          >
            [ 2: Z-MINING ]
          </button>
          <button
            type="button"
            onClick={() => sendMessage('Tell me a legend from our world history.')}
            className="text-[var(--ui-success)] hover:bg-[var(--ui-border)] px-1 whitespace-nowrap shrink-0"
          >
            [ 3: LORE ]
          </button>
          <button
            type="button"
            onClick={() =>
              sendMessage(
                'Weave a vivid tale from our dwarves’ recent Thoughts & Feelings log!'
              )
            }
            className="text-[#ff0099] hover:bg-[var(--ui-border)] px-1 whitespace-nowrap shrink-0 font-bold"
          >
            [ 4: TALES ]
          </button>
        </div>

        {advisorStatus && <p role="status" className="px-2 text-[var(--ui-muted)]">{advisorStatus}</p>}
        {/* Chat Stream */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-[var(--ui-bg)]"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-1.5 border text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'border-[var(--ui-warning)]/60 bg-[var(--ui-panel)] text-[var(--ui-warning)]'
                  : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-text)]'
              }`}
            >
              <div className="text-[10px] text-[var(--ui-muted)] mb-0.5">
                {m.role === 'user' ? '> OVERSEER COMMAND' : '< ADVISOR BOMREK'}
              </div>
              <div className="prose prose-invert prose-xs max-w-none text-[11px]">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
              {m.role === 'model' && (
                <div className="mt-1 pt-1 border-t border-[var(--ui-border)] flex justify-end">
                  <button
                    type="button"
                    onClick={() => speakText(m.content)}
                    className="text-[var(--ui-accent)] hover:text-[var(--ui-bright)] text-[10px] whitespace-nowrap shrink-0"
                  >
                    [ SPEAK TEXT ]
                  </button>
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="text-[11px] text-[var(--ui-accent)] animate-pulse px-1 whitespace-nowrap truncate">
              &gt; Chronicler Bomrek is interpreting the runes...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-2 border-t border-[var(--ui-border)] bg-[var(--ui-panel)] flex items-center gap-1.5">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            id="advisor-img-input"
            disabled={isTyping}
            onChange={handleImageUpload}
          />
          <label
            htmlFor="advisor-img-input"
            className="text-[var(--ui-info)] hover:bg-[var(--ui-border)] cursor-pointer px-1 py-0.5 border border-[var(--ui-border)] text-[11px] whitespace-nowrap shrink-0"
            title="Upload fortress sketch or blueprint"
          >
            [IMG]
          </label>

          <input
            type="text"
            maxLength={3000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Query advisor or enter command..."
            className="flex-1 min-w-0 bg-[var(--ui-bg)] border border-[var(--ui-border)] px-2 py-1 text-xs text-[var(--ui-text)] focus:outline-none focus:border-[var(--ui-accent)]"
          />

          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={isTyping}
            className="text-[var(--ui-accent)] hover:bg-[var(--ui-border)] disabled:text-[var(--ui-muted)] px-1.5 py-1 border border-[var(--ui-border)] font-bold whitespace-nowrap shrink-0"
          >
            [SEND]
          </button>
        </div>
      </div>
    </aside>
  );
}
