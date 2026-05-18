# Dark Mode Readability & Button UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal**: Improve Dark Mode readability and button active states in the dashboard and landing page.

**Architecture**: Apply Tailwind CSS `dark:` variants and interactive states (`active:`) to specific components to enhance contrast and user feedback.

**Tech Stack**: Next.js, Tailwind CSS, Lucide React.

---

### Task 1: Update Dashboard Guide Component

**Files**:
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Locate and modify the Onboarding Widget Card**
    - Change the card background from light gradient to dark neutral.
    - Code to modify (around line 561):
    ```tsx
    // Before
    <Card className="border-teal-100 shadow-sm bg-gradient-to-br from-white to-teal-50/30 overflow-hidden relative">
    
    // After
    <Card className="border-teal-100 dark:border-neutral-800 shadow-sm bg-gradient-to-br from-white to-teal-50/30 dark:from-neutral-900 dark:to-neutral-950 overflow-hidden relative">
    ```

- [ ] **Step 2: Update Text Colors for Readability**
    - Ensure title and description are readable in dark mode.
    - Code to modify (around line 566):
    ```tsx
    // Before
    <CardTitle className="text-lg text-foreground/90">Guía de Inicio Rápido</CardTitle>
    <CardDescription>Completa estos pasos para configurar tu clínica al 100%</CardDescription>
    
    // After
    <CardTitle className="text-lg text-foreground/90 dark:text-neutral-50">Guía de Inicio Rápido</CardTitle>
    <CardDescription className="dark:text-neutral-400">Completa estos pasos para configurar tu clínica al 100%</CardDescription>
    ```

- [ ] **Step 3: Update Step Items Styles**
    - Update the background and text colors for completed and incomplete steps.
    - Code to modify (around line 582):
    ```tsx
    // Before
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md ${step.done ? 'bg-card/60 border-teal-100/50 opacity-70' : 'bg-card border-teal-100 hover:border-teal-300'}`}>
    
    // After
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md active:scale-95 active:brightness-90 ${step.done ? 'bg-card/60 dark:bg-neutral-800/50 border-teal-100/50 dark:border-neutral-700 opacity-70' : 'bg-card dark:bg-neutral-800 border-teal-100 dark:border-neutral-700 hover:border-teal-300 dark:hover:border-teal-600'}`}>
    ```

- [ ] **Step 4: Update Step Text Colors**
    - Code to modify (around line 587):
    ```tsx
    // Before
    <p className={`text-sm font-medium ${step.done ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{step.title}</p>
    
    // After
    <p className={`text-sm font-medium ${step.done ? 'text-slate-500 dark:text-neutral-500 line-through' : 'text-slate-700 dark:text-neutral-100'}`}>{step.title}</p>
    ```

- [ ] **Step 5: Verify changes visually**
    - Run the dev server and check the dashboard in dark mode.
    - Command: `npx next dev` (if not already running)

- [ ] **Step 6: Commit**
    ```bash
    git add app/(dashboard)/dashboard/page.tsx
    git commit -m "feat: improve dark mode readability for dashboard guide"
    ```

---

### Task 2: Update Landing Page CTA Button States

**Files**:
- Modify: `app/(landing)/page.tsx`

- [ ] **Step 1: Locate and modify the CTA button**
    - Add `active:scale-95` and `active:brightness-90` to the button.
    - Code to modify (around line 299):
    ```tsx
    // Before
    <Button size="lg" className="h-16 px-10 text-xl font-bold rounded-full shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] bg-card text-teal-950 hover:bg-teal-950 hover:text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] active:scale-95 font-subtitle group border border-transparent hover:border-teal-800" asChild>
    
    // After
    <Button size="lg" className="h-16 px-10 text-xl font-bold rounded-full shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] bg-card text-teal-950 hover:bg-teal-950 hover:text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] active:scale-95 active:brightness-90 font-subtitle group border border-transparent hover:border-teal-800" asChild>
    ```

- [ ] **Step 2: Verify changes visually**
    - Check the landing page CTA button click behavior.

- [ ] **Step 3: Commit**
    ```bash
    git add app/(landing)/page.tsx
    git commit -m "feat: add active states to landing page CTA button"
    ```
