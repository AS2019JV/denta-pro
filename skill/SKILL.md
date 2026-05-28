---
name: clinia-brand-guidelines
description: Use when you need to design, modify, or evaluate UI/UX components for Clinia+. Contains the official color palette, typography, and Apple industry best practices for the brand.
---

# Clinia+ Brand Guidelines

## Overview
This skill must be referenced whenever creating or modifying UI components to ensure strict adherence to the Clinia+ visual identity and Apple's premium UI/UX standards.

## Brand Colors
Always use these exact hex codes or their Tailwind equivalents when defining backgrounds, text, buttons, and accents.

- **Principal (Dark Green)**: `#145247`
  - *Usage*: Main dark backgrounds, primary text in light mode, high-contrast structural elements.
- **Secondary (Orange/Yellow)**: `#FAA805`
  - *Usage*: Primary Call-to-Actions (CTAs), warnings, badges, and high-visibility highlights. Outstanding contrast against Principal.
- **Tertiary (Lime Green)**: `#CDE004`
  - *Usage*: Subtle accents, success states, secondary buttons. Use sparingly to avoid visual fatigue.
- **Complementary (Beige/Cream)**: `#E8D9C9`
  - *Usage*: Soft light backgrounds (reduces eye strain vs pure white), secondary text on dark backgrounds, card backgrounds.

## Typography
- **Title**: `Trend sans one` (Use for major headings, H1, H2, Hero titles)
- **Subtitle**: `Morisawa Role Sans` (Use for section badges, small caps, structural subheadings)
- **Text**: `Gowun Batang` (Use for body paragraphs, descriptions, and long-form reading)

## Apple Industry UI/UX Best Practices
1. **High Contrast**: Ensure WCAG AA or AAA contrast. Never use dark text on dark backgrounds or light text on light backgrounds. (e.g., Use `#E8D9C9` text on `#145247` background).
2. **Tactile Feedback**: Interactive elements should have clear hover and active states (e.g., `active:scale-95`).
3. **Glassmorphism & Depth**: Use subtle blurs (`backdrop-blur`) and shadows instead of harsh borders.
4. **Legibility First**: Fonts should be sized appropriately for mobile. Avoid fixed heights (`max-h-screen`) on containers with dynamic text to prevent cutoff.
