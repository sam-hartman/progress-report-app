# Privacy Impact Assessment

**System:** Quarterly Progress Report Generator  
**Version:** 1.0  
**Date:** April 27, 2026  
**Prepared for:** Montgomery County Public Schools (MCPS), Office of District Technology (ODT)  
**Classification:** Internal Use Only

---

## 1. System Description

The Quarterly Progress Report Generator is a web-based application designed for Maryland elementary school teachers to create narrative student progress reports. Teachers input student observation data and student work images; the system uses Mistral AI to generate draft progress report narratives that teachers review and edit before finalizing.

**Target Users:** MCPS elementary school teachers  
**Deployment:** Vercel (frontend), Fly.io (backend API)  
**AI Provider:** Mistral AI (EU-hosted, Zero Data Retention agreement)

---

## 2. Data Types Collected

| Data Category | Examples | Classification | Storage Location |
|---|---|---|---|
| Student First Names | "Maria", "James" | PII / Education Record | Browser localStorage (encrypted) |
| Teacher Names | Login identity | PII | Browser localStorage (encrypted) |
| School Names | School identifiers | Directory Information | Browser localStorage (encrypted) |
| Student Work Images | Photos of assignments, artwork | Education Record | Server (temporary, 24-hour purge) |
| Generated Reports | AI-drafted narrative text | Education Record | Browser localStorage (encrypted) |
| Session Metadata | Timestamps, session IDs | Operational | Server logs (90-day retention) |
| Consent Records | Teacher consent acknowledgment | Compliance | Browser localStorage (encrypted) |

---

## 3. Data Flow

### 3.1 Input Phase
1. Teacher enters student and class information via the browser interface.
2. Data is stored in encrypted browser localStorage.
3. Teacher uploads student work images through the browser.

### 3.2 Processing Phase
1. Before transmission to the AI provider, all student names are replaced with anonymized tokens (e.g., "Student_A", "Student_B").
2. Anonymized text data and images are transmitted via HTTPS (TLS 1.2+) to the backend server on Fly.io.
3. The backend forwards anonymized prompts to Mistral AI under a Zero Data Retention (ZDR) agreement.
4. Mistral AI processes the request and returns generated text. No input or output data is stored, logged, or used for training by Mistral AI.

### 3.3 Output Phase
1. The backend receives the AI-generated response and forwards it to the browser via HTTPS.
2. The browser re-inserts actual student names in place of anonymized tokens.
3. The teacher reviews, edits, and approves the final report.
4. Approved reports are stored in encrypted browser localStorage.

### 3.4 Deletion Phase
1. Client-side data is automatically purged after 90 days of inactivity.
2. Server-side uploaded images are automatically deleted after 24 hours.
3. Teachers can manually clear all local data at any time.

---

## 4. Privacy Controls Implemented

### 4.1 Name Anonymization
All student names are stripped from data before it is sent to the AI provider. The AI model never receives actual student identifiers. Re-identification occurs only in the teacher's browser after the AI response is received.

### 4.2 Encrypted localStorage
All client-side data is encrypted using AES-256 before being written to the browser's localStorage. Encryption keys are derived per session and are not transmitted to any server.

### 4.3 Zero Data Retention (ZDR)
Mistral AI operates under a contractual Zero Data Retention agreement. API inputs and outputs are not stored, logged, or used for model training. Processing occurs in EU data centers.

### 4.4 Automatic Data Purge
- **Client-side:** All localStorage data is automatically purged after 90 days of inactivity.
- **Server-side:** Uploaded student work images are automatically deleted after 24 hours.

### 4.5 Session Timeout
User sessions expire after 30 minutes of inactivity. Upon timeout, the session is invalidated and the user must re-authenticate.

### 4.6 Consent Collection
Teachers must acknowledge a data handling consent notice before using the application. The consent record is stored locally and includes a timestamp.

### 4.7 Audit Trail
The application maintains an audit log of key actions (report generation, data deletion, consent acknowledgment) for compliance review purposes.

### 4.8 Security Headers
The application enforces the following HTTP security headers on all responses:

| Header | Value | Purpose |
|---|---|---|
| Strict-Transport-Security | max-age=31536000; includeSubDomains | Enforce HTTPS connections |
| X-Content-Type-Options | nosniff | Prevent MIME-type sniffing |
| X-Frame-Options | DENY | Prevent clickjacking via iframes |
| Referrer-Policy | no-referrer | Prevent referrer leakage |
| Permissions-Policy | camera=(self), microphone=() | Restrict browser API access |
| X-XSS-Protection | 1; mode=block | Enable browser XSS filtering |
| Cache-Control (API) | no-store, no-cache, must-revalidate | Prevent caching of API responses |

---

## 5. Data Retention Schedule

| Data Type | Retention Period | Deletion Method |
|---|---|---|
| Student names (client) | 90 days from last activity | Automatic purge + manual clear |
| Generated reports (client) | 90 days from last activity | Automatic purge + manual clear |
| Student work images (server) | 24 hours from upload | Automatic server-side deletion |
| Session data | 30 minutes of inactivity | Automatic session invalidation |
| Consent records (client) | 90 days from last activity | Automatic purge + manual clear |
| Server access logs | 90 days | Automatic log rotation |
| AI provider data | 0 seconds (ZDR) | Never stored by Mistral AI |

---

## 6. Risk Assessment Matrix

| Risk | Likelihood | Impact | Severity | Mitigation |
|---|---|---|---|---|
| Unauthorized access to student data in localStorage | Low | High | Medium | AES-256 encryption, session timeout, browser-only storage |
| Data exposure during AI processing | Very Low | High | Low | Name anonymization, ZDR agreement, HTTPS transport |
| Student work images retained beyond policy | Low | Medium | Low | 24-hour automated deletion, no permanent storage |
| Cross-site scripting (XSS) attack | Low | High | Medium | Security headers, input sanitization, CSP |
| Teacher leaves session unattended | Medium | Medium | Medium | 30-minute session timeout, no persistent login |
| Shared/public computer usage | Medium | High | High | Clear data on logout, session timeout, teacher training |
| Browser localStorage accessible to other tabs | Low | Medium | Low | Origin-scoped storage, encryption at rest |
| Man-in-the-middle interception | Very Low | High | Low | HSTS enforcement, TLS 1.2+ required |
| AI model hallucination in reports | Medium | Medium | Medium | Teacher review required before finalization |

---

## 7. FERPA Compliance Mapping

| FERPA Requirement | Implementation |
|---|---|
| Legitimate educational interest | Teachers use the tool solely for professional report-writing duties |
| School official exception (34 CFR 99.31(a)(1)) | Teacher operates as data controller with direct control over records |
| Direct control over data use | Teacher reviews and approves all generated content; AI output is a draft |
| Data minimization | Only first names and work samples collected; no SSNs, grades, or addresses |
| Third-party processor safeguards | Mistral AI under ZDR agreement; name anonymization before processing |
| Parent notification | School district handles FERPA annual notification per existing policy |
| Record access rights | All data accessible to teacher in-browser; exportable for parent requests |
| Security safeguards | Encryption, HTTPS, session timeout, security headers, audit trail |

See [FERPA_COMPLIANCE.md](./FERPA_COMPLIANCE.md) for a detailed compliance checklist.

---

## 8. Residual Risks and Mitigations

### 8.1 Shared Device Risk
**Risk:** A teacher uses the application on a shared or public computer, and another user accesses the browser's localStorage.  
**Mitigation:** Data is encrypted at rest. Session timeout invalidates active sessions after 30 minutes. Teachers are trained to use school-issued devices and clear data before leaving. The Teacher Guide provides explicit instructions.

### 8.2 AI Output Accuracy
**Risk:** The AI model may generate inaccurate or inappropriate content in progress reports.  
**Mitigation:** All AI-generated text is presented as a draft. Teachers must review, edit, and explicitly approve every report before it is finalized. The application does not auto-submit or auto-distribute reports.

### 8.3 Browser Vulnerability
**Risk:** A zero-day browser vulnerability could expose encrypted localStorage data.  
**Mitigation:** Defense-in-depth approach with multiple layers (encryption, session timeout, security headers). Teachers are advised to keep browsers updated. Data auto-purges after 90 days, limiting the window of exposure.

### 8.4 Image Processing
**Risk:** Student work images uploaded to the server could be retained or exposed.  
**Mitigation:** Images are stored temporarily on the server with a 24-hour automatic deletion policy. Images are transmitted over HTTPS and are not forwarded to third parties beyond the AI provider under ZDR terms.

---

## 9. Approval

| Role | Name | Date | Signature |
|---|---|---|---|
| System Owner | __________________ | __________ | __________ |
| Privacy Officer | __________________ | __________ | __________ |
| IT Security | __________________ | __________ | __________ |
| School Administration | __________________ | __________ | __________ |

---

*This Privacy Impact Assessment should be reviewed and updated annually or whenever significant changes are made to the system's data handling practices.*
