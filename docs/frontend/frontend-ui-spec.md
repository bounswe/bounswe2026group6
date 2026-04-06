# Frontend UI Spec

## Design Reference

This project uses a **clean red-white visual language** inspired by the reference authentication screen shared by the team.

The overall interface should feel:

- clean
- modern
- light
- calm
- trustworthy
- consistent across web and Android

The UI should avoid looking too playful, too crowded, or too dark.  
The target feeling is a balanced mix of:

- emergency preparedness
- reliability
- accessibility
- simplicity

---

## Core Visual Principles

All frontend work should follow these principles:

### 1. Consistency over creativity
Do not invent a new style for each screen.  
If a component already exists, reuse it.

### 2. Simplicity over decoration
Avoid unnecessary gradients, decorative elements, and excessive icons.

### 3. Readability over density
Use enough spacing between sections, labels, inputs, and buttons.  
Do not compress forms too tightly.

### 4. One product, one language
Web and Android should look like the same product, even if implementation details differ.

### 5. Calm and trustworthy visual tone
Prefer soft backgrounds, clean cards, subtle borders, and restrained shadow usage.

---

## Color System

### Primary Palette

These colors define the main interface language.

- **Primary Red:** main brand/action color
- **Primary Red Dark:** hover/active/pressed state
- **Primary Red Light:** selected tabs, subtle highlight backgrounds
- **White:** cards and major surfaces
- **Soft Background Gray:** page background
- **Border Gray:** subtle borders and dividers
- **Text Primary:** main text
- **Text Secondary:** secondary descriptions and placeholders

### Recommended Color Tokens

Use these tokens consistently across web and Android.

#### Brand / Action

- `primary-500: #D84A4A`
- `primary-600: #C53E3E`
- `primary-700: #A93232`
- `primary-100: #FDECEC`

#### Neutrals

- `background-page: #F8F8F9`
- `surface-card: #FFFFFF`
- `border-subtle: #E7E7EA`
- `divider: #EEEEF1`

#### Text

- `text-primary: #2B2B33`
- `text-secondary: #737380`
- `text-muted: #A3A3AD`
- `text-on-primary: #FFFFFF`

#### Feedback

- `success: #2EBD85`
- `warning: #F4B740`
- `error: #D84A4A`
- `info: #B23B3B`

### Color Usage Rules

#### Primary Red
Use for:

- primary buttons
- active tabs
- selected states
- links
- toggle active state
- focused input border
- important action highlights

Do not use primary red for large text paragraphs or large background blocks unless necessary.

#### White
Use for:

- auth cards
- section cards
- profile content containers
- form surfaces

#### Background Gray
Use for:

- app/page background
- auth page background
- non-content outer area

#### Border Gray
Use for:

- input borders
- card outlines when needed
- section separators
- subtle UI separation

#### Text Primary
Use for:

- titles
- labels
- important content
- section headers

#### Text Secondary
Use for:

- helper text
- placeholders
- descriptions
- inactive labels

### Color Restrictions

Do not:

- use random new accent colors unless required by validation/feedback
- use strong black for standard text
- use highly saturated reds, greens, or purples for decorative purposes
- create new shades ad hoc in every file

All color use must map back to shared tokens.

### Recommended Emphasis Balance

The interface should remain **mostly white and light neutral**, while **red should be used as the primary accent and action color**.

Red should communicate urgency, action, and emphasis without overwhelming the user.

---

## Typography

Typography must be simple, readable, and consistent across all screens.

### Font Style

Use a clean sans-serif appearance.

The preferred visual hierarchy is:

- strong page headings
- clear section titles
- medium-weight labels
- calm body text
- smaller helper text

### Typography Tokens

#### Page Title
Used for:

- `Sign Up`
- `Verify Your Email`
- `Complete Your Profile`
- `Profile`
- `Privacy Settings`

Style:

- size: `30px - 32px`
- weight: `700`
- color: `text-primary`

#### Section Title
Used for:

- `Account Information`
- `Medical Information`
- `Location`
- `Personal Information Visibility`

Style:

- size: `20px - 24px`
- weight: `600`
- color: `text-primary`

#### Body Text
Used for general content.

Style:

- size: `16px`
- weight: `400`
- color: `text-primary`

#### Form Label
Used above or beside inputs.

Style:

- size: `14px`
- weight: `500`
- color: `text-primary`

#### Helper Text
Used for:

- instructions
- disclaimers
- small explanations
- secondary support copy

Style:

- size: `12px - 13px`
- weight: `400`
- color: `text-secondary`

#### Button Text
Used for all major buttons.

Style:

- size: `15px - 16px`
- weight: `600`
- color: depends on button type

### Typography Rules

- Do not mix too many font sizes on the same screen.
- Do not use excessively bold text for normal content.
- Titles should stand out through size and weight, not through color experimentation.
- Use consistent line height and spacing for all forms.

---

## Spacing System

Spacing must be token-based and reused consistently.

### Spacing Tokens

- `space-2: 8px`
- `space-3: 12px`
- `space-4: 16px`
- `space-5: 20px`
- `space-6: 24px`
- `space-8: 32px`
- `space-10: 40px`
- `space-12: 48px`

### Recommended Usage

#### Small spacing
Use `8px - 12px` for:

- label to input
- icon to text
- checkbox to label
- helper text gaps

#### Medium spacing
Use `16px - 20px` for:

- input groups
- stacked buttons
- related controls within the same section

#### Large spacing
Use `24px - 32px` for:

- section separation
- card inner padding
- page content spacing

#### Extra large spacing
Use `40px - 48px` for:

- auth card top/bottom breathing room
- large content blocks
- wide page sections

### Spacing Rules

- Do not hardcode random spacing values such as 13px, 22px, 29px unless absolutely necessary.
- Prefer token spacing.
- Form sections should breathe; avoid cramped vertical rhythm.
- Use the same input gap across all forms.

---

## Border Radius

The overall UI style is soft but not overly rounded.

### Radius Tokens

- `radius-sm: 8px`
- `radius-md: 10px`
- `radius-lg: 14px`
- `radius-xl: 16px`
- `radius-pill: 999px`

### Recommended Usage

- Inputs: `10px`
- Buttons: `10px`
- Small cards: `14px`
- Main auth cards: `16px`
- Pills/toggles/chips: `999px`

### Radius Rules

- Do not mix many different radius values.
- Buttons and inputs should generally share the same radius.
- Cards can be slightly rounder than inputs.
- Avoid sharp 0-radius components unless intentionally part of navigation/dividers.

---

## Border System

Borders are subtle and should not dominate the UI.

### Border Tokens

- default border: `1px solid border-subtle`
- divider line: `1px solid divider`
- active/focus border: `1px solid primary-500`
- error border: `1px solid error`

### Border Usage Rules

Use borders for:

- inputs
- selects
- outline buttons
- section separators
- subtle card definition where needed

Avoid:

- thick borders
- dark borders for normal surfaces
- inconsistent border colors between screens

---

## Shadow System

Shadows should be soft and restrained.

### Shadow Levels

#### Shadow 1 — Card Shadow
Use for standard cards and auth containers.

Suggested effect:

- subtle blur
- low opacity
- soft, diffused elevation

#### Shadow 2 — Elevated Overlay
Use for modals or more emphasized containers only.

### Shadow Rules

- Most screens should use only one default card shadow.
- Avoid strong/dark shadows.
- Do not apply heavy shadows to every element.
- Inputs and buttons should generally not have dramatic shadow unless the design specifically calls for it.

---

## Shared Component System

All shared UI must be reusable.  
No team member should repeatedly restyle the same basic component from scratch.

### Required Shared Components

The following components must exist in a shared UI layer.

---

## 1. PrimaryButton

### Purpose
Main call-to-action button.

### Typical Usage

- Log In
- Sign Up
- Verify Email
- Save Profile
- Save Changes

### Visual Rules

- filled with `primary-500`
- text color `text-on-primary`
- radius `radius-md`
- height should be consistent across the app
- full-width in auth forms
- pressed/hover state uses darker red

### States

- default
- hover / pressed
- disabled
- loading

---

## 2. SecondaryButton / OutlineButton

### Purpose
Secondary action button.

### Typical Usage

- alternate auth action
- cancel-like secondary action
- less emphasized CTA

### Visual Rules

- white background
- `primary-500` border
- `primary-500` text
- same radius and height as PrimaryButton

### States

- default
- hover / pressed
- disabled

---

## 3. TextInput

### Purpose
Standard text field.

### Typical Usage

- email
- full name
- phone number
- address details
- medical history

### Visual Rules

- white surface
- subtle border
- radius `radius-md`
- internal horizontal padding
- placeholder uses `text-muted`
- focused border uses `primary-500`

### States

- default
- focused
- error
- disabled

### Rules

- labels should be consistent
- height should remain consistent across screens
- icon alignment must be standardized if icons are used

---

## 4. PasswordInput

### Purpose
Password-specific input.

### Visual Rules

Same as TextInput, but includes:

- eye icon or visibility toggle if implemented
- same height and padding
- same error and focus treatment

---

## 5. SelectInput / DropdownField

### Purpose
Dropdown-based selection field.

### Typical Usage

- country
- city
- neighborhood
- gender if dropdown is preferred
- date-related selectors when appropriate

### Visual Rules

- same shape and size family as TextInput
- arrow icon aligned consistently
- white surface
- subtle border
- focus state same as inputs

---

## 6. Checkbox

### Purpose
Binary consent or setting confirmation.

### Typical Usage

- terms agreement
- visibility options
- optional settings

### Rules

- checked state uses `primary-500`
- size consistent across the app
- text aligned properly with checkbox
- spacing between box and label consistent

---

## 7. ToggleSwitch

### Purpose
Binary on/off interaction.

### Typical Usage

- location sharing
- visibility settings
- privacy controls

### Visual Rules

- active state uses `primary-500`
- inactive state uses neutral soft gray
- thumb position consistent
- surrounding label/description spacing consistent

---

## 8. RadioGroup

### Purpose
Mutually exclusive option selection.

### Typical Usage

- gender
- health data visibility
- privacy choice groups

### Rules

- selected state uses primary color
- all options aligned consistently
- group spacing must be consistent across screens

---

## 9. SectionCard

### Purpose
Reusable content block for authenticated screens.

### Typical Usage

- account information
- medical information
- location section
- privacy setting section

### Visual Rules

- white background
- soft border or subtle shadow
- medium-to-large padding
- radius `radius-lg` or `radius-xl`

---

## 10. AuthCard

### Purpose
Main centered card used in authentication screens.

### Typical Usage

- welcome
- login
- sign up
- verify email

### Visual Rules

- centered container
- large white surface
- clean spacing
- top logo area
- bottom footer area optional
- subtle shadow

---

## 11. TopNavbar

### Purpose
Main navigation bar for authenticated pages.

### Typical Usage

- home
- profile
- privacy
- security
- logout

### Visual Rules

- white or light surface
- simple horizontal structure
- active tab highlighted in primary red
- not visually heavy
- enough spacing between items

### Rules

- avoid overcrowding
- keep icon usage minimal and purposeful
- logout action should be visually clear but not dominant

---

## 12. AppShell

### Purpose
Authenticated page layout wrapper.

### Typical Usage

Used in:

- profile page
- privacy page
- security page
- home page

### Rules

Should provide:

- top navigation
- consistent page padding
- constrained content width
- consistent background color

---

## 13. AuthLayout

### Purpose
Dedicated layout wrapper for auth screens.

### Typical Usage

Used in:

- welcome
- login
- sign up
- verify email

### Rules

Should provide:

- page background
- centered auth card
- logo placement
- consistent spacing and footer behavior

---

## 14. SectionHeader

### Purpose
Standard title + subtitle block inside cards/pages.

### Typical Usage

- page headers
- content card titles
- grouped form sections

### Rules

- title style must be consistent
- subtitle uses secondary text
- spacing below consistent

---

## Shared Component Naming Rule

All shared components should use standard naming and should not be duplicated with slight stylistic differences.

Do not create:

- `BlueButton`
- `MainButton`
- `HeroButton`
- `BigButton`

when one shared `PrimaryButton` is enough.

Same logic applies to inputs, cards, and layout wrappers.

---

## Auth Screen Style Rules

Auth screens must share the same structure.

### Required Structure

- page background using `background-page`
- centered `AuthCard`
- logo near the top
- main CTA buttons stacked vertically
- supporting text below
- footer links optional but non-priority

### Required Consistency

All auth screens should have:

- the same card width philosophy
- the same button width
- the same input style
- the same vertical spacing rhythm
- the same heading hierarchy

### Out of Scope for Initial Version

The following can be placeholders in the first version:

- Terms of Service page
- Privacy Policy page
- social login integration
- actual email verification backend flow
- guest mode full feature behavior

---

## Authenticated Screen Style Rules

Authenticated pages include:

- profile
- privacy
- security
- future dashboard/home

### Required Structure

- `TopNavbar`
- `AppShell`
- consistent page container
- section-based card layout

### Rules

- avoid mixing too many layout systems
- all setting pages should use section cards
- forms should be aligned cleanly
- save actions should be placed consistently

---

## Form Design Rules

These rules apply to profile, privacy, and all form-based screens.

### Labels
- labels should be visible and consistently styled
- do not rely only on placeholders

### Validation
- error state must use the shared error token
- error text should be placed consistently
- required fields should be indicated consistently

### Field Width
- fields in the same row should align visually
- avoid arbitrary width differences unless meaningful

### Buttons
- primary submit button should be easy to find
- save buttons should generally be placed consistently across similar screens

---

## Icon Usage Rules

Icons may be used, but lightly.

### Use icons for
- email
- phone
- lock/password
- location
- notification
- visibility/security where helpful

### Avoid
- excessive icon use in every section
- inconsistent icon style families
- decorative icons with no functional value

Icons should support clarity, not clutter.

---

## Interaction States

Every interactive component should account for basic states.

### Required States

- default
- hover or pressed
- focused
- disabled
- error where applicable
- loading where applicable

### Rules

- state changes must be visible but not visually aggressive
- focus state should be clearly accessible
- disabled state should remain readable

---

## Accessibility-Oriented Visual Rules

Even though this is an MVP, visual accessibility should still be considered.

### Minimum expectations

- readable contrast between text and background
- clear focused input states
- visible button labels
- touch targets large enough on mobile
- no reliance on color alone for meaning

---

## Do Not Do

The following are explicitly discouraged:

- creating custom one-off buttons in each screen
- introducing new colors without discussion
- mixing multiple card styles with different radii and shadows
- using different spacing systems across screens
- inventing different input heights across pages
- using very dark backgrounds for core pages
- using heavy gradients for standard flows
- overcrowding auth and profile screens with decorative elements

---

## Implementation Priority for Shared UI

The shared component work should be implemented in this order:

1. color tokens
2. spacing tokens
3. typography tokens
4. radius and border tokens
5. PrimaryButton
6. SecondaryButton
7. TextInput
8. PasswordInput
9. SectionCard
10. AuthLayout
11. AppShell
12. TopNavbar
13. ToggleSwitch
14. SelectInput
15. SectionHeader

---

## Final Rule

If a new screen or component is added later, it must follow this spec unless the team explicitly agrees on an update.
