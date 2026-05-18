# Design Spec: Premium Dark Mode & Button UX Improvements

**Date**: 2026-05-18
**Status**: Draft
**Topic**: Dark Mode Readability and Button Active States

## 1. Objective
Improve the Dark Mode UI/UX of the application, focusing on text readability in the "Guía de Inicio Rápido" component and implementing premium active (click) states for buttons, following Apple's design principles (high contrast, clean depth, and vibrant accents).

## 2. Proposed Changes

### 2.1 Dashboard Guide ("Guía de Inicio Rápido")
**File**: `app/(dashboard)/dashboard/page.tsx`

- **Card Container**:
    - Current: Light gradient `bg-gradient-to-br from-white to-teal-50/30`.
    - New: Dark background with subtle depth. Use `dark:bg-neutral-900` or `dark:bg-black` with a subtle border `dark:border-neutral-800`.
- **Text Readability**:
    - Title: Ensure it uses `dark:text-white` or `dark:text-neutral-50`.
    - Subtitle: Use `dark:text-neutral-400`.
- **Step Items**:
    - **Incomplete Steps**:
        - Current: `bg-card border-teal-100 text-slate-700`.
        - New: `dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100`.
    - **Complete Steps**:
        - Current: `bg-card/60 text-slate-500`.
        - New: `dark:bg-neutral-800/50 dark:text-neutral-500` (muted but readable).
- **Progress Bar**:
    - Keep the vibrant teal (`bg-teal-500`) as the accent color.

### 2.2 Button Active States (Click Feedback)
**Global / Targeted Components**

- Implement a premium "press" effect for buttons.
- **Style**: Use `active:scale-95` combined with a slight darkening or brightness reduction (`active:brightness-90` or `active:bg-opacity-90`).
- This will apply to:
    - Steps in "Guía de Inicio Rápido".
    - Buttons in the Landing Page CTA section.
    - Other primary buttons in the dashboard.

### 2.3 Landing Page CTA Section
**File**: `app/(landing)/page.tsx`

- **Section Background**: Keep the current dark gradient as it looks good.
- **CTA Button**:
    - Add the premium active state (`active:scale-95` and `active:brightness-90`).
    - Ensure text and icon colors have high contrast on hover and active states.

## 3. Non-Functional Requirements
- **Performance**: No negative impact on load times.
- **Accessibility**: Ensure all text passes WCAG AA contrast guidelines in dark mode.

## 4. Verification Plan
- Visually verify the contrast of the "Guía de Inicio Rápido" component in dark mode.
- Test button click states to ensure they feel responsive and premium.
