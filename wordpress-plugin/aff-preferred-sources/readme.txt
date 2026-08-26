=== Add to Preferred Sources (Google) ===
Requires at least: 5.8
Tested up to: 6.8
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPL-2.0-or-later

Adds Google's official "Add to Preferred Sources" badge to your site.

== Description ==

Google's Preferred Sources lets readers mark your site as one they want to see
more often in Search — Top Stories, AI Overviews and AI Mode included. This
plugin loads Google's official badge script and places the badge for you.

* Auto-inserts at the end of single posts (toggleable).
* `[preferred_source]` shortcode for manual placement anywhere.
* Optional prompt line above the badge, editable in Settings.
* Light/dark badge variants for dark page sections.
* Plain-link fallback for visitors with JavaScript disabled.

The badge is rendered by Google inside an iframe, so its own appearance can't
be restyled — only its surroundings (spacing, alignment, the prompt line).

== Installation ==

1. Plugins → Add New → Upload Plugin → choose the .zip → Install Now.
2. Activate.
3. Optional: Settings → Preferred Sources to adjust placement and wording.

== Shortcode ==

    [preferred_source]
    [preferred_source align="center"]
    [preferred_source heading="" theme="dark"]

Attributes: `align` (left|center), `heading` (text, empty hides it),
`theme` (auto|light|dark).

== Notes ==

Preferred Sources is a Google feature and its availability depends on the
reader's country and account. Where it isn't available the badge simply does
not render; nothing else on the page is affected.

== Changelog ==

= 1.0.0 =
* Initial release.
