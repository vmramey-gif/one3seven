# One3Seven Authentication & Role-Based Routing Architecture

## Overview

One3Seven now features a unified authentication system that connects the worker-side intake experience and participating law firm dashboard into **one cohesive product ecosystem**.

## Authentication Flow

### Entry Point: Auth Welcome Screen

**Route:** `authWelcome`

The auth welcome screen is the **product entry gateway** (not the public marketing landing page).

**Features:**
- Minimal, premium design
- One3Seven branding
- Primary actions: Sign In / Create Account
- Secondary link for participating firms
- Calm, operational tone

**Copy:**
> "Organize employment records and intake information in one connected workspace."

### Sign In Screen

**Route:** `signIn`

Clean, trustworthy authentication experience.

**Features:**
- Email + password fields
- "Continue with Google" option
- Forgot password link
- Link to create account
- Mobile-first layout

**Flow:**
```
Sign In → Role Selection → Worker Landing OR Firm Dashboard
```

### Create Account Screen

**Route:** `createAccount`

Lightweight account creation.

**Features:**
- Email, password, confirm password
- Password validation (minimum 8 characters)
- Error messaging
- "Continue with Google" option
- Link to sign in

**Flow:**
```
Create Account → Role Selection → Worker Landing OR Firm Dashboard
```

### Role Selection Screen

**Route:** `roleSelection`

**Critical routing decision point** - determines which workspace the user accesses.

**Headline:** "How will you use One3Seven?"

**Two Primary Options:**

#### Option 1: Organize My Employment Records
- **Icon:** FileText
- **Description:** "For workers organizing employment-related records, timelines, and intake information."
- **Routes to:** Worker Landing Page → Worker Intake Flow
- **Sets role:** `'worker'`

#### Option 2: Participating Law Firm
- **Icon:** Briefcase
- **Description:** "For participating firms reviewing organized intake submissions and workflow-ready matter packets."
- **Routes to:** Law Firm Dashboard
- **Sets role:** `'firm'`

## Role-Based Routing

### User Roles

```typescript
export type UserRole = 'worker' | 'firm' | null;
```

### Routing Logic

**Worker Role:**
```
Role Selection → Landing Screen → Upload → Processing → Summary
                                                          ↓
                                        Timeline Details, File Preview, etc.
```

**Firm Role:**
```
Role Selection → Firm Dashboard → Intake Review
                                 ↓
                      Firm Settings, Status Management, etc.
```

### State Management

```typescript
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [userRole, setUserRole] = useState<UserRole>(null);
const [userEmail, setUserEmail] = useState<string | null>(null);
```

## User Session Conceptual Architecture

### Worker Session

A worker account conceptually supports:
- **Saved intake progress** - IntakeWorkspace with `saveStatus: 'saved'`
- **Saved uploaded files** - Documents persisted in workspace
- **Saved timeline context** - Worker-provided details per timeline event
- **Intake submission history** - Array of submitted IntakeWorkspace objects
- **Additional information requests** - Requests from firms attached to workspace
- **Shared intake status** - Track which intakes have been shared with firms

### Firm Session

A participating firm account conceptually supports:
- **Intake review dashboard** - Access to routed IntakeWorkspace submissions
- **Workflow statuses** - Update statuses on shared workspace
- **Internal reviewer notes** - Private notes attached to workspace
- **Additional information requests** - Request docs from workers
- **Intake routing preferences** - Geography, categories, readiness thresholds
- **Dashboard filtering** - Filter by status, readiness, location

## Connected Ecosystem Architecture

### Before Auth Layer

```
Worker Flow (disconnected)    Firm Dashboard (disconnected)
      ↓                                 ↓
  Isolated screens              Isolated screens
```

### After Auth Layer

```
                    Auth Welcome
                         ↓
                    Sign In / Create Account
                         ↓
                  Role Selection
                    /          \
                   /            \
           Worker Flow      Firm Dashboard
                   \            /
                    \          /
              Shared IntakeWorkspace
```

### Key Architectural Principles

**Single Entry Point:**
- All users enter through the same auth system
- No separate worker vs. firm login experiences

**Role-Based Routing:**
- Role selection determines workspace access
- Same user could conceptually access both (with proper permissions)

**Shared Data Layer:**
- Both roles interact with the same `IntakeWorkspace` objects
- Worker creates/submits, firm reviews/manages
- No duplicate or disconnected data

**Permission-Based Views:**
- Worker view: Create, edit, save, submit intakes
- Firm view: Read intakes + workflow management actions
- Privacy boundaries preserved (internal notes stay private)

## Visual Consistency

All auth screens maintain the existing One3Seven design system:

**Design Elements:**
- Grayscale palette (slate-50, slate-100, slate-900)
- Premium spacing and rounded corners (rounded-[14px], rounded-[18px])
- Mobile-first responsive design
- Calm, operational identity
- Minimal, emotionally intelligent tone

**Typography:**
- Headlines: text-xl to text-2xl, font-semibold
- Body: text-sm to text-base, text-slate-600
- Buttons: font-medium

**Components:**
- Form fields: bg-slate-50, border-slate-200, rounded-[14px]
- Primary buttons: bg-slate-900, text-white
- Secondary buttons: bg-slate-100, text-slate-900
- Icons: Lucide React (ArrowRight, Mail, Lock, FileText, Briefcase)

## Implementation Files

### New Screen Components
- `/screens/AuthWelcomeScreen.tsx` - Product entry gateway
- `/screens/SignInScreen.tsx` - Authentication
- `/screens/CreateAccountScreen.tsx` - Account creation
- `/screens/RoleSelectionScreen.tsx` - Role-based routing

### Updated Core Files
- `/App.tsx` - Added auth state, handlers, routing for new screens
- Screen types extended: `'authWelcome' | 'signIn' | 'createAccount' | 'roleSelection'`
- UserRole type: `'worker' | 'firm' | null`

### Auth Handlers

```typescript
handleSignIn(email, password) // Authenticate user
handleCreateAccount(email, password) // Create new account
handleSelectRole(role) // Set user role
handleSignOut() // Clear session and return to auth welcome
```

## Production Considerations

### Current Implementation (MVP)
- In-memory authentication (no backend persistence)
- No actual password hashing or validation
- Simulated session management
- Role routing is functional but not secured

### Production Requirements
- Backend authentication service (JWT tokens, sessions)
- Secure password hashing (bcrypt, argon2)
- Email verification workflow
- Password reset functionality
- OAuth integration (Google, Microsoft)
- Session management with expiration
- Role-based access control (RBAC)
- Multi-factor authentication (MFA) options
- Audit logging for security events

## Future Enhancements

- **Account Settings:** Allow users to update email, password, preferences
- **Profile Management:** User name, organization details, contact info
- **Role Switching:** Allow users with multiple roles to switch workspaces
- **Team Accounts:** Multiple users within same firm account
- **Invitation System:** Firms can invite team members
- **SSO Integration:** Enterprise single sign-on for larger firms
- **Session Security:** Device management, activity logs, forced logout

## User Experience Flow (Complete)

```
1. User visits One3Seven product
          ↓
2. Auth Welcome Screen ("Sign In" or "Create Account")
          ↓
3. Authentication (email + password or OAuth)
          ↓
4. Role Selection ("Worker" or "Participating Firm")
          ↓
5a. Worker Route:
    Landing → Upload → Processing → Summary → Timeline Details
                                                      ↓
                                            Share with Firms

5b. Firm Route:
    Firm Dashboard → Intake Review → Update Status
                                    ↓
                          Request Additional Info
          ↓
6. Both roles work with same shared IntakeWorkspace
```

The platform now feels like **one connected One3Seven ecosystem** rather than disconnected prototype screens.
