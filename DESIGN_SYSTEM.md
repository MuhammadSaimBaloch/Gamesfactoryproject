# Monochrome design system

## Visual language

Black #111, white #fff, paper #fafafa, surfaces #eee and grayscale text/borders only. Product photographs may retain authentic product colors; interface elements remain monochromatic. No fabricated discounts, review stars, delivery promises or warranty badges.

The layout combines large editorial headings, squared controls, clear rules and generous spacing. The homepage moves from a black hero to platform tiles, a light controller stage, physical-case game rail and a black Multan branch section.

## Typography and space

System Arial/Helvetica stack with no external font fetch. Heavy, tightly tracked display headings; 10px uppercase eyebrow labels; readable 13–15px body copy. Responsive heading sizes use clamp. Main spacing is 8/12/16/20/24/30/40/60/70px. Desktop gutters are approximately 4.2%; small-screen gutters 5–6%.

## Components

- Primary buttons: black/white, minimum 48px height. Secondary buttons: transparent, outlined. Dark sections invert primary colors.
- Product cards: dedicated neutral image stage, always-visible price and purchase action, quick-view control, explicit demo/availability label.
- Dialogs/drawers: Radix primitives for focus trapping and Escape handling. Cart count and additions provide accessible feedback.
- Forms: persistent labels, browser constraints plus server validation, clear error region, no color-only validation.
- Controller stage: Motion AnimatePresence, pointer drag, keyboard arrows, previous/next controls and direct selection dots; reduced-motion support.
- Game rail: native horizontal scrolling, scroll snap, keyboard/arrow navigation and distinct physical-case development covers.
- Product details: variant-specific galleries, lightbox, editable quantity, compatibility/specifications and related platform products.

## Responsive behavior

320/360/375/390/430/768/1024/1440px are automated overflow targets. Header switches to a compact mobile menu; filter controls wrap; checkout stacks; tables scroll internally. Touch controls use practical target sizes. Drawers account for bottom safe-area padding.

## Motion and assets

Animate transforms/opacity rather than layout. No continuous animation or scroll hijacking. Motion respects reduced-motion preferences, and CSS disables nonessential transitions/animations for that preference.

All current product icons and original demo covers are visibly marked development placeholders. Owner-approved transparent PNG/WebP/AVIF images can replace them through administration. The Lucide gamepad is a generic placeholder, not a representation of a particular product or a 3D model. No competitor imagery is reused.
