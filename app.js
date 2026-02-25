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
});

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
        html += '<div class="snapshot-item ' + activeClass + '" onclick="selectSnapshot(' + snapshot.id + ')">' +
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

// Drift Actions
function runDriftScan() {
    showToast('info', 'Scanning...', 'Running drift detection scan across all resources');
    
    // Simulate scanning
    setTimeout(function() {
        showToast('success', 'Scan Complete', 'Found 3 resources with drift');
    }, 2000);
}

function analyzeDrift(id) {
    // Navigate to AI Analysis section
    document.querySelector('[data-section="ai-analysis"]').click();
    showToast('info', 'Analyzing...', 'AI is analyzing the root cause of this drift');
}

function showRemediation(id) {
    document.querySelector('[data-section="remediation"]').click();
}

// Snapshot Actions
function selectSnapshot(id) {
    document.querySelectorAll('.snapshot-item').forEach(function(item) {
        item.classList.remove('active');
    });
    event.target.closest('.snapshot-item').classList.add('active');
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
        
        // Update drift count
        var driftBadge = document.querySelector('.nav-item[data-section="drift-detection"] .badge');
        if (driftBadge) {
            var currentCount = parseInt(driftBadge.textContent);
            driftBadge.textContent = Math.max(0, currentCount - 1);
        }
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
    
    if (lowerMessage.indexOf('/drift scan') !== -1 || lowerMessage.indexOf('scan') !== -1) {
        return '<p>Running drift detection scan...</p>' +
            '<p>Scan complete! Found <strong>3 resources</strong> with drift:</p>' +
            '<ul>' +
                '<li><code>security_group.web_sg</code> - Critical</li>' +
                '<li><code>storage_bucket_policy.app_policy</code> - Warning</li>' +
                '<li><code>iam_role.function_exec</code> - Warning</li>' +
            '</ul>' +
            '<p>Would you like me to analyze these or suggest remediations?</p>';
    }
    
    if (lowerMessage.indexOf('/status') !== -1 || lowerMessage.indexOf('status') !== -1) {
        return '<p><strong>Current Infrastructure Status:</strong></p>' +
            '<ul>' +
                '<li>Total Resources: 247</li>' +
                '<li>Active Drifts: 3</li>' +
                '<li>Last Scan: 5 minutes ago</li>' +
                '<li>Cloud Connection: Connected</li>' +
                '<li>IaC State: Synced</li>' +
            '</ul>';
    }
    
    if (lowerMessage.indexOf('/alerts') !== -1 || lowerMessage.indexOf('alert') !== -1) {
        return '<p><strong>Recent Alerts:</strong></p>' +
            '<ul>' +
                '<li>Security Group Modified (5 min ago)</li>' +
                '<li>Storage Bucket Policy Changed (23 min ago)</li>' +
                '<li>Compute Instance Tags Updated (1 hour ago)</li>' +
            '</ul>';
    }
    
    if (lowerMessage.indexOf('/remediate') !== -1) {
        return '<p><strong>Available Remediations:</strong></p>' +
            '<ul>' +
                '<li>1. Revert Security Group sg-0abc123 (Low Risk)</li>' +
                '<li>2. Fix Storage Bucket Policy (Medium Risk)</li>' +
                '<li>3. Detach Excessive IAM Policy (High Risk)</li>' +
            '</ul>' +
            '<p>Run <code>/remediate [1-3]</code> to apply a specific fix.</p>';
    }
    
    if (lowerMessage.indexOf('/policy') !== -1 || lowerMessage.indexOf('policy check') !== -1) {
        return '<p><strong>Policy Compliance Status:</strong></p>' +
            '<ul>' +
                '<li>No Public Storage Buckets - Compliant</li>' +
                '<li>Encrypted Storage Volumes - 2 violations</li>' +
                '<li>No Wide Open Security Groups - 1 violation</li>' +
                '<li>Required Tags - 58 violations (disabled)</li>' +
            '</ul>';
    }
    
    if (lowerMessage.indexOf('/help') !== -1) {
        return '<p><strong>Available Commands:</strong></p>' +
            '<ul>' +
                '<li><code>/drift scan</code> - Run a drift detection scan</li>' +
                '<li><code>/status</code> - Show infrastructure status</li>' +
                '<li><code>/alerts</code> - List recent alerts</li>' +
                '<li><code>/remediate</code> - Show available remediations</li>' +
                '<li><code>/policy check</code> - Check policy compliance</li>' +
                '<li><code>/analyze [resource]</code> - Analyze specific resource</li>' +
            '</ul>' +
            '<p>You can also ask questions in natural language!</p>';
    }
    
    if (lowerMessage.indexOf('analyze') !== -1 || lowerMessage.indexOf('sg-') !== -1) {
        return '<p><strong>AI Analysis for sg-0abc123:</strong></p>' +
            '<p><strong>Root Cause:</strong> Manual modification via Cloud Console</p>' +
            '<p><strong>Changed By:</strong> admin@example.com at 2024-02-17 05:32:14 UTC</p>' +
            '<p><strong>Impact:</strong> High - Exposes SSH port to public internet</p>' +
            '<p><strong>Recommendation:</strong> Immediate remediation recommended. Run <code>/remediate 1</code> to fix.</p>';
    }
    
    return '<p>I understand you are asking about: "' + message + '"</p>' +
        '<p>I can help you with drift detection, analysis, and remediation. Try these commands:</p>' +
        '<ul>' +
            '<li><code>/drift scan</code> - Scan for drift</li>' +
            '<li><code>/status</code> - Check status</li>' +
            '<li><code>/help</code> - See all commands</li>' +
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
