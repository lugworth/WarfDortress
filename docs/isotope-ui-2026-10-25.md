# Isotope Dark and a calmer ASCII interface

The gameplay changes were already committed at `b410d09` before this pass. This update changes presentation and navigation; simulation rules and save formats remain intact.

- Restored the standard Base16 Isotope Dark colors: black background, #101010 panels, #202020 selection/borders, #d0d0d0 text, and the original neon accents. Canvas terrain colors render at their original opacity. High contrast remains an optional accessibility setting.
- Replaced the crowded status/control/utility bars with a compact header. Essential stores remain visible; Guild, Adventure, pause, save, and command search stay easy to reach. More holds trade, decrees, display, clock speed, all stores, and world controls.
- Reduced the map toolbar to depth, inspection, zoom, Fit, and Options. Labels, panning, quick orders, object lookup, landmarks, and the legend appear when Options is expanded.
- Defaulted the tool list to favorites. A category selector replaces seven category buttons. Short tool names and shortcut hints occupy a single row; descriptions and costs appear once for the selected tool. Search automatically includes all tools.
- Removed idle priority messages and duplicated map legends/status decorations. Active commissions and actionable notices still appear.
- Removed arbitrary character wrapping from buttons. Shortened action labels, moved long descriptions out of simple controls, allowed button groups to wrap as whole buttons, and kept modal Close controls reachable at enlarged text sizes.

## Verification

Browser checks used the rendered DOM and element geometry because screenshot capture was unavailable in the browser connection.

- At 1280×720 with 14px text, the compact header has eight primary controls and the map's scrollable viewport is about 530px tall. The page has no horizontal overflow. Computed default palette values are #000000 background, #d0d0d0 foreground, and #ff0099 accent.
- Command search selects the brewery; keyboard placement previews show the correct cost and rejected stair tile; Escape cancels the preview. Map Options exposes the retained quick actions and object selector.
- At 320×844 with 28px text, tested simple buttons in the full tool list, clan controls, Guild Hall, Adventure Hall, and Trade exchange have no text-width overflow. Modal Close controls remain on-screen and clickable. Controls move to additional rows as complete buttons instead of breaking words.
- At 320px with the default 14px text, the map controls, mobile navigation, and main controls fit without page-level horizontal overflow. Display settings still allow the player to choose text size and an optional high-contrast palette.

The existing 86-test suite, TypeScript, lint, and production build are run for regression coverage. No physical touch-device, gamepad, or screen-reader test is claimed.
