const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// amazon.titan-text-express/lite/premier are not enabled in this account.
// amazon.nova-lite-v1:0 is Amazon's current-gen text model (successor to Titan text).
const MODEL_ID = 'amazon.nova-lite-v1:0';

// Local rule-based analysis used when Bedrock access is unavailable
function localAnalysis(drift) {
  const hasSsh = drift.drifts.some(d => d.rule.fromPort <= 22 && d.rule.toPort >= 22);
  const hasPublic = drift.drifts.some(d => d.rule.cidr && d.rule.cidr.includes('0.0.0.0/0'));
  const addedCount = drift.drifts.filter(d => d.type === 'ADDED').length;
  const severity = (hasSsh && hasPublic) ? 'CRITICAL' : hasPublic ? 'HIGH' : 'MEDIUM';
  const ports = drift.drifts.map(d => d.rule.fromPort + (d.rule.fromPort !== d.rule.toPort ? '-' + d.rule.toPort : '')).join(', ');
  const cidrs = [...new Set(drift.drifts.flatMap(d => d.rule.cidr || []))].join(', ');

  return {
    summary: addedCount + ' ingress rule(s) added to ' + drift.sgName + ' outside Terraform — ports ' + ports,
    rootCause: 'Most likely a manual change made directly in the AWS Management Console or via CLI, bypassing the Terraform IaC workflow. This is a common pattern during incident response or ad-hoc debugging.',
    securityImpact: hasSsh && hasPublic
      ? 'CRITICAL: SSH (port 22) is open to the entire internet (0.0.0.0/0). This exposes the security group to brute-force and credential-stuffing attacks from any IP address.'
      : 'Rules added outside Terraform break infrastructure-as-code consistency. Public CIDR ranges may expose services to unintended traffic.',
    severity,
    confidence: hasSsh && hasPublic ? 92 : 78,
    immediateAction: hasSsh && hasPublic
      ? 'Immediately remove the SSH rule from the AWS SG or restrict it to a trusted CIDR. Run terraform apply to restore desired state.'
      : 'Review the added rules, confirm if intentional, and if not — run terraform apply to restore desired state.',
    terraformFix: 'resource "aws_security_group" "' + drift.sgName + '" {\n  name        = "' + drift.sgName + '"\n  description = "Managed by Terraform"\n  vpc_id      = "' + drift.vpcId + '"\n\n  # No ingress rules — all ' + addedCount + ' rule(s) below were added outside Terraform:\n' +
      drift.drifts.map(d =>
        '  # REMOVE: ' + d.direction + ' ' + d.rule.protocol.toUpperCase() + ' ' + d.rule.fromPort + '-' + d.rule.toPort + ' from ' + (d.rule.cidr || []).join(', ')
      ).join('\n') +
      '\n\n  egress {\n    from_port   = 0\n    to_port     = 0\n    protocol    = "-1"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n\n  tags = {\n    Name      = "' + drift.sgName + '"\n    ManagedBy = "Terraform"\n  }\n}',
    remediationSteps: [
      'Run: terraform plan — verify it proposes removing the drifted rule(s)',
      'Run: terraform apply — removes the out-of-band rules from AWS',
      'Enable AWS Config rule "restricted-ssh" to alert on port 22 open to 0.0.0.0/0',
      'Add SCP or IAM policy to prevent direct SG modifications outside Terraform',
      'Set up drift detection to run on a schedule (e.g. every 15 minutes)'
    ],
    source: 'local-analysis'
  };
}

async function analyzeDrift(drift) {
  const client = new BedrockRuntimeClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

  const driftSummary = drift.drifts.map(d =>
    `- [${d.type}] ${d.direction}: protocol=${d.rule.protocol}, ports=${d.rule.fromPort}-${d.rule.toPort}, cidr=[${d.rule.cidr.join(', ')}]`
  ).join('\n');

  const prompt = `You are an AWS cloud security expert specializing in Terraform infrastructure drift analysis.

## Security Group Under Analysis
- Name: ${drift.sgName}
- ID: ${drift.sgId}
- VPC: ${drift.vpcId}
- Region: ${drift.region}
- Scanned at: ${drift.scannedAt}

## Terraform Desired State
Ingress rules: ${JSON.stringify(drift.desired.ingress, null, 2)}
Egress rules: ${JSON.stringify(drift.desired.egress, null, 2)}

## Actual AWS State
Ingress rules: ${JSON.stringify(drift.actual.ingress, null, 2)}
Egress rules: ${JSON.stringify(drift.actual.egress, null, 2)}

## Detected Drift (${drift.driftCount} change(s))
${driftSummary}

Analyze this drift and respond ONLY with valid JSON in this exact format:
{
  "summary": "One sentence describing the drift",
  "rootCause": "Explain the most likely reason this drift occurred (manual console change, runbook, incident response, etc.)",
  "securityImpact": "Describe the security implications of the drift",
  "severity": "CRITICAL or HIGH or MEDIUM or LOW",
  "confidence": <number 0-100>,
  "immediateAction": "What the team should do right now",
  "terraformFix": "The exact Terraform resource block to restore desired state, as a code string",
  "remediationSteps": ["step 1", "step 2", "step 3"]
}`;

  // Amazon Nova message format
  const body = JSON.stringify({
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { max_new_tokens: 2048, temperature: 0.7, top_p: 0.9 }
  });

  let resp;
  try {
    resp = await client.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body
    }));
  } catch (bedrockErr) {
    console.warn('[bedrock] Bedrock unavailable (' + bedrockErr.message.split('.')[0] + ') — using local analysis');
    return localAnalysis(drift);
  }

  // Amazon Nova response: output.message.content[0].text
  const decoded = JSON.parse(new TextDecoder().decode(resp.body));
  const text = decoded.output.message.content[0].text.trim();

  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

  try {
    const result = JSON.parse(jsonStr);
    result.source = 'bedrock';
    return result;
  } catch {
    return localAnalysis(drift);
  }
}

module.exports = { analyzeDrift };
