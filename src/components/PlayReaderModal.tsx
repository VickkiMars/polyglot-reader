"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  Users,
  Theater,
  Languages,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Mic,
  SkipForward,
  SkipBack,
  Clock,
  Info
} from "lucide-react";
import { PlayMetadata, PlayScene, PlayChunk, PlayCatalogItem } from "@/types";

interface PlayReaderModalProps {
  play: PlayMetadata;
  isOpen: boolean;
  onClose: () => void;
  availablePlays?: PlayCatalogItem[];
  onSelectPlay?: (playId: string) => void;
}

type RehearsalMode = "chunk" | "roleplay" | "continuous";
type CharacterRole = string;

export default function PlayReaderModal({
  play,
  isOpen,
  onClose,
  availablePlays,
  onSelectPlay,
}: PlayReaderModalProps) {
  // Navigation State
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const currentScene = play.scenes[activeSceneIndex] || play.scenes[0];

  // Abstraction & Playback Modes
  const [mode, setMode] = useState<RehearsalMode>("chunk");
  const [userRole, setUserRole] = useState<CharacterRole>("all");
  const [shadowingPause, setShadowingPause] = useState<number>(1.5); // seconds after chunk ends

  // Chunk State
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const activeChunk = currentScene.chunks[activeChunkIndex] || currentScene.chunks[0];
  const [isWaitingForUserSpeech, setIsWaitingForUserSpeech] = useState(false);

  // Audio Engine State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentScene?.duration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Display Settings
  const [showEnglish, setShowEnglish] = useState(true);
  const [showFurigana, setShowFurigana] = useState(true);
  const [showSettingInfo, setShowSettingInfo] = useState(false);

  // Card list ref for auto-scrolling
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset state when play changes
  useEffect(() => {
    setActiveSceneIndex(0);
    setActiveChunkIndex(0);
    setUserRole("all");
    setIsWaitingForUserSpeech(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [play.id]);

  // Reset chunk when scene changes
  useEffect(() => {
    setActiveChunkIndex(0);
    setIsWaitingForUserSpeech(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [activeSceneIndex]);

  // Sync audio source when scene changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = currentScene.audio_url;
      audioRef.current.load();
    }
  }, [currentScene]);

  // Auto-scroll active chunk into view
  useEffect(() => {
    if (cardRefs.current[activeChunkIndex]) {
      cardRefs.current[activeChunkIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeChunkIndex]);

  // Audio time update handler with CHUNK CLAMPING
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    setCurrentTime(curr);

    if (mode === "chunk") {
      // Clamped playback: pause as soon as active chunk ends
      if (curr >= activeChunk.end) {
        audioRef.current.pause();
        setIsPlaying(false);
        // Optional auto-advance with shadowing pause
        if (shadowingPause > 0 && activeChunkIndex < currentScene.chunks.length - 1) {
          // trigger timeout for next chunk
        }
      }
    } else if (mode === "roleplay") {
      // Roleplay partner mode
      if (curr >= activeChunk.end) {
        audioRef.current.pause();
        setIsPlaying(false);

        // Check if NEXT chunk is the user's role
        const nextIdx = activeChunkIndex + 1;
        if (nextIdx < currentScene.chunks.length) {
          const nextChunk = currentScene.chunks[nextIdx];
          if (nextChunk.speaker === userRole) {
            setActiveChunkIndex(nextIdx);
            setIsWaitingForUserSpeech(true);
          } else {
            setActiveChunkIndex(nextIdx);
            setIsWaitingForUserSpeech(false);
          }
        }
      }
    } else if (mode === "continuous") {
      // Continuous playback: advance active chunk marker to match audio
      const matchingIdx = currentScene.chunks.findIndex(
        (c) => curr >= c.start && curr <= c.end + 0.2
      );
      if (matchingIdx !== -1 && matchingIdx !== activeChunkIndex) {
        setActiveChunkIndex(matchingIdx);
      }
    }
  };

  // Play a specific chunk (Level 1 interaction)
  const playChunk = (index: number) => {
    if (!audioRef.current) return;
    const chunk = currentScene.chunks[index];
    if (!chunk) return;

    setActiveChunkIndex(index);
    setIsWaitingForUserSpeech(false);

    audioRef.current.currentTime = chunk.start;
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(console.error);
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (mode === "chunk") {
        audioRef.current.currentTime = activeChunk.start;
      }
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    }
  };

  // Replay current chunk
  const replayCurrentChunk = () => {
    playChunk(activeChunkIndex);
  };

  // Navigate Chunks
  const goToPreviousChunk = () => {
    if (activeChunkIndex > 0) {
      const prevIdx = activeChunkIndex - 1;
      setActiveChunkIndex(prevIdx);
      if (mode === "chunk" || mode === "roleplay") {
        playChunk(prevIdx);
      } else if (audioRef.current) {
        audioRef.current.currentTime = currentScene.chunks[prevIdx].start;
      }
    }
  };

  const goToNextChunk = () => {
    if (activeChunkIndex < currentScene.chunks.length - 1) {
      const nextIdx = activeChunkIndex + 1;
      setActiveChunkIndex(nextIdx);
      setIsWaitingForUserSpeech(false);
      if (mode === "chunk" || mode === "roleplay") {
        playChunk(nextIdx);
      } else if (audioRef.current) {
        audioRef.current.currentTime = currentScene.chunks[nextIdx].start;
      }
    }
  };

  // User confirmed their speech turn in roleplay mode
  const handleUserSpokeLine = () => {
    setIsWaitingForUserSpeech(false);
    goToNextChunk();
  };

  // Global Scrubber seek (Level 2 interaction)
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    // Find matching chunk
    const matchingIdx = currentScene.chunks.findIndex(
      (c) => time >= c.start && time <= c.end
    );
    if (matchingIdx !== -1) {
      setActiveChunkIndex(matchingIdx);
    }
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " " && e.target === document.body) {
        e.preventDefault();
        if (isWaitingForUserSpeech) {
          handleUserSpokeLine();
        } else {
          togglePlay();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPreviousChunk();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNextChunk();
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        replayCurrentChunk();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeChunkIndex, isPlaying, isWaitingForUserSpeech]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] w-full max-w-5xl h-[92vh] rounded-3xl flex flex-col shadow-2xl border border-[var(--md-sys-color-outline-variant)]/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src={currentScene.audio_url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration || currentScene.duration)}
          onEnded={() => setIsPlaying(false)}
        />

        {/* 1. Modal Top Bar: Play Identity (Level 4: Play) */}
        <div className="bg-[var(--md-sys-color-surface-container-high)] px-4 sm:px-6 py-3 border-b border-[var(--md-sys-color-outline-variant)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center shrink-0 shadow-sm">
              <Theater className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
                  {play.title_ja}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] font-medium">
                  {play.title_en}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                  JLPT {play.jlpt_level}
                </span>
              </div>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] truncate">
                {play.author_ja} ({play.author_en}) · {play.year}年 · {play.total_scenes}場構成
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {availablePlays && availablePlays.length > 1 && onSelectPlay && (
              <select
                value={play.id}
                onChange={(e) => onSelectPlay(e.target.value)}
                className="text-xs bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-xl px-2.5 py-1.5 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--md-sys-color-primary)] max-w-[180px] sm:max-w-[220px] truncate"
                title="Switch Play"
              >
                {availablePlays.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title_ja}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowSettingInfo(!showSettingInfo)}
              className="p-2 text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] rounded-full hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors"
              title="Setting & Characters Dossier"
            >
              <Info className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] rounded-full hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors"
              aria-label="Close Play Modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Setting Dossier Accordion */}
        {showSettingInfo && (
          <div className="bg-[var(--md-sys-color-surface-container)] px-6 py-3 border-b border-[var(--md-sys-color-outline-variant)] text-xs grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
            <div>
              <span className="font-semibold text-[var(--md-sys-color-primary)]">登場人物 (Dramatis Personae):</span>
              <ul className="mt-1 space-y-1">
                {play.characters.map((c) => (
                  <li key={c.name_ja} className="flex gap-2">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${c.gender === 'male' ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'}`}>
                      {c.name_ja} ({c.name_en})
                    </span>
                    <span className="text-[var(--md-sys-color-on-surface-variant)]">{c.role_description}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="font-semibold text-[var(--md-sys-color-primary)]">時と場所 (Setting & Stage):</span>
              <p className="mt-1 text-[var(--md-sys-color-on-surface-variant)]">
                <strong>時:</strong> {play.setting.time_ja} ({play.setting.time_en})<br/>
                <strong>所:</strong> {play.setting.place_ja} ({play.setting.place_en})
              </p>
            </div>
          </div>
        )}

        {/* 2. Scene Selector Tabs (Level 3: Scene) */}
        <div className="bg-[var(--md-sys-color-surface-container-low)] px-4 sm:px-6 py-2.5 border-b border-[var(--md-sys-color-outline-variant)]/60 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0">
            {play.scenes.map((scene, idx) => {
              const isSelected = idx === activeSceneIndex;
              return (
                <button
                  key={scene.id}
                  onClick={() => setActiveSceneIndex(idx)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm font-semibold"
                      : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                  }`}
                >
                  <span>第{scene.scene_number}場</span>
                  <span className="opacity-80 hidden md:inline text-xs font-normal">
                    {scene.title_en.split(":")[1] || scene.title_en}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[var(--md-sys-color-surface-container-highest)] p-1 rounded-xl shrink-0">
            <button
              onClick={() => { setMode("chunk"); setIsWaitingForUserSpeech(false); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                mode === "chunk"
                  ? "bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-primary)] shadow-xs font-bold"
                  : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
              }`}
            >
              Rehearse (Chunk)
            </button>
            <button
              onClick={() => { setMode("roleplay"); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                mode === "roleplay"
                  ? "bg-[var(--md-sys-color-surface)] text-rose-600 dark:text-rose-400 shadow-xs font-bold"
                  : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Roleplay
            </button>
            <button
              onClick={() => { setMode("continuous"); setIsWaitingForUserSpeech(false); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                mode === "continuous"
                  ? "bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-primary)] shadow-xs font-bold"
                  : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
              }`}
            >
              Full Audio
            </button>
          </div>
        </div>

        {/* Scene Context Banner & Role Selector Sub-bar */}
        <div className="bg-[var(--md-sys-color-surface-container-lowest)] px-4 sm:px-6 py-2 border-b border-[var(--md-sys-color-outline-variant)]/40 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--md-sys-color-on-surface)]">
              {currentScene.title_ja}
            </span>
            <span className="hidden sm:inline">· {currentScene.description_en}</span>
          </div>

          {mode === "roleplay" && (
            <div className="flex items-center gap-1.5 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 flex-wrap">
              <span className="font-semibold text-rose-700 dark:text-rose-300">My Role:</span>
              <button
                onClick={() => setUserRole("all")}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${userRole === "all" ? "bg-stone-700 text-white font-bold" : "bg-stone-500/20 text-stone-800 dark:text-stone-200"}`}
              >
                None
              </button>
              {play.characters.map((c) => (
                <button
                  key={c.name_ja}
                  onClick={() => setUserRole(c.name_ja)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                    userRole === c.name_ja
                      ? c.gender === "male"
                        ? "bg-sky-600 text-white font-bold shadow-xs"
                        : "bg-rose-600 text-white font-bold shadow-xs"
                      : c.gender === "male"
                      ? "bg-sky-500/20 text-sky-800 dark:text-sky-200 hover:bg-sky-500/30"
                      : "bg-rose-500/20 text-rose-800 dark:text-rose-200 hover:bg-rose-500/30"
                  }`}
                >
                  {c.name_ja} ({c.name_en})
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showEnglish}
                onChange={(e) => setShowEnglish(e.target.checked)}
                className="accent-[var(--md-sys-color-primary)] rounded"
              />
              <span>English Translation</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showFurigana}
                onChange={(e) => setShowFurigana(e.target.checked)}
                className="accent-[var(--md-sys-color-primary)] rounded"
              />
              <span>Furigana Ruby</span>
            </label>
          </div>
        </div>

        {/* 3. Main Script Dialogue Flow (Level 1: Chunks) */}
        <div className="flex-grow overflow-y-auto px-4 sm:px-8 py-6 space-y-4">
          {currentScene.chunks.map((chunk, index) => {
            const isActive = index === activeChunkIndex;
            const isUserTurn = mode === "roleplay" && chunk.speaker === userRole;
            const isStage = chunk.type === "stage_direction";

            if (isStage) {
              return (
                <div
                  key={chunk.id}
                  ref={(el) => { cardRefs.current[index] = el; }}
                  onClick={() => playChunk(index)}
                  className={`py-2 px-4 rounded-xl text-center cursor-pointer transition-all ${
                    isActive
                      ? "bg-[var(--md-sys-color-primary-container)]/30 border border-[var(--md-sys-color-primary)]"
                      : "text-[var(--md-sys-color-on-surface-variant)]/80 hover:bg-[var(--md-sys-color-surface-container)]"
                  }`}
                >
                  <span className="italic text-xs sm:text-sm font-serif">
                    ［ト書き：{chunk.direction_ja}］
                  </span>
                  {showEnglish && chunk.direction_en && (
                    <div className="text-xs italic text-[var(--md-sys-color-on-surface-variant)]/70 mt-0.5">
                      ({chunk.direction_en})
                    </div>
                  )}
                </div>
              );
            }

            const charMeta = play.characters.find((c) => c.name_ja === chunk.speaker);
            const isMale = charMeta?.gender === "male";
            const speakerColor = isMale
              ? "bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30"
              : "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30";

            return (
              <div
                key={chunk.id}
                ref={(el) => { cardRefs.current[index] = el; }}
                onClick={() => playChunk(index)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                  isActive
                    ? "bg-[var(--md-sys-color-surface-container-high)] border-l-4 border-l-[var(--md-sys-color-primary)] border-[var(--md-sys-color-outline-variant)] shadow-md scale-[1.005]"
                    : "bg-[var(--md-sys-color-surface-container-lowest)] border-[var(--md-sys-color-outline-variant)]/40 hover:border-[var(--md-sys-color-outline-variant)] opacity-75 hover:opacity-100"
                } ${isUserTurn && isWaitingForUserSpeech && isActive ? "ring-2 ring-rose-500 animate-pulse bg-rose-500/10" : ""}`}
              >
                {/* Turn Header: Speaker & Action Direction */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${speakerColor}`}>
                      {chunk.speaker} ({chunk.speaker_en})
                    </span>
                    {chunk.direction_ja && (
                      <span className="text-xs italic text-[var(--md-sys-color-on-surface-variant)] font-serif">
                        （{chunk.direction_ja}）
                      </span>
                    )}
                    {isUserTurn && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold tracking-wide uppercase">
                        Your Turn
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]/60 font-mono">
                      {formatTime(chunk.start)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playChunk(index);
                      }}
                      className="p-1.5 rounded-full hover:bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-primary)] transition-colors"
                      title="Replay this chunk"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Original Japanese Text (with Ruby Furigana) */}
                <div className="text-base sm:text-lg leading-relaxed text-[var(--md-sys-color-on-surface)] font-medium">
                  {showFurigana && chunk.ruby ? (
                    <div
                      className="inline-reading-content"
                      dangerouslySetInnerHTML={{ __html: chunk.ruby }}
                    />
                  ) : (
                    <span>{chunk.text_ja}</span>
                  )}
                </div>

                {/* English Theatrical Translation */}
                {showEnglish && chunk.text_en && (
                  <div className="mt-2 text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)] border-t border-[var(--md-sys-color-outline-variant)]/30 pt-1.5">
                    {chunk.direction_en && (
                      <span className="italic mr-1.5 text-[var(--md-sys-color-on-surface-variant)]/70">
                        ({chunk.direction_en})
                      </span>
                    )}
                    <span>{chunk.text_en}</span>
                  </div>
                )}

                {/* Roleplay Active Speech Prompt */}
                {isUserTurn && isWaitingForUserSpeech && isActive && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200 font-semibold">
                      <Mic className="w-4 h-4 text-rose-600 animate-bounce" />
                      <span>Speak your line aloud! (Shadow or rehearse character)</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUserSpokeLine();
                      }}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors shadow-sm"
                    >
                      Line Spoken (Next) [Space]
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 4. Global Scrubber Timeline (Level 2: Full Audio) */}
        <div className="bg-[var(--md-sys-color-surface-container)] px-4 sm:px-6 py-2 border-t border-[var(--md-sys-color-outline-variant)]/60">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[var(--md-sys-color-on-surface-variant)] w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="flex-grow h-1.5 bg-[var(--md-sys-color-surface-container-highest)] accent-[var(--md-sys-color-primary)] rounded-lg cursor-pointer"
            />
            <span className="text-xs font-mono text-[var(--md-sys-color-on-surface-variant)] w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* 5. Sticky Bottom Rehearsal Transport Bar (Fitts's Law Core) */}
        <div className="bg-[var(--md-sys-color-surface-container-high)] px-4 sm:px-8 py-3.5 border-t border-[var(--md-sys-color-outline-variant)] flex items-center justify-between gap-4">
          {/* Left: Progress info */}
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface)]">
              Chunk {activeChunkIndex + 1} of {currentScene.chunks.length}
            </span>
            <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
              {Math.round(((activeChunkIndex + 1) / currentScene.chunks.length) * 100)}% Scene Progress
            </span>
          </div>

          {/* Center: Main Rehearsal Controls (Touch target >= 44pt) */}
          <div className="flex items-center gap-2 sm:gap-3 mx-auto">
            <button
              onClick={goToPreviousChunk}
              disabled={activeChunkIndex === 0}
              className="p-2 sm:p-2.5 rounded-full hover:bg-[var(--md-sys-color-surface-container-highest)] disabled:opacity-40 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
              title="Previous Chunk (Left Arrow)"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={replayCurrentChunk}
              className="p-2 sm:p-2.5 rounded-full hover:bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-primary)] cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
              title="Replay Active Chunk (R)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              className="px-5 py-2.5 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:bg-[var(--md-sys-color-primary)]/90 cursor-pointer min-h-[44px] flex items-center gap-2 font-bold shadow-md transition-all scale-100 active:scale-95"
              title="Play / Pause (Spacebar)"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-5 h-5 fill-current" />
                  <span className="text-xs sm:text-sm">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span className="text-xs sm:text-sm">Play Chunk</span>
                </>
              )}
            </button>

            <button
              onClick={goToNextChunk}
              disabled={activeChunkIndex >= currentScene.chunks.length - 1}
              className="p-2 sm:p-2.5 rounded-full hover:bg-[var(--md-sys-color-surface-container-highest)] disabled:opacity-40 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
              title="Next Chunk (Right Arrow)"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Right: Audio Speed Selector */}
          <div className="flex items-center gap-2">
            <select
              value={playbackSpeed}
              onChange={(e) => {
                const spd = parseFloat(e.target.value);
                setPlaybackSpeed(spd);
                if (audioRef.current) audioRef.current.playbackRate = spd;
              }}
              className="bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] text-xs rounded-lg px-2.5 py-1.5 text-[var(--md-sys-color-on-surface)] cursor-pointer"
            >
              <option value="0.75">0.75x</option>
              <option value="1.0">1.0x</option>
              <option value="1.25">1.25x</option>
            </select>
          </div>

        </div>

      </div>
    </div>
  );
}
