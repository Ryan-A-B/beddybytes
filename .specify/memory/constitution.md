<!--
=============================================================================
SYNC IMPACT REPORT
=============================================================================
- Version change: 1.1.0 → 1.2.0 (MINOR: Reliability principle added)
- Added Principle VI: Reliability & Resilience
- Modified title: "Core Principles" principles are now explicitly numbered I-VI
- Rationale: Baby monitors require absolute reliability - parents must trust 
  the system to work when needed
- Ratified: 2026-01-17 | Last Amended: 2026-01-18
- Templates requiring updates: 
  - ✅ plan-template.md (add Reliability to Constitution Check)
  - ⚠ No other template changes needed (spec/tasks already reference constitution)
- Follow-up TODOs: None
=============================================================================
-->

# BeddyBytes Constitution

## Core Principles

### I. Simplicity-First (Occam's Razor)
Prefer simple, direct solutions over clever or over-engineered approaches. Every feature, function, and architectural decision MUST justify its complexity. If two solutions solve the problem equally, the simpler one wins. Remove code, features, and dependencies before adding them. YAGNI applies strictly: only build what is needed today, not what might be needed tomorrow.

**Rationale**: BeddyBytes serves privacy-conscious parents. Complexity introduces bugs, security vulnerabilities, and maintenance burden. Simplicity earns trust.

### II. Privacy-First (Non-Negotiable)
All architectural and design decisions MUST prioritize user privacy. Video and audio MUST never be able to leave the user's local network. No data collection beyond what is necessary for user licensing and account management. When privacy and convenience conflict, privacy wins.

**Rationale**: BeddyBytes exists because commercial monitors compromise privacy. This is the core value proposition—betraying it betrays the entire project.

### III. Modularity & Composability
Code MUST be organized into independently testable modules. Each module MUST have a single, clear responsibility. Dependencies between modules MUST be explicit and minimal. Modules serving different platforms (React frontend, Go backend, marketing site) MUST maintain clear boundaries.

**Rationale**: Three distinct components (Frontend PWA, Backend signaling server, Marketing site) require isolation to prevent changes in one from destabilizing others.

### IV. Test-First (Strict Discipline)
Tests MUST be written before implementation. Tests MUST fail first (red), then implementation makes them pass (green), then code is refactored (refactor). Every new feature, bug fix, and code change requires accompanying tests. Integration tests cover inter-service communication (WebRTC signaling, account server contracts). Unit tests cover individual modules.

**Rationale**: Live video streaming is unforgiving. Regression in signaling breaks the entire product. Tests provide confidence that changes don't silently break core workflows.

### V. Clear Communication Over Cleverness
Code MUST be readable. Prefer explicit over implicit. Prefer obvious over optimized (unless profiling proves the optimization is necessary). Comments MUST explain "why," not "what." Function and variable names MUST be self-documenting. When naming conflicts with brevity, naming wins.

**Rationale**: BeddyBytes is maintained by a small team. Code clarity reduces cognitive load and onboarding time. Comments save future maintainers from reading documentation or guessing intent.

### VI. Reliability & Resilience
The system MUST be dependable and predictable. Parents MUST be able to trust that the baby monitor will work when needed. Failures MUST be handled gracefully—connection drops, network outages, and backend disruptions MUST NOT break the product. WebRTC connections MUST persist through backend outages (P2P design). Stations MUST automatically reconnect after transient failures. Error states MUST be observable and diagnosable.

**Rationale**: This is a baby monitor. Parents rely on it for their child's safety. A system that fails silently or unpredictably erodes trust. Reliability is not optional—it is the foundation of the product's value proposition.

**Implementation Requirements**:
- Endurance tests MUST run for 5+ hours to catch rare failures (e.g., timeout after 5 hours)
- Backend outages MUST NOT terminate tests (chaos engineering validates resilience)
- WebRTC connections MUST remain active during backend outages (P2P architecture)
- Stations MUST retry connections with exponential backoff
- Failures MUST generate diagnostic artifacts (video recordings, logs) for root cause analysis
- Test infrastructure MUST NOT cause test failures (recording failures log warnings, don't fail tests)

## SOLID Principles

SOLID principles guide object-oriented and modular design. They are NOT alternatives to our core principles—they are complementary guardrails for code organization. Apply each principle judiciously; they can conflict with Simplicity-First and YAGNI.

### S. Single Responsibility Principle (SRP)
Each function, class, and package MUST have one clear reason to change. A module should do one thing and do it well.

**Application**: Reduces cognitive load. A reader should understand what a module does in one sentence. If a function handles both WebRTC connection AND account validation, it violates SRP and obscures intent.

**Example (Go)**: Separate packages for `signaling` (WebSocket protocol) and `accounts` (user licensing). Each has one responsibility; changes to account logic don't ripple into signaling.

**Note**: SRP is already foundational to our Modularity principle; this formalizes it.

### O. Open-Closed Principle (OCP)
Classes and functions MUST be open for extension but closed for modification. Use interfaces, generics, or decorator patterns to enable new functionality without changing existing code.

**Application**: Enables new features without risking regression in working code. New payment providers can be added without modifying the existing payment processor.

**Constraint (Critical)**: OCP must not conflict with Simplicity-First and YAGNI. Do not pre-engineer extension points "just in case." Add extension capability only when a second implementation is needed or explicitly planned. Premature abstraction violates Occam's Razor.

**Example (Go)**: Define a `Authenticator` interface. Different implementations (OAuth, email/password, LDAP) satisfy the interface; adding a new auth method requires a new implementation, not changes to existing code.

### L. Liskov Substitution Principle (LSP)
Any implementation of an interface MUST be reliably substitutable for another. Polymorphism MUST preserve predictability.

**Application**: If code treats an object as a `VideoStream`, any concrete implementation (WebRTC, Mock, File) must behave the same way. A test using a mock implementation should not discover different error modes than production.

**Note**: Not all error cases will be identical between implementations (network timeouts in WebRTC vs. none in mock)—document these boundaries clearly.

**Example (TypeScript)**: If `VideoCapture` interface has a `start()` method that can throw `PermissionDenied`, all implementations must throw the same error type for permission failures, not other errors.

### I. Interface Segregation Principle (ISP)
Clients MUST not depend on interfaces they don't use. Use many small, focused interfaces instead of one monolithic interface.

**Application**: Aligns perfectly with Go's philosophy of small interfaces. Decouples implementations from needless dependencies.

**Example (Go)**: Instead of one `Logger` interface with 10 methods, create `ErrorLogger` (error only) and `DebugLogger` (debug only). Components use only what they need.

### D. Dependency Inversion Principle (DIP)
High-level modules MUST not depend on low-level modules; both must depend on abstractions. The main function (or dependency injection container) decides which concrete implementation to wire.

**Application**: Enables testing and flexibility. In tests, inject a mock database; in production, inject the real one. Main function controls the decision.

**Example (Go)**: Signaling service depends on an `EventStore` interface, not a concrete PostgreSQL implementation. The `main()` function decides: use PostgreSQL in production, use in-memory in tests.

**Benefit**: Teams can work in parallel—one team implements signaling against the interface; another implements the event store. They're decoupled until wiring.

## Architecture & Structure

### Component Layout
- **Frontend**: React PWA in `/frontend` (create-react-app). Handles Baby Station capture and Parent Station playback via WebRTC.
- **Backend**: Go server in `/golang`. Provides signaling (WebSocket), account authentication, and licensing enforcement.
- **Marketing**: Gatsby site in `/marketing`. Static site generator for landing pages and public information.

### Technology Constraints
- **Frontend**: TypeScript, React functional components with hooks, standard browser APIs for WebRTC.
- **Backend**: Go, minimal dependencies, event sourcing for state management.
- **Deployment**: Docker Compose locally, AWS CloudFormation for production infrastructure.

### Data Persistence
Backend uses event sourcing: all state changes recorded as immutable events. Events stored in an event log; state reconstructed from log on startup. No mutable database—clarity and auditability guaranteed.

## Development Standards

### Code Style & Language-Specific Rules

**JavaScript/TypeScript**:
- Use arrow functions.
- Use `const` and `let`; never `var`.
- Use `===` and `!==`; never `==` or `!=`.
- Use double quotes for strings.
- Prefer returning values from functions over reassigning `let` variables.

**React**:
- Use functional components with hooks; never class components.
- Use `React.FunctionComponent` type (not `React.FC`).
- Use `<React.Fragment>` (not `<>`).
- Use double quotes for JSX attributes.

**Go**:
- Follow standard Go conventions (gofmt, golint compliant).
- Prefer explicit error handling over panic.

### Testing Requirements

**Test Organization**:
- Unit tests colocated with source code: `feature.test.ts` beside `feature.ts`.
- Integration tests in `/integration_tests` (Python-based).
- Contract tests verify API boundaries (signaling protocol, account endpoints).

**Test Execution**:
- Frontend: `scripts/frontend/test.sh`
- Backend: `go test ./...`
- Integration: `run_integration_tests.sh` (requires running local stack via `run_local_stack.sh`)

**Mandatory Test Gates**:
- All PRs must have passing unit and integration tests.
- Breaking changes to public APIs require contract test updates.
- New features require accompanying tests (red → green → refactor cycle).

### Code Review Standards
- PRs MUST be reviewed for compliance with this constitution.
- Complexity MUST be justified in PR description (if exceeding obvious solution).
- Privacy implications MUST be explicitly documented (if any data handling touches user content).
- Test coverage MUST be included and passing.

## Governance

**Constitutional Authority**: This constitution supersedes all other development guidance. Runtime decisions that conflict with these principles are escalated for revision of either the decision or the principle.

**Amendment Process**:
1. Proposed amendment documented with rationale.
2. Technical impact assessment performed (effects on templates, deployment, testing, etc.).
3. Amendment approved with semantic versioning bump.
4. All affected templates and documentation updated.
5. New version committed to repository.

**Version Management**: Semantic versioning (MAJOR.MINOR.PATCH)
- **MAJOR**: Principle removal or redefinition (e.g., privacy relaxed, simplicity abandoned).
- **MINOR**: New principle or section added, or materially expanded guidance.
- **PATCH**: Clarifications, wording improvements, typo fixes.

**Compliance Verification**:
- Constitution Check (in `.specify/templates/plan-template.md`) gates all implementation plans.
- Code review templates reference constitution principles.
- Integration tests validate architecture constraints (e.g., no external network calls for video/audio).

**Runtime Development Guidance**: See `.github/copilot-instructions.md` for component-specific walkthroughs, test command references, and directory structures. That file documents HOW to implement; this constitution documents WHY we build the way we do.

---

**Version**: 1.2.0 | **Ratified**: 2026-01-17 | **Last Amended**: 2026-01-18
