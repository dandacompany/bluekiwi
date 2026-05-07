# BlueKiwi Design Craft Rules

Use these rules as brand-agnostic quality checks for HiFi design-system work.
They are not copied from any external skill. They are BlueKiwi's baseline for
systems that agents can generate, inspect, and apply consistently.

## Accessibility Baseline

- Every interactive component must document keyboard focus, disabled, loading,
  and error behavior where applicable.
- Text and essential UI states must meet WCAG AA contrast. If a color pair is
  risky, record a safer fallback in the token or component notes.
- Do not rely on color alone for success, warning, danger, or selected states.
- Form controls need visible labels, helper text patterns, and validation copy.

## Typography Discipline

- Use at most two primary font families plus an optional mono family.
- Body text should keep letter spacing at `0` and line height between `1.45`
  and `1.75` unless the component is intentionally dense.
- Uppercase labels require positive letter spacing, usually `0.06em` or more.
- Display text can use tighter tracking, but compact UI text should not.
- Avoid a one-size hierarchy. Define roles for display, heading, body, label,
  caption, and mono.

## Color Discipline

- Prefer semantic role tokens over raw color names.
- Define explicit usage for canvas, surface, elevated surface, ink, muted text,
  line, accent, accent text, and semantic states.
- Keep accent colors scarce. A strong accent should usually mark action,
  selection, focus, or status rather than generic decoration.
- Avoid generic AI visual defaults unless the user asks for them: indigo/purple
  gradients, blue-cyan trust gradients, glass cards, glowing blobs, and
  decorative emoji-led panels.

## Component Coverage

Each HiFi component should include:

- purpose and usage
- framework/style-system metadata
- props or inputs
- variants
- states: default, hover, focus-visible, active or selected, disabled, loading,
  and error where relevant
- implementation hints for React, HTML/CSS, Tailwind CSS, or shadcn/ui
- preview HTML/CSS when possible

If a component cannot meaningfully support one of the states, state why.

## Layout And Density

- Operational tools should be dense but scanable: restrained radius, strong
  alignment, predictable tables, and limited decorative cards.
- Marketing or narrative systems can be spacious, but the first viewport still
  needs real product/content signal.
- Dashboards and data-heavy surfaces need loading, empty, error, populated, and
  edge states for every data panel.

## Motion

- Motion should explain state, hierarchy, or spatial change. Do not add motion
  only to make the screen feel busy.
- Default durations should stay near 120-220ms for UI controls and 200-400ms
  for larger layout transitions.
- Always specify reduced-motion behavior for expressive systems.

## Agent Readability

- Exported `DESIGN.md` should be readable by an agent without opening raw JSON.
- Use examples and concrete component prompts when a rule is easy to
  misunderstand.
- Record tradeoffs. A design system is more useful when it explains why a rule
  exists and when to break it.
