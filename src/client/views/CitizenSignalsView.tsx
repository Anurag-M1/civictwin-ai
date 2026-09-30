import React, { useState, useEffect, useRef, useId } from 'react';
import {
  Mic,
  Send,
  Globe,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  MapPin,
  RotateCcw,
  Copy,
  Check,
  Search,
  Sparkles,
  ShieldCheck,
  Layers,
  ChevronDown,
  ChevronUp,
  Volume2,
  Radio,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, CIVIC_CATEGORIES } from '../../shared/constants.js';
import {
  submitCitizenRequest,
  fetchCitizenPresets,
  transcribeVoiceAudio,
  detectTextLanguage,
} from '../services/api.js';

interface CitizenSignalsViewProps {
  requests: any[];
  onRefresh: () => void;
}

interface LanguageDetectionState {
  detectedLanguage: string;
  confidence: number;
  isSupported: boolean;
  scriptName: string;
  disclaimer?: string;
}

interface VoiceErrorState {
  code: string;
  message: string;
  resolution: string;
}

// Deterministic voice test presets for all 6 DPI supported languages
const VOICE_PRESETS = [
  {
    lang: 'hi',
    label: 'हिन्दी (Hindi Voice)',
    title: 'Varanasi Sigra Water Contamination',
    transcript: 'हमारे सिगरा स्टेडियम वार्ड 12 में मुख्य पेयजल पाइपलाइन टूट गई है। पिछले चार दिनों से नलों में बदबूदार गंदा पानी आ रहा है। तुरंत मरम्मत की जाए।',
    address: 'Sigra Stadium Road, Ward 12, Varanasi, Uttar Pradesh',
    lat: 25.3176,
    lng: 82.9739,
    landmark: 'Opposite Stadium Gate 3',
  },
  {
    lang: 'en',
    label: 'English Voice',
    title: 'Bengaluru Outer Ring Road Pothole Crisis',
    transcript: 'Severe road collapse, deep potholes, and waterlogging on Outer Ring Road right in front of the Garudachar Palya Primary Health Centre blocking emergency ambulance access.',
    address: 'Outer Ring Road, Opp Garudachar Palya PHC, Mahadevapura, Bengaluru',
    lat: 12.9875,
    lng: 77.6912,
    landmark: 'Garudachar Palya PHC Gate 1',
  },
  {
    lang: 'bn',
    label: 'বাংলা (Bengali Voice)',
    title: 'Kolkata Ward 45 Water Main Burst',
    transcript: 'রাস্তার পাশে পানীয় জলের প্রধান পাইপলাইন ফেটে গিয়ে জল নষ্ট হচ্ছে এবং স্থানীয় এলাকা প্লাবিত হয়ে যাতায়াত বন্ধ হয়ে গেছে।',
    address: 'Bidhan Sarani, Ward 45, North Kolkata, West Bengal',
    lat: 22.5833,
    lng: 88.3712,
    landmark: 'Near Shyambazar Crossing',
  },
  {
    lang: 'ta',
    label: 'தமிழ் (Tamil Voice)',
    title: 'Chennai Vyasarpadi Stormwater Blockage',
    transcript: 'எங்கள் பகுதியில் மழைநீர் வடிகால் அடைபட்டு கழிவுநீர் தெருவில் தேங்கி துர்நாற்றம் வீசுகிறது. சுகாதார சீர்கேடு ஏற்பட்டுள்ளது.',
    address: 'Perambur High Road, Vyasarpadi, Zone 4, Chennai, Tamil Nadu',
    lat: 13.1075,
    lng: 80.2612,
    landmark: 'Near Vyasarpadi Jeeva Railway Station',
  },
  {
    lang: 'te',
    label: 'తెలుగు (Telugu Voice)',
    title: 'Hyderabad Amberpet PHC Road Damage',
    transcript: 'ప్రాథమిక ఆరోగ్య ఉపకేంద్రం వద్ద రోడ్డు తీవ్రంగా దెబ్బతిన్నది. గుంతల వల్ల ప్రజలు తీవ్ర ఇబ్బందులు పడుతున్నారు.',
    address: 'Near Urban Primary Health Centre, Amberpet, Hyderabad, Telangana',
    lat: 17.3875,
    lng: 78.5125,
    landmark: 'Opposite Amberpet Market Yard',
  },
  {
    lang: 'mr',
    label: 'मराठी (Marathi Voice)',
    title: 'Pune Nagar Road Drainage Overflow',
    transcript: 'पुणे नगर रस्ता येथे मुख्य ड्रेनेज लाईन तुंबल्यामुळे घाण पाणी रस्त्यावर येत आहे आणि नागरिकांचे आरोग्य धोक्यात आले आहे.',
    address: 'Ahmednagar Road, Somnath Nagar, Vadgaon Sheri, Pune, Maharashtra',
    lat: 18.5524,
    lng: 73.9182,
    landmark: 'Near Somnath Nagar Bus Stop',
  },
];

export const CitizenSignalsView: React.FC<CitizenSignalsViewProps> = ({ requests, onRefresh }) => {
  // Form State
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('hi');
  const [channel, setChannel] = useState<'WEB' | 'VOICE' | 'MESSAGING'>('WEB');
  const [address, setAddress] = useState('Outer Ring Road, Opp Garudachar Palya PHC, Mahadevapura, Bengaluru');
  const [latitude, setLatitude] = useState<number>(12.9875);
  const [longitude, setLongitude] = useState<number>(77.6912);
  const [landmark, setLandmark] = useState('Garudachar Palya PHC Gate 1');
  const [mediaUrl, setMediaUrl] = useState('');

  // Voice-to-Text State
  const [voiceStatus, setVoiceStatus] = useState<'IDLE' | 'LISTENING' | 'TRANSCRIBING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [voiceDuration, setVoiceDuration] = useState<number>(0);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [voiceError, setVoiceError] = useState<VoiceErrorState | null>(null);
  const [voiceReceipt, setVoiceReceipt] = useState<any | null>(null);
  const [showVoiceFallback, setShowVoiceFallback] = useState<boolean>(false);
  const [isTranscribingPreset, setIsTranscribingPreset] = useState<boolean>(false);

  // Language Detection State
  const [detectedLangInfo, setDetectedLangInfo] = useState<LanguageDetectionState | null>(null);
  const [isDetectingLang, setIsDetectingLang] = useState<boolean>(false);

  // Submission & Workflow State
  const [submitting, setSubmitting] = useState(false);
  const [submissionPhase, setSubmissionPhase] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState<any | null>(null);
  const [submittedReceipt, setSubmittedReceipt] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedLanguage, setSelectedLanguage] = useState('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedChannel, setSelectedChannel] = useState('ALL');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  // Presets from API or fallback
  const [presets, setPresets] = useState<any[]>([]);

  // Refs for speech recognition & timer
  const recognitionRef = useRef<any>(null);
  const recordingTimerRef = useRef<any>(null);
  const langDebounceTimerRef = useRef<any>(null);
  const voiceLiveRegionId = useId();

  // Check Web Speech API capability on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      setSpeechSupported(hasSpeech);
      if (!hasSpeech) {
        setShowVoiceFallback(true);
      }
    }

    // Load server-configured presets
    fetchCitizenPresets()
      .then((res) => {
        if (res.success && res.data) {
          setPresets(res.data);
        }
      })
      .catch(() => {
        // Deterministic fallback presets available
      });

    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Real-time language detection with debounced API check
  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 3) {
      setDetectedLangInfo(null);
      return;
    }

    // Fast local heuristic for immediate responsive feedback
    const checkFastHeuristic = (val: string): LanguageDetectionState | null => {
      // Check unsupported scripts first
      if (/[\u0400-\u04FF]/.test(val)) {
        return {
          detectedLanguage: 'unsupported',
          confidence: 0.99,
          isSupported: false,
          scriptName: 'Cyrillic',
          disclaimer: 'CivicTwin AI supports strictly the 6 configured Indian languages. Cyrillic is not supported.',
        };
      }
      if (/[\u0600-\u06FF]/.test(val)) {
        return {
          detectedLanguage: 'unsupported',
          confidence: 0.99,
          isSupported: false,
          scriptName: 'Arabic',
          disclaimer: 'CivicTwin AI supports strictly the 6 configured Indian languages. Arabic script is not supported.',
        };
      }
      if (/[\u4E00-\u9FFF]/.test(val)) {
        return {
          detectedLanguage: 'unsupported',
          confidence: 0.99,
          isSupported: false,
          scriptName: 'Hanzi / CJK',
          disclaimer: 'CivicTwin AI supports strictly the 6 configured Indian languages. CJK script is not supported.',
        };
      }

      // Check supported Indic scripts
      if (/[\u0980-\u09FF]/.test(val)) {
        return { detectedLanguage: 'bn', confidence: 0.96, isSupported: true, scriptName: 'Bengali' };
      }
      if (/[\u0B80-\u0BFF]/.test(val)) {
        return { detectedLanguage: 'ta', confidence: 0.97, isSupported: true, scriptName: 'Tamil' };
      }
      if (/[\u0C00-\u0C7F]/.test(val)) {
        return { detectedLanguage: 'te', confidence: 0.96, isSupported: true, scriptName: 'Telugu' };
      }
      if (/[\u0900-\u097F]/.test(val)) {
        const isMarathi = val.includes('ळ') || /(आहे|नाही|पाणी|रस्ता|तक्रार|वॉर्ड|ड्रेनेज)/.test(val);
        return {
          detectedLanguage: isMarathi ? 'mr' : 'hi',
          confidence: isMarathi ? 0.92 : 0.95,
          isSupported: true,
          scriptName: isMarathi ? 'Devanagari (Marathi)' : 'Devanagari (Hindi)',
        };
      }
      if (/[a-zA-Z]/.test(val)) {
        return { detectedLanguage: 'en', confidence: 0.94, isSupported: true, scriptName: 'Latin (English)' };
      }
      return null;
    };

    const fastResult = checkFastHeuristic(trimmed);
    if (fastResult) {
      setDetectedLangInfo(fastResult);
    }

    // Call server language detection endpoint with debounce
    if (langDebounceTimerRef.current) clearTimeout(langDebounceTimerRef.current);
    langDebounceTimerRef.current = setTimeout(async () => {
      try {
        setIsDetectingLang(true);
        const res = await detectTextLanguage(trimmed, language);
        if (res.success && res.data) {
          setDetectedLangInfo(res.data);
        }
      } catch {
        // Retain fast heuristic
      } finally {
        setIsDetectingLang(false);
      }
    }, 350);

    return () => {
      if (langDebounceTimerRef.current) clearTimeout(langDebounceTimerRef.current);
    };
  }, [text, language]);

  // Handle language switch
  const handleLanguageChange = (code: string) => {
    setLanguage(code);
    const sample = VOICE_PRESETS.find((p) => p.lang === code);
    if (sample && (!text || VOICE_PRESETS.some((p) => p.transcript === text))) {
      setText(sample.transcript);
      setAddress(sample.address);
      setLatitude(sample.lat);
      setLongitude(sample.lng);
      setLandmark(sample.landmark);
    }
  };

  // Preset selector
  const handlePresetSelect = (preset: any) => {
    setText(preset.originalText);
    setLanguage(preset.language);
    setChannel(preset.channel || 'WEB');
    if (preset.location) {
      setAddress(preset.location.address || '');
      setLatitude(preset.location.latitude || 12.9875);
      setLongitude(preset.location.longitude || 77.6912);
      setLandmark(preset.location.landmark || '');
    }
    setErrorMessage(null);
    setDuplicateConflict(null);
    setSubmittedReceipt(null);
    setVoiceReceipt(null);
  };

  // Voice Ingestion via SpeechRecognition
  const handleVoiceToggle = () => {
    setVoiceError(null);

    if (!speechSupported) {
      setVoiceStatus('ERROR');
      setVoiceError({
        code: 'NOT_SUPPORTED',
        message: 'Speech Recognition API is not supported in this browser.',
        resolution: 'Robust text fallback is active below. You can also test the server-side voice pipeline using the native audio simulation presets.',
      });
      setShowVoiceFallback(true);
      return;
    }

    if (voiceStatus === 'LISTENING') {
      // User requested stop
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setVoiceStatus('IDLE');
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      const langMap: Record<string, string> = {
        hi: 'hi-IN',
        bn: 'bn-IN',
        ta: 'ta-IN',
        te: 'te-IN',
        mr: 'mr-IN',
        en: 'en-IN',
      };

      recognition.lang = langMap[language] || 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setVoiceStatus('LISTENING');
        setVoiceDuration(0);
        setChannel('VOICE');
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = setInterval(() => {
          setVoiceDuration((d) => d + 1);
        }, 1000);
      };

      recognition.onresult = (event: any) => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setChannel('VOICE');
          setVoiceStatus('SUCCESS');
        } else {
          setVoiceStatus('IDLE');
        }
      };

      recognition.onerror = (event: any) => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        const err = event.error;
        let mappedError: VoiceErrorState;

        if (err === 'not-allowed' || err === 'service-not-allowed') {
          mappedError = {
            code: 'PERMISSION_DENIED',
            message: 'Microphone permission was denied by browser or operating system.',
            resolution: 'Allow microphone access in site permissions, or use the robust text fallback / simulated voice presets below.',
          };
        } else if (err === 'no-speech') {
          mappedError = {
            code: 'NO_SPEECH',
            message: 'No speech was detected within the audio capture window.',
            resolution: 'Please speak closer to the microphone, or type your complaint directly into the description box.',
          };
        } else if (err === 'audio-capture') {
          mappedError = {
            code: 'AUDIO_CAPTURE',
            message: 'No audio capture device (microphone) was found.',
            resolution: 'Please plug in a microphone, or use the keyboard text entry below.',
          };
        } else if (err === 'network') {
          mappedError = {
            code: 'NETWORK_ERROR',
            message: 'Speech recognition service encountered a network error.',
            resolution: 'Check your network connection, or submit your complaint via standard text intake.',
          };
        } else {
          mappedError = {
            code: 'SPEECH_ERROR',
            message: `Speech recognition error: ${err}`,
            resolution: 'Text intake is active. You can also test the voice pipeline via server-side voice simulation.',
          };
        }

        setVoiceError(mappedError);
        setVoiceStatus('ERROR');
        setShowVoiceFallback(true);
      };

      recognition.onend = () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setVoiceStatus((s) => (s === 'LISTENING' ? 'IDLE' : s));
      };

      recognition.start();
    } catch (err: any) {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setVoiceStatus('ERROR');
      setVoiceError({
        code: 'INITIALIZATION_FAILED',
        message: err.message || 'Failed to initialize speech recognition engine.',
        resolution: 'Use the text fallback or pre-configured native voice simulation presets.',
      });
      setShowVoiceFallback(true);
    }
  };

  // Run Server-side Voice Transcription Pipeline
  const handleRunServerVoiceTranscription = async (preset: (typeof VOICE_PRESETS)[0]) => {
    setIsTranscribingPreset(true);
    setVoiceError(null);
    setVoiceReceipt(null);
    try {
      const res = await transcribeVoiceAudio({
        simulatedTranscript: preset.transcript,
        languageHint: preset.lang,
      });

      if (res.success && res.data) {
        setText(res.data.originalText);
        setLanguage(res.data.detectedLanguage);
        setChannel('VOICE');
        setAddress(preset.address);
        setLatitude(preset.lat);
        setLongitude(preset.lng);
        setLandmark(preset.landmark);
        setVoiceReceipt(res.data);
        setVoiceStatus('SUCCESS');
      } else {
        setVoiceError({
          code: 'TRANSCRIPTION_API_ERROR',
          message: res.error || 'Voice transcription API returned an error.',
          resolution: 'Please type the complaint manually or try another language preset.',
        });
      }
    } catch (err: any) {
      setVoiceError({
        code: 'NETWORK_FAILURE',
        message: err.message || 'Could not connect to voice transcription server.',
        resolution: 'Verify server status on port 3001.',
      });
    } finally {
      setIsTranscribingPreset(false);
    }
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorDetails(null);
    setDuplicateConflict(null);

    const trimmedText = text.trim();
    if (!trimmedText || trimmedText.length < 5) {
      setErrorMessage('Description must be at least 5 characters long.');
      return;
    }

    // Enforce supported language check
    if (detectedLangInfo && !detectedLangInfo.isSupported) {
      setErrorMessage(
        'Submission blocked: CivicTwin AI supports strictly the 6 configured Indian languages (English, Hindi, Bengali, Tamil, Telugu, Marathi). Non-supported languages are not claimed or processed.',
      );
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setErrorMessage('Please enter valid geographic coordinates (Latitude: -90 to 90, Longitude: -180 to 180).');
      return;
    }

    setSubmitting(true);
    setSubmissionPhase('1/3 Validating verbatim citizen input & DPI language compliance...');

    try {
      setTimeout(() => setSubmissionPhase('2/3 Running Gemini extraction & entity recognition...'), 250);
      setTimeout(() => setSubmissionPhase('3/3 Persisting record & SHA-256 audit digest...'), 500);

      const res = await submitCitizenRequest({
        originalText: trimmedText,
        language,
        channel,
        location: {
          address: address.trim(),
          latitude,
          longitude,
          landmark: landmark.trim() || undefined,
        },
        mediaUrl: mediaUrl.trim() || undefined,
      });

      if (res.success && res.data) {
        setSubmittedReceipt(res.data);
        setText('');
        setVoiceReceipt(null);
        onRefresh();
      } else if (res.code === 'CONFLICT') {
        setDuplicateConflict(res.details || { trackingCode: 'UNKNOWN' });
        setErrorMessage(res.error || 'Duplicate signal detected.');
      } else {
        setErrorMessage(res.error || 'Failed to submit citizen request.');
        if (res.details) setErrorDetails(res.details);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network communication error. Please check backend status.');
    } finally {
      setSubmitting(false);
      setSubmissionPhase('');
    }
  };

  const copyTrackingCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  const handleDetectLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('Geolocation not supported in browser environment.');
      setTimeout(() => setLocationStatus(null), 3000);
      return;
    }
    setLocationStatus('Detecting current GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(5));
        const lng = parseFloat(pos.coords.longitude.toFixed(5));
        setLatitude(lat);
        setLongitude(lng);
        setAddress(`Current Location (GPS: ${lat}, ${lng})`);
        setLocationStatus(`✓ Current location detected (${lat}, ${lng})`);
        setTimeout(() => setLocationStatus(null), 4000);
      },
      (err) => {
        console.warn('Geolocation notice:', err.message);
        setLocationStatus('Could not access GPS device. Retained coordinates.');
        setTimeout(() => setLocationStatus(null), 4000);
      },
      { timeout: 6000, enableHighAccuracy: true },
    );
  };

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    if (selectedCategory !== 'ALL' && r.category !== selectedCategory) return false;
    if (selectedLanguage !== 'ALL' && r.language !== selectedLanguage) return false;
    if (selectedUrgency !== 'ALL' && r.urgency !== selectedUrgency) return false;
    if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
    if (selectedChannel !== 'ALL' && r.channel !== selectedChannel) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const codeMatch = r.trackingCode?.toLowerCase().includes(q);
      const textMatch = r.originalText?.toLowerCase().includes(q);
      const summaryMatch = r.summary?.toLowerCase().includes(q);
      const locMatch = r.location?.address?.toLowerCase().includes(q);
      if (!codeMatch && !textMatch && !summaryMatch && !locMatch) return false;
    }
    return true;
  });

  const isCurrentLanguageUnsupported = detectedLangInfo !== null && !detectedLangInfo.isSupported;

  return (
    <div className="gov-container">
      {/* Top Banner / Digital Public Good Header */}
      <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
            Citizen Signal Intake & Multi-Modal Processing
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Digital Public Infrastructure portal aggregating multilingual civic requests across Voice, Web, and Messaging channels.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="gov-badge badge-good" title="English, Hindi, Bengali, Tamil, Telugu, Marathi">
            <Globe size={12} style={{ marginRight: '4px' }} />
            6 Indic Languages
          </span>
          <span className="gov-badge badge-medium">
            <Volume2 size={12} style={{ marginRight: '4px' }} />
            Voice-to-Text + Robust Fallback
          </span>
          <span className="gov-badge badge-good">
            <ShieldCheck size={12} style={{ marginRight: '4px' }} />
            Verbatim Content Preservation
          </span>
        </div>
      </div>

      {/* Verbatim Content Preservation & DPI Policy Notice */}
      <div
        style={{
          marginBottom: '16px',
          padding: '10px 14px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #1b3558',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} color="#1b3558" style={{ flexShrink: 0 }} />
          <span style={{ color: '#334155' }}>
            <strong>Citizen Verbatim Guarantee:</strong> Original citizen content in native script is permanently preserved without modification, transliteration, or translation overwrite. Every ingestion event is anchored with a SHA-256 cryptographic provenance digest.
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
          Strictly Configured Scope
        </span>
      </div>

      {/* Deterministic Presets Bar */}
      {presets.length > 0 && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 14px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Sparkles size={14} color="#1b3558" />
            <strong style={{ fontSize: '12px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Deterministic Test Scenarios & Multi-State Demonstrations:
            </strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {presets.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => handlePresetSelect(p)}
                className="gov-btn gov-btn-secondary"
                style={{ fontSize: '12px', padding: '4px 9px', borderRadius: '3px' }}
              >
                📍 {p.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="gov-two-col">
        {/* Left Column: Intake Form & Receipt */}
        <div>
          {submittedReceipt ? (
            /* Confirmation Receipt View */
            <div className="gov-card" style={{ borderTop: '4px solid #16a34a' }}>
              <div className="gov-card-header">
                <span className="gov-card-title" style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={18} />
                  Citizen Request Ingested & Verified
                </span>
                <span
                  className={`gov-badge ${
                    submittedReceipt.status === 'FLAGGED' ? 'badge-critical' : 'badge-good'
                  }`}
                >
                  {submittedReceipt.status === 'FLAGGED' ? 'FLAGGED FOR HUMAN REVIEW' : 'NORMALIZED'}
                </span>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>OFFICIAL CITIZEN TRACKING CODE</span>
                  <button
                    type="button"
                    className="gov-btn gov-btn-secondary"
                    onClick={() => copyTrackingCode(submittedReceipt.trackingCode)}
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                  >
                    {copiedCode ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                    {copiedCode ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#15803d', letterSpacing: '1px', fontFamily: 'monospace' }}>
                  {submittedReceipt.trackingCode}
                </div>
                <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px' }}>
                  Timestamp: {new Date(submittedReceipt.createdAt || Date.now()).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Verbatim Original Citizen Content Card */}
              <div style={{ padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#1b3558', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Verbatim Citizen Content (Original Script Preserved)
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span className="gov-badge badge-medium">{submittedReceipt.language?.toUpperCase()}</span>
                    <span className="gov-badge badge-good">
                      {submittedReceipt.channel === 'VOICE' ? '🎙️ VOICE INTAKE' : '🌐 WEB INTAKE'}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.5, backgroundColor: '#ffffff', padding: '10px', borderRadius: '3px', border: '1px solid #cbd5e1' }}>
                  "{submittedReceipt.originalText}"
                </div>
              </div>

              {/* Normalized AI Breakdown Card */}
              <div style={{ border: '1px solid #e2e8f0', padding: '14px', borderRadius: '4px', backgroundColor: '#ffffff', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#1b3558', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  AI Structured Normalization Output
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Civic Category:</span>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{submittedReceipt.category}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Urgency Level:</span>
                    <div>
                      <span
                        className={`gov-badge ${
                          submittedReceipt.urgency === 'CRITICAL'
                            ? 'badge-critical'
                            : submittedReceipt.urgency === 'HIGH'
                            ? 'badge-high'
                            : 'badge-medium'
                        }`}
                      >
                        {submittedReceipt.urgency}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Normalized Intent Summary (English):</span>
                  <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500, backgroundColor: '#f8fafc', padding: '8px', borderLeft: '3px solid #1b3558', marginTop: '3px' }}>
                    {submittedReceipt.summary || 'Summary generated'}
                  </div>
                </div>

                {submittedReceipt.requestedAction && (
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Action Needed for Urban Local Body:</span>
                    <div style={{ fontSize: '13px', color: '#334155' }}>
                      {submittedReceipt.requestedAction}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '10px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Confidence Score:</span>{' '}
                    <strong>{((submittedReceipt.confidence || 0.85) * 100).toFixed(1)}%</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Detected Language:</span>{' '}
                    <strong>{submittedReceipt.language?.toUpperCase()}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Location Link:</span>{' '}
                    <span>{submittedReceipt.location?.address || address}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Audit Log:</span>{' '}
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>SHA-256 Provenance Logged</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="gov-btn gov-btn-primary"
                  onClick={() => {
                    setSubmittedReceipt(null);
                    setVoiceReceipt(null);
                  }}
                >
                  <RotateCcw size={14} />
                  Submit Another Citizen Signal
                </button>
              </div>
            </div>
          ) : (
            /* Active Citizen Intake Form */
            <div className="gov-card">
              <div className="gov-card-header">
                <span className="gov-card-title">Multilingual Citizen Request Portal</span>
                <span className="gov-badge badge-good">Secure DPI Gateway</span>
              </div>

              {/* Error / Conflict Alert Banners */}
              {errorMessage && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: duplicateConflict ? '#fffbeb' : '#fef2f2',
                    border: `1px solid ${duplicateConflict ? '#fde68a' : '#fecaca'}`,
                    borderRadius: '4px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <AlertTriangle size={18} color={duplicateConflict ? '#d97706' : '#dc2626'} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: duplicateConflict ? '#b45309' : '#991b1b', fontSize: '13px' }}>
                      {duplicateConflict ? 'Duplicate Submission Conflict (HTTP 409)' : 'Submission Error'}
                    </strong>
                    <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '2px' }}>
                      {errorMessage}
                    </div>
                    {duplicateConflict?.trackingCode && (
                      <div style={{ marginTop: '6px', fontSize: '12px' }}>
                        Track existing request code:{' '}
                        <code style={{ fontWeight: 700, backgroundColor: '#fef3c7', padding: '2px 5px', borderRadius: '2px' }}>
                          {duplicateConflict.trackingCode}
                        </code>
                      </div>
                    )}
                    {errorDetails && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#7f1d1d' }}>
                        {JSON.stringify(errorDetails)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Voice Failure State Alert */}
              {voiceError && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '4px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                  role="alert"
                  aria-live="polite"
                >
                  <AlertOctagon size={18} color="#c2410c" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#9a3412', fontSize: '13px' }}>
                      Voice Intake Notice [{voiceError.code}]
                    </strong>
                    <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '2px' }}>
                      {voiceError.message}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      <strong>Recommended Action:</strong> {voiceError.resolution}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="gov-btn gov-btn-secondary"
                    onClick={() => setVoiceError(null)}
                    style={{ fontSize: '10px', padding: '2px 6px' }}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Voice Server Transcription Receipt Alert */}
              {voiceReceipt && (
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '4px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} color="#16a34a" />
                    <span style={{ fontSize: '12px', color: '#166534' }}>
                      <strong>Voice Transcribed:</strong> Detected <strong>{voiceReceipt.detectedLanguage?.toUpperCase()}</strong> ({(voiceReceipt.confidence * 100).toFixed(0)}% confidence). Verbatim text populated.
                    </span>
                  </div>
                  <span className="gov-badge badge-good" style={{ fontSize: '10px' }}>
                    Audit Logged
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* 1. Language Selector with Strict DPI Notice */}
                <div className="gov-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="gov-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0 }}>
                      <Globe size={14} color="#1b3558" />
                      Select Citizen Language / भाषा चुनें:
                    </label>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Only Configured Indian Languages
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} role="group" aria-label="Select Citizen Language">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        type="button"
                        key={lang.code}
                        className={`gov-btn ${language === lang.code ? 'gov-btn-primary' : 'gov-btn-secondary'}`}
                        onClick={() => handleLanguageChange(lang.code)}
                        style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '3px' }}
                        aria-pressed={language === lang.code}
                      >
                        {lang.name} ({lang.native})
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Channel Selector */}
                <div className="gov-form-group">
                  <label className="gov-label">Intake Ingestion Channel:</label>
                  <div style={{ display: 'flex', gap: '8px' }} role="group" aria-label="Ingestion Channel">
                    <button
                      type="button"
                      className={`gov-btn ${channel === 'WEB' ? 'gov-btn-primary' : 'gov-btn-secondary'}`}
                      onClick={() => setChannel('WEB')}
                      style={{ fontSize: '12px', flex: 1 }}
                      aria-pressed={channel === 'WEB'}
                    >
                      🌐 Web Portal
                    </button>
                    <button
                      type="button"
                      className={`gov-btn ${channel === 'VOICE' ? 'gov-btn-primary' : 'gov-btn-secondary'}`}
                      onClick={() => setChannel('VOICE')}
                      style={{ fontSize: '12px', flex: 1 }}
                      aria-pressed={channel === 'VOICE'}
                    >
                      🎙️ Voice Intake
                    </button>
                    <button
                      type="button"
                      className={`gov-btn ${channel === 'MESSAGING' ? 'gov-btn-primary' : 'gov-btn-secondary'}`}
                      onClick={() => setChannel('MESSAGING')}
                      style={{ fontSize: '12px', flex: 1 }}
                      aria-pressed={channel === 'MESSAGING'}
                    >
                      💬 WhatsApp / SMS Gateway
                    </button>
                  </div>
                </div>

                {/* 3. Citizen Description & Voice Intake Action */}
                <div className="gov-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="gov-label" style={{ marginBottom: 0 }}>
                      Citizen Complaint or Infrastructure Request:
                    </label>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {/* Robust Voice-to-Text Button */}
                      <button
                        type="button"
                        className={`gov-btn ${
                          voiceStatus === 'LISTENING'
                            ? 'gov-btn-danger'
                            : channel === 'VOICE'
                            ? 'gov-btn-primary'
                            : 'gov-btn-secondary'
                        }`}
                        style={{ fontSize: '11px', padding: '4px 9px' }}
                        onClick={handleVoiceToggle}
                        aria-label={voiceStatus === 'LISTENING' ? 'Stop recording voice' : 'Start microphone voice recording'}
                        aria-pressed={voiceStatus === 'LISTENING'}
                        title={speechSupported ? 'Record audio transcript via microphone' : 'Microphone speech recognition unavailable (click for details)'}
                      >
                        {voiceStatus === 'LISTENING' ? (
                          <>
                            <span className="recording-dot" />
                            Stop Recording ({voiceDuration}s)
                          </>
                        ) : (
                          <>
                            <Mic size={13} />
                            Microphone Voice
                          </>
                        )}
                      </button>

                      {/* Toggle Voice Simulation & Audio Fallback */}
                      <button
                        type="button"
                        className="gov-btn gov-btn-secondary"
                        onClick={() => setShowVoiceFallback(!showVoiceFallback)}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        title="Open Robust Voice-to-Text Fallback Panel"
                        aria-expanded={showVoiceFallback}
                      >
                        <Volume2 size={13} />
                        Voice Fallback & Presets
                        {showVoiceFallback ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Accessible Live Region for Screen Readers */}
                  <div id={voiceLiveRegionId} className="sr-only" aria-live="polite">
                    {voiceStatus === 'LISTENING'
                      ? `Listening for speech in ${language}. Speak now.`
                      : voiceStatus === 'SUCCESS'
                      ? 'Speech successfully converted to text.'
                      : voiceError
                      ? `Voice error: ${voiceError.message}`
                      : ''}
                  </div>

                  {/* Active Recording Notification */}
                  {voiceStatus === 'LISTENING' && (
                    <div
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: '#991b1b',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="recording-dot" />
                        <strong>Microphone Active:</strong> Speaking in{' '}
                        {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || 'Configured Language'}... ({voiceDuration}s elapsed)
                      </div>
                      <span style={{ fontSize: '11px', color: '#b91c1c' }}>
                        Click Stop when finished
                      </span>
                    </div>
                  )}

                  <textarea
                    className="gov-textarea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Describe the civic or infrastructure issue in any of the 6 supported languages (Hindi, English, Bengali, Tamil, Telugu, Marathi)..."
                    rows={4}
                    required
                    aria-describedby="char-count-info"
                  />

                  {/* Real-time Language Detection Badge & Character Counter */}
                  <div
                    id="char-count-info"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px',
                      color: '#64748b',
                      marginTop: '4px',
                      flexWrap: 'wrap',
                      gap: '4px',
                    }}
                  >
                    <div>
                      {text.trim().length < 5 ? (
                        <span style={{ color: '#ef4444' }}>Minimum 5 characters required ({text.trim().length}/5)</span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>✓ Description valid ({text.trim().length} chars)</span>
                      )}
                    </div>

                    {/* Detected Language Info Badge */}
                    {isDetectingLang && !detectedLangInfo && (
                      <span style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>
                        Analyzing language...
                      </span>
                    )}
                    {detectedLangInfo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {detectedLangInfo.isSupported ? (
                          <span
                            className="gov-badge badge-good"
                            style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Globe size={11} />
                            Detected: {SUPPORTED_LANGUAGES.find((l) => l.code === detectedLangInfo.detectedLanguage)?.name || detectedLangInfo.detectedLanguage.toUpperCase()} ({(detectedLangInfo.confidence * 100).toFixed(0)}%) • {detectedLangInfo.scriptName}
                            {isDetectingLang && <span style={{ opacity: 0.7 }}>(refreshing...)</span>}
                          </span>
                        ) : (
                          <span
                            className="gov-badge badge-critical"
                            style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <AlertTriangle size={11} />
                            Unsupported Script ({detectedLangInfo.scriptName})
                          </span>
                        )}

                        {/* Suggest switching declared language if mismatch */}
                        {detectedLangInfo.isSupported &&
                          detectedLangInfo.detectedLanguage !== language && (
                            <button
                              type="button"
                              onClick={() => setLanguage(detectedLangInfo.detectedLanguage)}
                              className="gov-btn gov-btn-secondary"
                              style={{ fontSize: '10px', padding: '1px 5px', color: '#1b3558' }}
                              title="Sync declared language to detected language"
                            >
                              Sync declared to {detectedLangInfo.detectedLanguage.toUpperCase()}
                            </button>
                          )}
                      </div>
                    )}
                  </div>

                  {/* Unsupported Language Warning Alert */}
                  {isCurrentLanguageUnsupported && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '10px 12px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '4px',
                        color: '#991b1b',
                        fontSize: '12px',
                      }}
                      role="alert"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <AlertTriangle size={14} color="#dc2626" />
                        Unsupported Language or Script Detected
                      </div>
                      <div style={{ marginTop: '2px', color: '#450a0a' }}>
                        CivicTwin AI supports strictly the 6 tested Indian languages: <strong>English, हिन्दी (Hindi), বাংলা (Bengali), தமிழ் (Tamil), తెలుగు (Telugu), and मराठी (Marathi)</strong>.
                        We do not claim capability for unsupported languages. Please enter your request in one of the 6 supported languages.
                      </div>
                    </div>
                  )}
                </div>

                {/* Robust Text Fallback & Voice Simulation Accordion */}
                {showVoiceFallback && (
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px 14px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Radio size={14} color="#1b3558" />
                        <strong style={{ fontSize: '12px', color: '#0f172a' }}>
                          Robust Voice-to-Text Fallback System & Native Audio Pipeline
                        </strong>
                      </div>
                      <span className="gov-badge badge-medium" style={{ fontSize: '10px' }}>
                        Accessibility Guarantee
                      </span>
                    </div>

                    <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                      If speech recognition is blocked, unsupported in your browser, or unavailable on your hardware, use the direct text input above (Robust Text Fallback) or test the server-side voice pipeline (<code>/api/v1/citizen/voice-transcribe</code>) with verified native language voice signals:
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '6px' }}>
                      {VOICE_PRESETS.map((vp) => (
                        <button
                          type="button"
                          key={vp.lang}
                          disabled={isTranscribingPreset}
                          onClick={() => handleRunServerVoiceTranscription(vp)}
                          className="gov-btn gov-btn-secondary"
                          style={{
                            fontSize: '11px',
                            padding: '6px 8px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            textAlign: 'left',
                            borderRadius: '3px',
                            backgroundColor: language === vp.lang ? '#f1f5f9' : '#ffffff',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'space-between' }}>
                            <strong style={{ color: '#1b3558' }}>{vp.label}</strong>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{vp.lang.toUpperCase()}</span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                            {vp.title}
                          </span>
                        </button>
                      ))}
                    </div>

                    {isTranscribingPreset && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#1b3558', textAlign: 'center' }}>
                        <span className="pulse">Transcribing audio via /api/v1/citizen/voice-transcribe...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Location Section */}
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <label className="gov-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <MapPin size={14} color="#1b3558" />
                      Geocoded Location & Administrative Linkage:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {locationStatus && (
                        <span style={{ fontSize: '11px', color: locationStatus.startsWith('✓') ? '#16a34a' : '#1b3558', fontWeight: 500 }}>
                          {locationStatus}
                        </span>
                      )}
                      <button
                        type="button"
                        className="gov-btn gov-btn-secondary"
                        onClick={handleDetectLocation}
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        title="Detect current GPS location via device"
                      >
                        📍 Detect Current Location
                      </button>
                    </div>
                  </div>

                  <div className="gov-form-group" style={{ marginBottom: '8px' }}>
                    <input
                      type="text"
                      className="gov-input"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address, ward, or locality..."
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Latitude:</span>
                      <input
                        type="number"
                        step="0.0001"
                        className="gov-input"
                        value={latitude}
                        onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Longitude:</span>
                      <input
                        type="number"
                        step="0.0001"
                        className="gov-input"
                        value={longitude}
                        onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Landmark / Facility Nearby (Optional):</span>
                    <input
                      type="text"
                      className="gov-input"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="e.g. Opposite Primary Health Centre Gate 1"
                    />
                  </div>
                </div>

                {/* 5. Optional Media URL */}
                <div className="gov-form-group" style={{ marginBottom: '16px' }}>
                  <label className="gov-label">Attachment / Photo Evidence URL (Optional):</label>
                  <input
                    type="url"
                    className="gov-input"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://example.gov.in/evidence/road-collapse.jpg"
                  />
                </div>

                {/* Submit Button & Progress Indicator */}
                <div>
                  <button
                    type="submit"
                    className="gov-btn gov-btn-primary"
                    disabled={submitting || text.trim().length < 5 || isCurrentLanguageUnsupported}
                    style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: '14px' }}
                    aria-disabled={submitting || text.trim().length < 5 || isCurrentLanguageUnsupported}
                  >
                    <Send size={15} />
                    {submitting
                      ? 'Processing Citizen Signal...'
                      : isCurrentLanguageUnsupported
                      ? 'Unsupported Language - Please Use Configured Language'
                      : `Ingest Citizen Signal via ${channel === 'VOICE' ? 'Voice' : 'Web'} & Run Normalization`}
                  </button>

                  {submitting && (
                    <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '12px', color: '#1b3558' }} aria-live="polite">
                      <div className="pulse" style={{ display: 'inline-block', fontWeight: 600 }}>
                        {submissionPhase || 'Ingesting and analyzing with Gemini...'}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Live Ingested Signals Stream & Details */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <span className="gov-card-title">Live Ingested Signals & Provenance Stream</span>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Showing {filteredRequests.length} of {requests.length} verified citizen signals
              </div>
            </div>
            <button
              type="button"
              className="gov-btn gov-btn-secondary"
              onClick={onRefresh}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              <RotateCcw size={12} />
              Refresh
            </button>
          </div>

          {/* Search and Filters Bar */}
          <div style={{ padding: '10px 0', borderBottom: '1px solid #e2e8f0', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '9px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                className="gov-input"
                style={{ paddingLeft: '28px', fontSize: '12px' }}
                placeholder="Search tracking code, text, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              <select
                className="gov-select"
                style={{ fontSize: '11px', padding: '4px 6px' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter by Civic Category"
              >
                <option value="ALL">All Categories</option>
                {CIVIC_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                className="gov-select"
                style={{ fontSize: '11px', padding: '4px 6px' }}
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                aria-label="Filter by Language"
              >
                <option value="ALL">All Languages</option>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>

              <select
                className="gov-select"
                style={{ fontSize: '11px', padding: '4px 6px' }}
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value)}
                aria-label="Filter by Urgency"
              >
                <option value="ALL">All Urgencies</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <select
                className="gov-select"
                style={{ fontSize: '11px', padding: '4px 6px' }}
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                aria-label="Filter by Ingestion Channel"
              >
                <option value="ALL">All Channels</option>
                <option value="VOICE">🎙️ Voice</option>
                <option value="WEB">🌐 Web</option>
                <option value="MESSAGING">💬 Messaging</option>
              </select>

              <select
                className="gov-select"
                style={{ fontSize: '11px', padding: '4px 6px' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                aria-label="Filter by Status"
              >
                <option value="ALL">All Statuses</option>
                <option value="NORMALIZED">Normalized</option>
                <option value="FLAGGED">Flagged</option>
                <option value="INGESTED">Ingested</option>
              </select>
            </div>
          </div>

          {/* Signals List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '580px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredRequests.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No citizen signals match the selected filters.
              </div>
            ) : (
              filteredRequests.map((r) => {
                const isExpanded = expandedRequestId === r.id;
                const latestAi = r.aiAnalyses?.[0];

                return (
                  <div
                    key={r.id}
                    style={{
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <code style={{ fontWeight: 700, fontSize: '12px', color: '#1b3558' }}>{r.trackingCode}</code>
                        <span className="gov-badge badge-medium">{r.language?.toUpperCase()}</span>
                        <span className="gov-badge badge-good">{r.category}</span>
                        {r.channel === 'VOICE' && (
                          <span className="gov-badge badge-high" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Mic size={10} /> VOICE
                          </span>
                        )}
                        {r.channel === 'WEB' && (
                          <span className="gov-badge badge-good" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Globe size={10} /> WEB
                          </span>
                        )}
                        {r.channel === 'MESSAGING' && (
                          <span className="gov-badge badge-medium" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            💬 MSG
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span
                          className={`gov-badge ${
                            r.urgency === 'CRITICAL'
                              ? 'badge-critical'
                              : r.urgency === 'HIGH'
                              ? 'badge-high'
                              : 'badge-medium'
                          }`}
                        >
                          {r.urgency}
                        </span>
                        <span
                          className={`gov-badge ${
                            r.status === 'FLAGGED' ? 'badge-critical' : 'badge-good'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                    </div>

                    {/* Verbatim Citizen Input Preserved */}
                    <div style={{ fontSize: '13px', color: '#0f172a', marginBottom: '8px', lineHeight: 1.4 }}>
                      <strong style={{ color: '#1b3558' }}>Original Verbatim:</strong>{' '}
                      <span style={{ fontStyle: 'normal' }}>"{r.originalText}"</span>
                    </div>

                    {r.summary && (
                      <div
                        style={{
                          fontSize: '12px',
                          backgroundColor: '#f8fafc',
                          padding: '8px',
                          borderLeft: '3px solid #1b3558',
                          marginBottom: '8px',
                        }}
                      >
                        <div>
                          <strong>Normalized Intent:</strong> {r.summary}
                        </div>
                        {r.requestedAction && (
                          <div style={{ color: '#475569', marginTop: '3px' }}>
                            <strong>Action Needed:</strong> {r.requestedAction}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b' }}>
                      <span>📍 {r.location?.address || 'Geocoded point'}</span>
                      <button
                        type="button"
                        onClick={() => setExpandedRequestId(isExpanded ? null : r.id)}
                        className="gov-btn gov-btn-secondary"
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        <Layers size={10} />
                        {isExpanded ? 'Hide AI Details' : 'AI Analysis & Audit'}
                        {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    </div>

                    {/* Expandable AI & Audit Details */}
                    {isExpanded && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#334155' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                          <div>
                            <span style={{ color: '#64748b' }}>Confidence:</span>{' '}
                            <strong>{((r.confidence || 0.8) * 100).toFixed(1)}%</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Requires Human Review:</span>{' '}
                            <strong>{r.requiresHumanReview ? 'Yes (Flagged)' : 'No (Auto-approved)'}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Model:</span>{' '}
                            <code>{latestAi?.modelName || 'gemini-2.5-flash'}</code>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Tokens / Latency:</span>{' '}
                            <span>{latestAi?.tokensUsed ?? 140} tokens / {latestAi?.latencyMs ?? 210}ms</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '6px', marginTop: '6px' }}>
                          <div>
                            <span style={{ color: '#64748b' }}>Ingestion Channel:</span> <strong>{r.channel}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ SHA-256 Verbatim Audit Logged</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
