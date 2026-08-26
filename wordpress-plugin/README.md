# Google "Add to Preferred Sources" badge — WordPress plugin

Drop-in plugin for **aiforfreelancers.net** that shows Google's official
*Add to Preferred Sources* badge to readers.

## Install (about 60 seconds)

1. Download `aff-preferred-sources.zip` from this folder.
2. WP Admin → **Plugins → Add New → Upload Plugin** → pick the zip → **Install Now**.
3. Click **Activate**.

That's it. The badge now appears at the end of every blog post.

## Adjusting it

**Settings → Preferred Sources** controls:

| Setting | Default |
|---|---|
| Auto-insert after post content | on |
| Post types | Posts |
| Prompt line above the badge | "Enjoying this? Get more of it in your Google results." |
| Badge theme | Auto |

## Placing it by hand

Anywhere a shortcode works — page content, a block, a widget:

```
[preferred_source]
[preferred_source align="center"]
[preferred_source heading="" theme="dark"]
```

Auto-insert is skipped on any post that already contains the shortcode, so the
badge never shows twice.

In a theme template file:

```php
<?php echo do_shortcode( '[preferred_source align="center"]' ); ?>
```

## How it works

Google's `publisher.js` SDK is enqueued on the front end and looks for elements
carrying the `google-add-preferred-source-btn` attribute, rendering the badge
into each one. Clicking it adds the site to that reader's preferred sources and
returns them to where they were reading.

The badge lives in a Google-served iframe, so its own look can't be changed from
site CSS — only spacing, alignment, and the prompt line above it. A plain
`<noscript>` link to `google.com/preferences/source` covers JS-disabled visitors.

Availability of Preferred Sources depends on the reader's country and Google
account. Where it isn't available the badge simply doesn't render — nothing else
on the page is affected.
