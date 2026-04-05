require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const path = require('path');
const fs = require('fs');
const { detectDrift } = require('./drift');
const { analyzeDrift } = require('./bedrock');

const app = express();
app.use(express.json());

// Serve frontend static files — no caching so updates are always fresh
app.use(express.static(path.join(__dirname, '..'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// In-memory state
let driftCache = null;
let analysisCache = null;
let remediatedCount = 0;
const snapshots = [];       // up to 10 scan snapshots
let snapshotCounter = 1;

function saveSnapshot(drift) {
  const snap = {
    id: snapshotCounter++,
    name: snapshotCounter === 2 ? 'Latest Snapshot' : 'Snapshot #' + snapshotCounter,
    timestamp: drift.scannedAt,
    totalResources: drift.totalResources,
    driftCount: drift.driftCount,
    status: drift.hasDrift ? 'drift' : 'clean',
    sgId: drift.sgId,
    sgName: drift.sgName
  };
  snapshots.unshift(snap);
  if (snapshots.length > 10) snapshots.pop();
  // Always label the newest as "Latest Snapshot"
  snapshots.forEach((s, i) => { s.name = i === 0 ? 'Latest Snapshot' : 'Snapshot #' + (snapshotCounter - 1 - i); });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Scan: compare tfstate vs live AWS
app.get('/api/drift', async (req, res) => {
  try {
    console.log('[drift] Scanning security group against tfstate...');
    driftCache = await detectDrift();
    analysisCache = null;
    saveSnapshot(driftCache);
    console.log(`[drift] Found ${driftCache.driftCount} drift(s) in ${driftCache.sgName}`);
    res.json({ ...driftCache, remediatedCount });
  } catch (err) {
    console.error('[drift] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Analyze: call Bedrock Nova Lite
app.post('/api/analyze', async (req, res) => {
  try {
    const drift = driftCache || await detectDrift();
    if (!drift.hasDrift) {
      return res.json({
        summary: 'No drift — security group matches Terraform state.',
        severity: 'LOW', confidence: 100,
        rootCause: 'No drift found', securityImpact: 'None',
        immediateAction: 'No action required', terraformFix: '',
        remediationSteps: ['Security group is in sync with Terraform state'],
        remediatedCount
      });
    }
    if (analysisCache) return res.json({ ...analysisCache, remediatedCount });
    console.log('[analyze] Calling AWS Bedrock Amazon Nova Lite...');
    analysisCache = await analyzeDrift(drift);
    console.log(`[analyze] Severity: ${analysisCache.severity}, Confidence: ${analysisCache.confidence}%`);
    res.json({ ...analysisCache, remediatedCount });
  } catch (err) {
    console.error('[analyze] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Snapshots history
app.get('/api/snapshots', (req, res) => {
  res.json(snapshots);
});

// Increment remediated count
app.post('/api/remediate', (req, res) => {
  remediatedCount++;
  console.log(`[remediate] Count now: ${remediatedCount}`);
  res.json({ remediatedCount });
});

// Real configuration for Settings page
app.get('/api/config', (req, res) => {
  const tfstatePath = process.env.TFSTATE_PATH || '';
  let accountId = 'N/A', vpcId = 'N/A', sgId = 'N/A', sgName = 'N/A';
  try {
    const tfstate = JSON.parse(fs.readFileSync(tfstatePath, 'utf8'));
    const sg = tfstate.resources.find(r => r.type === 'aws_security_group');
    if (sg) {
      const attrs = sg.instances[0].attributes;
      accountId = attrs.owner_id;
      vpcId = attrs.vpc_id;
      sgId = attrs.id;
      sgName = attrs.name;
    }
  } catch {}
  res.json({
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    accountId,
    vpcId,
    sgId,
    sgName,
    tfstatePath,
    model: 'amazon.nova-lite-v1:0',
    modelProvider: 'AWS Bedrock',
    scanInterval: 'On demand',
    lastScan: driftCache ? driftCache.scannedAt : 'Not yet scanned'
  });
});

const PORT = process.env.BACKEND_PORT || 8080;
app.listen(PORT, () => {
  console.log(`Terraform Drift UI + API running on http://localhost:${PORT}`);
});
