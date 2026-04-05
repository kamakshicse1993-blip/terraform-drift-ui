const fs = require('fs');
const { EC2Client, DescribeSecurityGroupsCommand } = require('@aws-sdk/client-ec2');


function parseTfstateRules(attrs) {
  const ingress = (attrs.ingress || []).map(r => ({
    protocol: r.protocol,
    fromPort: r.from_port,
    toPort: r.to_port,
    cidr: r.cidr_blocks || [],
    ipv6Cidr: r.ipv6_cidr_blocks || [],
    description: r.description || ''
  }));
  const egress = (attrs.egress || []).map(r => ({
    protocol: r.protocol,
    fromPort: r.from_port,
    toPort: r.to_port,
    cidr: r.cidr_blocks || [],
    ipv6Cidr: r.ipv6_cidr_blocks || [],
    description: r.description || ''
  }));
  return { ingress, egress };
}

function parseAwsRules(awsSg) {
  const ingress = (awsSg.IpPermissions || []).map(r => ({
    protocol: r.IpProtocol,
    fromPort: r.FromPort !== undefined ? r.FromPort : -1,
    toPort: r.ToPort !== undefined ? r.ToPort : -1,
    cidr: (r.IpRanges || []).map(ip => ip.CidrIp),
    ipv6Cidr: (r.Ipv6Ranges || []).map(ip => ip.CidrIpv6),
    description: ((r.IpRanges || [])[0] || {}).Description || ''
  }));
  const egress = (awsSg.IpPermissionsEgress || []).map(r => ({
    protocol: r.IpProtocol,
    fromPort: r.FromPort !== undefined ? r.FromPort : -1,
    toPort: r.ToPort !== undefined ? r.ToPort : -1,
    cidr: (r.IpRanges || []).map(ip => ip.CidrIp),
    ipv6Cidr: (r.Ipv6Ranges || []).map(ip => ip.CidrIpv6),
    description: ((r.IpRanges || [])[0] || {}).Description || ''
  }));
  return { ingress, egress };
}

function ruleKey(r) {
  return `${r.protocol}:${r.fromPort}:${r.toPort}:${[...r.cidr].sort().join(',')}`;
}

function diffRules(tfRules, awsRules, direction) {
  const drifts = [];
  const tfKeys = new Set(tfRules.map(ruleKey));
  const awsKeys = new Set(awsRules.map(ruleKey));

  // In AWS but not in TF state = added outside Terraform (drift)
  for (const awsRule of awsRules) {
    if (!tfKeys.has(ruleKey(awsRule))) {
      drifts.push({
        type: 'ADDED',
        direction,
        rule: awsRule,
        description: `Rule ${direction} ${awsRule.protocol}:${awsRule.fromPort}-${awsRule.toPort} from [${awsRule.cidr.join(', ')}] exists in AWS but NOT in Terraform state`
      });
    }
  }

  // In TF state but not in AWS = removed outside Terraform (drift)
  for (const tfRule of tfRules) {
    if (!awsKeys.has(ruleKey(tfRule))) {
      drifts.push({
        type: 'REMOVED',
        direction,
        rule: tfRule,
        description: `Rule ${direction} ${tfRule.protocol}:${tfRule.fromPort}-${tfRule.toPort} from [${tfRule.cidr.join(', ')}] is in Terraform state but MISSING from AWS`
      });
    }
  }

  return drifts;
}

async function detectDrift() {
  const tfstatePath = process.env.TFSTATE_PATH;
  if (!tfstatePath) throw new Error('TFSTATE_PATH not set in .env');

  // 1. Parse tfstate
  const tfstate = JSON.parse(fs.readFileSync(tfstatePath, 'utf8'));
  const sgResource = tfstate.resources.find(r => r.type === 'aws_security_group');
  if (!sgResource) throw new Error('No aws_security_group resource found in tfstate');

  const attrs = sgResource.instances[0].attributes;
  const sgId = attrs.id;
  const tfRules = parseTfstateRules(attrs);

  // 2. Fetch live AWS state
  const ec2 = new EC2Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

  // Fetch the tracked SG and count all SGs in the VPC in parallel
  const [resp, allSgsResp] = await Promise.all([
    ec2.send(new DescribeSecurityGroupsCommand({ GroupIds: [sgId] })),
    ec2.send(new DescribeSecurityGroupsCommand({
      Filters: [{ Name: 'vpc-id', Values: [attrs.vpc_id] }]
    }))
  ]);

  const awsSg = resp.SecurityGroups[0];
  if (!awsSg) throw new Error(`Security group ${sgId} not found in AWS`);
  const awsRules = parseAwsRules(awsSg);
  const totalResources = allSgsResp.SecurityGroups.length;

  // 3. Compute drift
  const drifts = [
    ...diffRules(tfRules.ingress, awsRules.ingress, 'INGRESS'),
    ...diffRules(tfRules.egress, awsRules.egress, 'EGRESS')
  ];

  const addedCount = drifts.filter(d => d.type === 'ADDED').length;
  const removedCount = drifts.filter(d => d.type === 'REMOVED').length;

  return {
    sgId,
    sgName: attrs.name,
    vpcId: attrs.vpc_id,
    region: attrs.region,
    scannedAt: new Date().toISOString(),
    hasDrift: drifts.length > 0,
    driftCount: drifts.length,
    addedCount,
    removedCount,
    totalResources,
    desired: { ingress: tfRules.ingress, egress: tfRules.egress },
    actual: { ingress: awsRules.ingress, egress: awsRules.egress },
    drifts
  };
}

module.exports = { detectDrift };
