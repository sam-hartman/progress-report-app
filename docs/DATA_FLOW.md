# Data Flow Diagram

**System:** Quarterly Progress Report Generator  
**Date:** April 27, 2026  
**Prepared for:** Montgomery County Public Schools (MCPS), Office of District Technology (ODT)

---

## 1. Primary Data Flow -- Report Generation

```
+-------------------+          +-------------------+          +-------------------+
|                   |          |                   |          |                   |
|   TEACHER         |  HTTPS   |   BACKEND         |  HTTPS   |   MISTRAL AI      |
|   (Browser)       +--------->|   (Fly.io)        +--------->|   (EU Servers)    |
|                   |          |                   |          |                   |
|  Input:           |          |  Receives:        |          |  Receives:        |
|  - Student names  |  Step 2  |  - Anonymized     |  Step 3  |  - Anonymized     |
|  - Observations   +--------->|    text           +--------->|    text           |
|  - Work images    |          |  - Work images    |          |  - Work images    |
|                   |          |                   |          |                   |
|  Protection:      |          |  Protection:      |          |  Protection:      |
|  - Encrypted      |          |  - TLS 1.2+       |          |  - Zero Data      |
|    localStorage   |          |  - 24hr image     |          |    Retention      |
|  - Session timeout|          |    auto-delete    |          |  - No training    |
|  - AES-256        |          |  - No persistent  |          |  - No logging     |
|                   |          |    student data   |          |  - Immediate      |
|                   |          |                   |          |    discard        |
+--------+----------+          +---------+---------+          +---------+---------+
         ^                               |                              |
         |                               |                              |
         |          +-------------------+|                              |
         |          |                   ||          Step 4              |
         +----------+   RESPONSE FLOW  |<------------------------------+
          Step 5     |                  ||
                     |  Backend returns ||  AI returns generated
                     |  anonymized      ||  report text (anonymized)
                     |  AI response     |+
                     |  to browser      |
                     +------------------+
                     |
                     |  Step 6: Browser re-inserts
                     |  real student names locally
                     |
                     v
            +------------------+
            |  FINAL REPORT    |
            |  (in browser)    |
            |                  |
            |  Teacher reviews |
            |  edits, approves |
            +------------------+
```

---

## 2. Step-by-Step Data Flow

```
Step 1: DATA ENTRY
======================================================================
Teacher --> Browser
  Data: Student first names, observations, work images
  Protection: Input validation, encrypted storage
  Storage: AES-256 encrypted localStorage

Step 2: ANONYMIZATION & TRANSMISSION
======================================================================
Browser --> Backend Server
  Data: Anonymized text (names replaced with tokens), work images
  Protection: HTTPS/TLS 1.2+, name anonymization
  Transform: "Maria shows improvement" --> "Student_A shows improvement"

Step 3: AI PROCESSING REQUEST
======================================================================
Backend --> Mistral AI
  Data: Anonymized text, work images
  Protection: HTTPS/TLS 1.2+, Zero Data Retention agreement
  Guarantee: No storage, no logging, no training use

Step 4: AI RESPONSE
======================================================================
Mistral AI --> Backend
  Data: Generated report text (anonymized)
  Protection: HTTPS/TLS 1.2+, ZDR (response not retained)
  Content: "Student_A has demonstrated strong growth in..."

Step 5: RESPONSE DELIVERY
======================================================================
Backend --> Browser
  Data: Anonymized AI-generated report text
  Protection: HTTPS/TLS 1.2+, security headers

Step 6: NAME RESTORATION
======================================================================
Browser (local operation)
  Data: Report text with real names restored
  Protection: Runs entirely in browser, no network call
  Transform: "Student_A has demonstrated..." --> "Maria has demonstrated..."
```

---

## 3. Data at Rest

```
+------------------------------------------------------------------+
|  BROWSER (Teacher's Device)                                       |
|                                                                   |
|  localStorage (AES-256 Encrypted)                                 |
|  +------------------------------------------------------------+  |
|  |  - Student first names                                      |  |
|  |  - Teacher name                                             |  |
|  |  - School name                                              |  |
|  |  - Observations and notes                                   |  |
|  |  - Generated report drafts                                  |  |
|  |  - Consent records                                          |  |
|  |  - Audit trail entries                                      |  |
|  +------------------------------------------------------------+  |
|  Auto-purge: 90 days from last activity                           |
|  Manual clear: Available at any time via settings                 |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|  BACKEND SERVER (Fly.io)                                          |
|                                                                   |
|  Temporary Storage                                                |
|  +------------------------------------------------------------+  |
|  |  - Uploaded student work images                             |  |
|  +------------------------------------------------------------+  |
|  Auto-delete: 24 hours from upload                                |
|  No persistent student data stored                                |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|  MISTRAL AI (EU Data Centers)                                     |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  NO DATA STORED                                             |  |
|  |  Zero Data Retention: inputs and outputs discarded          |  |
|  |  immediately after processing                               |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

---

## 4. Deletion Flows

```
AUTOMATIC DELETION
==================

  90-Day Client Purge:
  +------------------+     +-------------------+     +------------------+
  | Last user        |     | 90 days pass      |     | All localStorage |
  | activity         +---->| without activity  +---->| data wiped       |
  | (timestamp)      |     |                   |     | (encrypted data  |
  +------------------+     +-------------------+     |  removed)        |
                                                      +------------------+

  24-Hour Image Purge:
  +------------------+     +-------------------+     +------------------+
  | Image uploaded   |     | 24 hours pass     |     | Image file       |
  | to server        +---->| (server cron job) +---->| deleted from     |
  | (timestamp)      |     |                   |     | server storage   |
  +------------------+     +-------------------+     +------------------+

  Session Timeout:
  +------------------+     +-------------------+     +------------------+
  | Last user        |     | 30 minutes pass   |     | Session          |
  | interaction      +---->| without activity  +---->| invalidated      |
  | (timestamp)      |     |                   |     | (re-auth needed) |
  +------------------+     +-------------------+     +------------------+


MANUAL DELETION
===============

  User-Initiated Clear:
  +------------------+     +-------------------+     +------------------+
  | Teacher selects  |     | Application       |     | All encrypted    |
  | "Clear All Data" +---->| confirms action   +---->| localStorage     |
  | in settings      |     | with teacher      |     | entries removed  |
  +------------------+     +-------------------+     +------------------+
```

---

## 5. Connection Security Summary

| Connection | Protocol | Data Transmitted | Protections |
|---|---|---|---|
| Teacher -> Browser | Local | Raw student data | Input validation, encrypted storage |
| Browser -> Backend | HTTPS/TLS 1.2+ | Anonymized text, images | Name anonymization, HSTS, security headers |
| Backend -> Mistral AI | HTTPS/TLS 1.2+ | Anonymized text, images | ZDR agreement, no retention |
| Mistral AI -> Backend | HTTPS/TLS 1.2+ | Generated text (anonymized) | ZDR, no retention |
| Backend -> Browser | HTTPS/TLS 1.2+ | Generated text (anonymized) | HSTS, Cache-Control: no-store, security headers |
| Browser (local) | N/A | Name restoration | Runs entirely client-side, no network |

---

## 6. Data Classification at Each Stage

```
+----------+     +----------+     +----------+     +----------+     +----------+
|          |     |          |     |          |     |          |     |          |
| STAGE 1  |     | STAGE 2  |     | STAGE 3  |     | STAGE 4  |     | STAGE 5  |
| Input    |     | In-flight|     | AI Proc. |     | Response |     | Storage  |
|          |     |          |     |          |     |          |     |          |
| PII:     |     | PII:     |     | PII:     |     | PII:     |     | PII:     |
| YES      |     | NO       |     | NO       |     | NO       |     | YES      |
| (names)  |     | (anon.)  |     | (anon.)  |     | (anon.)  |     | (restored|
|          |     |          |     |          |     |          |     |  + encryp)|
| Encrypted|     | Encrypted|     | ZDR      |     | Encrypted|     | Encrypted|
| (AES-256)|     | (TLS)    |     | (none    |     | (TLS)    |     | (AES-256)|
|          |     |          |     |  stored) |     |          |     |          |
+----------+     +----------+     +----------+     +----------+     +----------+

  Browser        Browser->        Mistral AI       AI->Backend->     Browser
  localStorage   Backend                           Browser           localStorage
```

---

*This data flow diagram should be reviewed and updated whenever the application architecture or data handling practices change.*
