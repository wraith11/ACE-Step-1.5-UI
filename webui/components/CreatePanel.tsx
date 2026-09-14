import React, { useState, useEffect } from 'react';
import {
  Sparkles, ChevronDown, Settings2, Dices, Sliders, Wand2,
} from 'lucide-react';
import { GenerationParams } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  createSongFromDescription, enhanceCaptionLyrics, fetchRandomSample,
} from '../services/localAIService';
import { ToastType } from './Toast';

interface CreatePanelProps {
  onGenerate: (params: GenerationParams) => void;
  isGenerating: boolean;
  initialData?: { song: any; timestamp: number } | null;
  onShowToast?: (message: string, type: ToastType) => void;
}

const KEY_SIGNATURES = ['', 'C major', 'C minor', 'C# major', 'C# minor', 'D major', 'D minor', 'D# major', 'D# minor', 'Eb major', 'Eb minor', 'E major', 'E minor', 'F major', 'F minor', 'F# major', 'F# minor', 'Gb major', 'Gb minor', 'G major', 'G minor', 'G# major', 'G# minor', 'Ab major', 'Ab minor', 'A major', 'A minor', 'A# major', 'A# minor', 'Bb major', 'Bb minor', 'B major', 'B minor'];

const TIME_SIGNATURES = ['', '2/4', '3/4', '4/4', '6/8'];
const AUDIO_FORMATS = ['mp3', 'flac', 'opus', 'aac', 'wav', 'wav32'];

const VOCAL_LANGUAGES = [
  { value: 'unknown', label: 'Auto / Instrumental' },
  { value: 'ar', label: 'Arabic' }, { value: 'az', label: 'Azerbaijani' }, { value: 'bg', label: 'Bulgarian' },
  { value: 'bn', label: 'Bengali' }, { value: 'ca', label: 'Catalan' }, { value: 'cs', label: 'Czech' },
  { value: 'da', label: 'Danish' }, { value: 'de', label: 'German' }, { value: 'el', label: 'Greek' },
  { value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' }, { value: 'fa', label: 'Persian' },
  { value: 'fi', label: 'Finnish' }, { value: 'fr', label: 'French' }, { value: 'he', label: 'Hebrew' },
  { value: 'hi', label: 'Hindi' }, { value: 'hr', label: 'Croatian' }, { value: 'ht', label: 'Haitian Creole' },
  { value: 'hu', label: 'Hungarian' }, { value: 'id', label: 'Indonesian' }, { value: 'is', label: 'Icelandic' },
  { value: 'it', label: 'Italian' }, { value: 'ja', label: 'Japanese' }, { value: 'ko', label: 'Korean' },
  { value: 'la', label: 'Latin' }, { value: 'lt', label: 'Lithuanian' }, { value: 'ms', label: 'Malay' },
  { value: 'ne', label: 'Nepali' }, { value: 'nl', label: 'Dutch' }, { value: 'no', label: 'Norwegian' },
  { value: 'pa', label: 'Punjabi' }, { value: 'pl', label: 'Polish' }, { value: 'pt', label: 'Portuguese' },
  { value: 'ro', label: 'Romanian' }, { value: 'ru', label: 'Russian' }, { value: 'sa', label: 'Sanskrit' },
  { value: 'sk', label: 'Slovak' }, { value: 'sr', label: 'Serbian' }, { value: 'sv', label: 'Swedish' },
  { value: 'sw', label: 'Swahili' }, { value: 'ta', label: 'Tamil' }, { value: 'te', label: 'Telugu' },
  { value: 'th', label: 'Thai' }, { value: 'tl', label: 'Tagalog' }, { value: 'tr', label: 'Turkish' },
  { value: 'uk', label: 'Ukrainian' }, { value: 'ur', label: 'Urdu' }, { value: 'vi', label: 'Vietnamese' },
  { value: 'yue', label: 'Cantonese' }, { value: 'zh', label: 'Chinese (Mandarin)' },
];

const TRACK_NAMES = ['woodwinds', 'brass', 'fx', 'synth', 'strings', 'percussion', 'keyboard', 'guitar', 'bass', 'drums', 'backing_vocals', 'vocals'];

function SliderField(props: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display?: string; hint?: string;
}) {
  const { label, value, min, max, step, onChange, display, hint } = props;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
        <span className="text-xs font-mono text-zinc-900 dark:text-white bg-zinc-100 dark:bg-black/20 px-2 py-0.5 rounded">{display ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-pink-500" />
      {hint && <p className="text-[10px] text-zinc-500">{hint}</p>}
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: () => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{props.label}</span>
        {props.hint && <p className="text-[10px] text-zinc-500">{props.hint}</p>}
      </div>
      <button onClick={props.onChange}
        className={`w-9 h-5 rounded-full flex items-center transition-colors duration-200 px-0.5 border border-zinc-200 dark:border-white/5 flex-shrink-0 ${props.checked ? 'bg-pink-600' : 'bg-zinc-300 dark:bg-black/40'}`}>
        <div className={`w-4 h-4 rounded-full bg-white transform transition-transform duration-200 shadow-sm ${props.checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function Collapse(props: { title: string; icon?: React.ReactNode; subtitle?: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-suno-card rounded-xl border border-zinc-200 dark:border-white/5 overflow-hidden">
      <button onClick={props.onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          {props.icon}
          <div className="flex flex-col items-start">
            <span>{props.title}</span>
            {props.subtitle && <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal">{props.subtitle}</span>}
          </div>
        </div>
        <ChevronDown size={16} className={`text-zinc-500 transition-transform ${props.open ? 'rotate-180' : ''}`} />
      </button>
      {props.open && <div className="px-4 pb-4 space-y-4">{props.children}</div>}
    </div>
  );
}

export const CreatePanel: React.FC<CreatePanelProps> = ({ onGenerate, isGenerating, initialData, onShowToast }) => {
  const { isAuthenticated, token } = useAuth();

  const [caption, setCaption] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [title, setTitle] = useState('');
  const [instrumental, setInstrumental] = useState(false);
  const [vocalLanguage, setVocalLanguage] = useState('unknown');
  const [mode, setMode] = useState<'Custom' | 'Remix' | 'Cover' | 'Repaint' | 'Extract' | 'Complete'>('Custom');
  const [referenceAudioUrl, setReferenceAudioUrl] = useState('');
  const [sourceAudioUrl, setSourceAudioUrl] = useState('');
  const [audioCodes, setAudioCodes] = useState('');

  const [showSimple, setShowSimple] = useState(false);
  const [simpleQuery, setSimpleQuery] = useState('');
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);

  const [bpm, setBpm] = useState(0);
  const [bpmAuto, setBpmAuto] = useState(true);
  const [keyScale, setKeyScale] = useState('');
  const [keyAuto, setKeyAuto] = useState(true);
  const [timeSignature, setTimeSignature] = useState('');
  const [timesigAuto, setTimesigAuto] = useState(true);
  const [duration, setDuration] = useState(-1);
  const [durationAuto, setDurationAuto] = useState(true);
  const [batchSize, setBatchSize] = useState(1);

  const [thinking, setThinking] = useState(false);
  const [autogen, setAutogen] = useState(false);
  const [getScores, setGetScores] = useState(false);
  const [getLrc, setGetLrc] = useState(false);

  const [inferenceSteps, setInferenceSteps] = useState(8);
  const [guidanceScale, setGuidanceScale] = useState(7.0);
  const [inferMethod, setInferMethod] = useState<'ode' | 'sde'>('ode');
  const [samplerMode, setSamplerMode] = useState<'euler' | 'heun'>('euler');
  const [velocityNormThreshold, setVelocityNormThreshold] = useState(0.0);
  const [velocityEmaFactor, setVelocityEmaFactor] = useState(0.0);
  const [useAdg, setUseAdg] = useState(false);
  const [shift, setShift] = useState(3.0);
  const [customTimesteps, setCustomTimesteps] = useState('');
  const [cfgIntervalStart, setCfgIntervalStart] = useState(0.0);
  const [cfgIntervalEnd, setCfgIntervalEnd] = useState(1.0);
  const [seed, setSeed] = useState(-1);
  const [randomSeed, setRandomSeed] = useState(true);

  const [dcwEnabled, setDcwEnabled] = useState(false);
  const [dcwMode, setDcwMode] = useState<'low' | 'high' | 'double' | 'pix'>('double');
  const [dcwWavelet, setDcwWavelet] = useState('haar');
  const [dcwScaler, setDcwScaler] = useState(0.05);
  const [dcwHighScaler, setDcwHighScaler] = useState(0.02);

  const [lmTemperature, setLmTemperature] = useState(0.85);
  const [lmCfgScale, setLmCfgScale] = useState(2.0);
  const [lmTopK, setLmTopK] = useState(0);
  const [lmTopP, setLmTopP] = useState(0.9);
  const [lmNegativePrompt, setLmNegativePrompt] = useState('NO USER INPUT');
  const [lmUseLegacyCfgPrompt, setLmUseLegacyCfgPrompt] = useState(false);
  const [useCotMetas, setUseCotMetas] = useState(true);
  const [useCotCaption, setUseCotCaption] = useState(false);
  const [useCotLanguage, setUseCotLanguage] = useState(true);
  const [constrainedDecodingDebug, setConstrainedDecodingDebug] = useState(false);
  const [allowLmBatch, setAllowLmBatch] = useState(true);
  const [lmBatchChunkSize, setLmBatchChunkSize] = useState(8);

  const [audioFormat, setAudioFormat] = useState<'mp3' | 'flac' | 'opus' | 'aac' | 'wav' | 'wav32'>('mp3');
  const [mp3Bitrate, setMp3Bitrate] = useState('128k');
  const [mp3SampleRate, setMp3SampleRate] = useState(48000);
  const [scoreScale, setScoreScale] = useState(0.5);
  const [enableNormalization, setEnableNormalization] = useState(true);
  const [normalizationDb, setNormalizationDb] = useState(-1.0);
  const [fadeInDuration, setFadeInDuration] = useState(0.0);
  const [fadeOutDuration, setFadeOutDuration] = useState(0.0);
  const [latentShift, setLatentShift] = useState(0.0);
  const [latentRescale, setLatentRescale] = useState(1.0);

  const [repaintingStart, setRepaintingStart] = useState(0.0);
  const [repaintingEnd, setRepaintingEnd] = useState(-1);
  const [repaintMode, setRepaintMode] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [repaintStrength, setRepaintStrength] = useState(0.5);
  const [audioCoverStrength, setAudioCoverStrength] = useState(1.0);
  const [coverNoiseStrength, setCoverNoiseStrength] = useState(0.0);
  const [noFsq, setNoFsq] = useState(false);
  const [instruction, setInstruction] = useState('Fill the audio semantic mask based on the given conditions:');

  const [trackName, setTrackName] = useState('');
  const [completeTrackClasses, setCompleteTrackClasses] = useState('');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  const [referenceTracks, setReferenceTracks] = useState<any[]>([]);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioModalTarget, setAudioModalTarget] = useState<'reference' | 'source'>('reference');
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  useEffect(() => {
    if (initialData?.song) {
      setCaption(initialData.song.style || initialData.song.caption || '');
      setLyrics(initialData.song.lyrics || '');
      setTitle(initialData.song.title || '');
      setInstrumental(!(initialData.song.lyrics && initialData.song.lyrics.length > 0));
      if (initialData.song.bpm) { setBpm(initialData.song.bpm); setBpmAuto(false); }
      if (initialData.song.key_scale) { setKeyScale(initialData.song.key_scale); setKeyAuto(false); }
      if (initialData.song.time_signature) { setTimeSignature(initialData.song.time_signature); setTimesigAuto(false); }
    }
  }, [initialData]);

  useEffect(() => {
    let active = true;
    return () => { active = false; };
  }, []);

  const fetchReferenceTracks = async () => {
    if (!token) return;
    setIsLoadingTracks(true);
    try {
      const response = await fetch('/api/reference-tracks', { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setReferenceTracks(data.tracks || []);
      }
    } catch (err) {
      console.error('Failed to fetch reference tracks:', err);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const uploadReferenceTrack = async (file: File) => {
    if (!token) return;
    try {
      const formData = new FormData();
      formData.append('audio', file);
      const response = await fetch('/api/reference-tracks', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      setReferenceTracks((prev) => [data.track, ...prev]);
      if (audioModalTarget === 'reference') setReferenceAudioUrl(data.track.audio_url);
      else setSourceAudioUrl(data.track.audio_url);
      setShowAudioModal(false);
    } catch (err) {
      onShowToast?.('Upload failed', 'error');
    }
  };

  const useReferenceTrack = (track: any) => {
    if (audioModalTarget === 'reference') setReferenceAudioUrl(track.audio_url);
    else setSourceAudioUrl(track.audio_url);
    setShowAudioModal(false);
  };

  const handleSimpleGenerate = async () => {
    if (!simpleQuery.trim()) {
      onShowToast?.('Please describe your song first', 'error');
      return;
    }
    setIsGeneratingSample(true);
    try {
      const result = await createSongFromDescription(simpleQuery.trim(), instrumental, vocalLanguage, token);
      setCaption(result.style);
      if (result.lyrics) setLyrics(result.lyrics);
      if (result.title) setTitle(result.title);
      if (result.bpm && result.bpm > 0) { setBpm(result.bpm); setBpmAuto(false); }
      if (result.keyScale && KEY_SIGNATURES.some((k) => k.toLowerCase() === result.keyScale.toLowerCase())) {
        setKeyScale(result.keyScale); setKeyAuto(false);
      }
      if (result.timeSignature) { setTimeSignature(result.timeSignature); setTimesigAuto(false); }
      if (result.vocalLanguage && result.vocalLanguage !== 'unknown') setVocalLanguage(result.vocalLanguage);
      onShowToast?.('Song suggestion ready — review and tweak, then Create', 'success');
    } catch (err) {
      console.error('Simple generate error:', err);
      onShowToast?.(err instanceof Error ? err.message : 'Local AI unavailable — check that the ACE-Step API server is running with the LM initialized', 'error');
    } finally {
      setIsGeneratingSample(false);
    }
  };

  const handleEnhance = async () => {
    if (!caption.trim()) {
      onShowToast?.('Please enter a style/caption first', 'error');
      return;
    }
    setIsGeneratingSample(true);
    try {
      const result = await enhanceCaptionLyrics(caption, lyrics, {
        bpm: bpmAuto ? undefined : bpm,
        duration: durationAuto ? undefined : duration,
        keyScale: keyAuto ? undefined : keyScale,
        timeSignature: timesigAuto ? undefined : timeSignature,
      }, token);
      if (result.style) setCaption(result.style);
      if (result.lyrics) setLyrics(result.lyrics);
      if (result.title) setTitle(result.title);
      if (result.bpm && result.bpm > 0) { setBpm(result.bpm); setBpmAuto(false); }
      if (result.keyScale && KEY_SIGNATURES.some((k) => k.toLowerCase() === result.keyScale.toLowerCase())) {
        setKeyScale(result.keyScale); setKeyAuto(false);
      }
      if (result.timeSignature) { setTimeSignature(result.timeSignature); setTimesigAuto(false); }
      onShowToast?.('Style & lyrics enhanced', 'success');
    } catch (err) {
      onShowToast?.(err instanceof Error ? err.message : 'Enhance failed', 'error');
    } finally {
      setIsGeneratingSample(false);
    }
  };

  const handleRandom = async () => {
    setIsGeneratingSample(true);
    try {
      const sample = await fetchRandomSample(mode === 'Custom' ? 'custom_mode' : 'simple_mode');
      if (sample.caption) setCaption(sample.caption);
      if (sample.lyrics) setLyrics(sample.lyrics);
      if (sample.description) setSimpleQuery(sample.description);
      if (sample.bpm && sample.bpm > 0) { setBpm(sample.bpm); setBpmAuto(false); }
      if (sample.duration && sample.duration > 0) { setDuration(sample.duration); setDurationAuto(false); }
      if (sample.keyScale) setKeyScale(sample.keyScale);
      if (sample.timeSignature) setTimeSignature(sample.timeSignature);
      if (sample.instrumental) setInstrumental(true);
      onShowToast?.('Random example loaded', 'success');
    } catch (err) {
      onShowToast?.('Failed to load random example', 'error');
    } finally {
      setIsGeneratingSample(false);
    }
  };

  const resetAllAuto = () => {
    setBpm(0); setBpmAuto(true);
    setKeyScale(''); setKeyAuto(true);
    setTimeSignature(''); setTimesigAuto(true);
    setDuration(-1); setDurationAuto(true);
  };

  const handleGenerate = () => {
    if (!isAuthenticated) {
      onShowToast?.('Please set up your profile first', 'error');
      return;
    }
    if (!caption.trim() && mode !== 'Extract' && !sourceAudioUrl) {
      onShowToast?.('Please enter a style/caption description', 'error');
      return;
    }

    const taskTypeMap: Record<string, string> = {
      Custom: 'text2music', Remix: 'audio2audio', Cover: 'cover',
      Repaint: 'repaint', Extract: 'extract', Complete: 'complete',
    };

    onGenerate({
      customMode: true,
      mode,
      taskType: taskTypeMap[mode] || 'text2music',
      prompt: caption,
      lyrics,
      style: caption,
      title: title || caption.split(',')[0].slice(0, 40) || 'Untitled',
      referenceAudioUrl: referenceAudioUrl || undefined,
      sourceAudioUrl: sourceAudioUrl || undefined,
      instrumental,
      vocalLanguage,
      bpm: bpmAuto ? undefined : bpm,
      bpmAuto,
      keyScale: keyAuto ? '' : keyScale,
      keyAuto,
      timeSignature: timesigAuto ? '' : timeSignature,
      timesigAuto,
      duration: durationAuto ? undefined : duration,
      durationAuto,
      batchSize,
      inferenceSteps,
      guidanceScale,
      inferMethod,
      samplerMode,
      velocityNormThreshold,
      velocityEmaFactor,
      useAdg,
      shift,
      customTimesteps: customTimesteps || undefined,
      cfgIntervalStart,
      cfgIntervalEnd,
      seed: randomSeed ? -1 : seed,
      randomSeed,
      dcwEnabled,
      dcwMode,
      dcwWavelet,
      dcwScaler,
      dcwHighScaler,
      lmTemperature,
      lmCfgScale,
      lmTopK,
      lmTopP,
      lmNegativePrompt,
      lmUseLegacyCfgPrompt,
      useCotMetas,
      useCotCaption,
      useCotLanguage,
      constrainedDecodingDebug,
      allowLmBatch,
      lmBatchChunkSize,
      audioFormat,
      mp3Bitrate,
      mp3SampleRate,
      scoreScale,
      enableNormalization,
      normalizationDb,
      fadeInDuration,
      fadeOutDuration,
      latentShift,
      latentRescale,
      repaintingStart,
      repaintingEnd,
      repaintMode,
      repaintStrength,
      audioCoverStrength,
      coverNoiseStrength,
      noFsq,
      instruction,
      thinking,
      autogen,
      getScores,
      getLrc,
      trackName: trackName || undefined,
      completeTrackClasses: completeTrackClasses.split(',').map((s) => s.trim()).filter(Boolean),
      audioCodes: audioCodes || undefined,
    });
  };

  const modeLabel = mode === 'Cover' ? 'Cover' : mode === 'Remix' ? 'Remix' : 'Custom';

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-suno-panel w-full overflow-y-auto custom-scrollbar transition-colors duration-300">
      <div className="p-4 pt-14 md:pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">ACE-Step v1.5</span>
          </div>
          <div className="flex items-center bg-zinc-200 dark:bg-black/40 rounded-lg p-1 border border-zinc-300 dark:border-white/5">
            {['Custom', 'Remix', 'Cover', 'Repaint'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m as any)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === m ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-suno-card rounded-xl border border-zinc-200 dark:border-white/5 overflow-hidden">
          <button onClick={() => setShowSimple(!showSimple)}
            className="w-full flex items-center justify-between px-3 py-2.5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <Wand2 size={13} /> Describe your song (optional AI suggestion)
            </span>
            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${showSimple ? 'rotate-180' : ''}`} />
          </button>
          {showSimple && (
            <div className="p-3 space-y-2">
              <textarea
                value={simpleQuery}
                onChange={(e) => setSimpleQuery(e.target.value)}
                placeholder="e.g. A happy pop song about summer adventures with friends..."
                className="w-full h-20 bg-transparent p-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSimpleGenerate}
                  disabled={isGeneratingSample || !simpleQuery.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles size={13} className={isGeneratingSample ? 'animate-spin' : ''} />
                  {isGeneratingSample ? 'Generating suggestion...' : 'Generate suggestion'}
                </button>
                <button
                  onClick={handleRandom}
                  disabled={isGeneratingSample}
                  title="Load a random example"
                  className="p-2 rounded-lg text-zinc-400 hover:text-pink-500 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                >
                  <Dices size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-suno-card rounded-xl border border-zinc-200 dark:border-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/5">
            <div>
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Caption / Style</span>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Genre, mood, instruments, vibe</p>
            </div>
            <button
              onClick={handleEnhance}
              disabled={isGeneratingSample || !caption.trim()}
              title="Enhance with local AI"
              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded transition-colors text-zinc-500 hover:text-pink-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles size={14} className={isGeneratingSample ? 'animate-pulse' : ''} />
            </button>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. upbeat pop rock, emotional ballad, 90s hip hop"
            className="w-full h-20 bg-transparent p-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none resize-none"
          />
          <div className="px-3 pb-3 flex flex-wrap gap-1.5">
            {['Pop', 'Rock', 'Electronic', 'Hip Hop', 'Jazz', 'Classical'].map((tag) => (
              <button key={tag}
                onClick={() => setCaption((prev) => (prev ? `${prev}, ${tag}` : tag))}
                className="text-[10px] font-medium bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white px-2.5 py-1 rounded-full transition-colors border border-zinc-200 dark:border-white/5">
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-suno-card rounded-xl border border-zinc-200 dark:border-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/5">
            <div>
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Lyrics</span>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Leave empty for instrumental</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setInstrumental(!instrumental)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${instrumental ? 'bg-pink-600 text-white border-pink-500' : 'bg-white dark:bg-suno-card border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10'}`}>
                {instrumental ? 'Instrumental' : 'Vocal'}
              </button>
              <button onClick={handleEnhance} disabled={isGeneratingSample || !caption.trim()}
                title="Enhance with local AI"
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded transition-colors text-zinc-500 hover:text-pink-500 disabled:opacity-40 disabled:cursor-not-allowed">
                <Sparkles size={14} className={isGeneratingSample ? 'animate-pulse' : ''} />
              </button>
            </div>
          </div>
          <textarea
            disabled={instrumental}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={instrumental ? 'Instrumental mode - no lyrics needed' : '[Verse]\nYour lyrics here...\n\n[Chorus]\nThe catchy part...'}
            className={`w-full h-36 bg-transparent p-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none resize-none font-mono leading-relaxed ${instrumental ? 'opacity-30 cursor-not-allowed' : ''}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Name your song"
              className="w-full bg-white dark:bg-suno-card border border-zinc-200 dark:border-white/5 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Vocal Language</label>
            <select value={vocalLanguage} onChange={(e) => setVocalLanguage(e.target.value)}
              className="w-full bg-white dark:bg-suno-card border border-zinc-200 dark:border-white/5 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none">
              {VOCAL_LANGUAGES.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
            </select>
          </div>
        </div>

        {(mode === 'Remix' || mode === 'Cover' || mode === 'Repaint' || mode === 'Extract') && (
          <div className="bg-white dark:bg-suno-card rounded-xl border border-zinc-200 dark:border-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Source Audio</span>
              <div className="flex gap-1.5">
                <button onClick={() => { setAudioModalTarget('source'); setShowAudioModal(true); void fetchReferenceTracks(); }}
                  className="text-[10px] font-medium bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded-lg transition-colors">
                  From library
                </button>
                <button onClick={() => { setAudioModalTarget('source'); setShowAudioModal(true); void fetchReferenceTracks(); }}
                  className="text-[10px] font-medium bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded-lg transition-colors">
                  Upload
                </button>
              </div>
            </div>
            {sourceAudioUrl ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5">
                <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1 mr-2">{sourceAudioUrl.split('/').pop()}</span>
                <button onClick={() => setSourceAudioUrl('')} className="p-1 text-zinc-400 hover:text-rose-500">✕</button>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-400">No source audio selected</p>
            )}
          </div>
        )}

        {(mode === 'Custom' || mode === 'Cover') && (
          <div className="bg-white dark:bg-suno-card rounded-xl border border-zinc-200 dark:border-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Reference Audio</span>
              <button onClick={() => { setAudioModalTarget('reference'); setShowAudioModal(true); void fetchReferenceTracks(); }}
                className="text-[10px] font-medium bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded-lg transition-colors">
                Choose / Upload
              </button>
            </div>
            {referenceAudioUrl && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5">
                <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1 mr-2">{referenceAudioUrl.split('/').pop()}</span>
                <button onClick={() => setReferenceAudioUrl('')} className="p-1 text-zinc-400 hover:text-rose-500">✕</button>
              </div>
            )}
          </div>
        )}

        <Collapse title="Optional Parameters" icon={<Sliders size={16} className="text-zinc-500" />}
          subtitle="BPM, key, duration, variations" open={showOptional} onToggle={() => setShowOptional(!showOptional)}>
          <SliderField label="BPM" value={bpm} min={0} max={300} step={5}
            onChange={(v) => { setBpm(v); setBpmAuto(v === 0); }} display={bpm === 0 ? 'Auto' : String(bpm)} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Key</label>
              <select value={keyScale} onChange={(e) => { setKeyScale(e.target.value); setKeyAuto(e.target.value === ''); }}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none">
                <option value="">Auto</option>
                {KEY_SIGNATURES.filter((k) => k).map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Time</label>
              <select value={timeSignature} onChange={(e) => { setTimeSignature(e.target.value); setTimesigAuto(e.target.value === ''); }}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none">
                <option value="">Auto</option>
                {TIME_SIGNATURES.filter((t) => t).map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
          </div>
          <SliderField label="Duration" value={duration} min={-1} max={600} step={5}
            onChange={(v) => { setDuration(v); setDurationAuto(v === -1); }}
            display={duration === -1 ? 'Auto' : `${duration}s`} />
          <SliderField label="Variations (batch)" value={batchSize} min={1} max={4} step={1}
            onChange={setBatchSize} display={String(batchSize)} />
          <button onClick={resetAllAuto} className="w-full text-[11px] font-medium text-zinc-500 hover:text-pink-500 py-1.5 rounded-lg bg-zinc-100 dark:bg-black/20 transition-colors">
            Reset all to Auto
          </button>
        </Collapse>

        <Collapse title="Advanced Settings" icon={<Settings2 size={16} className="text-zinc-500" />}
          subtitle="Expert controls" open={showAdvanced} onToggle={() => setShowAdvanced(!showAdvanced)}>

          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Diffusion</h4>
          </div>
          <SliderField label="Inference Steps" value={inferenceSteps} min={4} max={32} step={1} onChange={setInferenceSteps} hint="More steps = better quality, slower" />
          <SliderField label="Guidance Scale" value={guidanceScale} min={1} max={15} step={0.1} onChange={setGuidanceScale} display={guidanceScale.toFixed(1)} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Method</label>
              <select value={inferMethod} onChange={(e) => setInferMethod(e.target.value as any)}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none">
                <option value="ode">ODE</option><option value="sde">SDE</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Sampler</label>
              <select value={samplerMode} onChange={(e) => setSamplerMode(e.target.value as any)}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none">
                <option value="euler">Euler</option><option value="heun">Heun</option>
              </select>
            </div>
          </div>
          <SliderField label="Velocity Norm Threshold" value={velocityNormThreshold} min={0} max={5} step={0.1} onChange={setVelocityNormThreshold} display={velocityNormThreshold.toFixed(1)} />
          <SliderField label="Velocity EMA Factor" value={velocityEmaFactor} min={0} max={0.5} step={0.01} onChange={setVelocityEmaFactor} display={velocityEmaFactor.toFixed(2)} />
          <SliderField label="Shift" value={shift} min={1} max={5} step={0.1} onChange={setShift} display={shift.toFixed(1)} hint="Timestep shift (not effective for turbo)" />
          <SliderField label="CFG Interval Start" value={cfgIntervalStart} min={0} max={1} step={0.01} onChange={setCfgIntervalStart} display={cfgIntervalStart.toFixed(2)} />
          <SliderField label="CFG Interval End" value={cfgIntervalEnd} min={0} max={1} step={0.01} onChange={setCfgIntervalEnd} display={cfgIntervalEnd.toFixed(2)} />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Custom Timesteps</label>
            <input type="text" value={customTimesteps} onChange={(e) => setCustomTimesteps(e.target.value)}
              placeholder="e.g. 0.97,0.76,0.615,..."
              className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none" />
          </div>
          <Toggle label="Use ADG" checked={useAdg} onChange={() => setUseAdg(!useAdg)} />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Seed</label>
            <div className="flex items-center gap-2">
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} disabled={randomSeed}
                className={`flex-1 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none ${randomSeed ? 'opacity-40' : ''}`} />
              <Toggle label="Random" checked={randomSeed} onChange={() => setRandomSeed(!randomSeed)} />
            </div>
          </div>

          <div className="space-y-1 border-t border-zinc-200 dark:border-white/10 pt-3">
            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">DCW (Differential Wavelet)</h4>
          </div>
          <Toggle label="Enable DCW" checked={dcwEnabled} onChange={() => setDcwEnabled(!dcwEnabled)} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Mode</label>
              <select value={dcwMode} onChange={(e) => setDcwMode(e.target.value as any)}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none">
                <option value="low">Low</option><option value="high">High</option><option value="double">Double</option><option value="pix">Pix</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Wavelet</label>
              <select value={dcwWavelet} onChange={(e) => setDcwWavelet(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none">
                {['haar', 'db2', 'db4', 'sym4', 'sym8', 'coif2'].map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <SliderField label="DCW Scaler" value={dcwScaler} min={0} max={0.1} step={0.005} onChange={setDcwScaler} display={dcwScaler.toFixed(3)} />
          <SliderField label="DCW High Scaler" value={dcwHighScaler} min={0} max={0.1} step={0.005} onChange={setDcwHighScaler} display={dcwHighScaler.toFixed(3)} />

          <div className="space-y-1 border-t border-zinc-200 dark:border-white/10 pt-3">
            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Language Model</h4>
          </div>
          <SliderField label="LM Temperature" value={lmTemperature} min={0} max={2} step={0.05} onChange={setLmTemperature} display={lmTemperature.toFixed(2)} />
          <SliderField label="LM CFG Scale" value={lmCfgScale} min={1} max={3} step={0.1} onChange={setLmCfgScale} display={lmCfgScale.toFixed(1)} />
          <div className="grid grid-cols-2 gap-3">
            <SliderField label="Top-K" value={lmTopK} min={0} max={100} step={1} onChange={setLmTopK} />
            <SliderField label="Top-P" value={lmTopP} min={0} max={1} step={0.01} onChange={setLmTopP} display={lmTopP.toFixed(2)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">LM Negative Prompt</label>
            <textarea value={lmNegativePrompt} onChange={(e) => setLmNegativePrompt(e.target.value)}
              className="w-full h-12 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg p-2 text-xs text-zinc-900 dark:text-white focus:outline-none resize-none" />
          </div>
          <Toggle label="Use CoT Metas" checked={useCotMetas} onChange={() => setUseCotMetas(!useCotMetas)} />
          <Toggle label="Use CoT Caption" checked={useCotCaption} onChange={() => setUseCotCaption(!useCotCaption)} />
          <Toggle label="Use CoT Language" checked={useCotLanguage} onChange={() => setUseCotLanguage(!useCotLanguage)} />
          <Toggle label="Allow LM Batch" checked={allowLmBatch} onChange={() => setAllowLmBatch(!allowLmBatch)} />
          <Toggle label="Legacy CFG Prompt" checked={lmUseLegacyCfgPrompt} onChange={() => setLmUseLegacyCfgPrompt(!lmUseLegacyCfgPrompt)} />
          <Toggle label="Constrained Decoding Debug" checked={constrainedDecodingDebug} onChange={() => setConstrainedDecodingDebug(!constrainedDecodingDebug)} />
          <SliderField label="LM Batch Chunk Size" value={lmBatchChunkSize} min={1} max={32} step={1} onChange={setLmBatchChunkSize} />

          <div className="space-y-1 border-t border-zinc-200 dark:border-white/10 pt-3">
            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Output</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Audio Format</label>
              <select value={audioFormat} onChange={(e) => setAudioFormat(e.target.value as any)}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none">
                {AUDIO_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </div>
            {audioFormat === 'mp3' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">MP3 Bitrate</label>
                <select value={mp3Bitrate} onChange={(e) => setMp3Bitrate(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none">
                  {['128k', '192k', '256k', '320k'].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
          </div>
          <SliderField label="Score Sensitivity" value={scoreScale} min={0.01} max={1} step={0.01} onChange={setScoreScale} display={scoreScale.toFixed(2)} />
          <Toggle label="Normalize Audio" checked={enableNormalization} onChange={() => setEnableNormalization(!enableNormalization)} />
          <SliderField label="Normalization dB" value={normalizationDb} min={-10} max={0} step={0.1} onChange={setNormalizationDb} display={normalizationDb.toFixed(1)} />
          <div className="grid grid-cols-2 gap-3">
            <SliderField label="Fade In (s)" value={fadeInDuration} min={0} max={10} step={0.1} onChange={setFadeInDuration} display={fadeInDuration.toFixed(1)} />
            <SliderField label="Fade Out (s)" value={fadeOutDuration} min={0} max={10} step={0.1} onChange={setFadeOutDuration} display={fadeOutDuration.toFixed(1)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SliderField label="Latent Shift" value={latentShift} min={-0.2} max={0.2} step={0.01} onChange={setLatentShift} display={latentShift.toFixed(2)} />
            <SliderField label="Latent Rescale" value={latentRescale} min={0.5} max={1.5} step={0.01} onChange={setLatentRescale} display={latentRescale.toFixed(2)} />
          </div>

          <div className="space-y-1 border-t border-zinc-200 dark:border-white/10 pt-3">
            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Repaint / Cover</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Repaint Start</label>
              <input type="number" step="0.1" value={repaintingStart} onChange={(e) => setRepaintingStart(Number(e.target.value))}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Repaint End</label>
              <input type="number" step="0.1" value={repaintingEnd} onChange={(e) => setRepaintingEnd(Number(e.target.value))}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Repaint Mode</label>
              <select value={repaintMode} onChange={(e) => setRepaintMode(e.target.value as any)}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none">
                <option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Repaint Strength</label>
              <input type="number" step="0.05" min={0} max={1} value={repaintStrength} onChange={(e) => setRepaintStrength(Number(e.target.value))}
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SliderField label="Cover Strength" value={audioCoverStrength} min={0} max={1} step={0.01} onChange={setAudioCoverStrength} display={audioCoverStrength.toFixed(2)} />
            <SliderField label="Cover Noise" value={coverNoiseStrength} min={0} max={1} step={0.01} onChange={setCoverNoiseStrength} display={coverNoiseStrength.toFixed(2)} />
          </div>
          <Toggle label="No FSQ (raw latents)" checked={noFsq} onChange={() => setNoFsq(!noFsq)} />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Instruction</label>
            <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)}
              className="w-full h-12 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg p-2 text-xs text-zinc-900 dark:text-white focus:outline-none resize-none" />
          </div>

          <div className="space-y-1 border-t border-zinc-200 dark:border-white/10 pt-3">
            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Track / Codes</h4>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Track Name</label>
            <select value={trackName} onChange={(e) => setTrackName(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none">
              <option value="">None</option>
              {TRACK_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Complete Track Classes</label>
            <input type="text" value={completeTrackClasses} onChange={(e) => setCompleteTrackClasses(e.target.value)}
              placeholder="vocals, drums"
              className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">LM Audio Codes</label>
            <textarea value={audioCodes} onChange={(e) => setAudioCodes(e.target.value)}
              placeholder="Optional audio semantic codes"
              className="w-full h-14 bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-lg p-2 text-xs text-zinc-900 dark:text-white focus:outline-none resize-none" />
          </div>
        </Collapse>
      </div>

      <div className="p-4 mt-auto sticky bottom-0 bg-zinc-50/95 dark:bg-suno-panel/95 backdrop-blur-sm z-10 border-t border-zinc-200 dark:border-white/5 space-y-2">
        <div className="flex items-center justify-around gap-1 text-[10px]">
          <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={thinking} onChange={() => setThinking(!thinking)} className="accent-pink-500" /> Think
          </label>
          <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={autogen} onChange={() => setAutogen(!autogen)} className="accent-pink-500" /> Autogen
          </label>
          <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={getScores} onChange={() => setGetScores(!getScores)} className="accent-pink-500" /> Scores
          </label>
          <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={getLrc} onChange={() => setGetLrc(!getLrc)} className="accent-pink-500" /> LRC
          </label>
        </div>
        <button onClick={handleGenerate} disabled={isGenerating}
          className="w-full h-12 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] bg-gradient-to-r from-orange-500 to-pink-600 text-white shadow-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed">
          <Sparkles size={18} />
          <span>{isGenerating ? 'Generating...' : `Create ${modeLabel}`}</span>
        </button>
      </div>

      {showAudioModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAudioModal(false)} />
          <div className="relative w-[92%] max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden">
            <div className="p-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">
                    {audioModalTarget === 'reference' ? 'Reference Audio' : 'Source Audio'}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Choose from library or upload</p>
                </div>
                <button onClick={() => setShowAudioModal(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400">✕</button>
              </div>
              <label className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/20 bg-zinc-50 dark:bg-white/5 px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all cursor-pointer">
                <input type="file" accept="audio/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadReferenceTrack(f); }} />
                Upload audio
              </label>
            </div>
            <div className="border-t border-zinc-100 dark:border-white/5 max-h-[300px] overflow-y-auto">
              {isLoadingTracks ? (
                <div className="px-5 py-8 text-center text-xs text-zinc-400">Loading...</div>
              ) : referenceTracks.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-zinc-400">No tracks yet — upload an audio file</div>
              ) : (
                referenceTracks.map((track) => (
                  <div key={track.id} className="px-5 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate block">{track.filename}</span>
                      {track.duration && <span className="text-xs text-zinc-400">{Math.round(track.duration)}s</span>}
                    </div>
                    <button onClick={() => useReferenceTrack(track)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100">
                      Use
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};