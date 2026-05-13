import React, { useEffect, useState } from "react";
import BadgeUnlockToast from "./BadgeUnlockToast";

/**
 * Mount once in Layout. Listens for `badgeUnlocked` window events and queues
 * BadgeUnlockToast displays so multiple unlocks don't stack visually.
 */
export default function GlobalBadgeListener() {
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      const badge = e.detail?.badge;
      if (badge) setQueue((q) => [...q, badge]);
    };
    window.addEventListener("badgeUnlocked", handler);
    return () => window.removeEventListener("badgeUnlocked", handler);
  }, []);

  // Drain the queue one badge at a time.
  useEffect(() => {
    if (!active && queue.length > 0) {
      setActive(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [active, queue]);

  return <BadgeUnlockToast badge={active} onComplete={() => setActive(null)} />;
}