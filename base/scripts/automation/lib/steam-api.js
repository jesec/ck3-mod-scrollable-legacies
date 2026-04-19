// Steam API utilities
// Handles fetching release notes and other data from Steam

import https from 'https';

/**
 * Generic HTTPS fetch helper
 */
export function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Fetch Steam events for an app
 */
export async function fetchSteamEvents(appId, offset = 0, count = 10) {
  const url = `https://store.steampowered.com/events/ajaxgetpartnereventspageable?` +
    `clan_accountid=0&appid=${appId}&offset=${offset}&count=${count}&l=english`;

  const data = await fetch(url);
  return JSON.parse(data);
}

/**
 * Fetch Steam app details
 */
export async function fetchSteamAppDetails(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}`;
  const data = await fetch(url);
  return JSON.parse(data);
}

/**
 * Find a release note event by version
 * Searches through paginated Steam events to find a specific version
 */
export async function findReleaseNoteByVersion(appId, targetVersion, options = {}) {
  const {
    maxPages = 20,
    pageSize = 100
  } = options;

  // Build search variants for this version
  // For "1.10.0": try ["1.10.0", "1.10"]
  // For "1.10.1": try ["1.10.1"]
  const searchVersions = [targetVersion];
  if (targetVersion.endsWith('.0')) {
    const shortened = targetVersion.replace(/\.0$/, '');
    searchVersions.push(shortened);
  }

  const isMajorRelease = targetVersion.endsWith('.0');
  let offset = 0;

  while (offset < maxPages * pageSize) {
    const eventsData = await fetchSteamEvents(appId, offset, pageSize);

    if (!eventsData.events || eventsData.events.length === 0) {
      break;
    }

    // Try all search variants
    for (const searchVersion of searchVersions) {
      const releaseEvent = eventsData.events.find(event => {
        if (!event.event_name || !event.announcement_body?.body) return false;

        const eventName = event.event_name.toLowerCase();
        const eventBody = event.announcement_body.body.toLowerCase();
        const searchLower = searchVersion.toLowerCase();

        // Exclude dev diaries
        if (eventName.includes('dev diary') ||
            eventName.includes('developer diary') ||
            eventName.includes('dev update') ||
            eventName.includes('upcoming') ||
            eventName.includes('preview')) {
          return false;
        }

        // Check if version appears in the event name
        // Pattern ensures version is not a substring (e.g., "1.12.1" shouldn't match "1.12.2.1")
        const versionPattern = new RegExp(`\\b${searchLower.replace(/\./g, '\\.')}(?!\\.[0-9])(?:[^0-9]|$)`, 'i');
        const inTitle = versionPattern.test(eventName);

        // If version is in title, we found it
        if (inTitle) {
          // For major releases (.0 versions), exclude hotfix announcements
          if (isMajorRelease && (eventName.includes('hotfix') || eventBody.includes('hotfix'))) return false;
          return true;
        }

        // Title doesn't have version - check if this looks like a release announcement
        const hasReleaseTitle = eventName.includes('available now') ||
                                eventName.includes('out now') ||
                                eventName.includes('released');

        if (!hasReleaseTitle) return false;

        // Title looks like a release announcement - check body for version
        const inBody = versionPattern.test(eventBody);
        if (!inBody) return false;

        // Found version in body with release-like title - verify it's the main subject
        // Check that version appears near the beginning (first 500 chars)
        const bodyStart = eventBody.substring(0, 500);
        if (!versionPattern.test(bodyStart)) return false;

        // For major releases, exclude hotfixes
        if (isMajorRelease && (eventName.includes('hotfix') || eventBody.includes('hotfix'))) return false;

        return true;
      });

      if (releaseEvent) {
        // Add the GID-based URL to the event
        releaseEvent.url = `https://store.steampowered.com/news/app/${appId}/view/${releaseEvent.gid}`;
        return releaseEvent;
      }
    }

    offset += pageSize;
  }

  return null;
}
