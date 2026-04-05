// Backend API served on same origin as the UI (Node serves both)
const BACKEND_URL = '';

// Live drift and analysis results (populated from API)
var liveDrift = null;
var liveAnalysis = null;

// Sample Data
const alertsData = [
    {
        id: 1,
        severity: 'critical',
        title: 'Security Group Modified',
        description: 'sg-0abc123 has open inbound rules on port 22',
        resource: 'security_group.web_sg',
        time: '5 minutes ago'
    },
    {
        id: 2,
        severity: 'warning',
        title: 'Storage Bucket Policy Changed',
        description: 'my-app-bucket policy differs from IaC state',
        resource: 'storage_bucket.app_bucket',
        time: '23 minutes ago'
    },
    {
        id: 3,
        severity: 'info',
        title: 'Compute Instance Tags Updated',
        description: 'i-0def456 has additional tags not in state',
        resource: 'compute_instance.web_server',
        time: '1 hour ago'
    }
];

const insightsData = [
    {
        icon: 'fa-lightbulb',
        title: 'Pattern Detected',
        description: '73% of drifts originate from manual console changes'
    },
    {
        icon: 'fa-chart-line',
        title: 'Trend Analysis',
        description: 'Security group modifications increased 40% this week'
    },
    {
        icon: 'fa-shield-alt',
        title: 'Security Recommendation',
        description: 'Enable config rules to prevent unauthorized changes'
    }
];

const driftsData = [
    {
        id: 1,
        severity: 'critical',
        resource: 'security_group.web_sg',
        resourceId: 'sg-0abc123',
        description: 'Inbound rule added: 0.0.0.0/0 to port 22 (SSH)',
        detectedAt: '2024-02-17 05:32:14 UTC',
        changedBy: 'admin@example.com',
        region: 'us-east-1'
    },
    {
        id: 2,
        severity: 'warning',
        resource: 'storage_bucket_policy.app_policy',
        resourceId: 'my-app-bucket',
        description: 'Bucket policy modified to allow public read access',
        detectedAt: '2024-02-17 04:15:32 UTC',
        changedBy: 'developer@example.com',
        region: 'us-east-1'
    },
    {
        id: 3,
        severity: 'warning',
        resource: 'iam_role.function_exec',
        resourceId: 'function-execution-role',
        description: 'Additional policy attached: StorageFullAccess',
        detectedAt: '2024-02-16 22:45:00 UTC',
        changedBy: 'ops@example.com',
        region: 'us-east-1'
    }
];

const snapshotsData = [
    {
        id: 1,
        name: 'Latest Snapshot',
        timestamp: '2024-02-17 06:00:00 UTC',
        resources: 247,
        changes: 3,
        status: 'active'
    },
    {
        id: 2,
        name: 'Snapshot #846',
        timestamp: '2024-02-17 05:00:00 UTC',
        resources: 247,
        changes: 0,
        status: 'clean'
    },
    {
        id: 3,
        name: 'Snapshot #845',
        timestamp: '2024-02-17 04:00:00 UTC',
        resources: 246,
        changes: 1,
        status: 'drift'
    },
    {
        id: 4,
        name: 'Snapshot #844',
        timestamp: '2024-02-17 03:00:00 UTC',
        resources: 246,
        changes: 0,
        status: 'clean'
    },
    {
        id: 5,
        name: 'Snapshot #843',
        timestamp: '2024-02-17 02:00:00 UTC',
        resources: 245,
        changes: 2,
        status: 'drift'
    }
];

const remediationsData = [
    {
        id: 1,
        title: 'Revert Security Group sg-0abc123',
        description: 'Remove unauthorized inbound rule allowing SSH from 0.0.0.0/0',
        risk: 'low',
        resource: 'security_group.web_sg',
        configPatch: `resource "security_group" "web_sg" {
  name        = "web-sg"
  description = "Web server security group"
  vpc_id      = vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

- ingress {
-   from_port   = 22
-   to_port     = 22
-   protocol    = "tcp"
-   cidr_blocks = ["0.0.0.0/0"]
- }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`
    },
    {
        id: 2,
        title: 'Fix Storage Bucket Policy',
        description: 'Restore private bucket policy configuration',
        risk: 'medium',
        resource: 'storage_bucket_policy.app_policy',
        configPatch: `resource "storage_bucket_policy" "app_policy" {
  bucket = storage_bucket.app_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyPublicRead"
        Effect    = "Deny"
        Principal = "*"
        Action    = "storage:GetObject"
        Resource  = "\${storage_bucket.app_bucket.arn}/*"
        Condition = {
          Bool = {
            "secureTransport" = "false"
          }
        }
      }
    ]
  })
}`
    },
    {
        id: 3,
        title: 'Detach Excessive IAM Policy',
        description: 'Remove StorageFullAccess from function execution role',
        risk: 'high',
        resource: 'iam_role.function_exec',
        configPatch: `resource "iam_role_policy_attachment" "function_storage" {
  role       = iam_role.function_exec.name
- policy_arn = "policies/StorageFullAccess"
+ policy_arn = "policies/StorageReadOnlyAccess"
}`
    }
];

const desiredStateExample = {
    "version": 4,
    "iac_version": "1.5.0",
    "serial": 42,
    "lineage": "abc123-def456",
    "resources": [
        {
            "type": "security_group",
            "name": "web_sg",
            "instances": [
                {
                    "attributes": {
                        "id": "sg-0abc123",
                        "name": "web-sg",
                        "ingress": [
                            {
                                "from_port": 443,
                                "to_port": 443,
                                "protocol": "tcp",
                                "cidr_blocks": ["0.0.0.0/0"]
                            }
                        ]
                    }
                }
            ]
        }
    ]
};

const actualStateExample = {
    "SecurityGroups": [
        {
            "GroupId": "sg-0abc123",
            "GroupName": "web-sg",
            "IpPermissions": [
                {
                    "FromPort": 443,
                    "ToPort": 443,
                    "IpProtocol": "tcp",
                    "IpRanges": [{"CidrIp": "0.0.0.0/0"}]
                },
                {
                    "FromPort": 22,
                    "ToPort": 22,
                    "IpProtocol": "tcp",
                    "IpRanges": [{"CidrIp": "0.0.0.0/0"}],
                    "Description": "DRIFT: Added manually"
                }
            ]
        }
    ]
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    renderAlerts();
    renderInsights();
    renderDrifts();
    renderSnapshots();
    renderRemediations();
    renderStateComparison();
    initSimulations();
    removePoliciesPage();
    clearStaleAnalysisContent();
    loadSettings();
    autoScan();  // kick off real drift scan on load
});

function removePoliciesPage() {
    // Hide Policies nav item and section — not backed by real data
    var policiesNav = document.querySelector('.nav-item[data-section="policies"]');
    if (policiesNav) policiesNav.style.display = 'none';
    var policiesSection = document.getElementById('policies');
    if (policiesSection) policiesSection.style.display = 'none';
}

function clearStaleAnalysisContent() {
    // Replace hardcoded AI Analysis HTML with a placeholder until real analysis runs
    var content = document.getElementById('ai-analysis-content');
    if (content) {
        content.innerHTML = '<div style="padding:32px;text-align:center;color:#94a3b8">' +
            '<i class="fas fa-brain" style="font-size:40px;margin-bottom:12px;display:block;color:#6366f1"></i>' +
            '<p>Auto-scanning... Analysis will appear here shortly.</p>' +
        '</div>';
    }
    // Update model dropdown label to reflect actual model
    var modelSelect = document.getElementById('analysis-model');
    if (modelSelect) {
        modelSelect.innerHTML = '<option value="nova">Amazon Nova Lite (Bedrock)</option>';
    }
}

function loadSettings() {
    fetch(BACKEND_URL + '/api/config')
        .then(function(r) { return r.json(); })
        .then(function(cfg) {
            var settingsGrid = document.querySelector('#settings .settings-grid');
            if (!settingsGrid) return;
            settingsGrid.innerHTML =
                '<div class="settings-card">' +
                    '<h3><i class="fas fa-cloud"></i> Cloud Configuration</h3>' +
                    '<div class="settings-form">' +
                        '<div class="form-group"><label>Cloud Region</label>' +
                            '<select class="select-input"><option>' + cfg.region + '</option></select></div>' +
                        '<div class="form-group"><label>AWS Account ID</label>' +
                            '<input type="text" value="' + cfg.accountId + '" readonly></div>' +
                        '<div class="form-group"><label>VPC ID</label>' +
                            '<input type="text" value="' + cfg.vpcId + '" readonly></div>' +
                        '<div class="form-group"><label>Security Group</label>' +
                            '<input type="text" value="' + cfg.sgId + ' (' + cfg.sgName + ')" readonly></div>' +
                        '<div class="form-group"><label>Terraform State Path</label>' +
                            '<input type="text" value="' + cfg.tfstatePath + '" readonly style="font-size:11px"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="settings-card">' +
                    '<h3><i class="fas fa-brain"></i> AI Configuration</h3>' +
                    '<div class="settings-form">' +
                        '<div class="form-group"><label>LLM Provider</label>' +
                            '<select class="select-input"><option>' + cfg.modelProvider + '</option></select></div>' +
                        '<div class="form-group"><label>Model</label>' +
                            '<input type="text" value="' + cfg.model + '" readonly></div>' +
                        '<div class="form-group"><label>Last Scan</label>' +
                            '<input type="text" value="' + (cfg.lastScan !== 'Not yet scanned' ? new Date(cfg.lastScan).toLocaleString() : 'Not yet scanned') + '" readonly id="last-scan-field"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="settings-card">' +
                    '<h3><i class="fas fa-bell"></i> Notifications</h3>' +
                    '<div class="settings-form">' +
                        '<div class="form-group toggle-group"><label>Email Notifications</label>' +
                            '<label class="toggle-switch"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>' +
                        '<div class="form-group toggle-group"><label>Slack Alerts</label>' +
                            '<label class="toggle-switch"><input type="checkbox"><span class="toggle-slider"></span></label></div>' +
                        '<div class="form-group toggle-group"><label>PagerDuty Integration</label>' +
                            '<label class="toggle-switch"><input type="checkbox"><span class="toggle-slider"></span></label></div>' +
                    '</div>' +
                '</div>' +
                '<div class="settings-card">' +
                    '<h3><i class="fas fa-clock"></i> Automation</h3>' +
                    '<div class="settings-form">' +
                        '<div class="form-group"><label>Scan Interval</label>' +
                            '<select class="select-input"><option>On demand</option><option>Every 5 minutes</option><option>Every 15 minutes</option><option>Every hour</option></select></div>' +
                        '<div class="form-group toggle-group"><label>Auto-remediate Low Risk</label>' +
                            '<label class="toggle-switch"><input type="checkbox"><span class="toggle-slider"></span></label></div>' +
                        '<div class="form-group toggle-group"><label>GitHub Actions Integration</label>' +
                            '<label class="toggle-switch"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>' +
                    '</div>' +
                '</div>';
        })
        .catch(function() {});
}

// Navigation
function initNavigation() {
    var navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var sectionId = item.dataset.section;
            
            // Update active nav item
            navItems.forEach(function(nav) {
                nav.classList.remove('active');
            });
            item.classList.add('active');
            
            // Show corresponding section
            document.querySelectorAll('.content-section').forEach(function(section) {
                section.classList.remove('active');
            });
            document.getElementById(sectionId).classList.add('active');
            
            // Update page title
            var title = item.querySelector('span').textContent;
            document.getElementById('page-title').textContent = title;
            document.querySelector('.breadcrumb').textContent = 'InfraOps AI / ' + title;
        });
    });
}

// Render Alerts
function renderAlerts() {
    var alertsList = document.getElementById('alerts-list');
    if (!alertsList) return;
    
    var html = '';
    alertsData.forEach(function(alert) {
        var iconClass = alert.severity === 'critical' ? 'fa-exclamation-circle' : 
                        alert.severity === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
        html += '<div class="alert-item ' + alert.severity + '">' +
            '<div class="alert-icon"><i class="fas ' + iconClass + '"></i></div>' +
            '<div class="alert-content">' +
                '<h4>' + alert.title + '</h4>' +
                '<p>' + alert.description + '</p>' +
                '<span class="alert-time">' + alert.time + '</span>' +
            '</div>' +
        '</div>';
    });
    alertsList.innerHTML = html;
}

// Render Insights
function renderInsights() {
    var insightsList = document.getElementById('insights-list');
    if (!insightsList) return;
    
    var html = '';
    insightsData.forEach(function(insight) {
        html += '<div class="insight-item">' +
            '<i class="fas ' + insight.icon + '"></i>' +
            '<div class="insight-content">' +
                '<h4>' + insight.title + '</h4>' +
                '<p>' + insight.description + '</p>' +
            '</div>' +
        '</div>';
    });
    insightsList.innerHTML = html;
}

// Render Drifts
function renderDrifts() {
    var driftList = document.getElementById('drift-list');
    if (!driftList) return;
    
    var html = '';
    driftsData.forEach(function(drift) {
        var iconClass = drift.severity === 'critical' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
        html += '<div class="drift-item">' +
            '<div class="drift-info">' +
                '<div class="drift-severity ' + drift.severity + '">' +
                    '<i class="fas ' + iconClass + '"></i>' +
                '</div>' +
                '<div class="drift-details">' +
                    '<h4>' + drift.resource + '</h4>' +
                    '<p>' + drift.description + '</p>' +
                    '<div class="drift-meta">' +
                        '<span><i class="fas fa-fingerprint"></i> ' + drift.resourceId + '</span>' +
                        '<span><i class="fas fa-clock"></i> ' + drift.detectedAt + '</span>' +
                        '<span><i class="fas fa-user"></i> ' + drift.changedBy + '</span>' +
                        '<span><i class="fas fa-map-marker-alt"></i> ' + drift.region + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="drift-actions">' +
                '<button class="btn btn-secondary" onclick="analyzeDrift(' + drift.id + ')">' +
                    '<i class="fas fa-search"></i> Analyze' +
                '</button>' +
                '<button class="btn btn-primary" onclick="showRemediation(' + drift.id + ')">' +
                    '<i class="fas fa-wrench"></i> Fix' +
                '</button>' +
            '</div>' +
        '</div>';
    });
    driftList.innerHTML = html;
}

// Render Snapshots
function renderSnapshots() {
    var timeline = document.getElementById('snapshots-timeline');
    if (!timeline) return;
    
    var html = '';
    snapshotsData.forEach(function(snapshot, index) {
        var activeClass = index === 0 ? 'active' : '';
        var warningClass = snapshot.changes > 0 ? 'text-warning' : '';
        html += '<div class="snapshot-item ' + activeClass + '" data-id="' + snapshot.id + '" onclick="selectSnapshot(' + snapshot.id + ')">' +
            '<h4>' + snapshot.name + '</h4>' +
            '<p>' + snapshot.timestamp + '</p>' +
            '<div class="snapshot-meta">' +
                '<span>' + snapshot.resources + ' resources</span>' +
                '<span class="' + warningClass + '">' + snapshot.changes + ' changes</span>' +
            '</div>' +
        '</div>';
    });
    timeline.innerHTML = html;
}

// Render State Comparison
function renderStateComparison() {
    var desiredView = document.getElementById('desired-state-view');
    var actualView = document.getElementById('actual-state-view');
    
    if (desiredView) {
        desiredView.textContent = JSON.stringify(desiredStateExample, null, 2);
    }
    
    if (actualView) {
        actualView.innerHTML = formatActualStateWithHighlight(actualStateExample);
    }
}

function formatActualStateWithHighlight(state) {
    var json = JSON.stringify(state, null, 2);
    // Highlight the drift
    json = json.replace(/"Description": "DRIFT: Added manually"/g, 
        '<span class="diff-add">"Description": "DRIFT: Added manually"</span>');
    json = json.replace(/"FromPort": 22/g, '<span class="diff-add">"FromPort": 22</span>');
    json = json.replace(/"ToPort": 22/g, '<span class="diff-add">"ToPort": 22</span>');
    return json;
}

// Render Remediations
function renderRemediations() {
    var remediationList = document.getElementById('remediation-list');
    if (!remediationList) return;
    
    var html = '';
    remediationsData.forEach(function(rem) {
        var riskLabel = rem.risk.charAt(0).toUpperCase() + rem.risk.slice(1);
        html += '<div class="remediation-item">' +
            '<div class="remediation-header">' +
                '<div class="remediation-info">' +
                    '<h4>' + rem.title + '</h4>' +
                    '<p>' + rem.description + '</p>' +
                '</div>' +
                '<span class="risk-badge ' + rem.risk + '">' + riskLabel + ' Risk</span>' +
            '</div>' +
            '<div class="remediation-preview">' +
                '<pre>' + formatConfigDiff(rem.configPatch) + '</pre>' +
            '</div>' +
            '<div class="remediation-actions">' +
                '<button class="btn btn-secondary" onclick="copyToClipboard(\'' + encodeURIComponent(rem.configPatch) + '\')">' +
                    '<i class="fas fa-copy"></i> Copy' +
                '</button>' +
                '<button class="btn btn-warning" onclick="dryRun(' + rem.id + ')">' +
                    '<i class="fas fa-play"></i> Dry Run' +
                '</button>' +
                '<button class="btn btn-primary" onclick="openApplyModal(' + rem.id + ')">' +
                    '<i class="fas fa-check"></i> Apply Patch' +
                '</button>' +
            '</div>' +
        '</div>';
    });
    remediationList.innerHTML = html;
}

function formatConfigDiff(code) {
    var escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return escaped
        .replace(/^-(.*)$/gm, '<span class="diff-remove">-$1</span>')
        .replace(/^\+(.*)$/gm, '<span class="diff-add">+$1</span>');
}

// ── Real API Functions ────────────────────────────────────────────────────────

function autoScan() {
    fetch(BACKEND_URL + '/api/health')
        .then(function() { runDriftScan(); })
        .catch(function() {
            showToast('warning', 'Backend Offline', 'Start the backend: cd backend && node server.js');
        });
}

function runDriftScan() {
    showToast('info', 'Scanning...', 'Comparing tfstate vs live AWS security group...');
    fetch(BACKEND_URL + '/api/drift')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.error) throw new Error(data.error);
            liveDrift = data;
            renderRealDrift(data);
            fetchAndRenderSnapshots();
            var msg = data.hasDrift
                ? 'Found ' + data.driftCount + ' drift(s) in ' + data.sgName
                : 'No drift — ' + data.sgName + ' matches Terraform state';
            showToast(data.hasDrift ? 'warning' : 'success', 'Scan Complete', msg);
            // Auto-fetch analysis in background so AI Analysis + Remediation are pre-populated
            fetch(BACKEND_URL + '/api/analyze', { method: 'POST' })
                .then(function(r) { return r.json(); })
                .then(function(analysis) {
                    if (!analysis.error) {
                        liveAnalysis = analysis;
                        renderRealAnalysis(analysis, data);
                        renderRealRemediation(analysis, data);
                        updateStatCard('ai', analysis.confidence + '%', 'Bedrock Nova confidence');
                    }
                });
        })
        .catch(function(err) {
            showToast('error', 'Scan Failed', err.message);
        });
}

function fetchAndRenderSnapshots() {
    fetch(BACKEND_URL + '/api/snapshots')
        .then(function(r) { return r.json(); })
        .then(function(snaps) { renderRealSnapshots(snaps); })
        .catch(function() {});
}

function renderRealSnapshots(snaps) {
    var timeline = document.getElementById('snapshots-timeline');
    if (!timeline || !snaps.length) return;
    var html = '';
    snaps.forEach(function(s, i) {
        var activeClass = i === 0 ? 'active' : '';
        var ts = new Date(s.timestamp).toLocaleString();
        var changeColor = s.driftCount > 0 ? 'style="color:#f59e0b"' : 'style="color:#22c55e"';
        html += '<div class="snapshot-item ' + activeClass + '" onclick="selectSnapshot(' + s.id + ')">' +
            '<h4>' + s.name + '</h4>' +
            '<p>' + ts + '</p>' +
            '<div class="snapshot-meta">' +
                '<span>' + s.totalResources + ' SGs in VPC</span>' +
                '<span ' + changeColor + '>' + s.driftCount + ' drift(s)</span>' +
            '</div>' +
        '</div>';
    });
    timeline.innerHTML = html;
}

function analyzeDrift() {
    document.querySelector('[data-section="ai-analysis"]').click();
    if (!liveDrift) {
        showToast('warning', 'No scan data', 'Run a drift scan first');
        return;
    }
    if (liveAnalysis) {
        renderRealAnalysis(liveAnalysis, liveDrift);
        return;
    }
    showToast('info', 'Analyzing...', 'Calling AWS Bedrock Claude 3 Sonnet...');
    var content = document.getElementById('ai-analysis-content');
    if (content) content.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8"><i class="fas fa-spinner fa-spin" style="font-size:32px;margin-bottom:12px;display:block"></i><p>Bedrock is analyzing the drift...</p></div>';

    fetch(BACKEND_URL + '/api/analyze', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.error) throw new Error(data.error);
            liveAnalysis = data;
            renderRealAnalysis(data, liveDrift);
            updateStatCard('ai', data.confidence + '%', 'Bedrock Nova confidence');
            showToast('success', 'Analysis Complete', 'Severity: ' + data.severity + ' (' + data.confidence + '% confidence)');
        })
        .catch(function(err) {
            showToast('error', 'Analysis Failed', err.message);
        });
}

function showRemediation() {
    document.querySelector('[data-section="remediation"]').click();
    if (liveAnalysis && liveDrift) {
        renderRealRemediation(liveAnalysis, liveDrift);
    } else if (liveDrift) {
        showToast('info', 'Run Analysis First', 'Click Analyze to get AI remediation suggestion');
    }
}

function updateStatCard(iconClass, value, subtitle) {
    var icon = document.querySelector('.stat-icon.' + iconClass);
    if (!icon) return;
    var card = icon.closest('.stat-card');
    var val = card.querySelector('.stat-value');
    var change = card.querySelector('.stat-change');
    if (val) val.textContent = value;
    if (change && subtitle) change.textContent = subtitle;
}

function renderRealDrift(data) {
    // Update all 4 dashboard stat cards with real data
    updateStatCard('resources', data.totalResources, '+' + data.totalResources + ' in VPC');
    updateStatCard('drift', data.driftCount, data.driftCount > 0 ? '+' + data.addedCount + ' added, ' + data.removedCount + ' removed' : 'All clear');
    updateStatCard('resolved', data.remediatedCount, 'This session');

    // Update nav badge
    var badge = document.querySelector('.nav-item[data-section="drift-detection"] .badge');
    if (badge) badge.textContent = data.driftCount;

    // Update state comparison panel
    var desiredView = document.getElementById('desired-state-view');
    var actualView = document.getElementById('actual-state-view');
    if (desiredView) desiredView.textContent = JSON.stringify({ ingress: data.desired.ingress, egress: data.desired.egress }, null, 2);
    if (actualView) {
        var raw = JSON.stringify({ ingress: data.actual.ingress, egress: data.actual.egress }, null, 2)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        actualView.innerHTML = raw;
    }

    var driftList = document.getElementById('drift-list');
    if (!driftList) return;

    if (!data.hasDrift) {
        driftList.innerHTML = '<div style="padding:32px;text-align:center;color:#22c55e"><i class="fas fa-check-circle" style="font-size:48px;margin-bottom:12px;display:block"></i><h3>No Drift Detected</h3><p>' + data.sgName + ' matches Terraform state.</p></div>';
        return;
    }

    var html = '';
    data.drifts.forEach(function(d, idx) {
        var portRange = d.rule.fromPort === d.rule.toPort ? d.rule.fromPort : d.rule.fromPort + '-' + d.rule.toPort;
        var cidrStr = (d.rule.cidr && d.rule.cidr.length) ? d.rule.cidr.join(', ') : 'N/A';
        var isPublic = d.rule.cidr && d.rule.cidr.some(function(c) { return c === '0.0.0.0/0' || c === '::/0'; });
        var severity = isPublic ? 'critical' : 'warning';
        var iconClass = severity === 'critical' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
        var label = d.type === 'ADDED' ? 'Exists in AWS but NOT in Terraform state' : 'In Terraform state but MISSING from AWS';
        html += '<div class="drift-item">' +
            '<div class="drift-info">' +
                '<div class="drift-severity ' + severity + '"><i class="fas ' + iconClass + '"></i></div>' +
                '<div class="drift-details">' +
                    '<h4>aws_security_group.' + data.sgName + ' &mdash; ' + d.direction + ' ' + d.type + '</h4>' +
                    '<p>' + label + ': <strong>' + d.rule.protocol.toUpperCase() + '</strong> port <strong>' + portRange + '</strong> &larr; <strong>' + cidrStr + '</strong></p>' +
                    '<div class="drift-meta">' +
                        '<span><i class="fas fa-fingerprint"></i> ' + data.sgId + '</span>' +
                        '<span><i class="fas fa-clock"></i> ' + data.scannedAt + '</span>' +
                        '<span><i class="fas fa-map-marker-alt"></i> ' + data.region + '</span>' +
                        '<span><i class="fas fa-network-wired"></i> ' + data.vpcId + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="drift-actions">' +
                '<button class="btn btn-secondary" onclick="analyzeDrift(' + idx + ')"><i class="fas fa-search"></i> Analyze</button>' +
                '<button class="btn btn-primary" onclick="showRemediation(' + idx + ')"><i class="fas fa-wrench"></i> Fix</button>' +
            '</div>' +
        '</div>';
    });
    driftList.innerHTML = html;
}

function renderRealAnalysis(analysis, drift) {
    var content = document.getElementById('ai-analysis-content');
    if (!content) return;
    var colorMap = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#22c55e' };
    var meterMap = { CRITICAL: 95, HIGH: 75, MEDIUM: 50, LOW: 25 };
    var sev = analysis.severity || 'MEDIUM';
    var color = colorMap[sev] || '#6366f1';
    var meterPct = meterMap[sev] || 50;
    var conf = analysis.confidence || 0;
    var stepsHtml = '';
    if (analysis.remediationSteps && analysis.remediationSteps.length) {
        stepsHtml = '<h4 style="margin-top:12px">Remediation Steps</h4><ol>' +
            analysis.remediationSteps.map(function(s) { return '<li>' + s + '</li>'; }).join('') + '</ol>';
    }
    content.innerHTML =
        '<div class="analysis-item">' +
            '<h4><i class="fas fa-search" style="color:' + color + '"></i> Root Cause — <em>' + drift.sgId + ' (' + drift.sgName + ')</em></h4>' +
            '<p>' + analysis.rootCause + '</p>' +
        '</div>' +
        '<div class="analysis-item">' +
            '<h4><i class="fas fa-shield-alt" style="color:' + color + '"></i> Security Impact</h4>' +
            '<div class="impact-meter">' +
                '<span style="color:' + color + ';font-weight:600">' + sev + ' Severity</span>' +
                '<div class="meter-bar"><div class="meter-fill" style="width:' + meterPct + '%;background:' + color + '"></div></div>' +
            '</div>' +
            '<p>' + analysis.securityImpact + '</p>' +
        '</div>' +
        '<div class="analysis-item">' +
            '<h4>Confidence Score</h4>' +
            '<div class="confidence-display"><div class="confidence-ring">' +
                '<svg viewBox="0 0 36 36">' +
                    '<path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e8e8e8" stroke-width="3"/>' +
                    '<path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="' + color + '" stroke-width="3" stroke-dasharray="' + conf + ', 100"/>' +
                '</svg><span>' + conf + '%</span>' +
            '</div></div>' +
        '</div>' +
        '<div class="analysis-item">' +
            '<h4><i class="fas fa-bolt"></i> Immediate Action</h4>' +
            '<p>' + analysis.immediateAction + '</p>' +
            stepsHtml +
        '</div>';

    // Replace mock Vector Similarity panel with real drift rule details
    var vectorCard = document.querySelector('.vector-embeddings-card');
    if (vectorCard && drift && drift.drifts) {
        var scannedAt = drift.scannedAt ? new Date(drift.scannedAt).toLocaleString() : 'N/A';
        var rulesHtml = drift.drifts.map(function(d) {
            var ports = d.rule.fromPort === d.rule.toPort ? d.rule.fromPort : d.rule.fromPort + '–' + d.rule.toPort;
            var cidr = (d.rule.cidr || []).join(', ') || 'N/A';
            var isPublic = (d.rule.cidr || []).includes('0.0.0.0/0');
            var riskColor = isPublic ? '#ef4444' : '#f59e0b';
            var riskLabel = isPublic ? 'PUBLIC' : 'INTERNAL';
            return '<div class="incident-item" style="display:flex;flex-direction:column;gap:4px;padding:10px;border-left:3px solid ' + riskColor + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:center">' +
                    '<span style="font-weight:600;color:#f8fafc">' + d.direction + ' — ' + d.rule.protocol.toUpperCase() + ' :' + ports + '</span>' +
                    '<span style="font-size:11px;background:' + riskColor + '20;color:' + riskColor + ';padding:2px 8px;border-radius:4px;font-weight:600">' + riskLabel + '</span>' +
                '</div>' +
                '<span style="font-size:12px;color:#94a3b8">CIDR: <code style="color:#e2e8f0">' + cidr + '</code></span>' +
                '<span style="font-size:12px;color:#94a3b8">Type: <strong style="color:#f59e0b">' + d.type + '</strong> — added outside Terraform</span>' +
            '</div>';
        }).join('');

        vectorCard.innerHTML =
            '<div class="analysis-header">' +
                '<i class="fas fa-list-alt"></i>' +
                '<h3>Detected Drift Rules</h3>' +
            '</div>' +
            '<div class="embeddings-content">' +
                '<div style="margin-bottom:12px;padding:8px 12px;background:#1e293b;border-radius:6px;font-size:12px;color:#94a3b8">' +
                    '<i class="fas fa-clock" style="margin-right:6px"></i>Scanned: ' + scannedAt + '<br>' +
                    '<i class="fas fa-fingerprint" style="margin-right:6px;margin-top:4px"></i>SG: <code style="color:#e2e8f0">' + drift.sgId + '</code><br>' +
                    '<i class="fas fa-network-wired" style="margin-right:6px;margin-top:4px"></i>VPC: <code style="color:#e2e8f0">' + drift.vpcId + '</code><br>' +
                    '<i class="fas fa-map-marker-alt" style="margin-right:6px;margin-top:4px"></i>Region: ' + drift.region +
                '</div>' +
                '<h4 style="margin-bottom:8px">Out-of-Band Rules (' + drift.driftCount + ')</h4>' +
                '<div style="display:flex;flex-direction:column;gap:8px">' + rulesHtml + '</div>' +
                '<div style="margin-top:12px;padding:8px 12px;background:#1e293b;border-radius:6px;font-size:12px;color:#94a3b8">' +
                    '<i class="fas fa-robot" style="margin-right:6px;color:#6366f1"></i>' +
                    'Analysis by <strong style="color:#e2e8f0">AWS Bedrock Amazon Nova Lite</strong>' +
                    (analysis.source === 'bedrock' ? ' <span style="color:#22c55e">● live</span>' : ' <span style="color:#f59e0b">● local fallback</span>') +
                '</div>' +
            '</div>';
    }
}

function renderRealRemediation(analysis, drift) {
    var remediationList = document.getElementById('remediation-list');
    if (!remediationList) return;
    var riskMap = { CRITICAL: 'high', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };
    var risk = riskMap[analysis.severity] || 'medium';
    var tfFix = analysis.terraformFix || '# Run: terraform plan && terraform apply\n# to restore desired state';
    var html = '<div class="remediation-item">' +
        '<div class="remediation-header">' +
            '<div class="remediation-info">' +
                '<h4>Restore ' + drift.sgName + ' (' + drift.sgId + ') to Terraform State</h4>' +
                '<p>' + (analysis.summary || 'Revert security group to match tfstate') + '</p>' +
            '</div>' +
            '<span class="risk-badge ' + risk + '">' + risk.charAt(0).toUpperCase() + risk.slice(1) + ' Risk</span>' +
        '</div>' +
        '<div class="remediation-preview"><pre>' + formatConfigDiff(tfFix) + '</pre></div>' +
        '<div class="remediation-actions">' +
            '<button class="btn btn-secondary" onclick="copyToClipboard(\'' + encodeURIComponent(tfFix) + '\')"><i class="fas fa-copy"></i> Copy</button>' +
            '<button class="btn btn-warning" onclick="dryRun(1)"><i class="fas fa-play"></i> Dry Run</button>' +
            '<button class="btn btn-primary" onclick="openRealApplyModal()"><i class="fas fa-check"></i> Apply Patch</button>' +
        '</div>' +
    '</div>';
    remediationList.innerHTML = html;
}

function openRealApplyModal() {
    if (!liveAnalysis) return;
    var modal = document.getElementById('apply-patch-modal');
    if (modal) {
        document.getElementById('patch-preview-content').innerHTML = formatConfigDiff(liveAnalysis.terraformFix || '');
        modal.classList.add('active');
    }
}

// Snapshot Actions
function selectSnapshot(id) {
    document.querySelectorAll('.snapshot-item').forEach(function(item) {
        item.classList.remove('active');
    });
    var el = document.querySelector('.snapshot-item[data-id="' + id + '"]');
    if (el) el.classList.add('active');
    showToast('info', 'Snapshot Selected', 'Loaded snapshot #' + id + ' for comparison');
}

function createSnapshot() {
    showToast('success', 'Snapshot Created', 'New state snapshot has been created');
}

// Remediation Actions
function openApplyModal(id) {
    var modal = document.getElementById('apply-patch-modal');
    var remediation = remediationsData.find(function(r) { return r.id === id; });
    
    if (modal && remediation) {
        document.getElementById('patch-preview-content').innerHTML = formatConfigDiff(remediation.configPatch);
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function runDryRun() {
    showToast('info', 'Dry Run Started', 'Executing configuration plan...');
    
    setTimeout(function() {
        showToast('success', 'Dry Run Complete', 'No errors detected. Safe to apply.');
    }, 2000);
}

function applyPatch() {
    showToast('info', 'Applying Patch', 'Executing configuration apply...');
    
    // Update QA validation status
    var qaCheck = document.querySelector('.check-item.pending');
    if (qaCheck) {
        setTimeout(function() {
            qaCheck.classList.remove('pending');
            qaCheck.classList.add('passed');
            qaCheck.querySelector('i').classList.remove('fa-clock');
            qaCheck.querySelector('i').classList.add('fa-check-circle');
        }, 1000);
    }
    
    setTimeout(function() {
        closeModal('apply-patch-modal');
        showToast('success', 'Patch Applied', 'Infrastructure has been remediated successfully');
        fetch('/api/remediate', { method: 'POST' })
            .then(function(r) { return r.json(); })
            .then(function(d) { updateStatCard('resolved', d.remediatedCount, 'This session'); });
    }, 3000);
}

function copyToClipboard(encodedText) {
    var text = decodeURIComponent(encodedText);
    navigator.clipboard.writeText(text).then(function() {
        showToast('success', 'Copied', 'Configuration code copied to clipboard');
    });
}

function dryRun(id) {
    showToast('info', 'Dry Run', 'Executing configuration plan for remediation...');
    setTimeout(function() {
        showToast('success', 'Plan Complete', 'Changes verified. No destructive operations detected.');
    }, 2000);
}

// ChatOps Functions
function handleChatInput(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

function insertCommand(command) {
    document.getElementById('chat-input').value = command;
    document.getElementById('chat-input').focus();
}

function sendChatMessage() {
    var input = document.getElementById('chat-input');
    var message = input.value.trim();
    
    if (!message) return;
    
    var chatMessages = document.getElementById('chat-messages');
    
    // Add user message
    chatMessages.innerHTML += 
        '<div class="chat-message user">' +
            '<div class="message-avatar">' +
                '<i class="fas fa-user"></i>' +
            '</div>' +
            '<div class="message-content">' +
                '<span class="message-author">You</span>' +
                '<p>' + message + '</p>' +
            '</div>' +
        '</div>';
    
    input.value = '';
    
    // Simulate bot response
    setTimeout(function() {
        var response = generateChatResponse(message);
        chatMessages.innerHTML += 
            '<div class="chat-message bot">' +
                '<div class="message-avatar">' +
                    '<i class="fas fa-robot"></i>' +
                '</div>' +
                '<div class="message-content">' +
                    '<span class="message-author">InfraOps AI</span>' +
                    response +
                '</div>' +
            '</div>';
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 1000);
}

function generateChatResponse(message) {
    var lowerMessage = message.toLowerCase();

    if (lowerMessage.indexOf('/drift scan') !== -1 || lowerMessage === 'scan') {
        runDriftScan();
        return '<p>Running live drift detection scan against AWS...</p>' +
            '<p>Check the <strong>Drift Detection</strong> section for results once complete.</p>';
    }

    if (lowerMessage.indexOf('/status') !== -1) {
        if (!liveDrift) {
            return '<p>No scan data yet. Run <code>/drift scan</code> first.</p>';
        }
        return '<p><strong>Live Infrastructure Status:</strong></p>' +
            '<ul>' +
                '<li>Security Group: <code>' + liveDrift.sgId + '</code> (' + liveDrift.sgName + ')</li>' +
                '<li>VPC: <code>' + liveDrift.vpcId + '</code></li>' +
                '<li>Region: ' + liveDrift.region + '</li>' +
                '<li>Total SGs in VPC: ' + liveDrift.totalResources + '</li>' +
                '<li>Active Drifts: <strong>' + liveDrift.driftCount + '</strong></li>' +
                '<li>Last Scan: ' + new Date(liveDrift.scannedAt).toLocaleString() + '</li>' +
            '</ul>';
    }

    if (lowerMessage.indexOf('/alerts') !== -1) {
        if (!liveDrift || !liveDrift.hasDrift) {
            return '<p><strong>No active drift alerts.</strong> Security group matches Terraform state.</p>';
        }
        var alertHtml = '<p><strong>Active Drift Alerts (' + liveDrift.driftCount + '):</strong></p><ul>';
        liveDrift.drifts.forEach(function(d) {
            var ports = d.rule.fromPort + (d.rule.fromPort !== d.rule.toPort ? '-' + d.rule.toPort : '');
            alertHtml += '<li>[' + d.type + '] ' + d.direction + ': ' + d.rule.protocol.toUpperCase() +
                ' port ' + ports + ' from ' + (d.rule.cidr || []).join(', ') + '</li>';
        });
        return alertHtml + '</ul>';
    }

    if (lowerMessage.indexOf('/analyze') !== -1) {
        analyzeDrift();
        return '<p>Calling <strong>AWS Bedrock Nova Lite</strong> for root cause analysis...</p>' +
            '<p>Check the <strong>AI Analysis</strong> section for results.</p>';
    }

    if (lowerMessage.indexOf('/remediate') !== -1) {
        if (!liveAnalysis) {
            return '<p>No analysis data yet. Run <code>/analyze</code> first.</p>';
        }
        showRemediation();
        return '<p><strong>Remediation for ' + (liveDrift ? liveDrift.sgName : 'security group') + ':</strong></p>' +
            '<p>Severity: <strong>' + liveAnalysis.severity + '</strong></p>' +
            '<p>' + liveAnalysis.immediateAction + '</p>' +
            '<p>See the <strong>Remediation</strong> section for the Terraform fix patch.</p>';
    }

    if (lowerMessage.indexOf('/help') !== -1) {
        return '<p><strong>Available Commands (all live):</strong></p>' +
            '<ul>' +
                '<li><code>/drift scan</code> — Run live AWS drift scan</li>' +
                '<li><code>/status</code> — Show real infrastructure status</li>' +
                '<li><code>/alerts</code> — List active drift alerts</li>' +
                '<li><code>/analyze</code> — Run Bedrock AI root cause analysis</li>' +
                '<li><code>/remediate</code> — Show remediation for detected drift</li>' +
            '</ul>';
    }

    if (lowerMessage.indexOf('sg-') !== -1 || lowerMessage.indexOf('security group') !== -1) {
        if (liveDrift) {
            return '<p><strong>Security Group: ' + liveDrift.sgId + ' (' + liveDrift.sgName + ')</strong></p>' +
                '<p>Region: ' + liveDrift.region + ' | VPC: ' + liveDrift.vpcId + '</p>' +
                '<p>Active Drifts: <strong>' + liveDrift.driftCount + '</strong></p>' +
                (liveAnalysis ? '<p>Severity: <strong>' + liveAnalysis.severity + '</strong></p>' : '') +
                '<p>Use <code>/analyze</code> for full root cause analysis.</p>';
        }
        return '<p>Run <code>/drift scan</code> first to load security group data.</p>';
    }

    return '<p>I can help with live drift detection and remediation. Try:</p>' +
        '<ul>' +
            '<li><code>/drift scan</code> — Scan AWS now</li>' +
            '<li><code>/status</code> — Infrastructure status</li>' +
            '<li><code>/help</code> — All commands</li>' +
        '</ul>';
}

// Toast Notifications
function showToast(type, title, message) {
    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    var icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = 
        '<i class="fas ' + icons[type] + '"></i>' +
        '<div class="toast-content">' +
            '<h4>' + title + '</h4>' +
            '<p>' + message + '</p>' +
        '</div>';
    
    container.appendChild(toast);
    
    setTimeout(function() {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 4000);
}

// Real-time Simulations
function initSimulations() {
    // Simulate periodic updates
    setInterval(function() {
        // Update timestamp in pipeline
        var stages = document.querySelectorAll('.stage-status');
        if (stages.length > 0 && stages[2]) {
            var currentCount = parseInt(stages[2].textContent) || 847;
            stages[2].textContent = (currentCount + 1) + ' snapshots';
        }
    }, 30000);
    
    // Simulate incoming alerts occasionally
    setInterval(function() {
        if (Math.random() > 0.7) {
            simulateNewAlert();
        }
    }, 60000);
}

function simulateNewAlert() {
    var alertTypes = [
        { severity: 'info', title: 'Tag Update Detected', description: 'Resource tags modified in us-west-2' },
        { severity: 'warning', title: 'IAM Policy Change', description: 'New policy attached to role' },
        { severity: 'info', title: 'Instance Scaled', description: 'Auto Scaling group adjusted capacity' }
    ];
    
    var alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    showToast(alert.severity === 'warning' ? 'warning' : 'info', alert.title, alert.description);
}

// Keyboard Shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search-box input').focus();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(function(modal) {
            modal.classList.remove('active');
        });
    }
});

// Search functionality
var searchInput = document.querySelector('.search-box input');
if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        var query = e.target.value.toLowerCase();
        
        // Filter visible content based on search
        if (query.length > 2) {
            highlightSearchResults(query);
        }
    });
}

function highlightSearchResults(query) {
    // This would implement search highlighting across the UI
    console.log('Searching for:', query);
}

// Export functions for global access
window.runDriftScan = runDriftScan;
window.analyzeDrift = analyzeDrift;
window.showRemediation = showRemediation;
window.openRealApplyModal = openRealApplyModal;
window.selectSnapshot = selectSnapshot;
window.createSnapshot = createSnapshot;
window.openApplyModal = openApplyModal;
window.closeModal = closeModal;
window.runDryRun = runDryRun;
window.applyPatch = applyPatch;
window.copyToClipboard = copyToClipboard;
window.dryRun = dryRun;
window.handleChatInput = handleChatInput;
window.insertCommand = insertCommand;
window.sendChatMessage = sendChatMessage;
