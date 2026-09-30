import { Router } from 'express';
import {
  buildHotspotEvidenceGraph,
  ensureHotspotEvidenceRecords,
  traceEntityLineage,
  getEvidenceRecordDetail,
  verifyEvidenceIntegrity,
  getDataProvenanceReport,
} from '../services/evidence-graph.service.js';

export const evidenceGraphRouter = Router();

// GET /api/v1/evidence-graph/hotspot/:id - Full Civic Evidence Graph for a hotspot
evidenceGraphRouter.get('/evidence-graph/hotspot/:id', async (req, res) => {
  try {
    const graph = await buildHotspotEvidenceGraph(req.params.id);
    res.json({
      success: true,
      data: graph,
    });
  } catch (error: any) {
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/v1/evidence-graph/generate/:hotspotId - Compile & link verifiable evidence records for a hotspot
evidenceGraphRouter.post('/evidence-graph/generate/:hotspotId', async (req, res) => {
  try {
    const records = await ensureHotspotEvidenceRecords(req.params.hotspotId);
    res.status(201).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error: any) {
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/evidence-graph/trace/:entityType/:entityId - Bidirectional lineage trace
evidenceGraphRouter.get('/evidence-graph/trace/:entityType/:entityId', async (req, res) => {
  try {
    const trace = await traceEntityLineage(req.params.entityType, req.params.entityId);
    res.json({
      success: true,
      data: trace,
    });
  } catch (error: any) {
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/evidence-graph/evidence/:evidenceCode - Deep detail on a specific Evidence ID
evidenceGraphRouter.get('/evidence-graph/evidence/:evidenceCode', async (req, res) => {
  try {
    const detail = await getEvidenceRecordDetail(req.params.evidenceCode);
    if (!detail.found) {
      return res.status(404).json({
        success: false,
        error: detail.error || 'Evidence record not found',
        data: detail,
      });
    }
    res.json({
      success: true,
      data: detail,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/evidence-graph/verify/:targetType/:targetId - Audit verification of citations
evidenceGraphRouter.get('/evidence-graph/verify/:targetType/:targetId', async (req, res) => {
  try {
    const report = await verifyEvidenceIntegrity(req.params.targetType, req.params.targetId);
    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/v1/evidence-graph/provenance - Dataset provenance registry & transparency report
evidenceGraphRouter.get('/evidence-graph/provenance', async (_req, res) => {
  try {
    const report = await getDataProvenanceReport();
    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
