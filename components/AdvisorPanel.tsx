'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useGame } from './GameProvider';
import ReactMarkdown from 'react-markdown';

type GeminiModelOption = 'gemini-3.8-flash' | 'gemini-4-argon' | 'gemini-3.1-flash-lite';

export default function AdvisorPanel() {
  const { gameState } = useGame();
  const [selectedModel, setSelectedModel] = useState<GeminiModelOption>('gemini-3.1-flash-lite');
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
  const [autoSpeak, setAutoSpeak] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const speakText = async (text: string) => {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    const cleanText = text.replace(/[*#_`]/g, '').slice(0, 420);
    try {
      const res = await fetch('/api/advisor/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      });
      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        await audio.play();
        return;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.pitch = 0.8;
        utter.rate = 0.95;
        utter.onend = () => setIsSpeaking(false);
        utter.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utter);
        return;
      }
      setIsSpeaking(false);
    } catch {
      setIsSpeaking(false);
    }
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
        dwarvesStates: gameState.dwarves.map((d) => ({
          name: d.name,
          state: d.state,
          z: d.z,
          thought: d.thought,
        })),
      };

      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: updatedMessages.map((m) => ({
            role: m.role,
            parts: [{ text: m.content }],
          })),
          fortressSummary,
        }),
      });
      const data = await res.json();
      const reply =
        data.text ||
        'Keep the picks ringing in the granite and ensure our Plump Helmet stores never run dry!';
      setMessages((prev) => [...prev, { role: 'model', content: reply }]);
      if (autoSpeak) {
        speakText(reply);
      }
    } catch {
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
    if (!file) return;

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
            prompt:
              'Analyze this image as a Dwarven Master Architect. Suggest how it inspires a fortress hall layout, defense trap, or legendary artifact.',
          }),
        });
        const data = await res.json();
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
    <aside className="w-full h-full bg-[#000000] border-l border-[#202020] flex flex-col font-mono text-xs select-none text-[#d0d0d0]">
      {/* Top Section: Fortress Chronicle */}
      <div className="h-44 border-b border-[#202020] flex flex-col bg-[#101010]">
        <div className="px-2 py-1.5 border-b border-[#202020] flex items-center justify-between gap-1 text-xs">
          <span className="text-[#ff0099] font-bold truncate whitespace-nowrap">┌─[ CHRONICLE ]</span>
          <button
            type="button"
            onClick={() => speakText(gameState.chronicle[0]?.text || 'Strike the earth!')}
            className="text-[#00ffff] hover:text-[#ffffff] hover:bg-[#202020] px-1 transition-colors whitespace-nowrap shrink-0 text-[11px]"
            title="Read Latest Chronicle via Gemini TTS"
          >
            [ READ LATEST ]
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[11px] custom-scrollbar bg-[#000000]">
          {gameState.chronicle.map((entry) => (
            <div
              key={entry.id}
              className="px-1.5 py-0.5 border-b border-[#202020]/60 text-[#d0d0d0] leading-snug"
            >
              <span className="text-[#ff9900] whitespace-nowrap shrink-0">
                [Y{entry.year}·T{entry.tick}]
              </span>{' '}
              {entry.text}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Section: Royal Advisor Chat */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#000000]">
        <div className="px-2 py-1.5 border-b border-[#202020] bg-[#101010] flex items-center justify-between gap-1 text-xs">
          <span className="text-[#ff0099] font-bold truncate whitespace-nowrap">
            ┌─[ ADVISOR BOMREK ]
          </span>

          <div className="flex items-center gap-1 shrink-0 text-[10px]">
            <select
              aria-label="Gemini Model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as GeminiModelOption)}
              className="bg-[#000000] border border-[#202020] text-[#00ffff] px-1 py-0.5 focus:outline-none whitespace-nowrap shrink-0"
            >
              <option value="gemini-3.8-flash">Flash</option>
              <option value="gemini-4-argon">Argon</option>
              <option value="gemini-3.1-flash-lite">Lite</option>
            </select>

            <button
              type="button"
              onClick={() => setAutoSpeak((v) => !v)}
              className={`px-1 py-0.5 transition-colors whitespace-nowrap shrink-0 ${
                autoSpeak
                  ? 'text-[#33ff00] bg-[#202020] font-bold'
                  : 'text-[#808080] hover:text-[#d0d0d0]'
              }`}
            >
              {autoSpeak ? '[VOICE:ON]' : '[VOICE:OFF]'}
            </button>
          </div>
        </div>

        {/* Quick Clickable Query Prompts */}
        <div className="px-2 py-1 bg-[#101010] border-b border-[#202020] flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-[10px]">
          <button
            type="button"
            onClick={() => sendMessage('What should our first 3 priorities be for this fortress?')}
            className="text-[#00ffff] hover:bg-[#202020] px-1 whitespace-nowrap shrink-0"
          >
            [ 1: PRIORITIES ]
          </button>
          <button
            type="button"
            onClick={() => sendMessage('How do I excavate deeper Z-levels safely?')}
            className="text-[#ff0099] hover:bg-[#202020] px-1 whitespace-nowrap shrink-0"
          >
            [ 2: Z-MINING ]
          </button>
          <button
            type="button"
            onClick={() => sendMessage('Tell me a legend from our world history.')}
            className="text-[#33ff00] hover:bg-[#202020] px-1 whitespace-nowrap shrink-0"
          >
            [ 3: LORE ]
          </button>
        </div>

        {/* Chat Stream */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-[#000000]"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-1.5 border text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'border-[#ff9900]/60 bg-[#101010] text-[#ff9900]'
                  : 'border-[#202020] bg-[#101010] text-[#d0d0d0]'
              }`}
            >
              <div className="text-[10px] text-[#808080] mb-0.5">
                {m.role === 'user' ? '> OVERSEER COMMAND' : '< ADVISOR BOMREK'}
              </div>
              <div className="prose prose-invert prose-xs max-w-none text-[11px]">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
              {m.role === 'model' && (
                <div className="mt-1 pt-1 border-t border-[#202020] flex justify-end">
                  <button
                    type="button"
                    onClick={() => speakText(m.content)}
                    className="text-[#ff0099] hover:text-[#ffffff] text-[10px] whitespace-nowrap shrink-0"
                  >
                    [ SPEAK TEXT ]
                  </button>
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="text-[11px] text-[#ff0099] animate-pulse px-1 whitespace-nowrap truncate">
              &gt; Chronicler Bomrek is interpreting the runes...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-2 border-t border-[#202020] bg-[#101010] flex items-center gap-1.5">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            id="advisor-img-input"
            onChange={handleImageUpload}
          />
          <label
            htmlFor="advisor-img-input"
            className="text-[#00ffff] hover:bg-[#202020] cursor-pointer px-1 py-0.5 border border-[#202020] text-[11px] whitespace-nowrap shrink-0"
            title="Upload fortress sketch or blueprint"
          >
            [IMG]
          </label>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Query advisor or enter command..."
            className="flex-1 min-w-0 bg-[#000000] border border-[#202020] px-2 py-1 text-xs text-[#d0d0d0] focus:outline-none focus:border-[#ff0099]"
          />

          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={isTyping}
            className="text-[#ff0099] hover:bg-[#202020] disabled:text-[#808080] px-1.5 py-1 border border-[#202020] font-bold whitespace-nowrap shrink-0"
          >
            [SEND]
          </button>
        </div>
      </div>
    </aside>
  );
}
