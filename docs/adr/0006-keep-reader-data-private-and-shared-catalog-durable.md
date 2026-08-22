# Keep Reader data private and the shared catalog durable

A Reader's Library, Recommendations, Holding Periods, Reading Attempts, Sessions, and statistics are private unless the Reader explicitly shares a scoped aggregate, list, or item. PageTurn offers a machine-readable export before account deletion without delaying an explicit erasure request. Deletion erases the Reader's private data and unreferenced personal catalog drafts; shared catalog records used by others remain with the departed Reader's provenance anonymized, so deleting one account cannot break other Libraries.
