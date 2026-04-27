# FERPA Compliance Checklist

**System:** Quarterly Progress Report Generator  
**Date:** April 27, 2026  
**Prepared for:** Montgomery County Public Schools (MCPS), Office of District Technology (ODT)  
**Regulation:** Family Educational Rights and Privacy Act (20 U.S.C. 1232g; 34 CFR Part 99)

---

## Overview

This document maps each applicable FERPA requirement to the specific controls implemented in the Quarterly Progress Report Generator. It is intended for compliance review by MCPS ODT and school administration.

---

## 1. Legitimate Educational Interest

**FERPA Basis:** 34 CFR 99.31(a)(1) -- Disclosure to school officials with legitimate educational interest.

| Requirement | Control | Status |
|---|---|---|
| User has a legitimate educational purpose | Only classroom teachers generating progress reports for their own students | Implemented |
| Access limited to users with professional need | Application is scoped to authenticated teachers | Implemented |
| Data used solely for educational reporting | Generated content is exclusively student progress narratives | Implemented |

---

## 2. School Official Exception

**FERPA Basis:** 34 CFR 99.31(a)(1)(i)(B) -- School official includes teacher performing duties.

| Requirement | Control | Status |
|---|---|---|
| Teacher qualifies as school official | Teachers use the tool in their professional capacity | Verified |
| Teacher acts as data controller | Teacher inputs data, reviews output, approves final reports | Implemented |
| Institution maintains direct control | MCPS controls deployment, policies, and access | Implemented |
| No re-disclosure to unauthorized parties | AI provider under ZDR; no data sharing beyond processing | Implemented |

---

## 3. Directory Information Considerations

**FERPA Basis:** 34 CFR 99.3 -- Definition of directory information.

| Requirement | Control | Status |
|---|---|---|
| Only directory-level information used where possible | Only student first names collected; no addresses, SSNs, phone numbers, or student IDs | Implemented |
| Non-directory PII protected | Student work images (education records) handled under full FERPA protections | Implemented |
| District directory information policy followed | Application aligns with MCPS directory information designations | Verified |

---

## 4. Direct Control Requirements

**FERPA Basis:** 34 CFR 99.31(a)(1)(ii) -- Institution must maintain direct control over third-party use.

| Requirement | Control | Status |
|---|---|---|
| Institution controls third-party data use | Mistral AI operates under contractual ZDR agreement | Implemented |
| Third party uses data only for authorized purposes | Mistral AI processes anonymized data solely for text generation | Implemented |
| Third party does not re-disclose data | ZDR agreement prohibits storage, logging, and sharing | Implemented |
| Institution can audit third-party compliance | ZDR agreement includes compliance verification provisions | Implemented |
| Data anonymized before third-party processing | All student names replaced with tokens before AI processing | Implemented |

---

## 5. Record-Keeping Requirements

**FERPA Basis:** 34 CFR 99.32 -- Record of disclosures.

| Requirement | Control | Status |
|---|---|---|
| Maintain record of each disclosure | Audit trail logs all report generation events with timestamps | Implemented |
| Record includes date, party, and purpose | Audit entries include timestamp, action type, and session identifier | Implemented |
| Records available for parent inspection | Audit logs can be exported for review upon request | Implemented |
| Records retained for inspection period | Audit data retained for 90 days (client-side) | Implemented |

---

## 6. Parent Notification Requirements

**FERPA Basis:** 34 CFR 99.7 -- Annual notification of rights.

| Requirement | Control | Status |
|---|---|---|
| Annual FERPA rights notification to parents | Handled by MCPS district-level annual notification process | District Responsibility |
| Notification includes right to inspect records | Covered under existing MCPS parent notification | District Responsibility |
| Notification includes right to request amendment | Covered under existing MCPS parent notification | District Responsibility |
| Notification includes right to consent to disclosure | Covered under existing MCPS parent notification | District Responsibility |
| Application-specific disclosure in notification | Recommended: MCPS include AI-assisted report generation in annual notice | Recommendation |

---

## 7. Data Minimization

**FERPA Principle:** Collect and process only the minimum data necessary.

| Requirement | Control | Status |
|---|---|---|
| Minimum necessary data collected | Only student first names, teacher names, school names, and work samples | Implemented |
| No unnecessary PII collected | No SSNs, addresses, phone numbers, grades, or demographic data | Verified |
| Data retention limited to operational need | 90-day client purge, 24-hour server image deletion | Implemented |
| Data deleted when no longer needed | Automatic purge schedules enforced programmatically | Implemented |
| Teacher can delete data on demand | Manual data clearing available in application settings | Implemented |

---

## 8. Third-Party Processor Requirements (Mistral AI)

**FERPA Basis:** 34 CFR 99.31(a)(1) -- Conditions for third-party access.

| Requirement | Control | Status |
|---|---|---|
| Written agreement in place | Mistral AI Zero Data Retention agreement executed | Implemented |
| Data used only for specified purpose | ZDR limits use to real-time text generation only | Implemented |
| No data retention by processor | ZDR guarantees zero storage of inputs and outputs | Implemented |
| No use of data for model training | ZDR explicitly prohibits training on customer data | Implemented |
| Data anonymized before processing | Student names replaced with non-identifying tokens | Implemented |
| Processing occurs in compliant jurisdiction | Mistral AI processes data in EU data centers | Verified |
| Encryption in transit | All API communications use HTTPS (TLS 1.2+) | Implemented |
| Incident notification provisions | ZDR agreement includes breach notification requirements | Verified |

---

## 9. Security Safeguards

**FERPA Basis:** 34 CFR 99.31(a)(1)(ii) -- Reasonable methods to ensure access limited to legitimate interest.

| Safeguard | Implementation | Status |
|---|---|---|
| Authentication | Teacher login required | Implemented |
| Session management | 30-minute inactivity timeout | Implemented |
| Encryption at rest | AES-256 encrypted localStorage | Implemented |
| Encryption in transit | HTTPS with HSTS enforcement | Implemented |
| Access control | Teachers access only their own data | Implemented |
| Security headers | HSTS, X-Frame-Options, CSP, Referrer-Policy | Implemented |
| Audit logging | Action-level audit trail | Implemented |
| Input validation | All user inputs validated and sanitized | Implemented |

---

## 10. Compliance Summary

| Category | Items | Implemented | District Responsibility | Recommendations |
|---|---|---|---|---|
| Legitimate Educational Interest | 3 | 3 | 0 | 0 |
| School Official Exception | 4 | 4 | 0 | 0 |
| Directory Information | 3 | 2 | 1 | 0 |
| Direct Control | 5 | 5 | 0 | 0 |
| Record-Keeping | 4 | 4 | 0 | 0 |
| Parent Notification | 5 | 0 | 4 | 1 |
| Data Minimization | 5 | 5 | 0 | 0 |
| Third-Party Processor | 8 | 8 | 0 | 0 |
| Security Safeguards | 8 | 8 | 0 | 0 |
| **Total** | **45** | **39** | **5** | **1** |

---

## 11. Recommendations

1. **Parent Notification Update:** Include a reference to AI-assisted progress report generation in the MCPS annual FERPA notification to parents. This should describe the use of anonymized data processing and the teacher's role in reviewing all generated content.

2. **Periodic Audit:** Conduct an annual review of Mistral AI's ZDR compliance and update this checklist accordingly.

3. **Teacher Training:** Ensure all teachers using the application complete a brief training module on data handling responsibilities and FERPA obligations specific to this tool.

---

## 12. Approval

| Role | Name | Date | Signature |
|---|---|---|---|
| FERPA Compliance Officer | __________________ | __________ | __________ |
| IT Security | __________________ | __________ | __________ |
| School Administration | __________________ | __________ | __________ |

---

*This checklist should be reviewed annually or whenever the application's data handling practices change.*
