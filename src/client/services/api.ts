// Client API Service for CivicTwin AI

const BASE_URL = '/api/v1';

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

export async function fetchAreas(stateCode?: string) {
  const url = stateCode ? `${BASE_URL}/areas?stateCode=${stateCode}` : `${BASE_URL}/areas`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchCitizenRequests(filters: { category?: string; language?: string; urgency?: string; status?: string; search?: string } = {}) {
  const params = new URLSearchParams(filters as any).toString();
  const res = await fetch(`${BASE_URL}/citizen/requests?${params}`);
  return res.json();
}

export async function fetchCitizenRequestDetails(idOrCode: string) {
  const res = await fetch(`${BASE_URL}/citizen/requests/${idOrCode}`);
  return res.json();
}

export async function fetchCitizenPresets() {
  const res = await fetch(`${BASE_URL}/citizen/presets`);
  return res.json();
}

export async function submitCitizenRequest(payload: any, idempotencyKey?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idempotencyKey) {
    headers['x-idempotency-key'] = idempotencyKey;
  }
  const res = await fetch(`${BASE_URL}/citizen/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function transcribeVoiceAudio(payload: {
  audioBase64?: string;
  mimeType?: string;
  simulatedTranscript?: string;
  languageHint?: string;
}) {
  const res = await fetch(`${BASE_URL}/citizen/voice-transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function detectTextLanguage(text: string, declaredLanguage?: string) {
  const res = await fetch(`${BASE_URL}/citizen/detect-language`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, declaredLanguage }),
  });
  return res.json();
}

export async function fetchSupportedLanguages() {
  const res = await fetch(`${BASE_URL}/citizen/languages`);
  return res.json();
}

export async function fetchHotspots(filters: { category?: string; stateCode?: string } = {}) {
  const params = new URLSearchParams(filters as any).toString();
  const res = await fetch(`${BASE_URL}/radar/hotspots?${params}`);
  return res.json();
}

export async function fetchHotspotDetails(id: string) {
  const res = await fetch(`${BASE_URL}/radar/hotspots/${id}`);
  return res.json();
}

export async function fetchAssets(filters: { stateCode?: string; type?: string; conditionRating?: string } = {}) {
  const params = new URLSearchParams(filters as any).toString();
  const res = await fetch(`${BASE_URL}/infrastructure/assets?${params}`);
  return res.json();
}

export async function fetchInvestments(filters: Record<string, any> = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '' && v !== null) {
      query.set(k, String(v));
    }
  }
  const res = await fetch(`${BASE_URL}/investments?${query.toString()}`);
  return res.json();
}

export async function fetchInvestmentDetail(id: string) {
  const res = await fetch(`${BASE_URL}/investments/${id}`);
  return res.json();
}

export async function fetchCapexGapAnalysis() {
  const res = await fetch(`${BASE_URL}/investments/analytics/gap-analysis`);
  return res.json();
}

export async function fetchPriorityFactors() {
  const res = await fetch(`${BASE_URL}/priority/factors`);
  return res.json();
}

export async function fetchSimulationPresets() {
  const res = await fetch(`${BASE_URL}/simulator/presets`);
  return res.json();
}

export async function fetchHotspotAssessments(hotspotId: string) {
  const res = await fetch(`${BASE_URL}/priority/assessments/${hotspotId}`);
  return res.json();
}

export async function fetchAssessmentDetail(id: string) {
  const res = await fetch(`${BASE_URL}/priority/assessments/${id}/detail`);
  return res.json();
}

export async function comparePriorityAssessments(assessmentIdA: string, assessmentIdB: string) {
  const res = await fetch(`${BASE_URL}/priority/assessments/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assessmentIdA, assessmentIdB }),
  });
  return res.json();
}

export async function fetchHotspotScenarios(hotspotId: string) {
  const res = await fetch(`${BASE_URL}/simulator/scenarios/${hotspotId}`);
  return res.json();
}

export async function fetchScenarioDetail(id: string) {
  const res = await fetch(`${BASE_URL}/simulator/scenarios/${id}/detail`);
  return res.json();
}

export async function simulateWhatIf(payload: any) {
  const res = await fetch(`${BASE_URL}/simulator/what-if`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchRecommendations() {
  const res = await fetch(`${BASE_URL}/recommendations`);
  return res.json();
}

export async function updateRecommendationStatus(id: string, status: string, reviewNotes?: string, reviewerRole?: string) {
  const res = await fetch(`${BASE_URL}/recommendations/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reviewNotes, reviewerRole }),
  });
  return res.json();
}

export async function fetchEvidenceBrief(hotspotId: string) {
  const res = await fetch(`${BASE_URL}/briefs/${hotspotId}`);
  return res.json();
}

export async function fetchEvidencePack(hotspotId: string) {
  const res = await fetch(`${BASE_URL}/briefs/${hotspotId}/evidence-pack`);
  return res.json();
}

export async function fetchAuditLogs(filters: { sourceModule?: string; validationStatus?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.sourceModule) params.set('sourceModule', filters.sourceModule);
  if (filters.validationStatus) params.set('validationStatus', filters.validationStatus);
  if (filters.limit) params.set('limit', String(filters.limit));
  const res = await fetch(`${BASE_URL}/audit/logs?${params.toString()}`);
  return res.json();
}

export async function fetchAuditStats() {
  const res = await fetch(`${BASE_URL}/audit/stats`);
  return res.json();
}

export async function verifyAuditRecord(id: string) {
  const res = await fetch(`${BASE_URL}/audit/verify/${id}`);
  return res.json();
}

export async function fetchHumanReviews() {
  const res = await fetch(`${BASE_URL}/reviews`);
  return res.json();
}

export async function submitHumanReview(payload: any) {
  const res = await fetch(`${BASE_URL}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchDataSources() {
  const res = await fetch(`${BASE_URL}/data-sources`);
  return res.json();
}

export async function resetDemoDataset() {
  const res = await fetch(`${BASE_URL}/demo/reset`, { method: 'POST' });
  return res.json();
}

export async function runHotspotDetection(radiusKm: number = 3.0) {
  const res = await fetch(`${BASE_URL}/radar/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ radiusKm }),
  });
  return res.json();
}

export async function recalculatePriority(hotspotId: string, weights?: any, modelVersion?: string) {
  const res = await fetch(`${BASE_URL}/priority/calculate/${hotspotId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weights, modelVersion }),
  });
  return res.json();
}

export async function generateBrief(hotspotId: string) {
  const res = await fetch(`${BASE_URL}/briefs/generate/${hotspotId}`, {
    method: 'POST',
  });
  return res.json();
}

export async function fetchEvidenceGraph(hotspotId: string) {
  const res = await fetch(`${BASE_URL}/evidence-graph/hotspot/${hotspotId}`);
  return res.json();
}

export async function fetchEntityTrace(entityType: string, entityId: string) {
  const res = await fetch(`${BASE_URL}/evidence-graph/trace/${entityType}/${entityId}`);
  return res.json();
}

export async function fetchEvidenceDetail(evidenceCode: string) {
  const res = await fetch(`${BASE_URL}/evidence-graph/evidence/${evidenceCode}`);
  return res.json();
}

export async function verifyEvidenceCitations(targetType: string, targetId: string) {
  const res = await fetch(`${BASE_URL}/evidence-graph/verify/${targetType}/${targetId}`);
  return res.json();
}

export async function fetchDataProvenanceReport() {
  const res = await fetch(`${BASE_URL}/evidence-graph/provenance`);
  return res.json();
}

export async function fetchHotspotExplanation(hotspotId: string) {
  const res = await fetch(`${BASE_URL}/radar/hotspots/${hotspotId}/explanation`);
  return res.json();
}

export async function updateHotspotStatus(hotspotId: string, status: string, rationale?: string) {
  const res = await fetch(`${BASE_URL}/radar/hotspots/${hotspotId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, rationale }),
  });
  return res.json();
}

export async function fetchFilteredHotspots(params: Record<string, any>) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) {
      query.set(k, String(v));
    }
  }
  const res = await fetch(`${BASE_URL}/radar/hotspots?${query.toString()}`);
  return res.json();
}
