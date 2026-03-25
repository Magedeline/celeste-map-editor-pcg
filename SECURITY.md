# Security Policy

## Supported Versions

Security fixes are applied to the latest code on `main`.

## Reporting a Vulnerability

Do not open public issues for security reports.

Report vulnerabilities through GitHub Security Advisories for this repository. If advisories are not enabled yet, contact the repository owner directly and include:

1. A short summary of the issue.
2. Impact and affected components.
3. Reproduction steps or a proof of concept.
4. Any suggested remediation.

## Response Targets

1. Initial triage: within 5 business days.
2. Reproduction and severity assessment: as soon as the issue is confirmed.
3. Fix and disclosure timeline: coordinated case by case based on impact.

## Hardening In This Repo

This repository now includes:

1. `CODEOWNERS` coverage for core paths.
2. Dependabot update checks for npm and GitHub Actions.
3. A CodeQL workflow for TypeScript, C++, and C# analysis.
