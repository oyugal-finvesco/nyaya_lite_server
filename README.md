# nyaya_lite_server

🏗 Architecture & Tech Stack

Backend (Node.js)

Framework: Express.js with a Layered Architecture (Routes → Controllers → Services → Data Access Layer).
Database: MySQL 8.0 with a normalized schema where the Firm is the root custodian of all data.
Security:

Bcrypt for password hashing (salt rounds: 10).
JWT authentication with configurable expiration.
Role-Based Access Control (RBAC): Juniors see only their assigned tasks; Seniors have broader visibility.
Audit Logging: Every write action (document upload, status change) triggers an immutable entry in the audit_logs table with actor ID, timestamp, action type, and affected entity.


API Endpoints:

POST /api/auth/login - Authenticate and return JWT
GET /api/tasks/:case_id - Fetch tasks with role-based filtering
POST /api/upload - Secure document upload with case binding


Storage:

Prototype: Local disk storage (simulated S3) for easy reviewer testing.
Production Strategy: See Section 3 below for the AWS implementation plan.

**AWS & Architecture Strategy**

While this prototype uses local storage for simplicity, the production environment is designed to deploy on AWS with the following "Audit-Ready" security configuration:
**1. Secure Document Storage (S3 + KMS)**
To strictly adhere to the "Legal Custodian" requirement and ensure encryption-at-rest, we implement a multi-layered security approach using Amazon S3 with Server-Side Encryption via AWS KMS (SSE-KMS).
**Architecture**:

**Encryption-at-Rest:**  SSE-KMS with customer-managed keys (CMK) provides explicit control over encryption keys, unlike standard S3-managed encryption.

**Key Management:**

    * Separate CMKs per firm to ensure complete data isolation
    * Key rotation enabled automatically every 365 days
    * Key usage policies restrict decryption to specific IAM roles


**Audit Trail:** AWS CloudTrail captures every key usage event, providing forensic evidence of:

    * Who accessed the encryption key
    * When the decryption occurred
    * Which document was accessed 
    * Source IP and user agent


**Access Control Implementation:**

    * All S3 buckets configured with Block Public Access enabled
    * Bucket policies enforce encryption-in-transit (HTTPS only)
    * Node.js backend generates time-limited Presigned URLs (5-minute expiration) after validating:
           1) User authentication (valid JWT)
           2) Case ownership verification
           3) Role-based permissions
    * Presigned URLs use SigV4 authentication with temporary security credentials

**Bucket Structure:**

nyaya-production/
├── {firm_id}/
│   ├── {case_id}/
│   │   ├── evidence/
│   │   └── correspondence/



**2. Automated Malware Scanning Pipeline**
We implement a "Quarantine-Scan-Promote" pattern to protect the legal vault from malicious uploads while maintaining user experience:
**Pipeline Architecture:**

1) Upload Phase:

   * Flutter app uploads to nyaya-quarantine bucket (separate from production)
   * Database record created with status: PENDING_SCAN
   * User receives immediate acknowledgment but document is not yet accessible


2) Scanning Phase:

   * S3 Event Notification triggers on object creation
   * AWS Lambda function invokes scanning service (two options):
     Option A: AWS GuardDuty Malware Protection
          1) Managed service with automatic signature updates
          2) Scans against 200+ million malware signatures
          3) Results available within 1-2 minutes

      Option B: Custom Lambda with ClamAV
          1) Open-source antivirus engine
          2) Lambda container (4GB memory) with updated virus definitions
          3) Definitions refreshed daily via automated S3 sync
          4) More cost-effective for high-volume scenarios

3) Verdict Handling:
If Clean:
   * File atomically moved to nyaya-production bucket with proper path structure
   * Database status updated to ACTIVE with scan metadata
   * Amazon SNS notification sent to user: "Document ready for review"
   * Original quarantine file deleted

If Infected:
  * File immediately deleted from quarantine
  * Database status set to REJECTED with threat details
  * Critical Alert sent via SNS to:
        1) Firm Administrator
        2) Compliance Officer
        3) Upload initiator (user)
  * Incident logged in security monitoring system


4) Timeout Handling:
    * Lambda timeout: 5 minutes maximum
    * If scan exceeds timeout, mark as SCAN_FAILED 
    * Manual review queue created for administrators

**3. Feature Flags (AWS AppConfig)**
To manage tiered rollouts and enable/disable features dynamically without code deployments, we utilize AWS AppConfig for centralized feature flag management.

Implementation Strategy:

Configuration Structure:
json: {
  "features": {
    "enable_evidence_ocr": {
      "enabled": true,
      "allowed_tiers": ["platinum", "enterprise"],
      "rollout_percentage": 100
    },
    "enable_video_upload": {
      "enabled": true,
      "allowed_tiers": ["gold", "platinum", "enterprise"],
      "rollout_percentage": 50
    },
    "enable_ai_document_summary": {
      "enabled": false,
      "allowed_tiers": ["enterprise"],
      "rollout_percentage": 0
    }
  }
}

Backend Integration:
     1) Node.js middleware checks feature availability before executing feature-specific code
     2) Configuration polled every 60 seconds with local caching for resilience
     3) If AppConfig is unavailable, fail-safe to default conservative permissions

Benefits: 
     1) Instant Rollback: If a feature causes issues, disable it immediately without redeployment
     2) Gradual Rollout: Test features with 10% of users before full release
     3) Tier-Based Access: Platinum firms get advanced features, Basic tier gets core functionality
     4) A/B Testing: Compare feature adoption and user satisfaction across cohorts
     5) Emergency Kill Switch: Critical bugs can be contained in seconds, not hours

Deployment Workflow:
     1) Developer defines new feature flag in AppConfig console
     2) Code deployed with feature-gated logic: if (featureFlags.enable_evidence_ocr) { ... }
     3) Feature initially set to 0% rollout
     4) Gradually increase to 10% → 25% → 50% → 100% while monitoring metrics
     5) If error rate spikes, instant rollback to 0%


