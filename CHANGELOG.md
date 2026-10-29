# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Unit tests (Jest and React Testing Library) for the pages, components and Redux slices: authentication, registration and profile completion, student results, rankings and attempt review, payment and bank-slip upload, admin and video content, chat, feedback, referral and badges (DDP-#52)
- Frontend CI workflow with lint, build, unit-test and security-scan checks on every push and pull request (DDP-#50)
- 80% coverage threshold enforced in the unit-test stage (DDP-#58)
- Production `Dockerfile` and a workflow that starts the staging deployment in `edura-infra` after a push
- README: project details, prerequisites, local setup instructions and badges

### Changed
- `lint` script now runs `next lint` instead of `next build`
- Prettier ignores build output and uses `endOfLine: auto`; code reformatted with Prettier; `audit-ci.jsonc` excluded from formatting
- Jest default timeout raised to 20 seconds
- Security scan allowlists the dependency advisories accepted in ADR-14

### Fixed
- All ESLint errors cleared so the lint check passes
- Profile creation handles accounts that already have a profile (sign-up race after verification)

## [0.3.0] - 2026-10-15

### Added
- Student and administrator screens wired to the backend services (PR #12): course and exam management, video and course management with Cloudinary assets, and stream and grade-subject management in the admin API
- Email verification flow with a resend option
- Feedback and bank-account management API calls
- Video progress tracking with extra data fields and violation reporting

### Changed
- Admin roles and permissions standardised across the application

### Fixed
- Analytics display handles null grades; `district_rank` mapping in the submit response handles null values
- Token handling on 401 responses; unique notification IDs
- `.gitignore` covers all local environment files

## [0.2.0] - 2026-09-12

### Added
- Redux slices for payment, questions, referral, student dashboard, UI and video classes

## [0.1.0] - 2026-07-19

### Added
- Frontend configuration, linter settings, package dependencies and a formatting check

### Changed
- Upgraded to Next.js 15 and React 19 to resolve dependency audit vulnerabilities (ADR-11)

[Unreleased]: https://github.com/Edura-LMS-Zynaptrix/edura-frontend/compare/v0.3.0...develop
[0.3.0]: https://github.com/Edura-LMS-Zynaptrix/edura-frontend/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Edura-LMS-Zynaptrix/edura-frontend/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Edura-LMS-Zynaptrix/edura-frontend/releases/tag/v0.1.0
