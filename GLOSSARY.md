# PageTurn

PageTurn models a Reader's current and historical relationship with Works and Editions they own, borrow, access, or read.

## Language

**Reader**:
The person whose library and reading activity PageTurn records.
_Avoid_: User, account

**Library**:
A Reader's current and historical collection of Library Entries, including Editions they no longer hold but whose reading history they retain.
_Avoid_: Inventory, collection

**Work**:
The intellectual creation shared by all of its published forms, with its canonical title, first-publication date, authorship, and Subjects.
_Avoid_: Book

**Edition**:
A particular published volume or release containing one or more Works, with its own displayed title, language, publisher, publication date, format, Progress Unit, cover, and Edition Identifiers.
_Avoid_: Book, copy, version

**Edition Content**:
The inclusion of a Work within an Edition, recording its order and optional position range. This allows one Edition to contain several Works while each Reading Attempt still targets one Work.
_Avoid_: Contents, chapter

**Abridged**:
A classification on Edition Content indicating that material from its Work was intentionally shortened while remaining a presentation of the same Work.
_Avoid_: Adaptation, summary

**Adaptation**:
A distinct Work that materially transforms a source Work rather than presenting it in another Edition.
_Avoid_: Abridgement, edition

**Edition Identifier**:
A typed external identifier for an Edition, such as ISBN-10, ISBN-13, ASIN, OCLC, or a catalog-provider identifier. An Edition may have several, but a value is unique within its identifier namespace.
_Avoid_: ISBN, book ID

**Subject**:
A normalized classification attached to a Work, with provenance retained from its source. A Work may have multiple Subjects.
_Avoid_: Genre, tag, category

**Catalog Merge**:
The consolidation of duplicate Works, Editions, or Contributors into one canonical record. Existing references and source identifiers move to the canonical record, conflicting metadata is retained for review, and retired identifiers continue to redirect.
_Avoid_: Deletion, deduplication

**Contributor**:
A person or organization credited for part of a Work or Edition.
_Avoid_: Creator

**Contribution**:
The relationship between a Contributor and a Work or Edition, qualified by a role such as author, editor, translator, illustrator, or narrator.
_Avoid_: Authorship

**Gender**:
A demographic classification recorded for a Contributor with explicit provenance when known. Unknown remains a meaningful value, and Gender is never inferred from a Contributor's name.
_Avoid_: Sex, author sex

**Library Entry**:
A Reader's unique, enduring personal relationship with an Edition, created when they first hold or read it. It may exist without a Holding Period.
_Avoid_: Book, inventory item

**Recommendation**:
One inbound suggestion connecting a Reader to a Work, optionally identifying its source and date. A Reader may retain several Recommendations for the same Work without a Library Entry.
_Avoid_: Recommended, rating, review

**Reading Session**:
A completed, dated record of Reading Time spent on one Reading Attempt using one Edition that contains the attempt's Work. It never spans multiple Works; its first and final positions in the Edition are retained when known.
_Avoid_: Session

**Live Reading Session**:
A temporary capture of a Reading Session using an active timer rather than retrospective entry. It becomes a Reading Session when completed, and a Reader may have only one active capture at a time.
_Avoid_: Live read, timer

**Finishing Session**:
The Reading Session during which the Reader finished the associated Reading Attempt. It records the completion event; it is not the attempt's current status.
_Avoid_: Finished session, completed session

**Reading Attempt**:
One intentional effort by a Reader to read a Work, with its own status, Work Progress, and Reading Sessions across one or more Editions. It is created explicitly rather than by adding a Library Entry; a Reader has at most one unfinished Reading Attempt per Work.
_Avoid_: Read, reading

**Attempt Interval**:
The historical span from the start of a Reading Attempt until it becomes Finished or Abandoned. Corrections may add a Reading Session within this interval after termination, but later activity requires a new Reading Attempt.
_Avoid_: Reading period

**Not Started**:
A reading status for a newly created Reading Attempt with no Reading Sessions. Saving its first Reading Session changes it to Currently Reading.
_Avoid_: In progress

**Currently Reading**:
A reading status for a Reading Attempt with recorded prior progress or at least one Reading Session.
_Avoid_: In progress

**Finished**:
A terminal reading status explicitly confirming that the Reader completed a Reading Attempt. Reaching an Edition's final position may suggest Finished but never sets it automatically, and the status remains authoritative even when no Finishing Session exists.
_Avoid_: Complete, read

**Abandoned**:
A terminal reading status indicating that the Reader intentionally stopped a Reading Attempt without finishing it.
_Avoid_: Did not finish, inactive, paused

**Holding Period**:
One continuous span during which a Reader possesses or can access one copy of a Library Entry's Edition. It records how the copy is held, when the period begins and ends, any Acquisition Cost, and an optional Holding End Reason; multiple copies have overlapping Holding Periods.
_Avoid_: Ownership period, ownership history, acquisition

**Holding End Reason**:
Why a Holding Period ended, such as Sold, Gifted, Lost, Destroyed, Returned, Access Ended, or Other.
_Avoid_: Deletion reason

**Owned**:
A Holding Period type indicating that ownership of the copy belongs to the Reader.
_Avoid_: Active, available, held

**Borrowed**:
A Holding Period type indicating that the Reader temporarily possesses or can access a copy owned by someone else.
_Avoid_: Owned, rented

**Subscription Access**:
A Holding Period type indicating that access to an Edition depends on an active subscription rather than ownership or a single loan.
_Avoid_: Owned, borrowed

**Removed**:
A lifecycle outcome indicating that an Owned Holding Period ended because the Reader no longer owns that copy. Other Holding Periods may remain active, and the Library Entry and reading history remain intact.
_Avoid_: Deleted, archived

**Deletion**:
Permanent erasure of a mistaken Library Entry or fulfillment of an explicit data-erasure request. Normal disposal, return, or loss ends a Holding Period instead.
_Avoid_: Removal

**Acquisition Cost**:
The amount and currency paid to begin a Holding Period. Historical costs retain their original currencies and aggregate separately by currency unless an explicit conversion records its exchange rate and valuation date.
_Avoid_: Cost, price

**Progress Unit**:
The unit an Edition uses to express progress: Page for print and e-book Editions, and Time Position for audiobook Editions.
_Avoid_: Page count

**Edition Length**:
The optional total number of Progress Units in an Edition. An unknown Edition Length permits activity and positions but prevents Edition-derived percentages, native-unit completion speed, and finish estimates.
_Avoid_: Page count, duration

**Content Start Position**:
The first position in an Edition that the Reader considers readable or listenable content for one Reading Attempt. Earlier material advances the Reading Position but does not count as reading effort.
_Avoid_: Starting page, reading baseline

**Session Start Position**:
The first position read or heard during a Reading Session, expressed in the Edition's Progress Unit.
_Avoid_: Starting page, current page

**Session End Position**:
The final position read or heard during a Reading Session, expressed in the Edition's Progress Unit.
_Avoid_: Ending page, current page

**Reading Time**:
The wall-clock time from the start to the end of a Reading Session excluding paused intervals. A manually logged session records the Reader's best estimate of the same measure.
_Avoid_: Duration, media time, time position

**Reading Date**:
The Reader-local calendar date on which a Reading Session occurred. Live sessions may additionally retain their start and end instants and paused intervals.
_Avoid_: Created date, session timestamp

**Pages Read**:
The number of page interactions recorded as reading effort during a Reading Session. Reread pages count again; skipped pages do not.
_Avoid_: Reading position, current page

**Reading Position**:
The furthest position the Reader has reached within one Edition during a Reading Attempt, expressed in that Edition's Progress Unit and including material passed before its Content Start Position.
_Avoid_: Pages read, current page

**Work Progress**:
The furthest overall progress a Reader has confirmed through a Work during one Reading Attempt. Edition positions and corrected Sessions may suggest a review, but incompatible positions are never added and confirmed progress is never silently reduced.
_Avoid_: Reading position, pages read

**Reading Speed**:
Progress through one Edition measured in its native Progress Unit per hour of Reading Time. Cross-format summaries compare Reading Time and Work Progress change instead of combining native-unit speeds.
_Avoid_: Reading pace

**Estimated Finish**:
A forecast for an active Reading Attempt based on recent Work Progress velocity from at least two progress-bearing Reading Sessions. It is omitted when the available progress evidence is insufficient.
_Avoid_: Finish date, completion date

**Works in Library**:
The number of distinct Works represented by a Reader's Library Entries.
_Avoid_: Total books

**Editions in Library**:
The number of distinct Library Entries in a Reader's Library.
_Avoid_: Total books

**Active Holdings**:
The number of copies or access entitlements represented by Holding Periods that have not ended.
_Avoid_: Total books, books owned

**Time Position**:
An elapsed point within an audiobook Edition used to express Reading Position. It is distinct from the time a Reader actually spends listening, which may vary with playback speed.
_Avoid_: Reading time, duration

**Library Composition**:
A demographic view of the unique Works represented by a Reader's active Owned Holding Periods, grouped by Author Gender.
_Avoid_: Reading exposure

**Reading Exposure**:
A demographic view of Reading Attempts with activity during a selected period, weighted by tracked reading time and grouped by Author Gender.
_Avoid_: Library composition

**Demographic Insight**:
A private aggregate view of Library Composition or Reading Exposure intended to help a Reader reflect on their reading biases.
_Avoid_: Bias score, diversity score

**Representation Rate**:
The proportion of Works or tracked reading time featuring at least one Author in a Gender category. A multi-author Work counts fully in every represented category, so Representation Rates may overlap and need not total 100%.
_Avoid_: Gender split, demographic share

**Finished Attempts**:
The number of Reading Attempts that became Finished, including rereads of the same Work.
_Avoid_: Books finished

**Unique Works Finished**:
The number of distinct Works for which a Reader has at least one Finished Reading Attempt.
_Avoid_: Books finished

**Import Batch**:
A staged set of catalog, Library, or reading-history records that is validated and reviewed before being committed atomically. Identifier matches take precedence, while ambiguous title and Contributor matches require the Reader's resolution.
_Avoid_: Import, spreadsheet upload

**Data Export**:
A machine-readable copy of a Reader's private PageTurn data and referenced catalog identifiers. It is offered before account deletion but never delays an explicit erasure request.
_Avoid_: Backup, spreadsheet export
