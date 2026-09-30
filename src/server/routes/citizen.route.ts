import { Router } from 'express';
import { prisma } from '../db.js';
import { CitizenRequestInputSchema } from '../../shared/schemas/citizen.schema.js';
import { ingestCitizenRequest } from '../services/ingestion.service.js';
import { ValidationError, NotFoundError } from '../errors/app-error.js';
import { SUPPORTED_LANGUAGES } from '../../shared/constants.js';

export const citizenRouter = Router();

// GET /api/v1/citizen/requests - List citizen requests with filtering
citizenRouter.get('/citizen/requests', async (req, res, next) => {
  try {
    const { category, language, urgency, status, search, limit = '50' } = req.query;
    const where: any = {};
    if (category && category !== 'ALL') where.category = String(category);
    if (language && language !== 'ALL') where.language = String(language);
    if (urgency && urgency !== 'ALL') where.urgency = String(urgency);
    if (status && status !== 'ALL') where.status = String(status);
    if (search) {
      where.OR = [
        { trackingCode: { contains: String(search) } },
        { originalText: { contains: String(search) } },
        { summary: { contains: String(search) } },
      ];
    }

    const requests = await prisma.citizenRequest.findMany({
      where,
      include: {
        location: {
          include: { administrativeArea: true },
        },
        issueCluster: true,
        aiAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(String(limit), 10) || 50, 200),
    });

    res.json({
      success: true,
      count: requests.length,
      data: requests,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/v1/citizen/requests/:idOrCode - Track a specific citizen request by ID or tracking code
citizenRouter.get('/citizen/requests/:idOrCode', async (req, res, next) => {
  try {
    const { idOrCode } = req.params;
    const request = await prisma.citizenRequest.findFirst({
      where: {
        OR: [
          { id: idOrCode },
          { trackingCode: idOrCode },
        ],
      },
      include: {
        location: {
          include: { administrativeArea: true },
        },
        issueCluster: true,
        aiAnalyses: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      return next(new NotFoundError(`Citizen request '${idOrCode}'`));
    }

    res.json({
      success: true,
      data: request,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    next(error);
  }
});

// POST /api/v1/citizen/voice-transcribe - Transcribe voice audio with language detection & robust text fallback
citizenRouter.post('/citizen/voice-transcribe', async (req, res, next) => {
  try {
    const { transcribeVoiceAudio } = await import('../services/voice.service.js');
    const result = await transcribeVoiceAudio(req.body);
    res.status(200).json({
      success: true,
      message: 'Voice audio successfully transcribed and language detected',
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
});

// POST /api/v1/citizen/detect-language - Detect language and script of input text
citizenRouter.post('/citizen/detect-language', async (req, res, next) => {
  try {
    const { text, declaredLanguage } = req.body;
    const { detectLanguage } = await import('../services/language.service.js');
    const result = detectLanguage(String(text || ''), declaredLanguage);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/v1/citizen/languages - List officially tested & supported DPI languages
citizenRouter.get('/citizen/languages', (_req, res) => {
  res.json({
    success: true,
    count: SUPPORTED_LANGUAGES.length,
    data: SUPPORTED_LANGUAGES,
    policyNotice: 'CivicTwin AI supports strictly the 6 configured Indian languages. Unsupported languages are not claimed or processed.',
  });
});

// POST /api/v1/citizen/requests - Submit a new citizen request
citizenRouter.post('/citizen/requests', async (req, res, next) => {
  try {
    const validation = CitizenRequestInputSchema.safeParse(req.body);
    if (!validation.success) {
      return next(new ValidationError('Validation failed', validation.error.format()));
    }

    const idempotencyKey =
      (req.headers['x-idempotency-key'] as string | undefined) || validation.data.idempotencyKey;

    const input = {
      ...validation.data,
      idempotencyKey,
    };

    const citizenReq = await ingestCitizenRequest(input);

    res.status(201).json({
      success: true,
      message: 'Citizen request successfully ingested and analyzed',
      data: citizenReq,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/v1/citizen/presets - Deterministic demo scenarios across languages and civic issues
citizenRouter.get('/citizen/presets', (_req, res) => {
  const presets = [
    {
      id: 'preset-bengaluru-roads',
      title: 'Bengaluru — Mahadevapura Potholes & PHC Access',
      language: 'en',
      category: 'Roads',
      originalText: 'Severe road collapse, deep potholes, and waterlogging on Outer Ring Road right in front of the Garudachar Palya Primary Health Centre. Ambulances cannot enter and emergency medical access is blocked.',
      channel: 'WEB',
      location: {
        address: 'Outer Ring Road, Opp Garudachar Palya PHC, Mahadevapura, Bengaluru',
        latitude: 12.9875,
        longitude: 77.6912,
        landmark: 'Garudachar Palya PHC Gate 1',
      },
    },
    {
      id: 'preset-varanasi-water',
      title: 'Varanasi — Sigra Water Distribution Rupture',
      language: 'hi',
      category: 'Water',
      originalText: 'हमारे सिगरा स्टेडियम वार्ड 12 में मुख्य पेयजल पाइपलाइन टूट गई है। पिछले चार दिनों से नलों में बदबूदार गंदा पानी आ रहा है और कई बच्चे बीमार पड़ रहे हैं। तुरंत नई पाइपलाइन डाली जाए।',
      channel: 'WEB',
      location: {
        address: 'Sigra Stadium Road, Ward 12, Varanasi Cantt, Uttar Pradesh',
        latitude: 25.3176,
        longitude: 82.9739,
        landmark: 'Opposite Municipal Jal Kal Pumping Station',
      },
    },
    {
      id: 'preset-kolkata-water',
      title: 'Kolkata — Ward 66 Water Main Rupture',
      language: 'bn',
      category: 'Water',
      originalText: 'রাস্তার পাশে পানীয় জলের প্রধান পাইপলাইন ফেটে গিয়ে জল নষ্ট হচ্ছে এবং স্থানীয় এলাকা প্লাবিত হয়ে যাতায়াত সম্পূর্ণরূপে বন্ধ হয়ে গেছে।',
      channel: 'WEB',
      location: {
        address: 'Topsia Main Road, Ward 66, Borough VII, Kolkata',
        latitude: 22.5358,
        longitude: 88.3845,
        landmark: 'Near Topsia Pumping Station',
      },
    },
    {
      id: 'preset-chennai-sanitation',
      title: 'Chennai — T. Nagar Drainage & Waterlogging',
      language: 'ta',
      category: 'Sanitation',
      originalText: 'எங்கள் பகுதியில் மழைநீர் வடிகால் அடைபட்டு கழிவுநீர் தெருவில் தேங்கி துர்நாற்றம் வீசுகிறது. சுகாதார சீர்கேடு ஏற்பட்டுள்ளது.',
      channel: 'WEB',
      location: {
        address: 'Usman Road, T. Nagar, Chennai, Tamil Nadu',
        latitude: 13.0418,
        longitude: 80.2341,
        landmark: 'Near Ranganathan Street Junction',
      },
    },
    {
      id: 'preset-hyderabad-roads',
      title: 'Hyderabad — Kukatpally Primary Health Centre Road',
      language: 'te',
      category: 'Roads',
      originalText: 'ప్రాథమిక ఆరోగ్య ఉపకేంద్రం వద్ద రోడ్డు తీవ్రంగా దెబ్బతిన్నది. గుంతల వల్ల ప్రజలు తీవ్ర ఇబ్బందులు పడుతున్నారు.',
      channel: 'WEB',
      location: {
        address: 'KPHB Colony Main Road, Kukatpally, Hyderabad, Telangana',
        latitude: 17.4938,
        longitude: 78.3995,
        landmark: 'Near KPHB PHC Sub-Centre',
      },
    },
    {
      id: 'preset-pune-sanitation',
      title: 'Pune — Nagar Road Drainage Overflow',
      language: 'mr',
      category: 'Sanitation',
      originalText: 'पुणे नगर रस्ता येथे मुख्य ड्रेनेज लाईन तुंबल्यामुळे घाण पाणी रस्त्यावर येत आहे आणि नागरिकांचे आरोग्य धोक्यात आले आहे.',
      channel: 'WEB',
      location: {
        address: 'Nagar Road, Shivaji Nagar Ward, Pune, Maharashtra',
        latitude: 18.5524,
        longitude: 73.9142,
        landmark: 'Near Viman Nagar Corner',
      },
    },
    {
      id: 'preset-ambiguous-signal',
      title: 'Ambiguous Signal — Low Confidence & Review Flag',
      language: 'en',
      category: 'Other',
      originalText: 'Something is really wrong and bad in this area. Please look into it immediately and fix things.',
      channel: 'WEB',
      location: {
        address: 'Central Square, Bengaluru',
        latitude: 12.9716,
        longitude: 77.5946,
        landmark: 'Main Circle',
      },
    },
  ];

  res.json({
    success: true,
    data: presets,
  });
});

